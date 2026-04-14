import json
import os

DATA_FILE = "data/properties.json"

def load_properties():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_properties(properties):
    with open(DATA_FILE, "w") as f:
        json.dump(properties, f, indent=2)

def add_property():
    properties = load_properties()

    prop = {
        "id": len(properties) + 1,
        "type": input("Property Type (2BHK/3BHK): "),
        "location": input("Location: "),
        "price": int(input("Price: ")),
        "nearby": input("Nearby (comma separated): ").split(","),
        "distance_railway_km": float(input("Distance from railway (km): ")),
        "parking": input("Parking (yes/no): ").lower() == "yes",
        "amenities": input("Amenities (comma separated): ").split(",")
    }

    properties.append(prop)
    save_properties(properties)

    print("✅ Property added successfully!")

if __name__ == "__main__":
    add_property()