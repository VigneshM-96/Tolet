#!/usr/bin/env python3
"""
Rental Property Query Extractor
Uses Claude via OpenRouter API to extract structured data from natural language rental queries.
"""

import json
import requests

# ──────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────
OPENROUTER_API_KEY = "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" 
MODEL              = "anthropic/claude-3-haiku"
API_URL            = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """You are a rental property query parser. Extract structured data from the user's natural language query.

Return ONLY a valid JSON object — no markdown, no explanation, no extra text.

JSON Schema to follow exactly:
{
  "BHK": <integer or null>,
  "budget": {
    "min": <integer or null>,
    "max": <integer or null>,
    "currency": "INR"
  },
  "nearby": <list of strings — places the user WANTS to be near>,
  "not_nearby": <list of strings — places the user DOES NOT want to be near>,
  "furnishing": <"furnished" | "semi-furnished" | "unfurnished" | null>,
  "property_type": <"flat" | "house" | "villa" | "pg" | null>,
  "amenities": <list of strings or []>,
  "location": <city/area string or null>,
  "raw_query": <the original input string>
}

Rules:
- BHK: extract the numeric value (e.g. "2BHK" → 2)
- budget: if single value like "under 10000" → min: null, max: 10000
          if range like "10000 to 12000" → min: 10000, max: 12000
          if "around 10000" → min: 9000, max: 11000  (±10%)
- nearby: places user wants close to (e.g. railway station, metro, school)
- not_nearby: places user explicitly does NOT want nearby (e.g. "not near airport")
- amenities: extras like parking, gym, pool, etc.
- If a field is not mentioned, use null or [] for lists.
"""

# ──────────────────────────────────────────────
# CORE FUNCTION
# ──────────────────────────────────────────────
def extract_rental_data(query: str) -> dict:
    """Send query to OpenRouter and return parsed JSON."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://rental-extractor.local",   # Optional but recommended
        "X-Title": "Rental Property Extractor",             # Optional label in OpenRouter dashboard
    }

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": query},
        ],
        "temperature": 0,          # Deterministic output for structured extraction
        "max_tokens": 512,
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        raise SystemExit(f"[HTTP Error] {e}\nResponse: {response.text}")
    except requests.exceptions.RequestException as e:
        raise SystemExit(f"[Request Error] {e}")

    raw_text = response.json()["choices"][0]["message"]["content"].strip()

    # Strip markdown fences if model wraps response anyway
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        raw_text = raw_text.strip()

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        raise SystemExit(f"[Parse Error] Could not parse model response as JSON:\n{raw_text}")


# ──────────────────────────────────────────────
# DISPLAY HELPER
# ──────────────────────────────────────────────
def display_result(data: dict) -> None:
    """Pretty-print the extracted JSON to console."""
    print("\n" + "═" * 50)
    print("  EXTRACTED RENTAL REQUIREMENTS")
    print("═" * 50)
    print(json.dumps(data, indent=2, ensure_ascii=False))
    print("═" * 50 + "\n")


# ──────────────────────────────────────────────
# MAIN — Interactive Console Loop
# ──────────────────────────────────────────────
def main():
    print("\n🏠  Rental Property Query Extractor")
    print("    Powered by Claude (via OpenRouter)")
    print("    Type 'quit' or 'exit' to stop.\n")

    while True:
        try:
            query = input("Enter your rental requirement: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not query:
            print("  ⚠  Please enter a query.\n")
            continue

        if query.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break

        print("\n⏳ Extracting data...")
        extracted = extract_rental_data(query)
        display_result(extracted)


if __name__ == "__main__":
    main()