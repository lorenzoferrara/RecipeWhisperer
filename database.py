import os
import numpy as np
import pandas as pd

class Database:
    def __init__(self, csv_file="recipes.csv", data_folder="data"):
        self.data_folder = data_folder
        self.csv_file = csv_file
        
        os.makedirs(self.data_folder, exist_ok=True)
        self.table_path = os.path.join(self.data_folder, self.csv_file)
        
        # Load or create the CSV file
        try:
            self.table = self.load_csv(self.table_path)
        except Exception as e:
            print(f"Error loading CSV file: {e}. Creating a new one.")
            self.table = self.create_empty_dataframe()
            self.save_csv()

        self.next_id = self.get_next_id()

    def load_csv(self, path):
        """Load CSV file or create a new one if it doesn't exist."""
        df = pd.read_csv(path)
        return df

    def create_empty_dataframe(self):
        """Create an empty dataframe with the required columns."""
        columns = ["recipe_id", "name", "category", "ingredients"]
        return pd.DataFrame(columns=columns)

    def get_next_id(self):
        """Get the maximum ID from the table."""
        if self.table.empty or "recipe_id" not in self.table.columns:
            return 1
        elif len(self.table) > 0:
            return self.table["recipe_id"].max() +1 
        else:
            return 1

    def save_csv(self):
        """Save the dataframe to CSV file."""
        self.table.to_csv(self.table_path, index=False)
        print(f"Data saved to {self.table_path}")

    def check_consistency(self):
        """Check that all items in the table have the same keys."""
        if self.table.empty:
            print("No items found in table.")
            return

        print(f"Table columns: {list(self.table.columns)}")
        print(f"Total recipes: {len(self.table)}")
        
        # Check for missing values
        missing_data = self.table.isnull().sum()
        if missing_data.any():
            print("\nMissing values per column:")
            for col, count in missing_data.items():
                if count > 0:
                    print(f"  {col}: {count} missing values")
        else:
            print("\nNo missing values found.")

    def add_recipe_from_file(self, file_path):
        """Add a new recipe from a given file."""

        new_recipes_csv = self.load_csv(file_path)

        for index, row in new_recipes_csv.iterrows():
            name = row["name"]
            category = row["category"]
            ingredients = row["ingredients"]

            if name in self.table["name"].values:
                print(f"Recipe '{name}' already exists. Skipping.")
                continue

            new_recipe = {
                "recipe_id": self.get_next_id(),
                "name": name,
                "category": category,
                "ingredients": ingredients,
            }

            # Add to dataframe
            self.table = pd.concat([self.table, pd.DataFrame([new_recipe])], ignore_index=True)
                
            # Save to CSV
            self.save_csv()

    def add_recipe(self):
        """Interactively add a new recipe."""
        print("\n--- Add New Recipe ---")
        
        # Categories
        categories = [
            "Antipasto",
            "Primo", 
            "Secondo",
            "Contorno",
            "Generico",
            "Dessert",
        ]

        # Get recipe details from user
        name = input("Recipe name: ").strip()
        
        print("\nAvailable categories:")
        for i, cat in enumerate(categories, 1):
            print(f"{i}. {cat}")
        
        while True:
            try:
                cat_choice = int(input("\nSelect category (number): ")) - 1
                if 0 <= cat_choice < len(categories):
                    category = categories[cat_choice]
                    break
                else:
                    print("Invalid choice. Please try again.")
            except ValueError:
                print("Please enter a valid number.")

        ingredients = input("Ingredients (comma-separated): ").strip()
        nutrients = input("Nutrients/Notes (optional): ").strip()
        prep_time = input("Preparation time (optional): ").strip()
        difficulty = input("Difficulty level (optional): ").strip()

        # Generate new ID

        # Create new recipe dictionary
        new_recipe = {
            "recipe_id": self.get_next_id(),
            "name": name,
            "category": category,
            "ingredients": ingredients,
            "nutrients": nutrients,
            "preparation_time": prep_time,
            "difficulty": difficulty
        }

        # Add to dataframe
        self.table = pd.concat([self.table, pd.DataFrame([new_recipe])], ignore_index=True)
        
        # Save to CSV
        self.save_csv()
        print(f"Recipe '{name}' added successfully!")

    def search_recipes(self, category=None, ingredients=None):
        """Search recipes by category and/or ingredients."""
        if self.table.empty:
            print("No recipes found in database.")
            return

        filtered_table = self.table.copy()

        # Filter by category
        if category:
            filtered_table = filtered_table[
                filtered_table["category"].str.contains(category, case=False, na=False)
            ]

        # Filter by ingredients
        if ingredients:
            ingredient_list = [ing.strip().lower() for ing in ingredients.split(",")]
            for ingredient in ingredient_list:
                filtered_table = filtered_table[
                    filtered_table["ingredients"].str.contains(ingredient, case=False, na=False)
                ]

        if filtered_table.empty:
            print("No recipes match your criteria.")
        else:
            print(f"\nFound {len(filtered_table)} recipe(s):")
            for _, recipe in filtered_table.iterrows():
                print(f"\nID: {recipe['recipe_id']}")
                print(f"Name: {recipe['name']}")
                print(f"Category: {recipe['category']}")
                print(f"Ingredients: {recipe['ingredients']}")
                if pd.notna(recipe['preparation_time']) and recipe['preparation_time']:
                    print(f"Prep time: {recipe['preparation_time']}")
                if pd.notna(recipe['difficulty']) and recipe['difficulty']:
                    print(f"Difficulty: {recipe['difficulty']}")

    def display_all_recipes(self):
        """Display all recipes in the database."""
        if self.table.empty:
            print("No recipes in database.")
        else:
            print(f"\nAll Recipes ({len(self.table)} total):")
            print(self.table.to_string(index=False))

def main():
    db = Database()
    
    while True:
        print("\n" + "="*40)
        print("Recipe Database Manager")
        print("="*40)
        print("1. Add new recipe")
        print("2. Search recipes")
        print("3. Display all recipes")
        print("4. Check database consistency")
        print("5. Exit")
        
        choice = input("\nSelect an option (1-5): ").strip()
        
        if choice == "1":
            db.add_recipe()
        elif choice == "2":
            category = input("Category (optional, press Enter to skip): ").strip()
            ingredients = input("Ingredients to search for (comma-separated, optional): ").strip()
            db.search_recipes(
                category if category else None,
                ingredients if ingredients else None
            )
        elif choice == "3":
            db.display_all_recipes()
        elif choice == "4":
            db.check_consistency()
        elif choice == "5":
            print("Goodbye!")
            break
        else:
            print("Invalid choice. Please try again.")
