"""The monitor's and the launch screens' header line fits the terminal, in the widths a person actually uses.

The product name is two characters longer than the old one, so the room the header keeps for itself before the
connection's address moved with it (`render.HEADER_ROOM`). These tests hold what a reader can see: no row is wider
than the window, the state marker is never the part that gets cut, and the header still names the product and the
computer it is on. They read the room from the code rather than repeating the number, and they do not measure the
spaces between the pieces: how the line is laid out inside the room is free to change.
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

MARKER = "[FROZEN/NO METRICS]"       # the longest marker the monitor draws


def snapshot() -> dict:
    return {"source": "fixture", "sampled_at": time.time(), "model": {"id": "IQ3_S", "loaded": True},
            "work": {}, "rates": {}, "devices": [], "recent": [], "totals": {}, "topology": {},
            "quality": {}, "instance": {"id": "x"}}


class MonitorHeader(unittest.TestCase):
    def head(self, width, url="http://192.168.88.21:8080", state=None):
        rows = render.render_view(snapshot(), "overview", width, 24, connection=url,
                                  connection_state=state, frozen=state is not None).splitlines()
        self.assertTrue(all(len(row) <= width for row in rows),
                        f"{width}: a row is wider than the window: {max(len(r) for r in rows)}")
        return rows[0]

    def test_the_classic_monitor_header_fits_and_keeps_its_marker(self):
        for width in (30, 40, 48, 60, 80, 100, 120):
            head = self.head(width)
            self.assertTrue(head.startswith("NOSTROMA"), f"{width}: {head!r}")
            self.assertIn("Overview", head)
            self.assertTrue(head.endswith("[LIVE]"), f"{width}: the state marker was cut: {head!r}")

    def test_the_room_holds_the_header_and_moves_with_the_name(self):
        # The room is the name, the view's title and the marker before the address gets a single column. A longer
        # name has to move it: 0.2.15 reserved 42 for its six letters, and NOSTROMA is two letters longer. This is
        # the one number the test knows, and it knows it as a difference from the old name, not as the room itself.
        OLD_NAME, OLD_ROOM = "STRATA", 42
        room = render.HEADER_ROOM

        base = self.head(room, state="telemetry_unavailable")
        self.assertLessEqual(len(base), room, f"the room must hold the header: {base!r}")
        self.assertTrue(base.endswith(MARKER), f"the longest marker is cut inside the room: {base!r}")
        self.assertNotIn("http", base, f"the room left columns for the address: {base!r}")
        name = base.split()[0]
        self.assertEqual(room, OLD_ROOM + (len(name) - len(OLD_NAME)),
                         f"the header draws {name!r} ({len(name)} letters), so its room is "
                         f"{OLD_ROOM + len(name) - len(OLD_NAME)}, not {room}")

        for width in (room, 60, 80, 120):        # from the room on, the marker is whole at every width
            line = self.head(width, state="telemetry_unavailable")
            self.assertTrue(line.endswith(MARKER), f"{width}: the marker was cut: {line!r}")
        self.assertIn("http://192.168.88.21:8080", self.head(120, state="telemetry_unavailable"),
                      "a wide terminal shows the whole address")


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
