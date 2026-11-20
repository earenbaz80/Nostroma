#!/usr/bin/env python3
"""Draw the brand lockups: the N mark plus the wordmark as real outlines.

The wordmark in public/brand/strata-lockup-*.svg is not text, so a font change
does not reach it. This script re-outlines the name from the app's own face so
the picture and .brand__word stay the same word:

    public/fonts/Exo2-Variable.woff2   the face, instanced at the chosen weights
    cap height 21.8px, baseline 37.75px, tracking -0.01em (what .brand__word sets)
    kerning         the pair values of the font's own kern feature
    left ink edge   x=57.62, the mark keeps its geometry and colours

Default output is three SVGs in public/brand: light, dark and high-contrast at
weight 700. Options:

    --weights 400,700      draw every theme at each weight; 700 keeps the plain
                           file name, other weights get a -<weight> suffix
    --themes light,dark    restrict the themes (default: all three)
    --check                write nothing; compare the SVGs on disk with what this
                           run would draw, and exit 1 if any differs
    --update-manifest      after writing, refresh output_sha256 and method for
                           the drawn files in public/brand/source-manifest.json
    --png                  also write brand/strata-lockup-*.png, transparent and
                           --png-scale times larger (default 4)
    --preview              also write docs/media/lockup-in-context-<theme>.png,
                           the lockup on the theme's own background
    --ink-left 60          trial offset for the wordmark; needs --out DIR, so a
                           trial never overwrites the committed assets
    --out DIR              where the SVGs go (default public/brand)

PNG bytes depend on the Pillow build, so --check compares SVGs only; images are
convenience exports, not hashed assets.

Every SVG carries a <title> for screen readers and a comment naming the face,
the weight and the fontTools release that drew it.

The path data comes from fontTools' SVGPathPen, and the way it formats numbers
can change between releases. The files in the repository were drawn with
fontTools 4.68.0 (DRAWN_WITH); when --check finds a difference it names that
version next to the one that is running, so a formatting change in fontTools is
not mistaken for a change in the lockup. The CI job in
.github/workflows/brand-lockups.yml pins that same release.

Needs fontTools and Brotli (the face ships as WOFF2), and Pillow for --png and
--preview:

    python3 apps/host/scripts/prepare-brand-lockups.py [--check]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import tempfile
from functools import lru_cache
from pathlib import Path

# Validate dependencies early with clear messages (instead of a traceback)
try:
    import fontTools
except ImportError:
    sys.stderr.write(
        "Error: fontTools is required to run this script.\n"
        "Install it with: pip install fonttools\n"
    )
    sys.exit(1)

try:
    import brotli  # noqa: F401  (fontTools needs it to decode the WOFF2 face)
except ImportError:
    sys.stderr.write(
        "Error: the Brotli Python extension is required to decode the WOFF2 face.\n"
        "Install it with: pip install brotli\n"
        "Or set PYTHONPATH to a directory containing the brotli wheel.\n"
    )
    sys.exit(1)

from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

APP = Path(__file__).resolve().parent.parent
ROOT = APP.parent.parent
BRAND = APP / "public" / "brand"
MANIFEST = BRAND / "source-manifest.json"
MEDIA = ROOT / "docs" / "media"
FONT = APP / "public" / "fonts" / "Exo2-Variable.woff2"

DRAWN_WITH = "4.68.0"      # fontTools release that drew the committed paths
WORD = "ostroma"
DEFAULT_WEIGHT = 700
CAP_HEIGHT = 21.8          # the cap height the lockup has always used
BASELINE = 37.75           # its baseline
INK_LEFT = 57.62           # where the name's leftmost ink sits
TRACKING = -10             # -0.01em in font units, as .brand__word sets it
RIGHT_PAD = 7.45           # space after the name
HEIGHT = 48
MIN_TEXT_CONTRAST = 4.5    # WCAG AA for the wordmark
MIN_GRAPHIC_CONTRAST = 3.0  # WCAG AA for the mark, which is a graphic

# the mark, in the lockup's own units: two bars and the diagonal between them
MARK = (
    '<rect x="3.556" y="8" width="8.889" height="32" rx="0" fill="{ink}" />',
    '<rect x="30.222" y="8" width="8.889" height="32" rx="0" fill="{ink}" />',
    '<polygon points="12.444,8 19.556,8 30.222,40 23.111,40" fill="{accent}" />',
)
MARK_SHAPES = (
    ("rect", (3.556, 8, 3.556 + 8.889, 40), "ink"),
    ("rect", (30.222, 8, 30.222 + 8.889, 40), "ink"),
    ("polygon", ((12.444, 8), (19.556, 8), (30.222, 40), (23.111, 40)), "accent"),
)

# ink, accent and the background each theme is drawn for: the app's own page
# colour (--st-bg in nostroma-crt.css), so the contrast figures mean something
THEMES = {
    "light": {"ink": "#2b1e0a", "accent": "#8f5200", "bg": "#f3e8d2", "line": "#d7c39b"},
    "dark": {"ink": "#ffe7c2", "accent": "#ffb000", "bg": "#0b0803", "line": "#3d2f19"},
    "high-contrast": {"ink": "#000000", "accent": "#5c3300", "bg": "#f3e8d2", "line": "#000000"},
}
DEFAULT_THEMES = tuple(THEMES)


class Contours(BasePen):
    """Collects closed contours as lists of points, flattening the curves."""

    def __init__(self, glyph_set, steps: int = 10):
        super().__init__(glyph_set)
        self.steps = steps
        self.paths: list[list[tuple[float, float]]] = []
        self._current: list[tuple[float, float]] = []

    def _moveTo(self, pt):
        self._current = [pt]

    def _lineTo(self, pt):
        self._current.append(pt)

    def _quadratic(self, p0, p1, p2):
        for step in range(1, self.steps + 1):
            t = step / self.steps
            u = 1 - t
            self._current.append(
                (
                    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
                    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
                )
            )

    def _cubic(self, p0, p1, p2, p3):
        for step in range(1, self.steps + 1):
            t = step / self.steps
            u = 1 - t
            self._current.append(
                (
                    u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
                )
            )

    def _curveToOne(self, p1, p2, p3):
        self._cubic(self._getCurrentPoint(), p1, p2, p3)

    def _qCurveToOne(self, p1, p2):
        self._quadratic(self._getCurrentPoint(), p1, p2)

    def _closePath(self):
        self._endPath()

    def _endPath(self):
        if len(self._current) > 2:
            self.paths.append(self._current)
        self._current = []


@lru_cache(maxsize=None)
def instance(weight: int) -> TTFont:
    """The face at one weight.

    The instance is saved and read back, so outlines and advances are the
    rounded integers a TrueType file stores: that is what the committed SVGs
    were drawn from, and drawing the in-memory instance directly would put
    fractional coordinates in the paths."""
    font = instantiateVariableFont(TTFont(FONT), {"wght": weight})
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


@lru_cache(maxsize=None)
def geometry(weight: int) -> tuple[float, float, float, tuple]:
    """Width, origin and per-letter paths for one weight.

    Returns (width, origin, scale, letters), where each letter is
    (x offset in font units, SVG path data, flattened contours)."""
    font = instance(weight)
    scale = CAP_HEIGHT / font["OS/2"].sCapHeight
    cmap, glyphs, hmtx = font.getBestCmap(), font.getGlyphSet(), font["hmtx"]

    names = [cmap[ord(letter)] for letter in WORD]
    letters, cursor = [], 0.0
    bounds = (float("inf"), float("-inf"))
    for index, name in enumerate(names):
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        contours = Contours(glyphs)
        glyphs[name].draw(contours)
        letters.append((cursor, pen.getCommands(), tuple(contours.paths)))
        box = BoundsPen(glyphs)
        glyphs[name].draw(box)
        if box.bounds:
            bounds = (min(bounds[0], box.bounds[0] + cursor), max(bounds[1], box.bounds[2] + cursor))
        cursor += hmtx[name][0]
        if index + 1 < len(names):
            cursor += kern(font, name, names[index + 1]) + TRACKING

    origin = INK_LEFT - bounds[0] * scale
    width = round(INK_LEFT + (bounds[1] - bounds[0]) * scale + RIGHT_PAD, 2)
    return width, origin, scale, tuple(letters)


def svg(theme: str, weight: int, ink_left: float) -> str:
    palette = THEMES[theme]
    ink, accent = palette["ink"], palette["accent"]
    width, origin, scale, letters = geometry(weight)
    if ink_left != INK_LEFT:
        origin += ink_left - INK_LEFT
        width = round(width + ink_left - INK_LEFT, 2)

    mark = "\n".join(element.format(ink=ink, accent=accent) for element in MARK)
    word = "".join(
        f'<path transform="translate({cursor:.4f} 0)" d="{data}" />'
        for cursor, data, _ in letters
    )
    note = (
        "<!-- Brand asset of Nostroma. Drawn from public/fonts/Exo2-Variable.woff2 "
        f"(weight {weight}) by apps/host/scripts/prepare-brand-lockups.py with "
        f"fontTools {DRAWN_WITH}; regenerate it rather than editing. -->"
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:g}" height="{HEIGHT}" '
        f'viewBox="0 0 {width:g} {HEIGHT}" role="img" aria-labelledby="t">\n'
        f'<title id="t">Nostroma, {theme} lockup</title>\n'
        f"{note}\n"
        f"{mark}\n"
        f'<g transform="translate({origin:.4f} {BASELINE}) scale({scale:.6f} -{scale:.6f})" '
        f'fill="{ink}">{word}</g>\n'
        "</svg>\n"
    )


def _channel(value: int) -> float:
    channel = value / 255
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def luminance(colour: str) -> float:
    red, green, blue = (int(colour[index : index + 2], 16) for index in (1, 3, 5))
    return 0.2126 * _channel(red) + 0.7152 * _channel(green) + 0.0722 * _channel(blue)


def contrast(ink: str, background: str) -> float:
    light, dark = sorted((luminance(ink), luminance(background)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


def check_contrast(theme: str) -> bool:
    """Report the theme's contrast and say whether it clears WCAG AA."""
    palette = THEMES[theme]
    text = contrast(palette["ink"], palette["bg"])
    graphic = contrast(palette["accent"], palette["bg"])
    ok = text >= MIN_TEXT_CONTRAST and graphic >= MIN_GRAPHIC_CONTRAST
    verdict = "ok" if ok else "BELOW AA"
    print(
        f"contrast {theme}: ink {text:.2f}:1 on {palette['bg']} "
        f"(needs {MIN_TEXT_CONTRAST}), accent {graphic:.2f}:1 "
        f"(needs {MIN_GRAPHIC_CONTRAST}) - {verdict}"
    )
    return ok


def shown(path: Path) -> Path:
    """The path as it reads from the repository root, for messages."""
    try:
        return path.relative_to(ROOT)
    except ValueError:
        return path


def weight_suffix(weight: int) -> str:
    return "" if weight == DEFAULT_WEIGHT else f"-{weight}"


def svg_path(out_dir: Path, theme: str, weight: int) -> Path:
    return out_dir / f"strata-lockup-{theme}{weight_suffix(weight)}.svg"


def _pillow():
    try:
        from PIL import Image, ImageChops, ImageDraw
    except ImportError:
        sys.stderr.write(
            "Error: Pillow is required for --png and --preview.\n"
            "Install it with: pip install pillow\n"
        )
        sys.exit(1)
    return Image, ImageChops, ImageDraw


def raster(theme: str, weight: int, ink_left: float, scale_factor: int):
    """The lockup as an RGBA image at scale_factor times its size."""
    Image, ImageChops, ImageDraw = _pillow()
    palette = THEMES[theme]
    width, origin, scale, letters = geometry(weight)
    if ink_left != INK_LEFT:
        origin += ink_left - INK_LEFT
        width = round(width + ink_left - INK_LEFT, 2)

    size = (round(width * scale_factor), round(HEIGHT * scale_factor))
    mask = Image.new("1", size, 0)
    for cursor, _, contours in letters:
        for contour in contours:
            layer = Image.new("1", size, 0)
            ImageDraw.Draw(layer).polygon(
                [
                    (
                        (origin + (cursor + x) * scale) * scale_factor,
                        (BASELINE - y * scale) * scale_factor,
                    )
                    for x, y in contour
                ],
                fill=1,
            )
            mask = ImageChops.logical_xor(mask, layer)

    image = Image.new("RGBA", size, (0, 0, 0, 0))
    ink = tuple(int(palette["ink"][index : index + 2], 16) for index in (1, 3, 5)) + (255,)
    image.paste(Image.new("RGBA", size, ink), (0, 0), mask)

    draw = ImageDraw.Draw(image)
    accent = tuple(int(palette["accent"][index : index + 2], 16) for index in (1, 3, 5)) + (255,)
    for shape, points, colour in MARK_SHAPES:
        fill = ink if colour == "ink" else accent
        if shape == "rect":
            x0, y0, x1, y1 = points
            draw.rectangle(
                [x0 * scale_factor, y0 * scale_factor, x1 * scale_factor, y1 * scale_factor], fill=fill
            )
        else:
            draw.polygon([(x * scale_factor, y * scale_factor) for x, y in points], fill=fill)
    return image


def preview(theme: str, weight: int, ink_left: float):
    """The lockup on its theme's background, the way a header shows it."""
    Image, _, _ = _pillow()
    palette = THEMES[theme]
    logo = raster(theme, weight, ink_left, 2)
    pad = 24
    canvas = Image.new(
        "RGBA", (logo.width + pad * 3, logo.height + pad * 2), palette["bg"] + "ff"
    )
    canvas.paste(logo, (pad, pad), logo)
    line = tuple(int(palette["line"][index : index + 2], 16) for index in (1, 3, 5)) + (255,)
    ImageDraw = _pillow()[2]
    ImageDraw.Draw(canvas).line([(0, canvas.height - 1), (canvas.width, canvas.height - 1)], fill=line)
    return canvas.convert("RGB")


def method_for(theme: str, weight: int) -> str:
    palette = THEMES[theme]
    text = (
        "mark kept 3.556/30.222 as supplied, word "
        f"'{WORD}' outlined from public/fonts/Exo2-Variable.woff2 at weight {weight} "
        "with cap height 21.8, baseline 37.75 and -0.01em tracking"
    )
    if theme == "high-contrast":
        text += f", in the high-contrast palette ({palette['ink']} on {palette['bg']})"
    return text + "; scripts/prepare-brand-lockups.py regenerates this file byte for byte"


def update_manifest(drawn: list[tuple[Path, str, int]]) -> None:
    """Point each drawn file's hash and method at what is now on disk.

    New files (a second weight, the high-contrast theme) get an entry of their
    own, with the source of the theme they were drawn from, so every row still
    says which supplied design it belongs to."""
    data = json.loads(MANIFEST.read_text())
    files = data["files"]
    by_output = {BRAND.parent / entry["output"]: entry for entry in files}

    for path, theme, weight in drawn:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        entry = by_output.get(path)
        if entry is None:
            # a variant belongs to the supplied design its theme comes from
            base_theme = "light" if theme == "high-contrast" else theme
            base = by_output.get(svg_path(BRAND, base_theme, DEFAULT_WEIGHT))
            entry = {
                "source": base["source"] if base else None,
                "source_sha256": base["source_sha256"] if base else None,
                "output": f"brand/{path.name}",
                "output_sha256": digest,
                "method": method_for(theme, weight),
            }
            files.append(entry)
            by_output[path] = entry
        else:
            entry["output_sha256"] = digest
            entry["method"] = method_for(theme, weight)

    MANIFEST.write_text(json.dumps(data, indent=2) + "\n")
    print(f"updated {MANIFEST.relative_to(APP)} ({len(drawn)} row(s))")


def needs_pillow(args: argparse.Namespace) -> None:
    if args.png or args.preview:
        _pillow()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="compare, write nothing")
    parser.add_argument("--weights", default=str(DEFAULT_WEIGHT), help="comma separated weights")
    parser.add_argument("--themes", default=",".join(DEFAULT_THEMES), help="comma separated themes")
    parser.add_argument("--out", default=str(BRAND), help="where the SVGs go")
    parser.add_argument("--ink-left", type=float, default=None, help="trial offset for the wordmark")
    parser.add_argument("--png", action="store_true", help="also write PNG copies")
    parser.add_argument("--png-scale", type=int, default=4, help="PNG size multiplier")
    parser.add_argument("--preview", action="store_true", help="also write in-context previews")
    parser.add_argument("--update-manifest", action="store_true", help="refresh source-manifest.json")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    themes = [name.strip() for name in args.themes.split(",") if name.strip()]
    weights = [int(value) for value in args.weights.split(",") if value.strip()]
    out_dir = Path(args.out)
    ink_left = INK_LEFT if args.ink_left is None else args.ink_left

    unknown = [name for name in themes if name not in THEMES]
    if unknown:
        sys.exit(f"Error: unknown theme(s): {', '.join(unknown)}. Known: {', '.join(THEMES)}")
    if ink_left != INK_LEFT and out_dir.resolve() == BRAND.resolve():
        sys.exit(
            "Error: --ink-left is a trial offset. Pass --out DIR so a trial does not\n"
            "overwrite the committed lockups in public/brand."
        )
    if not check_contrast_all(themes):
        sys.exit(1)

    needs_pillow(args)
    status = 0
    drawn: list[tuple[Path, str, int]] = []
    for weight in weights:
        for theme in themes:
            target = svg_path(out_dir, theme, weight)
            text = svg(theme, weight, ink_left)
            if args.check:
                current = target.read_text() if target.is_file() else ""
                if current == text:
                    print(f"{shown(target)}: matches")
                    continue
                drawn_note = f"fontTools {DRAWN_WITH}"
                if fontTools.version != DRAWN_WITH:
                    drawn_note += f", and this run has fontTools {fontTools.version}"
                print(
                    f"{shown(target)}: DIFFERS from the file on disk, drawn with "
                    f"{drawn_note}. SVGPathPen's number format can change between releases, "
                    "so check whether the outline changed or only its formatting before "
                    "editing the file."
                )
                status = 1
                continue

            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text)
            drawn.append((target, theme, weight))
            print(f"wrote {shown(target)} ({len(text)} bytes)")

            if args.png:
                image = raster(theme, weight, ink_left, args.png_scale)
                png = target.with_suffix(".png")
                image.save(png)
                print(f"wrote {shown(png)} ({png.stat().st_size} bytes)")

            if args.preview:
                image = preview(theme, weight, ink_left)
                shot = MEDIA / f"lockup-in-context-{theme}{weight_suffix(weight)}.png"
                shot.parent.mkdir(parents=True, exist_ok=True)
                image.save(shot)
                print(f"wrote {shown(shot)} ({shot.stat().st_size} bytes)")

    if args.update_manifest and drawn and not args.check:
        update_manifest(drawn)
    sys.exit(status)


def check_contrast_all(themes: list[str]) -> bool:
    return all([check_contrast(theme) for theme in themes])


if __name__ == "__main__":
    main()
