from pydantic import BaseModel
from types import Literal


class NaturalLanguageRequest(BaseModel):
    prompt : str
    provider : Literal["Anthropic", "OpenAI", "Google-GenAI"] = "OpenAI"
    model : str = None