"""An Anthropic client's cache_control markers are reported, and never change the prompt."""
import http.client
import json
import os
import unittest
from pathlib import Path
from unittest import mock

from serve.frontend import ChatTemplate, anthropic_cache_hints, anthropic_to_messages
from serve.server import ByteTokenizer, MockEngine, Service, cache_boundary_on, serve, warn_cache_hints_once


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ChatTemplate(Path(__file__).with_name("chat_template.jinja"))


def claude_code_request():
    """A Claude Code turn: cache points on the system, on a tool and on the last message."""
    return {
        "model": "nostroma",
        "max_tokens": 512,
        "system": [{"type": "text", "text": "You are Claude Code.",
                    "cache_control": {"type": "ephemeral"}}],
        "tools": [{"name": "Read", "description": "Read a file.",
                   "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}},
                   "cache_control": {"type": "ephemeral", "ttl": "1h"}}],
        "messages": [
            {"role": "user", "content": [{"type": "text", "text": "First question."}]},
            {"role": "assistant", "content": [{"type": "text", "text": "First answer."}]},
            {"role": "user", "content": [{"type": "text", "text": "Fix the failing test.",
                                          "cache_control": {"type": "ephemeral"}}]},
        ],
    }


def without_markers(value):
    """The same request with every cache_control removed: what the prompt must not depend on."""
    if isinstance(value, dict):
        return {k: without_markers(v) for k, v in value.items() if k != "cache_control"}
    if isinstance(value, list):
        return [without_markers(v) for v in value]
    return value


class CacheHints(unittest.TestCase):
    def test_marks_are_counted_where_the_client_put_them(self):
        hints = anthropic_cache_hints(claude_code_request())
        self.assertEqual(hints["marks"], 3)
        self.assertEqual(hints["by_block"], {"system": 1, "messages": 1, "tools": 1})
        self.assertEqual(hints["last_marked_message"], 2)
        self.assertTrue(hints["at_last_message"])
        self.assertEqual(hints["ttl"], ["1h"])

    def test_a_request_without_markers_says_nothing(self):
        self.assertEqual(anthropic_cache_hints(without_markers(claude_code_request())), {"marks": 0})
        self.assertEqual(anthropic_cache_hints({}), {"marks": 0})

    def test_the_rendered_prompt_is_byte_identical(self):
        marked = anthropic_to_messages(claude_code_request())
        plain = anthropic_to_messages(without_markers(claude_code_request()))
        self.assertEqual(json.dumps(marked, sort_keys=True), json.dumps(plain, sort_keys=True))
        self.assertEqual(TEMPLATE.render(marked[0], marked[1], **marked[2]),
                         TEMPLATE.render(plain[0], plain[1], **plain[2]))


class _Service:
    engine = None
    cache_hints = None
    cache_hints_requests = 0
    cache_hints_marks = 0


class CacheHintsMetrics(unittest.TestCase):
    def test_counts_and_the_last_summary_reach_metrics(self):
        svc = _Service()
        with mock.patch.dict(os.environ, clear=True), mock.patch("builtins.print"):
            Service.note_cache_hints(svc, {"marks": 2, "by_block": {"messages": 2}})
            Service.note_cache_hints(svc, {"marks": 0})          # a turn with no markers is not a cache request
        self.assertEqual((svc.cache_hints_requests, svc.cache_hints_marks), (1, 2))
        self.assertEqual(svc.cache_hints["marks"], 2)
        self.assertEqual(Service.cache_hints_view(svc),
                         {"requests": 1, "marks_total": 2, "boundary": "off",
                          "last": {"marks": 2, "by_block": {"messages": 2}}})

    def test_boundary_on_is_reported_from_the_engine_environment(self):
        svc = _Service()
        svc.engine = type("Engine", (), {"spawn": (None, [], None, None,
                                                  {"NOSTROMA_CACHE_MESSAGE_BOUNDARY": "1"}, False, None)})()
        self.assertTrue(cache_boundary_on(svc))
        self.assertEqual(Service.cache_hints_view(svc)["boundary"], "on")

    def test_the_warning_is_one_line_per_process(self):
        with mock.patch.dict(os.environ, clear=True), \
                mock.patch("serve.server._CACHE_HINTS_WARNED", False), \
                mock.patch("builtins.print") as printed:
            warn_cache_hints_once()
            warn_cache_hints_once()
        self.assertEqual(printed.call_count, 1)
        self.assertIn("--cache-boundary on", printed.call_args[0][0])


class CacheHintsInHistory(unittest.TestCase):
    """Each /metrics record keeps the marks of its own turn, so a cached turn can be read against its cost."""

    @classmethod
    def setUpClass(cls):
        tok = ByteTokenizer()
        cls.svc = Service(MockEngine(tok, "hello from the mock", max_context=4096), tok,
                          ChatTemplate(ROOT / "serve/chat_template.jinja"))
        cls.httpd = serve(cls.svc, port=0)
        cls.port = cls.httpd.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def _get(self, method, path, body=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=20)
        try:
            connection.request(method, path, body=json.dumps(body).encode() if body is not None else None,
                               headers={"Content-Type": "application/json"} if body is not None else {})
            return json.loads(connection.getresponse().read() or b"{}")
        finally:
            connection.close()

    def test_a_record_carries_only_its_own_marks(self):
        with mock.patch("builtins.print"):
            self._get("POST", "/v1/messages", claude_code_request())
            self._get("POST", "/v1/messages", without_markers(claude_code_request()))
        records = self._get("GET", "/metrics")["requests"]
        self.assertNotIn("cache_hints", records[0])          # the turn without marks keeps none from the one before
        self.assertEqual(records[1]["cache_hints"]["marks"], 3)
        self.assertEqual(records[1]["cache_hints"]["by_block"], {"system": 1, "messages": 1, "tools": 1})
        self.assertTrue(records[1]["cache_hints"]["at_last_message"])
        # the cost of that same turn is beside its marks
        self.assertIn("prompt_tokens", records[1])
        self.assertIn("output_tokens", records[1])


if __name__ == "__main__":
    unittest.main()
