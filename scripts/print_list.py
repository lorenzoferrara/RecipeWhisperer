import json

# Read the recipes.json file
with open('data/recipes.json', 'r') as file:
    recipes = json.load(file)

# Extract recipe names and write to txt file
with open('data/recipes.txt', 'w') as output:
    for recipe in recipes:
        output.write(f"{recipe['name']}:\n  {recipe['code']}\n")

print("Recipe names written to recipes.txt")