import asyncio
import json
import os
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastmcp import Client
import mcp.types as mcp_types

load_dotenv(Path(__file__).parents[2] / ".env")

ProviderT = Literal["Google-GenAI", "OpenAI", "Anthropic"]

DEFAULT_MODELS = {
    "Google-GenAI": "gemini-2.0-flash",
    "OpenAI":       "gpt-4o",
    "Anthropic":    "claude-sonnet-4-5",
}

ENV_KEYS = {
    "Google-GenAI": "GEMINI_API_KEY",
    "OpenAI":       "OPENAI_API_KEY",
    "Anthropic":    "ANTHROPIC_API_KEY",
}


# ── Tool converters ────────────────────────────────────────────────────────────

def _to_google_schema(s: dict) -> Any:
    from google.genai import types as gt
    TYPE = {"string": gt.Type.STRING, "integer": gt.Type.INTEGER, "number": gt.Type.NUMBER,
            "boolean": gt.Type.BOOLEAN, "array": gt.Type.ARRAY, "object": gt.Type.OBJECT}
    kw: dict[str, Any] = {"type": TYPE.get(s.get("type", "object"), gt.Type.STRING)}
    if "description" in s: kw["description"] = s["description"]
    if "enum"        in s: kw["enum"]        = [str(e) for e in s["enum"]]
    if "required"    in s: kw["required"]    = s["required"]
    if s.get("type") == "object" and "properties" in s:
        kw["properties"] = {k: _to_google_schema(v) for k, v in s["properties"].items()}
    if s.get("type") == "array" and "items" in s:
        kw["items"] = _to_google_schema(s["items"])
    return gt.Schema(**kw)


def mcp_tools_to_google(tools: list[mcp_types.Tool]) -> list:
    from google.genai import types as gt
    return [gt.FunctionDeclaration(name=t.name, description=t.description or "",
            parameters=_to_google_schema(t.inputSchema or {"type": "object"})) for t in tools]


def mcp_tools_to_anthropic(tools: list[mcp_types.Tool]) -> list[dict]:
    return [{"name": t.name, "description": t.description or "",
             "input_schema": t.inputSchema or {"type": "object", "properties": {}}} for t in tools]


def mcp_tools_to_openai(tools: list[mcp_types.Tool]) -> list[dict]:
    return [{"type": "function", "function": {"name": t.name, "description": t.description or "",
             "parameters": t.inputSchema or {"type": "object", "properties": {}}}} for t in tools]


# ── Tool execution ─────────────────────────────────────────────────────────────

async def _run_tool(client: Client, name: str, args: dict) -> str:
    try:
        result = await client.call_tool(name, args)
        return "\n".join(p.text for p in result.content if hasattr(p, "text"))
    except Exception as e:
        return f"[tool error: {e}]"


# ── Per-provider loops ─────────────────────────────────────────────────────────

async def _google(prompt, tools, client, model, api_key, system, temp, max_tok, max_iter):
    from google import genai
    from google.genai import types as gt

    g = genai.Client(api_key=api_key)
    decls = mcp_tools_to_google(tools)
    cfg = gt.GenerateContentConfig(
        temperature=temp, max_output_tokens=max_tok, system_instruction=system,
        tools=[gt.Tool(function_declarations=decls)] if decls else None,
    )
    contents = [gt.Content(role="user", parts=[gt.Part(text=prompt)])]

    for _ in range(max_iter):
        resp = await g.aio.models.generate_content(model=model, contents=contents, config=cfg)
        turn = resp.candidates[0].content
        contents.append(turn)
        calls = [p for p in turn.parts if getattr(p, "function_call", None)]
        if not calls or not client:
            return "\n".join(p.text for p in turn.parts if getattr(p, "text", ""))
        results = []
        for p in calls:
            fc = p.function_call
            out = await _run_tool(client, fc.name, dict(fc.args or {}))
            results.append(gt.Part(function_response=gt.FunctionResponse(name=fc.name, response={"result": out})))
        contents.append(gt.Content(role="user", parts=results))
    return "[max iterations]"


async def _anthropic(prompt, tools, client, model, api_key, system, temp, max_tok, max_iter):
    from anthropic import AsyncAnthropic

    a = AsyncAnthropic(api_key=api_key)
    msgs = [{"role": "user", "content": prompt}]

    for _ in range(max_iter):
        kw = dict(model=model, messages=msgs, max_tokens=max_tok, temperature=temp,
                  tools=mcp_tools_to_anthropic(tools))
        if system: kw["system"] = system
        resp = await a.messages.create(**kw)
        msgs.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason != "tool_use" or not client:
            return "\n".join(b.text for b in resp.content if hasattr(b, "text"))
        tool_results = []
        for b in resp.content:
            if b.type == "tool_use":
                tool_results.append({"type": "tool_result", "tool_use_id": b.id,
                                     "content": await _run_tool(client, b.name, b.input or {})})
        msgs.append({"role": "user", "content": tool_results})
    return "[max iterations]"


async def _openai(prompt, tools, client, model, api_key, base_url, system, temp, max_tok, max_iter):
    from openai import AsyncOpenAI

    o = AsyncOpenAI(api_key=api_key, **({"base_url": base_url} if base_url else {}))
    msgs = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    otools = mcp_tools_to_openai(tools)

    for _ in range(max_iter):
        kw = dict(model=model, messages=msgs, temperature=temp, max_tokens=max_tok)
        if otools: kw |= {"tools": otools, "tool_choice": "auto"}
        resp = await o.chat.completions.create(**kw)
        choice = resp.choices[0]
        msg = choice.message
        msgs.append({"role": "assistant", "content": msg.content,
                     "tool_calls": [{"id": tc.id, "type": "function",
                                     "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                                    for tc in (msg.tool_calls or [])] or None})
        if choice.finish_reason != "tool_calls" or not client:
            return msg.content or ""
        for tc in msg.tool_calls:
            out = await _run_tool(client, tc.function.name, json.loads(tc.function.arguments))
            msgs.append({"role": "tool", "tool_call_id": tc.id, "content": out})
    return "[max iterations]"


# ── Public API ─────────────────────────────────────────────────────────────────

async def generate(
    prompt: str,
    tools: list[mcp_types.Tool] | None = None,
    mcp_client: Client | None = None,
    *,
    provider: ProviderT = "Google-GenAI",
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
    system: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    max_iterations: int = 10,
) -> str:
    key = api_key or os.getenv(
        "OPENROUTER_API_KEY" if (provider == "OpenAI" and base_url and "openrouter" in base_url)
        else ENV_KEYS[provider], ""
    )
    mdl  = model or DEFAULT_MODELS[provider]
    args = (tools or [], mcp_client, mdl, key, system, temperature, max_tokens, max_iterations)

    if provider == "Google-GenAI": return await _google(prompt,   *args)
    if provider == "Anthropic":    return await _anthropic(prompt, *args)
    if provider == "OpenAI":       return await _openai(prompt,    *args[:2], mdl, key, base_url, system, temperature, max_tokens, max_iterations)
    raise ValueError(f"Unknown provider: {provider}")


class LLM:
    def __init__(
        self,
        provider: ProviderT,
        model: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        *,
        system: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        max_iterations: int = 10,
    ):
        self.provider      = provider
        self.model         = model or DEFAULT_MODELS[provider]
        self.api_key       = api_key or os.getenv(ENV_KEYS[provider], "")
        self.base_url      = base_url
        self.system        = system
        self.temperature   = temperature
        self.max_tokens    = max_tokens
        self.max_iterations = max_iterations

    async def generate(self, prompt: str, tools: list | None = None, mcp_client: Client | None = None, **kw) -> str:
        return await generate(
            prompt, tools, mcp_client,
            provider=self.provider, model=self.model, api_key=self.api_key,
            base_url=self.base_url, system=kw.get("system", self.system),
            temperature=kw.get("temperature", self.temperature),
            max_tokens=kw.get("max_tokens", self.max_tokens),
            max_iterations=kw.get("max_iterations", self.max_iterations),
        )

    def __repr__(self):
        return f"LLM({self.provider!r}, {self.model!r})"