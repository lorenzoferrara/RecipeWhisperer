import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RECIPES_FILE = REPO_ROOT / "data" / "recipes.json"
IMAGES_DIR = REPO_ROOT / "images"
PROMPTS_FILE = Path(__file__).resolve().parent / "prompts.txt"

def build_image_prompt(recipe):
    name = recipe['name']
    cuisine = recipe.get('cuisine', 'Italiana')

    main_ingredients = recipe['ingredients'][:6]
    main = ', '.join([
        f"{i['amount']} {i['name']}" if i['unit'] == 'n'
        else f"{i['amount']} {i['unit']} {i['name']}"
        for i in main_ingredients
    ])

    recipe_code = recipe['code']

    recipe_instructions = recipe['instructions']

    return f"""
A professional food photography shot of {name}.
The dish is fully prepared and plated, with {main} as part of the cooked recipe, not as separate raw ingredients in the scene.
The dish is prepared following these instructions: {recipe_instructions}.
Medium shot, the entire plate is fully visible and centered in the frame, with comfortable margins around the dish.
Slight 45-degree angle composition, focused on the whole plated dish.
Served in a dish appropriate to {cuisine} cuisine.
All ingredients must be integrated into the dish on the plate.
No ingredients placed around the plate or outside it.
Minimal, clean background with no extra props, no cutlery, no clutter.
Soft natural lighting, shallow depth of field.
Photorealistic, high resolution, food magazine quality.
Aspect ratio 4:3.
Filename: {recipe_code}.png
"""

def has_image(recipe_code):
    """Check if image exists in images/ for this recipe code"""
    for ext in ['.png', '.jpg', '.jpeg', '.webp', '.gif']:
        if (IMAGES_DIR / "web" / f"{recipe_code}{ext}").exists():
            return True
    return False

def main():
    with open(RECIPES_FILE, 'r', encoding='utf-8') as f:
        recipes = json.load(f)

    prompts = []
    for recipe in recipes:
        # Generate prompt only if image file is NOT present in images/ directory
        if not has_image(recipe['code']):
            prompt = build_image_prompt(recipe)
            prompts.append(f"Recipe: {recipe['name']}\n{prompt}\n{'-'*50}\n")

    with open(PROMPTS_FILE, 'w', encoding='utf-8') as f:
        f.writelines(prompts)

    print(f"Generated {len(prompts)} prompts and saved to {PROMPTS_FILE}")

if __name__ == "__main__":
    main()
