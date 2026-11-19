#!/usr/bin/env python3
"""Draw the two brand lockups: the N mark plus "Nostroma" as real outlines.

The wordmark in public/brand/strata-lockup-{light,dark}.svg is not text, so a
font change does not reach it. This script re-outlines the name from the app's
own face so the picture and .brand__word stay the same word:

    public/fonts/Exo2-Variable.woff2   the face, at its 700 instance
    cap height 21.8px, baseline 37.75px, tracking -0.01em (what .brand__word sets)
    kerning         the pair values of the font's own kern feature
    left ink edge   x=57.62, the mark keeps its geometry and colours

Writes both files and prints their sizes. `--check` writes nothing and exits 1
if a file on disk differs from what this script would produce, which is what the
hashes in public/brand/source-manifest.json were taken from.

The path data comes from fontTools' SVGPathPen, and the way it formats numbers
can change between releases. The files in the repository were drawn with
fontTools 4.68.0 (DRAWN_WITH); when --check finds a difference it names that
version next to the one that is running, so a formatting change in fontTools is
not mistaken for a change in the lockup.

Needs fontTools, and Brotli because the face is stored as WOFF2:

    python3 apps/host/scripts/prepare-brand-lockups.py [--check]
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import fontTools
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

APP = Path(__file__).resolve().parent.parent
BRAND = APP / "public" / "brand"
FONT = APP / "public" / "fonts" / "Exo2-Variable.woff2"

DRAWN_WITH = "4.68.0"      # fontTools release that drew the committed paths
WORD = "Nostroma"
WEIGHT = 700
CAP_HEIGHT = 21.8          # the cap height the lockup has always used
BASELINE = 37.75           # its baseline
INK_LEFT = 57.62           # where the name's leftmost ink sits
TRACKING = -10             # -0.01em in font units, as .brand__word sets it
RIGHT_PAD = 7.45           # space after the name
HEIGHT = 48

# the mark, in the lockup's own units: two bars and the diagonal between them
MARK = (
    '<rect x="3.556" y="8" width="8.889" height="32" rx="0" fill="{ink}" />',
    '<rect x="30.222" y="8" width="8.889" height="32" rx="0" fill="{ink}" />',
    '<polygon points="12.444,8 19.556,8 30.222,40 23.111,40" fill="{accent}" />',
)
THEMES = {"light": ("#2b1e0a", "#8f5200"), "dark": ("#ffe7c2", "#ffb000")}


def instance() -> TTFont:
    """The face at the weight the lockup uses.

    The instance is saved and read back, so outlines and advances are the
    rounded integers a TrueType file stores: that is what the committed SVGs
    were drawn from, and drawing the in-memory instance directly would put
    fractional coordinates in the paths."""
    font = instantiateVariableFont(TTFont(FONT), {"wght": WEIGHT})
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "instance.ttf"
        font.save(path)
        return TTFont(path)


def kern(font: TTFont, left: str, right: str) -> int:
    """The font's kern value for one pair, from GPOS lookup type 2."""
    gpos = font["GPOS"].table
    lookups = {
        index
        for feature in gpos.FeatureList.FeatureRecord
        if feature.FeatureTag == "kern"
        for index in feature.Feature.LookupListIndex
    }
    for index in sorted(lookups):
        lookup = gpos.LookupList.Lookup[index]
        if lookup.LookupType != 2:
            continue
        for subtable in lookup.SubTable:
            if left not in subtable.Coverage.glyphs:
                continue
            value = None
            if subtable.Format == 1:
                row = subtable.PairSet[subtable.Coverage.glyphs.index(left)]
                value = next((p.Value1 for p in row.PairValueRecord if p.SecondGlyph == right), None)
                if value is None:
                    continue
            elif subtable.Format == 2:
                first = subtable.ClassDef1.classDefs.get(left, 0)
                second = subtable.ClassDef2.classDefs.get(right, 0)
                value = subtable.Class1Record[first].Class2Record[second].Value1
            return (value.XAdvance or 0) if value else 0
    return 0


def lockup(theme: str) -> str:
    ink, accent = THEMES[theme]
    font = instance()
    scale = CAP_HEIGHT / font["OS/2"].sCapHeight
    cmap, glyphs, hmtx = font.getBestCmap(), font.getGlyphSet(), font["hmtx"]

    names = [cmap[ord(letter)] for letter in WORD]
    paths, cursor = [], 0.0
    bounds = (float("inf"), float("-inf"))
    for index, name in enumerate(names):
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        paths.append(f'<path transform="translate({cursor:.4f} 0)" d="{pen.getCommands()}" />')
        box = BoundsPen(glyphs)
        glyphs[name].draw(box)
        if box.bounds:
            bounds = (min(bounds[0], box.bounds[0] + cursor), max(bounds[1], box.bounds[2] + cursor))
        cursor += hmtx[name][0]
        if index + 1 < len(names):
            cursor += kern(font, name, names[index + 1]) + TRACKING

    origin = INK_LEFT - bounds[0] * scale
    width = round(INK_LEFT + (bounds[1] - bounds[0]) * scale + RIGHT_PAD, 2)
    mark = "\n".join(element.format(ink=ink, accent=accent) for element in MARK)
    word = "".join(paths)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:g}" height="{HEIGHT}" '
        f'viewBox="0 0 {width:g} {HEIGHT}" role="img">\n'
        f"{mark}\n"
        f'<g transform="translate({origin:.4f} {BASELINE}) scale({scale:.6f} -{scale:.6f})" '
        f'fill="{ink}">{word}</g>\n'
        "</svg>\n"
    )


def main() -> None:
    check = "--check" in sys.argv[1:]
    status = 0
    for theme in THEMES:
        target = BRAND / f"strata-lockup-{theme}.svg"
        text = lockup(theme)
        if check:
            current = target.read_text() if target.is_file() else ""
            if current == text:
                print(f"{target.relative_to(APP)}: matches")
            else:
                drawn = f"fontTools {DRAWN_WITH}"
                if fontTools.version != DRAWN_WITH:
                    drawn += f", and this run has fontTools {fontTools.version}"
                print(
                    f"{target.relative_to(APP)}: DIFFERS from the file on disk, drawn with {drawn}. "
                    "SVGPathPen's number format can change between releases, so check whether the "
                    "outline changed or only its formatting before editing the file."
                )
                status = 1
        else:
            target.write_text(text)
            print(f"wrote {target.relative_to(APP)} ({len(text)} bytes)")
    sys.exit(status)


if __name__ == "__main__":
    main()
