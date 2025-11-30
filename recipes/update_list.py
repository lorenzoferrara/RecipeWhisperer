import os
import json

directory = "./recipes"
titles = []

for filename in os.listdir(directory):
    if filename.endswith(".json"):
        file_path = os.path.join(directory, filename)

        with open(file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                if "title" in data:
                    titles.append(data["title"])
            except json.JSONDecodeError:
                print(f"Skipping invalid JSON: {filename}")

with open("recipe_list.txt", "w", encoding="utf-8") as out_file:
    for title in titles:
        out_file.write(title + "\n")

