"""Prepare The Unprinted Proof's ImageGen atlases and hero tableaus.

Some built-in ImageGen exports contain useful alpha while others contain a
neutral checker preview matte. Existing alpha is preserved; RGB exports are
unmatted against white. Every production asset receives a clear exterior edge
and is verified on both bone and nocturnal grounds.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "art-direction" / "unprinted-proof" / "source"
OUTPUT_DIR = ROOT / "public" / "art" / "proof"
VALIDATION_DIR = ROOT / "art-direction" / "unprinted-proof" / "validation"
ASSET_NAMES = (
    "proof-atlas-01-pressure-type",
    "proof-atlas-02-reverse-transfer",
    "proof-atlas-03-misregistration-practice",
    "proof-atlas-04-conversation-removal",
    "proof-atlas-05-depth-ending",
    "proof-hero-reverse-plate",
    "proof-hero-many-proofs",
    "proof-hero-two-plates",
    "proof-hero-inspection-light",
)


def recover_neutral_matte(source: Image.Image) -> Image.Image:
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
            if chroma < 5 and darkest > 224:
                alpha_pixels[x, y] = 0
                pigment_pixels[x, y] = (255, 255, 255, 0)
                continue
            strength = max((255 - darkest - 7) / 62, max(0, chroma - 1) / 50)
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
    pigment.putalpha(alpha)
    return pigment


def prepare(source: Image.Image) -> Image.Image:
    has_useful_alpha = source.mode == "RGBA" and source.getchannel("A").getextrema()[0] == 0
    result = source.convert("RGBA") if has_useful_alpha else recover_neutral_matte(source)
    alpha = result.getchannel("A")
    width, height = result.size
    border = 8
    alpha.paste(0, (0, 0, width, border))
    alpha.paste(0, (0, height - border, width, height))
    alpha.paste(0, (0, 0, border, height))
    alpha.paste(0, (width - border, 0, width, height))
    result.putalpha(alpha)
    return result


def alpha_report(image: Image.Image) -> tuple[float, int]:
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    transparent_fraction = sum(histogram[:3]) / sum(histogram)
    edges = list(alpha.crop((0, 0, alpha.width, 4)).get_flattened_data())
    edges += list(alpha.crop((0, alpha.height - 4, alpha.width, alpha.height)).get_flattened_data())
    edges += list(alpha.crop((0, 0, 4, alpha.height)).get_flattened_data())
    edges += list(alpha.crop((alpha.width - 4, 0, alpha.width, alpha.height)).get_flattened_data())
    return transparent_fraction, max(edges)


def save_proof(name: str, image: Image.Image) -> None:
    preview = image.copy()
    preview.thumbnail((720, 480), Image.Resampling.LANCZOS)
    proof = Image.new("RGB", (preview.width * 2, preview.height))
    for index, color in enumerate(((238, 234, 224), (18, 20, 27))):
        ground = Image.new("RGBA", preview.size, (*color, 255))
        ground.alpha_composite(preview)
        proof.paste(ground.convert("RGB"), (index * preview.width, 0))
    proof.save(VALIDATION_DIR / f"{name}-proof.webp", "WEBP", quality=84, method=6)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    VALIDATION_DIR.mkdir(parents=True, exist_ok=True)
    for name in ASSET_NAMES:
        raw_path = SOURCE_DIR / f"{name}-raw.png"
        png_path = SOURCE_DIR / f"{name}.png"
        webp_path = OUTPUT_DIR / f"{name}.webp"
        corrected = prepare(Image.open(raw_path))
        transparent_fraction, edge_max = alpha_report(corrected)
        if transparent_fraction < 0.35 or edge_max > 2:
            raise RuntimeError(
                f"{name}: invalid alpha coverage={transparent_fraction:.3f}, edge={edge_max}"
            )
        corrected.save(png_path, optimize=True)
        corrected.save(webp_path, "WEBP", lossless=True, quality=92, method=6, exact=True)
        save_proof(name, corrected)
        print(
            f"{name}: {corrected.width}x{corrected.height}, "
            f"transparent={transparent_fraction:.1%}, edge={edge_max}, "
            f"webp={webp_path.stat().st_size / 1024:.0f} KiB"
        )


if __name__ == "__main__":
    main()
