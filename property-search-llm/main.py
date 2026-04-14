from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from nlp.intent_extractor import extract_intent

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchRequest(BaseModel):
    query: str

@app.post("/search")
def search(req: SearchRequest):
    try:
        intent = extract_intent(req.query)
        return {
            "query": req.query,
            "intent": intent
        }
    except Exception as e:
        return {
            "query": req.query,
            "error": str(e)
        }