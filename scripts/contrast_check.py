#!/usr/bin/env python3
"""
contrast_check.py — measure real WCAG contrast ratios from a screenshot,
instead of eyeballing whether text "looks" readable.

WHY THIS EXISTS
----------------
"That text looks low-contrast" is a guess. This script samples the actual
rendered pixels of a screenshot and computes the same contrast-ratio formula
WCAG 2.x uses, so findings are numbers you can check, not impressions you
have to trust. It's what produced every ratio in
masterprompt_retro_arcade_contrast_accessibility.md.

HOW TO ADD A NEW REGION TO CHECK
----------------------------------
1. Open your screenshot in any image viewer that shows pixel coordinates
   (or crop-and-view candidate boxes with an image tool — trial and error
   on the box coordinates is normal, this isn't precision surgery).
2. Add an entry to REGIONS below: name -> (x0, y0, x1, y1). Keep boxes small
   and tight around ONE piece of text plus a little surrounding background —
   large boxes pull in unrelated colors and muddy the result.
3. Run this file. For each region it prints the most common colors found,
   by pixel count. The single largest cluster is almost always the
   background; a smaller-but-substantial cluster at a different luminance
   is almost always the text. Anti-aliased edge pixels show up as many
   small in-between clusters — ignore those.
4. Once you've identified the fg/bg pair for a region, add it to PAIRS_TO_CHECK
   (or just eyeball the two numbers printed and run through wcag_ratio()
   yourself for a one-off check).

WCAG THRESHOLDS
-----------------
- Normal text needs >= 4.5:1 (AA) or >= 7:1 (AAA)
- Large text (>=18pt, or >=14pt bold) and UI components need >= 3:1 (AA)
  "Large" is about point size, not italics or color weight — small italic
  text still needs the 4.5:1 normal-text threshold.

USAGE
------
    python3 contrast_check.py                    # runs the checks below
    python3 contrast_check.py path/to/other.png   # same regions, different image
                                                    # (only useful if the new
                                                    # screenshot has the same layout)

For a quick one-off fg/bg check without an image at all — e.g. testing a
candidate fix color before you commit to it in CSS — just call wcag_ratio()
directly:

    >>> wcag_ratio((226, 225, 245), (108, 107, 207))
    3.52...
"""

import sys
from collections import Counter

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Requires Pillow and numpy: pip install Pillow numpy --break-system-packages")
    sys.exit(1)


# ---------------------------------------------------------------------------
# WCAG contrast ratio
# ---------------------------------------------------------------------------

def _srgb_channel_to_linear(c):
    c = c / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(rgb):
    r, g, b = rgb
    return (
        0.2126 * _srgb_channel_to_linear(r)
        + 0.7152 * _srgb_channel_to_linear(g)
        + 0.0722 * _srgb_channel_to_linear(b)
    )


def wcag_ratio(rgb_a, rgb_b):
    """Contrast ratio between two RGB colors, per the WCAG 2.x formula.
    Returns a value from 1.0 (identical) to 21.0 (black on white)."""
    la, lb = relative_luminance(rgb_a), relative_luminance(rgb_b)
    lighter, darker = max(la, lb), min(la, lb)
    return (lighter + 0.05) / (darker + 0.05)


def verdict(ratio):
    normal = "PASS" if ratio >= 4.5 else "FAIL"
    large = "PASS" if ratio >= 3.0 else "FAIL"
    return f"AA-normal-text(>=4.5): {normal}   AA-large-text/UI(>=3.0): {large}"


def blend_with_black(rgb, opacity):
    """Approximate the effective background color after placing a black
    scrim of the given opacity (0-1) over it — e.g. a
    `background: rgba(0,0,0,0.3)` overlay in CSS. Use this to verify a
    scrim-behind-text fix BEFORE writing the CSS, the way §4 of
    masterprompt_retro_arcade_contrast_accessibility.md does for the
    Retro Arcade cards."""
    return tuple(round(c * (1 - opacity)) for c in rgb)


# ---------------------------------------------------------------------------
# Region sampling
# ---------------------------------------------------------------------------

def dominant_colors(image_array, box, top_n=6):
    """Return the top_n most common (r,g,b) colors in a crop, by pixel count."""
    x0, y0, x1, y1 = box
    crop = image_array[y0:y1, x0:x1].reshape(-1, 3)
    colors, counts = np.unique(crop, axis=0, return_counts=True)
    order = np.argsort(-counts)
    total = len(crop)
    return [
        (tuple(int(v) for v in colors[i]), int(counts[i]), 100 * counts[i] / total)
        for i in order[:top_n]
    ]


def print_region_report(name, image_array, box, top_n=6):
    print(f"--- {name}  box={box} ---")
    for color, count, pct in dominant_colors(image_array, box, top_n):
        print(f"  {color}  {count} px  ({pct:.1f}%)")
    print()


# ---------------------------------------------------------------------------
# Regions + confirmed fg/bg pairs from the Retro Arcade screenshot
# (1288x846 px). Re-run print_region_report() on a fresh screenshot if the
# layout changes — coordinates will drift.
# ---------------------------------------------------------------------------

REGIONS = {
    "page background (blank area)": (900, 90, 960, 100),
    'header "Retro Arcade"': (130, 50, 260, 72),
    "body paragraph text": (100, 116, 500, 132),
    "disclaimer dark box background": (1100, 220, 1180, 230),
    "disclaimer amber heading": (135, 172, 395, 190),
    "disclaimer white body text": (115, 206, 500, 220),
    "DOOM card bg, upper-left (blue end of gradient)": (105, 332, 145, 345),
    "DOOM card bg, lower-right (magenta end of gradient)": (410, 405, 450, 417),
    "DOOM card italic subtitle text": (135, 392, 250, 403),
    "stats row background": (900, 703, 960, 715),
    'stats label "Total Play Time"': (115, 700, 230, 720),
    'stats value "0h 0m"': (1130, 700, 1190, 720),
}

# Confirmed fg/bg pairs, from reading REGIONS' output — see
# masterprompt_retro_arcade_contrast_accessibility.md for the full findings.
PAIRS_TO_CHECK = {
    "Header / body / stats-label text on page background": (
        (30, 41, 59), (171, 184, 196),
    ),
    "Disclaimer amber heading on dark navy box": (
        (251, 191, 36), (37, 48, 66),
    ),
    "Disclaimer white body text on dark navy box": (
        (241, 245, 249), (37, 48, 66),
    ),
    "Game card italic subtitle vs BLUE end of gradient (worst case)": (
        (226, 225, 245), (108, 107, 207),
    ),
    "Game card italic subtitle vs MAGENTA end of gradient (best case)": (
        (226, 225, 245), (117, 78, 166),
    ),
    "Stats value text on page background": (
        (0, 0, 0), (163, 178, 196),
    ),
}


def main():
    image_path = sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-data/uploads/1788104359637_image.png"
    img = Image.open(image_path).convert("RGB")
    arr = np.array(img)
    print(f"Loaded {image_path}  size={img.size}\n")

    print("=" * 70)
    print("REGION COLOR SAMPLING (raw — identify fg/bg by eye from this)")
    print("=" * 70)
    for name, box in REGIONS.items():
        print_region_report(name, arr, box)

    print("=" * 70)
    print("CONTRAST RATIOS (confirmed pairs)")
    print("=" * 70)
    for name, (fg, bg) in PAIRS_TO_CHECK.items():
        ratio = wcag_ratio(fg, bg)
        print(f"{name}")
        print(f"   fg={fg}  bg={bg}")
        print(f"   ratio = {ratio:.2f}:1   {verdict(ratio)}\n")

    print("=" * 70)
    print("PROPOSED FIX CHECK: 30% black scrim behind the card subtitle,")
    print("original pale text color kept — see masterprompt §4")
    print("=" * 70)
    subtitle_text = (226, 225, 245)
    for name, bg in [("blue end", (108, 107, 207)), ("magenta end", (117, 78, 166))]:
        scrimmed_bg = blend_with_black(bg, 0.30)
        ratio = wcag_ratio(subtitle_text, scrimmed_bg)
        print(f"{name}: {bg} -> scrimmed {scrimmed_bg}")
        print(f"   ratio = {ratio:.2f}:1   {verdict(ratio)}\n")


if __name__ == "__main__":
    main()
