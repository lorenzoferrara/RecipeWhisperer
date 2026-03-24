import os
import json
import time
import base64
import requests
from pathlib import Path
from typing import List, Dict, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
RECIPES_FILE = REPO_ROOT / "data" / "recipes.json"
IMAGES_DIR = REPO_ROOT / "images"

def load_dotenv(path: Path):
    if not path.exists():
        return
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value

load_dotenv(REPO_ROOT / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY is None:
    raise ValueError("GEMINI_API_KEY non impostata nell'ambiente")

API_URL = "https://api.generativeai.googleapis.com/v1beta/images:generate"  # endpoint Gemini

IMAGES_DIR.mkdir(parents=True, exist_ok=True)

def safe_code(code: str) -> str:
    s = code.lower().strip()
    s = "".join(c if c.isalnum() or c == "_" else "_" for c in s)
    s = "_".join(filter(bool, s.split("_")))
    return s[:32].rstrip("_")

def build_prompt(recipe: Dict) -> str:
    name = recipe.get("name", "ricetta")
    cuisine = recipe.get("cuisine", "italiana")
    ingredients = recipe.get("ingredients", [])
    main_items = []
    for i in ingredients[:6]:
        name_item = i.get("name")
        if not name_item:
            continue
        amount = str(i.get("amount", "")).strip()
        unit = str(i.get("unit", "")).strip()
        chunk = " ".join(filter(bool, [amount, unit, name_item.strip()]))
        main_items.append(chunk)
    main = ", ".join(main_items) if main_items else "ingredienti principali"

    return (
        f"A professional food photography shot of {name}, "
        f"{main} visible in the composition. "
        f"Served in a dish appropriate to {cuisine} cuisine. "
        f"golden and crispy, vibrant and colorful, rich and creamy. "
        f"Shot from slightly above (45-degree angle), "
        f"soft natural side lighting, shallow depth of field, "
        f"warm and inviting tones, rustic {cuisine}-style props and background, "
        f"garnished with fresh basil. "
        f"Photorealistic, high resolution, food magazine quality. "
        f"Aspect ratio 4:3."
    )

def generate_image(prompt: str) -> bytes:
    payload = {
        "model": "gemini-image-alpha-1",  # o nanobanana se disponibile
        "prompt": prompt,
        "size": "1024x768",
        "image_format": "png"
    }

    headers = {
        "Authorization": f"Bearer {GEMINI_API_KEY}",
        "Content-Type": "application/json",
    }

    r = requests.post(API_URL, json=payload, headers=headers, timeout=180)
    r.raise_for_status()
    data = r.json()

    # Estrarre immagine dalla risposta Gemini
    img_b64 = None
    if isinstance(data.get("data"), list) and data["data"]:
        img_b64 = data["data"][0].get("image") or data["data"][0].get("b64_json")
    elif isinstance(data.get("output"), list) and data["output"]:
        img_b64 = data["output"][0].get("image") or data["output"][0].get("b64_json")

    if not img_b64:
        raise RuntimeError(f"Gemini non ha restituito dati immagine: {data}")

    if img_b64.startswith("data:image"):
        img_b64 = img_b64.split("base64,")[-1]

    return base64.b64decode(img_b64)

def main():
    with open(RECIPES_FILE, "r", encoding="utf-8") as f:
        recipes = json.load(f)

    changed = 0
    for recipe in recipes:
        code = safe_code(recipe.get("code") or recipe.get("name", "ricetta"))
        recipe["code"] = code
        filename = f"{code}.png"
        path = IMAGES_DIR / filename
        if path.exists():
            recipe["image"] = f"images/{filename}"
            continue

        # Se già c'è field non vuoto, manteniamo.
        if recipe.get("image"):
            continue

        prompt = build_prompt(recipe)
        print(f"[INFO] Generate {code}: {prompt[:80]}...")
        img_bytes = generate_image(prompt)
        with open(path, "wb") as img_file:
            img_file.write(img_bytes)

        recipe["image"] = f"images/{filename}"
        changed += 1
        print(f"[OK] Salvata {path}")

        # Taxa polite usage
        time.sleep(2)

    if changed:
        with open(RECIPES_FILE, "w", encoding="utf-8") as f:
            json.dump(recipes, f, ensure_ascii=False, indent=2)
        print(f"[DONE] Aggiornati {changed} record in recipes.json")
    else:
        print("[DONE] Nessuna nuova immagine generata")

if __name__ == "__main__":
    main()