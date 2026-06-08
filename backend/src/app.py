from fastapi import FastAPI
from utils import LLM

app = FastAPI("Chat Interface")


@app.post("/chat")
def 