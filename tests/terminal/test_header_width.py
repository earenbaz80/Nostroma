"""The monitor's and the launch screens' header line fits the terminal, in the widths a person actually uses.

The product name is two characters longer than the old one, so the room the header reserves for the rest of the line
moved with it (render.py's `width - 44`, screens.py's gap from `len("NOSTROMA  Launch")`). These tests hold that
budget: no row is wider than the window, the state marker is never the part that gets cut, and the header still names
the screen in a 46-column window.
"""
from __future__ import annotations

import asyncio
import time
import unittest

from nostroma_cli import render
from nostroma_cli.launch import settings as S, store
from nostroma_cli.launch.app import Ctx, LaunchApp
from nostroma_cli.launch.widgets import Glyphs
from tests.terminal.launch_support import HW_12, Home, catalog


def snapshot() -> dict:
    return {"source": "fixture", "sampled_at": time.time(), "model": {"id": "IQ3_S", "loaded": True},
            "work": {}, "rates": {}, "devices": [], "recent": [], "totals": {}, "topology": {},
            "quality": {}, "instance": {"id": "x"}}


class MonitorHeader(unittest.TestCase):
    def test_the_classic_monitor_header_fits_and_keeps_its_marker(self):
        for width in (30, 40, 48, 60, 80, 100, 120):
            rows = render.render_view(snapshot(), "overview", width, 24, connection="http://192.168.88.21:8080").splitlines()
            head = rows[0]
            self.assertTrue(all(len(row) <= max(width, 30) for row in rows),
                            f"{width}: a row is wider than the window: {max(len(r) for r in rows)}")
            self.assertTrue(head.startswith("NOSTROMA"), f"{width}: {head!r}")
            self.assertIn("Overview", head)
            self.assertTrue(head.endswith("[LIVE]"), f"{width}: the state marker was cut: {head!r}")

    def test_the_longest_marker_sets_the_room_and_one_column_per_extra_one_goes_to_the_address(self):
        # "[FROZEN/NO METRICS]" is the longest marker the monitor draws, so the header with it and no address is the
        # room the line needs before the connection: the name, the view and the marker. From there every column of
        # window goes to the address and nothing else, and the two columns the longer name took are why the budget is
        # `width - 44`: with 42 the same terminal would show two more characters of address than 0.2.15 did, and the
        # header would grow into the slack that keeps it off the edge.
        def head(width):
            rows = render.render_view(snapshot(), "overview", width, 24, connection="http://192.168.88.21:8080",
                                      connection_state="telemetry_unavailable", frozen=True).splitlines()
            self.assertTrue(all(len(row) <= width for row in rows), f"{width}: wider than the window")
            return rows[0]

        url = "http://192.168.88.21:8080"
        base = head(44)                                                # 44 columns: the room, and not one for the address
        self.assertTrue(base.endswith("[FROZEN/NO METRICS]"), base)     # the longest marker fits that room whole
        self.assertLessEqual(len(base), 44)
        self.assertNotIn("http", base)
        for width in (48, 60, 80, 120):
            line = head(width)
            self.assertTrue(line.endswith("[FROZEN/NO METRICS]"), f"{width}: the marker was cut: {line!r}")
        # every column past the room is the address's, so at 48 the address has exactly the four characters that fit
        self.assertEqual(len(head(48)) - len(base), 4, head(48))
        self.assertNotIn("http:", head(48), "the budget left room for more than it should")
        self.assertIn(url, head(44 + len(url)), "the whole address is shown once the terminal is that wide")
        self.assertEqual(len(head(44 + len(url))), len(base) + len(url), head(44 + len(url)))
        # the room the fixed part needs is exactly the width where the whole header lands, marker and all: one column
        # less and the marker is what gets cut, so a longer name has to come with a budget that moved with it
        self.assertTrue(head(41).endswith("[FROZEN/NO METRICS]"), head(41))
        self.assertEqual(len(head(41)), 41, head(41))
        self.assertFalse(head(40).endswith("[FROZEN/NO METRICS]"), "40 columns cannot hold the fixed part")
        for width in (30, 36, 40):                                      # narrower than it needs: cut, never wider
            self.assertTrue(head(width))

    def test_a_long_connection_gives_room_up_instead_of_pushing_the_marker_out(self):
        long_url = "http://a-very-long-host-name.example.internal:8080"
        head = render.render_view(snapshot(), "overview", 48, 24, connection=long_url).splitlines()[0]
        self.assertLessEqual(len(head), 48)
        self.assertNotIn(long_url, head)           # shortened, not spilled
        self.assertTrue(head.endswith("[LIVE]"))


class LaunchHeader(unittest.TestCase):
    def go(self, width, height):
        async def run():
            cat = catalog(HW_12)
            comp = cat.computer()
            ctx = Ctx(catalog=cat, computer=comp, rows=cat.rows(comp.raw), settings=S.LaunchSettings(), glyphs=Glyphs(True))
            app = LaunchApp(ctx)
            async with app.run_test(size=(width, height)) as pilot:
                await pilot.pause(0.3)
                return [s.text.rstrip() for s in app.screen._compositor.render_strips()]
        return asyncio.run(run())

    def test_the_launch_header_fits_a_small_terminal(self):
        with Home():
            store.save(S.LaunchSettings(name="Demo", family="qwen", model="IQ3_XXS", context=131072))
            for width, height in ((110, 34), (80, 24), (60, 20), (46, 16)):
                rows = self.go(width, height)
                head = next(row for row in rows if row.strip())
                self.assertTrue(all(len(row) <= width for row in rows),
                                f"{width}x{height}: a row is wider than the window: {max(len(r) for r in rows)}")
                self.assertIn("NOSTROMA  Launch", head, f"{width}x{height}: {head!r}")
                self.assertIn("RTX 5070", head, f"{width}x{height}: the computer's line was lost: {head!r}")


if __name__ == "__main__":
    unittest.main()
