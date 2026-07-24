import asyncio
from fastmcp import Client


client = Client("./server.py")

# Currently using the only one function defined as an MCP client.
async def main():
    async with client:
        await client.ping()
        tools = await client.list_tools()
        resources = await client.list_resources()
        prompts = await client.list_prompts()

        result = await client.call_tool("command", {"cmd" : "echo Hello from the MCP client"})

        print(result)


if __name__=="__main__":
    asyncio.run(main())