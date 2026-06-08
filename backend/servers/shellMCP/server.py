# import os
# import shlex
import subprocess
from fastmcp import FastMCP


mcp = FastMCP("ShellMCP")


@mcp.tool
def command(cmd : str):
    """
    The tool used to execute the command 'cmd' written in one plain line of text.

    Args:
        cmd: single line text command to be executed by the shell
    """
    # args = shlex.split(cmd)
    result = subprocess.run(cmd, shell = True, capture_output=True)

    return {
        "status" : result.returncode,
        "stdout" : result.stdout.strip(),
        "stderr" : result.stderr,
    }


# # Process management
# @mcp.tool
# def work_process(cmd : str):
#     """
#     The tool used to initiate and utilise the process management functionality of server.

#     Args:

#     """


if __name__=="__main__":
    mcp.run(transport = "stdio")
