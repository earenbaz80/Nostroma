"""#1527: the READY-read timeout (#1317) ends the engine, and the request that was loading it must end too -
a 503 with the reason, not a connection that never answers (or a misleading 400)."""
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
import json
import urllib.request
from unittest import mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import serve.server as server                                            # noqa: E402
from serve.server import NostromaEngine, Service, ChatTemplate, ByteTokenizer, serve  # noqa: E402

# never prints READY: the READY read times out and the process is killed
SILENT = r'''
import time
time.sleep(3600)
'''

# first run answers READY + one request; after --hang is touched a restart stays silent forever
HANG_ON_RESTART = r'''
import sys, time
from pathlib import Path
hang = Path(sys.argv[sys.argv.index('--hang') + 1])
if hang.exists():
    time.sleep(3600)
print('READY 4096 stop', flush=True)
for line in sys.stdin:
    if line.startswith('QUIT'):
        break
    if line.startswith(('GEN', 'BGEN')):
        print('T 90\nDONE 1 1 0 1 stop', flush=True)
'''

# the engine's own line for a model whose download never finished, then it leaves: no retry can fix that
MISSING_SHARD = r'''
import sys
from pathlib import Path
Path(sys.argv[sys.argv.index('--starts') + 1]).open('a').write('started\n')
print('nostroma generate: --native /models/model-00001-of-00002.gguf: missing model shard '
      '/models/model-00001-of-00002.gguf (shard 1 of 2; is the download complete?)', file=sys.stderr, flush=True)
sys.exit(1)
'''


def write_script(root: Path, name: str, code: str) -> str:
    py = root / (name + '.py')
    if os.name == 'nt':
        py.write_text(code); script = root / (name + '.cmd')
        script.write_text(f'@"{sys.executable}" "{py}" %*\r\n')
    else:
        script = py; py.write_text('#!' + sys.executable + '\n' + code); py.chmod(0o700)
    return str(script)


@unittest.skipIf(os.name == "nt", "the .cmd wrapper keeps the pipe open after the kill (only the wrapper dies), so the "
                                  "close of its stdout waits for the sleeping child; a real engine is one process")
class ReadyTimeout(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self._patchers = [mock.patch.object(server, 'ENGINE_READY_S', 0.5),
                          mock.patch.object(NostromaEngine, 'RESTART_RETRY_S', 0.0)]
        for p in self._patchers:
            p.start(); self.addCleanup(p.stop)

    def make_script(self, name, code):
        return write_script(self.root, name, code)

    def service(self, script, extra_args=()):
        eng = NostromaEngine(script, list(extra_args), lazy=True)
        self.addCleanup(eng.close)
        return Service(eng, ByteTokenizer(), ChatTemplate(Path(__file__).parent / 'chat_template.jinja'))

    def post(self, base):
        body = {'messages': [{'role': 'user', 'content': 'hi'}], 'max_tokens': 8}
        req = urllib.request.Request(base + '/v1/chat/completions', data=json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read()

    def assert503(self, base):
        t0 = time.monotonic()
        try:
            self.post(base)
            self.fail('a request on an engine that never reports READY must not succeed')
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 503)
            body = e.read().decode()
            self.assertIn('did not report READY', body)
            self.assertIn('next request restarts it', body)
        self.assertLess(time.monotonic() - t0, 60)

    def test_ready_timeout_on_lazy_load_answers_the_request(self):
        # lazy start: restart()'s own bookkeeping must not crash on the missing slot_cv either (#1527)
        svc = self.service(self.make_script('silent', SILENT))
        httpd = serve(svc, port=0)
        self.addCleanup(httpd.shutdown); self.addCleanup(httpd.server_close)
        base = f'http://127.0.0.1:{httpd.server_address[1]}'
        self.assert503(base)
        self.assertFalse(svc.engine.starting)

    def test_ready_timeout_on_restart_answers_the_request(self):
        # the reporter's case: the engine had answered once, then a restart hangs on the READY read
        hang = self.root / 'hang'
        svc = self.service(self.make_script('hang_on_restart', HANG_ON_RESTART), ('--hang', str(hang)))
        httpd = serve(svc, port=0)
        self.addCleanup(httpd.shutdown); self.addCleanup(httpd.server_close)
        base = f'http://127.0.0.1:{httpd.server_address[1]}'
        status, _ = self.post(base)                              # first request: the engine works
        self.assertEqual(status, 200)
        svc.engine.proc.kill(); svc.engine.proc.wait(10)         # it dies between requests
        hang.touch()                                             # and its restart never reports READY
        self.assert503(base)
        self.assertFalse(svc.engine.starting)


class MissingModelFiles(unittest.TestCase):
    """A model whose files are incomplete cannot start however often it is tried: the request answers at once with
    the engine's own line and what to do, instead of waiting through restart()'s three tries (a client saw no bytes
    for half a minute and gave up)."""

    def test_a_missing_shard_answers_at_once_and_says_what_to_do(self):
        tmp = tempfile.TemporaryDirectory(); self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        starts = root / 'starts'
        eng = NostromaEngine(write_script(root, 'missing_shard', MISSING_SHARD), ['--starts', str(starts)],
                             log=str(root / 'engine.log'), lazy=True)
        self.addCleanup(eng.close)
        svc = Service(eng, ByteTokenizer(), ChatTemplate(Path(__file__).parent / 'chat_template.jinja'))
        httpd = serve(svc, port=0)
        self.addCleanup(httpd.shutdown); self.addCleanup(httpd.server_close)
        base = f'http://127.0.0.1:{httpd.server_address[1]}'
        req = urllib.request.Request(base + '/v1/chat/completions',
                                     data=json.dumps({'messages': [{'role': 'user', 'content': 'hi'}],
                                                      'max_tokens': 8}).encode(),
                                     headers={'Content-Type': 'application/json'})
        with mock.patch.object(NostromaEngine, 'RESTART_RETRY_S', 10.0):   # a retry would be slow enough to see
            started = time.monotonic()
            with self.assertRaises(urllib.error.HTTPError) as cm:
                urllib.request.urlopen(req, timeout=30)
            elapsed = time.monotonic() - started
        self.assertEqual(cm.exception.code, 503)
        said = cm.exception.read().decode()
        self.assertIn('missing model shard', said)
        self.assertIn('Download the model again', said)
        self.assertNotIn('the next request restarts it', said, 'the files will not be there on the next try')
        self.assertLess(elapsed, 5, 'the request waited through restart() retries')
        self.assertEqual(starts.read_text().count('started'), 1, 'the engine was started more than once')


class SpawnFailure(unittest.TestCase):
    """The engine program cannot be started at all (missing, not executable, or blocked by Windows - #735): the
    request that was loading it gets a 503 with the reason, not a dropped connection."""
    BODIES = {'/v1/chat/completions': {'messages': [{'role': 'user', 'content': 'hi'}], 'max_tokens': 8},
              '/v1/messages': {'model': 'nostroma', 'max_tokens': 8, 'messages': [{'role': 'user', 'content': 'hi'}]},
              '/v1/responses': {'input': 'hi', 'max_output_tokens': 8}}

    def test_missing_engine_answers_503_and_leaves_nothing_running(self):
        tmp = tempfile.TemporaryDirectory(); self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        eng = NostromaEngine(str(root / 'no-such-engine'), [], log=str(root / 'engine.log'), lazy=True)
        svc = Service(eng, ByteTokenizer(), ChatTemplate(Path(__file__).parent / 'chat_template.jinja'))
        httpd = serve(svc, port=0)
        self.addCleanup(httpd.shutdown); self.addCleanup(httpd.server_close)
        base = f'http://127.0.0.1:{httpd.server_address[1]}'
        before = set(threading.enumerate())
        cases = list(self.BODIES.items()) + [('/v1/chat/completions',
                                              {**self.BODIES['/v1/chat/completions'], 'stream': True})]
        for path, body in cases:
            with self.subTest(path=path, stream=body.get('stream', False)):
                req = urllib.request.Request(base + path, data=json.dumps(body).encode(),
                                             headers={'Content-Type': 'application/json'})
                with self.assertRaises(urllib.error.HTTPError) as cm:
                    urllib.request.urlopen(req, timeout=30)
                self.assertEqual(cm.exception.code, 503)
                self.assertIn('the engine could not be started', cm.exception.read().decode())
                self.assertTrue(eng.log.closed)                 # our handle on the engine log is given back
        # the start narrator ("still starting ... please wait") ends with the failed start
        deadline = time.monotonic() + 5
        while (narrators := [t for t in set(threading.enumerate()) - before if '(narrate_start)' in t.name]) \
                and time.monotonic() < deadline:
            time.sleep(0.1)
        self.assertEqual(narrators, [])


if __name__ == '__main__':
    unittest.main()
