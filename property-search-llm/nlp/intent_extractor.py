import os
import json
import re
import requests
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


def extract_json(text: str):
    match = re.search(r"\{.*\}", text, re.DOTALL)
    return match.group(0) if match else None


def extract_intent(user_query: str) -> dict:
    try:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        prompt_path = os.path.join(BASE_DIR, "..", "prompts", "extraction.txt")

        with open(prompt_path, "r", encoding="utf-8") as f:
            prompt_template = f.read()

        prompt = prompt_template.replace("{user_query}", user_query)

        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "Property Search LLM"
            },
            json={
                "model": "anthropic/claude-3-haiku",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0,
                "response_format": {"type": "json_object"}  
            }
        )

        print("STATUS:", response.status_code)
        print("RESPONSE:", response.text)

        result = response.json()

 
        if "choices" not in result:
            return {"error": "API Error", "details": result}

        raw = result["choices"][0]["message"]["content"].strip()

        
        json_str = extract_json(raw)

        if not json_str:
            return {"error": "No JSON found", "raw": raw}

        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            return {"error": "Invalid JSON", "raw": raw}

    except Exception as e:
        return {"error": str(e)}