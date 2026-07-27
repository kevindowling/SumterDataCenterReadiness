#!/usr/bin/env python3
"""Build the 1200x630 link-preview image shared to Facebook, iMessage and Slack.

The site icon is a square parcel outline. It is the wrong shape for a link
preview: scrapers crop to a wide card, so a square logo is letterboxed or
cut. This draws a purpose-made card at the ratio those cards actually use,
reusing the palette in website/styles.css and the parcel outline from
website/favicon.svg so the preview matches the site it links to.

    python3 tools/build-preview-image.py

Writes website/icons/preview.svg and website/icons/preview.png. PNG output
needs rsvg-convert (librsvg); the SVG alone is written if it is missing.
"""
import re
import shutil
import subprocess
from pathlib import Path

WIDTH, HEIGHT = 1200, 630

# Matches the custom properties in website/styles.css.
INK = '#171a18'
LIGHT = '#f8f4e9'
ORANGE = '#e55726'
MUTED = '#8a8b83'

# The web fonts are not installed on build machines, so name the families that
# are and let the card render the same way everywhere rather than depending on
# whatever the local fontconfig happens to resolve.
SERIF = 'Liberation Serif, DejaVu Serif, Times New Roman, serif'
MONO = 'Liberation Sans, DejaVu Sans, Helvetica, sans-serif'

HEADLINE = 'Data center research'
SUBHEAD = 'for Americus, Georgia'
KICKER = 'SUMTER FIELD DESK'
FOOTER = 'Water · Noise · Air · Electricity · Public cost'
DOMAIN = 'scc4t.com'


LOGO = 'sumter-county-transparency-logo.svg'


def logo_body(icons: Path) -> str:
    """The seal's artwork, minus its arced wordmark.

    Two reasons the ring text is dropped rather than kept. It is set on a
    <textPath>, which librsvg does not render at all (2.62.1 draws plain <text>
    and silently skips text on a path), so it would be missing from the PNG
    either way. And at the size the seal appears here it would be about 15px
    on a curve - unreadable, and competing with the card's own type.
    """
    source = icons / LOGO
    if not source.exists():
        return ''
    inner = re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', source.read_text(), flags=re.S)
    return re.sub(r'<text\b.*?</text>', '', inner, flags=re.S)


def svg_document(logo: str) -> str:
    # The seal is authored in a 500-unit square; drop it on the right at 310px
    # across, vertically centred.
    mark = f'<g transform="translate(800 160) scale(0.62)">{logo}</g>' if logo else ''

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">
  <rect width="{WIDTH}" height="{HEIGHT}" fill="{INK}" />
  {mark}
  <g font-family="{SERIF}" fill="{LIGHT}">
    <text x="80" y="296" font-size="72" font-weight="700" letter-spacing="-1.5">{HEADLINE}</text>
    <text x="80" y="374" font-size="72" font-weight="700" letter-spacing="-1.5">{SUBHEAD}</text>
  </g>
  <g font-family="{MONO}">
    <text x="80" y="122" font-size="24" font-weight="700" letter-spacing="7" fill="{ORANGE}">{KICKER}</text>
    <text x="80" y="470" font-size="22" fill="{MUTED}">{FOOTER}</text>
    <text x="80" y="524" font-size="22" font-weight="700" fill="{LIGHT}">{DOMAIN}</text>
  </g>
  <rect x="0" y="{HEIGHT - 14}" width="300" height="14" fill="{ORANGE}" />
</svg>
'''


def main():
    website = Path(__file__).resolve().parent.parent / 'website'
    icons = website / 'icons'
    icons.mkdir(exist_ok=True)

    source = icons / 'preview.svg'
    source.write_text(svg_document(logo_body(icons)))
    print(f'icons/preview.svg written ({WIDTH}x{HEIGHT})')

    rsvg = shutil.which('rsvg-convert')
    if not rsvg:
        print('rsvg-convert not found; skipped PNG (install librsvg)')
        return
    subprocess.run([rsvg, '-w', str(WIDTH), '-h', str(HEIGHT), str(source),
                    '-o', str(icons / 'preview.png')], check=True)
    print(f'  icons/preview.png ({WIDTH}x{HEIGHT})')


if __name__ == '__main__':
    main()
