#!/usr/bin/env python3
"""Generate web-optimized WebP images for recipe cards and modal views.

Usage:
  uv run scripts/convert_png_to_webp.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

SRC_DIR = Path("images") / "png"
OUT_DIR = SRC_DIR / "web"
MAX_SIDE = 960
QUALITY = 78


def optimize_image(src: Path, dst: Path) -> tuple[int, int, int]:
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")

        w, h = im.size
        scale = min(MAX_SIDE / max(w, h), 1.0)
        if scale < 1.0:
            new_size = (int(w * scale), int(h * scale))
            im = im.resize(new_size, Image.Resampling.LANCZOS)

        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst, format="WEBP", quality=QUALITY, method=6)

    src_size = src.stat().st_size
    dst_size = dst.stat().st_size
    savings = max(src_size - dst_size, 0)
    return src_size, dst_size, savings


def main() -> None:
    pngs = sorted(SRC_DIR.glob("*.png"))
    if not pngs:
        print(f"No PNG files found in {SRC_DIR}")
        return

    total_src = 0
    total_dst = 0
    skipped = 0
    optimized = 0

    for src in pngs:
        dst = OUT_DIR / f"{src.stem}.webp"
        if dst.exists():
            skipped += 1
            print(f"skip {src.name} (already exists: web/{dst.name})")
            continue

        src_size, dst_size, _ = optimize_image(src, dst)
        total_src += src_size
        total_dst += dst_size
        optimized += 1
        print(f"{src.name} -> web/{dst.name}")

    total_saved = total_src - total_dst
    pct = (total_saved / total_src * 100) if total_src else 0
    print()
    print(f"Optimized {optimized} images")
    print(f"Skipped:        {skipped}")
    print(f"Original total: {total_src / (1024 * 1024):.2f} MB")
    print(f"WebP total:     {total_dst / (1024 * 1024):.2f} MB")
    print(f"Saved:          {total_saved / (1024 * 1024):.2f} MB ({pct:.1f}%)")


if __name__ == "__main__":
    main()
