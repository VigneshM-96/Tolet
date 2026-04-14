import json
import re
from nlp.intent_extractor import extract_intent

DATA_FILE = "data/properties.json"


def load_properties():
    with open(DATA_FILE, "r") as f:
        return json.load(f)



def normalize(text):
    return str(text).lower().strip()



def extract_budget(query):
    match = re.search(r'(\d+)\s*k', query.lower())
    if match:
        return int(match.group(1)) * 1000
    return None


def score_property(prop, intent):
    score = 0

    prop_type = normalize(prop.get("type"))
    prop_location = normalize(prop.get("location"))
    prop_nearby = [normalize(x) for x in prop.get("nearby", [])]
    prop_amenities = [normalize(x) for x in prop.get("amenities", [])]

    intent_type = normalize(intent.get("property_type", ""))
    intent_location = normalize(intent.get("location", ""))
    intent_nearby = [normalize(x) for x in intent.get("nearby", [])]
    intent_amenities = [normalize(x) for x in intent.get("amenities", [])]

    
    if intent_type and prop_type == intent_type:
        score += 10

  
    if intent_location and intent_location in prop_location:
        score += 10

   
    if intent.get("budget"):
        if prop.get("price", 0) <= intent["budget"]:
            score += 10
        else:
            score -= 10

    
    if any("parking" in a for a in intent_amenities):
        if prop.get("parking"):
            score += 8
        else:
            score -= 5

 
    for item in intent_nearby:
        if item in prop_nearby:
            score += 5

 
    for item in intent_amenities:
        if item in prop_amenities:
            score += 3

    return score


def find_best_property(query):
    intent_data = extract_intent(query)


    if not intent_data.get("valid"):
        print("Invalid query")
        return

    intent = intent_data["intent"]

    
    if not intent.get("budget"):
        intent["budget"] = extract_budget(query)

    properties = load_properties()

    best = None
    best_score = float("-inf")

    print("\nScoring Properties:\n")

    for prop in properties:
        score = score_property(prop, intent)
        print(f"Property {prop['id']} → Score: {score}")

        if score > best_score:
            best_score = score
            best = prop

    if not best:
        print("No matching property found")
        return

    print("\n BEST MATCH PROPERTY:\n")
    print(json.dumps(best, indent=2))
    print(f"\n Score: {best_score}")


if __name__ == "__main__":
    query = input("Enter your search query: ")
    find_best_property(query)