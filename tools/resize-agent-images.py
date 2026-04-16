#!/usr/bin/env python3
"""
resize-agent-images.py — High-quality PNG resize for agent portrait images.

For each source PNG in docs/agents/images/, produces three variants in
docs/agents/images/optimized/:
  {avatar}-64.png   — 160px longest side (used at 80px CSS × 2× retina)
  {avatar}-160.png  — 320px longest side (used at 160px CSS × 2× retina)
  {avatar}-320.png  — 640px longest side (used at 320px CSS × 2× retina)

Strategy:
  1. Center-top crop to square so avatar circles don't need upscaling.
  2. LANCZOS resampling (highest quality for downscale).
  3. Mild unsharp mask to recover edge crispness lost in large downscales.
  4. PNG output (lossless, no quality degradation).

Usage:
  python3 tools/resize-agent-images.py
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageFilter

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "docs" / "agents" / "images"
OUT_DIR = SRC_DIR / "optimized"

# Source files to process (name → output avatar slug)
AGENTS = [
    "circuit",
    "compass",
    "conductor",
    "forge",
    "keystone",
    "lens",
    "palette",
    "pixel",
    "sentinel",
]

# Output sizes: (slug_suffix, target_px)
# Doubled from CSS display size for 2× retina sharpness.
SIZES = [
    ("64", 160),    # CSS 80px → 160px source
    ("160", 320),   # CSS 160px → 320px source
    ("320", 640),   # CSS 320px → 640px source
]

# Unsharp mask params (radius, percent, threshold)
# Gentle pass — recovers detail without halos.
USM_RADIUS = 0.8
USM_PERCENT = 120
USM_THRESHOLD = 3


def center_top_crop(img: Image.Image) -> Image.Image:
    """Crop to square, taking center-x and top-y of the image.

    For landscape portraits (wider than tall), this centres horizontally
    and keeps the full height — matching CSS `object-position: center top`.
    For portrait/square images, the crop is a no-op.
    """
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = 0
    return img.crop((left, top, left + side, top + side))


def resize_agent(slug: str) -> None:
    src = SRC_DIR / f"{slug}.png"
    if not src.exists():
        print(f"  [skip] {slug}.png not found")
        return

    img = Image.open(src).convert("RGBA")
    cropped = center_top_crop(img)
    print(f"  {slug}: {img.size} → square {cropped.size}")

    for suffix, target_px in SIZES:
        out_path = OUT_DIR / f"{slug}-{suffix}.png"
        resized = cropped.resize((target_px, target_px), Image.LANCZOS)
        # Apply unsharp mask to RGB channels only (preserve alpha cleanly)
        r, g, b, a = resized.split()
        rgb = Image.merge("RGB", (r, g, b))
        sharpened = rgb.filter(
            ImageFilter.UnsharpMask(
                radius=USM_RADIUS, percent=USM_PERCENT, threshold=USM_THRESHOLD
            )
        )
        sr, sg, sb = sharpened.split()
        final = Image.merge("RGBA", (sr, sg, sb, a))
        final.save(out_path, "PNG", optimize=True)
        kb = out_path.stat().st_size // 1024
        print(f"    → {out_path.name} ({target_px}×{target_px}, {kb} KB)")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[resize-agent-images] source: {SRC_DIR}")
    print(f"[resize-agent-images] output: {OUT_DIR}")
    for slug in AGENTS:
        resize_agent(slug)
    print("[resize-agent-images] done")


if __name__ == "__main__":
    main()
