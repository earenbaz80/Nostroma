"""An Anthropic client's cache_control markers are reported, and never change the prompt."""
import json
import os
import unittest
from pathlib import Path
from unittest import mock

from serve.frontend import ChatTemplate, anthropic_cache_hints, anthropic_to_messages
from serve.server import Service, cache_boundary_on, warn_cache_hints_once


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
                                                  {"STRATA_CACHE_MESSAGE_BOUNDARY": "1"}, False, None)})()
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


if __name__ == "__main__":
    unittest.main()
