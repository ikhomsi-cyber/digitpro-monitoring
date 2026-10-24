"""Download verified public Carrefour images from a JSON list on stdin.

No customer data, credentials, email access or retailer scraping is required.
Each entry must contain key, imageUrl and sourceUrl from a verified search match.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "public/images/products/carrefour"
DESTINATION.mkdir(parents=True, exist_ok=True)


def download(entry):
    result = dict(entry)
    image = urlsplit(entry["imageUrl"])
    source = urlsplit(entry["sourceUrl"])
    if (image.scheme != "https" or image.netloc != "media.carrefour.fr"
            or source.scheme != "https" or source.netloc != "www.carrefour.fr"
            or not source.path.startswith("/p/")):
        return {**result, "downloadStatus": "rejected"}
    filename = hashlib.sha256(entry["key"].encode()).hexdigest()[:20] + ".png"
    target = DESTINATION / filename
    try:
        if not target.exists():
            request = Request(entry["imageUrl"], headers={"User-Agent": "DigitProProductImages/1.0"})
            with urlopen(request, timeout=20) as response:
                final = urlsplit(response.url)
                if final.scheme != "https" or final.netloc != "media.carrefour.fr":
                    raise ValueError("Unexpected image redirect")
                if not response.headers.get("Content-Type", "").startswith("image/"):
                    raise ValueError("Unexpected content type")
                data = response.read(4_000_001)
                if len(data) > 4_000_000:
                    raise ValueError("Oversized image")
            with tempfile.TemporaryDirectory() as directory:
                original = Path(directory) / "source-image"
                original.write_bytes(data)
                thumbnail = Path(directory) / "thumbnail.png"
                subprocess.run(["sips", "-Z", "160", "-s", "format", "png", str(original), "--out", str(thumbnail)], check=True, capture_output=True, timeout=15)
                if not thumbnail.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"):
                    raise ValueError("Invalid thumbnail")
                thumbnail.replace(target)
        return {**result, "localImageUrl": "/images/products/carrefour/" + filename, "downloadStatus": "ready"}
    except Exception as error:
        return {**result, "downloadStatus": "failed", "downloadError": type(error).__name__}


if __name__ == "__main__":
    entries = json.load(sys.stdin)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        results = list(executor.map(download, entries))
    print(json.dumps(results, ensure_ascii=False))
