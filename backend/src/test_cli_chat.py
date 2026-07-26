from fastmcp import Client
import asyncio
from google import genai
from openai import OpenAI
from anthropic import Anthropic
from google.genai import types
import os
from dotenv import load_dotenv
from typing import Literal


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")





async def main():
    return 0



if __name__ == "__main__":
   asyncio.run(main())

