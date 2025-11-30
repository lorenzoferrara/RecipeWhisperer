from database import Database

def main():
    db = Database(csv_file="recipes.csv", data_folder="data")
    db.add_recipe_from_file("data/new_recipe.csv")
    # db.check_consistency()


if __name__ == "__main__":
    main()