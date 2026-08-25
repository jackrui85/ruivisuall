from pathlib import Path

from PIL import Image


SOURCE = Path("/home/ubuntu/webdev-static-assets/sightguide-ai-icon.png")
TARGETS = [
    Path("/home/ubuntu/sightguide-ai/assets/images/icon.png"),
    Path("/home/ubuntu/sightguide-ai/assets/images/splash-icon.png"),
    Path("/home/ubuntu/sightguide-ai/assets/images/favicon.png"),
    Path("/home/ubuntu/sightguide-ai/assets/images/android-icon-foreground.png"),
]


def main() -> None:
    with Image.open(SOURCE) as image:
        rendered = image.convert("RGBA").resize((512, 512), Image.Resampling.LANCZOS)
        for target in TARGETS:
            rendered.save(target, "PNG", optimize=True, compress_level=9)
            print(f"{target.name}: {target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
