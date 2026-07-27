#!/usr/bin/env python3
"""Build the transparency seal from tools/seal-source.svg.

The authored logo sets its ring wordmark on a <textPath>. Browsers render that
correctly, but nothing else does: librsvg (2.62.1, what rsvg-convert and the
icon build use) draws plain <text> and silently skips text on a path, so every
PNG came out with a bare ring. The type also asks for Georgia, which is not
installed on Linux build machines and falls back to whatever fontconfig picks -
here, a monospace face.

Both problems go away by converting the ring text to outlines. This walks each
character along the arc it was set on and emits real <path> geometry, so the
result renders identically in browsers, in librsvg, in ImageMagick, and in
whatever a printer uses, with no font dependency at all.

    python3 tools/build-seal.py

Writes website/icons/sumter-county-transparency-logo.svg (the group's own
colours) and website/icons/seal.svg (the desk palette, for use in the site
chrome). Edit tools/seal-source.svg and re-run; do not edit the outputs.
"""
import math
import re
import subprocess
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

FONT = '/usr/share/fonts/liberation/LiberationSerif-Regular.ttf'
FONT_FALLBACKS = [
    FONT,
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
    '/usr/share/fonts/dejavu/DejaVuSerif.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
]

# The group's palette, and the desk's equivalent for each. The site variant is a
# recolour only: same geometry, so the two read as one system without either
# mark losing its shape.
DESK_PALETTE = {
    '#1B3A5C': '#171a18',  # navy   -> ink
    '#C9A227': '#e55726',  # gold   -> orange
    '#F7F5EF': '#f8f4e9',  # cream  -> light
    '#2E7D8C': '#287b86',  # teal   -> blue
}


def find_font() -> Path:
    for candidate in FONT_FALLBACKS:
        if Path(candidate).exists():
            return Path(candidate)
    try:  # last resort: ask fontconfig for any serif
        out = subprocess.run(['fc-match', 'serif', '-f', '%{file}'],
                             capture_output=True, text=True, check=True).stdout.strip()
        if out and Path(out).exists():
            return Path(out)
    except Exception:
        pass
    raise SystemExit('No serif font found; install liberation-fonts or dejavu-fonts')


class Glyphs:
    """Outlines and advances for a font, in font units."""

    def __init__(self, path: Path):
        self.font = TTFont(str(path))
        self.upem = self.font['head'].unitsPerEm
        self.cmap = self.font.getBestCmap()
        self.glyphs = self.font.getGlyphSet()
        self.hmtx = self.font['hmtx']

    def name(self, char: str) -> str:
        return self.cmap.get(ord(char), '.notdef')

    def advance(self, char: str) -> float:
        return self.hmtx[self.name(char)][0]

    def outline(self, char: str) -> str:
        pen = SVGPathPen(self.glyphs)
        self.glyphs[self.name(char)].draw(pen)
        return pen.getCommands()


def arc(d: str):
    """Centre, radius, endpoint angles and direction of an SVG arc command.

    Only handles the one shape the seal uses: a semicircular arc whose two
    endpoints are a diameter apart, which makes the centre their midpoint.
    """
    numbers = [float(n) for n in re.findall(r'-?\d+\.?\d*', d)]
    x1, y1, rx, _ry, _rot, _large, sweep, x2, y2 = numbers[:9]
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    start = math.atan2(y1 - cy, x1 - cx)
    return cx, cy, rx, start, 1 if sweep else -1


def arced_text(text, d, size, spacing, fill, glyphs: Glyphs):
    """Lay `text` along arc `d`, centred, and return it as <path> elements."""
    cx, cy, radius, start, direction = arc(d)
    scale = size / glyphs.upem
    advances = [glyphs.advance(char) * scale for char in text]
    total = sum(advances) + spacing * (len(text) - 1)

    # startOffset="50%" with text-anchor="middle" centres the run on the arc's
    # midpoint, which sits a quarter turn along from the start.
    middle = start + direction * (math.pi / 2)
    cursor = -total / 2
    out = []
    for char, advance in zip(text, advances):
        if char != ' ':
            angle = middle + direction * (cursor + advance / 2) / radius
            x = cx + radius * math.cos(angle)
            y = cy + radius * math.sin(angle)
            # Baseline follows the tangent; the glyph is drawn from its own
            # origin, so step back half its width to centre it on that point.
            rotation = math.degrees(angle) + 90 * direction
            transform = (f'translate({x:.2f} {y:.2f}) rotate({rotation:.2f}) '
                         f'translate({-advance / 2:.2f} 0) scale({scale:.5f} {-scale:.5f})')
            path = glyphs.outline(char)
            if path:
                out.append(f'<path d="{path}" fill="{fill}" transform="{transform}" />')
        cursor += advance + spacing
    return '\n  '.join(out)


def build(source: str, glyphs: Glyphs) -> str:
    """Replace every <text><textPath> in the source with outlined geometry."""
    arcs = dict(re.findall(r'<path id="(\w+)" d="([^"]+)"', source))

    def replace(match):
        block = match.group(0)
        href = re.search(r'(?:xlink:)?href="#(\w+)"', block)
        content = re.search(r'>([^<]*)</textPath>', block)
        if not href or not content or href.group(1) not in arcs:
            return ''
        size = float(re.search(r'font-size="([\d.]+)"', block).group(1))
        spacing_match = re.search(r'letter-spacing="([\d.]+)"', block)
        fill = re.search(r'fill="(#[0-9A-Fa-f]+)"', block).group(1)
        return arced_text(content.group(1).strip(), arcs[href.group(1)], size,
                          float(spacing_match.group(1)) if spacing_match else 0, fill, glyphs)

    built = re.sub(r'<text\b.*?</text>', replace, source, flags=re.S)
    # The arc defs existed only to carry that text.
    built = re.sub(r'\s*<defs>.*?</defs>', '', built, flags=re.S)
    return built.replace('<!-- Arced text -->', '<!-- Ring wordmark, outlined by tools/build-seal.py -->')


def main():
    root = Path(__file__).resolve().parent.parent
    icons = root / 'website' / 'icons'
    icons.mkdir(parents=True, exist_ok=True)

    source = (root / 'tools' / 'seal-source.svg').read_text()
    glyphs = Glyphs(find_font())
    built = build(source, glyphs)

    note = ('<!-- Generated by tools/build-seal.py from tools/seal-source.svg. '
            'Edit the source, not this file. -->\n')
    (icons / 'sumter-county-transparency-logo.svg').write_text(note + built)
    print('icons/sumter-county-transparency-logo.svg written (ring text outlined)')

    desk = built
    for original, replacement in DESK_PALETTE.items():
        desk = re.sub(original, replacement, desk, flags=re.I)
    (icons / 'seal.svg').write_text(note + desk)
    print('icons/seal.svg written (desk palette)')


if __name__ == '__main__':
    main()
