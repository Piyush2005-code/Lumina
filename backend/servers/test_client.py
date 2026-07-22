from fastmcp import Client, FastMCP
import asyncio
from google import genai
from google.genai import types
import os
from dotenv import load_dotenv


load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# print(GEMINI_API_KEY)

gemini_client = genai.Client(GEMINI_API_KEY)
client = Client("../servers/autoGuiMCP/server.py", auto_initialize = False)


async def main():
    async with client:
        print(f"Client Connection : {client.is_connected()}")
        print(f"Initialized {client.initialize_result is not None}")

        result = await client.initialize(timeout=10.0)
        print(f"Server: {result.serverInfo.name}")


        tools = await client.list_tools()

        print([{
            "tool_name" : tool.name,
            "tool_description" : tool.description,
            "input_Schema" : tool.inputSchema
            } for tool in tools])

        toolList = [
                types.Tool(
                    function_declarations = [
                            {
                            "name" : tool.name,
                            "description" : tool.description,
                            "parameters" : {
                                k: v
                                for k, v in tool.inputSchema.items()
                                if k not in ["additionalProperties", "$schema"]
                                }
                            }
                        ]
                    )
            for tool in tools
        ]

        user_query = input("Enter the query which you want to ask to the LLM")

        resonse = await gemini_client.models.generate_content(
                model = "gemini-2.5-flash",
                contents = user_query,
                config = types.GenerateContentConfig(
                    temperature = 0,
                    tools = toolList
                    )
                )
        
        function_call = response.function_call
        result = client.call_tool(
            function_call.name, arguments = dict(function_call.args)
                )


if __name__ == "__main__":
   asyncio.run(main())

