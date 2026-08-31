"""Recover transparent atlas marks from ImageGen's baked preview matte.

ImageGen occasionally returns a very light neutral checkerboard even when alpha
is requested. This script removes only that near-white neutral matte, unmattes
the surviving pigment against white, and emits both RGBA PNG sources and
lossless-alpha WebP production files.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "art-direction" / "wall-atlases" / "source"
OUTPUT_DIR = ROOT / "public" / "art" / "self"
VALIDATION_DIR = ROOT / "art-direction" / "wall-atlases" / "validation"
ATLAS_NAMES = (
    "wall-atlas-01-origin-language",
    "wall-atlas-02-self-deviation-senses",
    "wall-atlas-03-conversation-erasure-depth",
    "wall-atlas-04-purpose-residue-ending",
)


def recover_alpha(source: Image.Image) -> Image.Image:
    rgb = source.convert("RGB")
    width, height = rgb.size
    pigment = Image.new("RGBA", rgb.size)
    alpha = Image.new("L", rgb.size)
    pigment_pixels = pigment.load()
    alpha_pixels = alpha.load()
    source_pixels = rgb.load()

    for y in range(height):
        for x in range(width):
            red, green, blue = source_pixels[x, y]
            darkest = min(red, green, blue)
            chroma = max(red, green, blue) - darkest
            strength = max((255 - darkest - 7) / 60, max(0, chroma - 1) / 50)
            opacity = min(1.0, max(0.0, strength))
            if opacity < 0.035:
                opacity = 0.0
            alpha_pixels[x, y] = round(opacity * 255)

            if opacity <= 0:
                pigment_pixels[x, y] = (255, 255, 255, 0)
                continue

            def unmatte(channel: int) -> int:
                return round(max(0, min(255, 255 - (255 - channel) / opacity)))

            pigment_pixels[x, y] = (
                unmatte(red), unmatte(green), unmatte(blue), 255
            )

    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.35))
    border = 8
    alpha.paste(0, (0, 0, width, border))
    alpha.paste(0, (0, height - border, width, height))
    alpha.paste(0, (0, 0, border, height))
    alpha.paste(0, (width - border, 0, width, height))
    pigment.putalpha(alpha)
    return pigment


def alpha_report(image: Image.Image) -> tuple[float, int]:
    alpha = image.getchannel("A")
    values = list(alpha.get_flattened_data())
    transparent_fraction = sum(value <= 2 for value in values) / len(values)
    edge = list(alpha.crop((0, 0, alpha.width, 4)).get_flattened_data())
    edge += list(alpha.crop((0, alpha.height - 4, alpha.width, alpha.height)).get_flattened_data())
    edge += list(alpha.crop((0, 0, 4, alpha.height)).get_flattened_data())
    edge += list(alpha.crop((alpha.width - 4, 0, alpha.width, alpha.height)).get_flattened_data())
    return transparent_fraction, max(edge)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    VALIDATION_DIR.mkdir(parents=True, exist_ok=True)
    for name in ATLAS_NAMES:
        raw_path = SOURCE_DIR / f"{name}-raw.png"
        png_path = SOURCE_DIR / f"{name}.png"
        webp_path = OUTPUT_DIR / f"{name}.webp"
        corrected = recover_alpha(Image.open(raw_path))
        transparent_fraction, edge_max = alpha_report(corrected)
        if transparent_fraction < 0.55 or edge_max > 2:
            raise RuntimeError(
                f"{name}: invalid alpha coverage={transparent_fraction:.3f}, edge={edge_max}"
            )
        corrected.save(png_path, optimize=True)
        corrected.save(webp_path, "WEBP", lossless=True, quality=92, method=6, exact=True)
        proof = Image.new("RGB", (corrected.width * 2, corrected.height))
        for index, color in enumerate(((238, 234, 224), (18, 20, 27))):
            ground = Image.new("RGBA", corrected.size, (*color, 255))
            ground.alpha_composite(corrected)
            proof.paste(ground.convert("RGB"), (index * corrected.width, 0))
        proof.save(VALIDATION_DIR / f"{name}-proof.webp", "WEBP", quality=82, method=6)
        print(
            f"{name}: {corrected.width}x{corrected.height}, "
            f"transparent={transparent_fraction:.1%}, edge={edge_max}, "
            f"webp={webp_path.stat().st_size / 1024:.0f} KiB"
        )


if __name__ == "__main__":
    main()
