from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art-direction" / "fable-alive" / "source"
OUTPUT = ROOT / "public" / "art" / "fable-alive"
VALIDATION = ROOT / "art-direction" / "fable-alive" / "validation"
WORLD_WIDTH = 1600
FULL_TILE_HEIGHT = 1200


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    VALIDATION.mkdir(parents=True, exist_ok=True)
    captured = json.loads((SOURCE / "capture-manifest.json").read_text(encoding="utf-8"))
    production: list[dict[str, object]] = []
    previews: list[Image.Image] = []

    for item in captured:
        source_path = SOURCE / str(item["filename"])
        image = Image.open(source_path).convert("RGBA")
        logical_height = min(FULL_TILE_HEIGHT, int(round(float(item["logicalHeight"]))))
        output_height = round(image.width * logical_height / WORLD_WIDTH)
        image = image.crop((0, 0, image.width, min(image.height, output_height)))
        filename = source_path.with_suffix(".webp").name
        output_path = OUTPUT / filename
        image.save(output_path, "WEBP", lossless=True, method=6, exact=True)

        alpha = image.getchannel("A")
        production.append(
            {
                "id": f"tile-{int(item['index']):02d}",
                "source": f"/art/fable-alive/{filename}",
                "worldY": int(round(float(item["logicalTop"]))),
                "worldHeight": logical_height,
                "pixelWidth": image.width,
                "pixelHeight": image.height,
                "alphaExtrema": list(alpha.getextrema()),
                "bytes": output_path.stat().st_size,
            }
        )

        proof = Image.new("RGB", image.size, (24, 20, 17))
        proof.paste(image, mask=alpha)
        proof.thumbnail((360, 275))
        previews.append(proof)

    (VALIDATION / "production-manifest.json").write_text(
        json.dumps(production, indent=2) + "\n", encoding="utf-8"
    )

    sheet = Image.new("RGB", (360 * 4, 275 * 5), (17, 17, 17))
    draw = ImageDraw.Draw(sheet)
    for index, preview in enumerate(previews):
        x = index % 4 * 360
        y = index // 4 * 275
        sheet.paste(preview, (x, y))
        draw.rectangle((x + 6, y + 6, x + 38, y + 28), fill=(0, 0, 0))
        draw.text((x + 13, y + 10), str(index + 1), fill=(255, 255, 255))
    sheet.save(VALIDATION / "tiles-contact.webp", "WEBP", quality=90, method=6)

    for tile in production:
        print(
            f"{tile['id']}: {tile['pixelWidth']}×{tile['pixelHeight']}, "
            f"world y={tile['worldY']} h={tile['worldHeight']}, {tile['bytes'] // 1024} KiB"
        )


if __name__ == "__main__":
    main()
