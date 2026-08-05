import os
import fnmatch
from pathlib import Path
from datetime import datetime, timezone

from fastmcp import FastMCP


mcp = FastMCP("FilesystemMCP")

# Every path argument is resolved relative to this root and rejected if it
# would escape it, so an agent can browse/edit the project without being
# able to touch the rest of the filesystem.
FS_ROOT = Path(os.environ.get("FS_MCP_ROOT", Path(__file__).resolve().parents[2])).resolve()

IGNORED_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"}


def resolve_path(relative_path: str) -> Path:
    candidate = (FS_ROOT / relative_path).resolve()
    if candidate != FS_ROOT and FS_ROOT not in candidate.parents:
        raise ValueError(f"Path '{relative_path}' escapes the allowed root '{FS_ROOT}'")
    return candidate


@mcp.tool
def read_file(path: str):
    """
    Reads and returns the full text contents of a file.

    Args:
        path: path to the file, relative to the workspace root.
    """
    try:
        target = resolve_path(path)
        if not target.is_file():
            return {"status": f"'{path}' is not a file or does not exist"}
        return {
            "status": "File read successfully",
            "content": target.read_text(errors="replace"),
        }
    except Exception as e:
        return {"status": f"Failed to read '{path}', error: {e}"}


@mcp.tool
def write_file(path: str, content: str, append: bool = False):
    """
    Writes text content to a file, creating it (and any missing parent
    directories) if it doesn't already exist.

    Args:
        path: path to the file, relative to the workspace root.
        content: text content to write.
        append: if True, appends to the end of the file instead of overwriting it.
    """
    try:
        target = resolve_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)

        with open(target, "a" if append else "w") as f:
            f.write(content)

        return {
            "status": f"File '{path}' written successfully",
            "bytes_written": len(content.encode()),
        }
    except Exception as e:
        return {"status": f"Failed to write '{path}', error: {e}"}


@mcp.tool
def list_directory(path: str = "."):
    """
    Lists the immediate contents of a directory (not recursive).

    Args:
        path: path to the directory, relative to the workspace root. Defaults to the workspace root.
    """
    try:
        target = resolve_path(path)
        if not target.is_dir():
            return {"status": f"'{path}' is not a directory or does not exist"}

        entries = [
            {"name": entry.name, "type": "directory" if entry.is_dir() else "file"}
            for entry in sorted(target.iterdir())
        ]

        return {"status": "Directory listed successfully", "entries": entries}
    except Exception as e:
        return {"status": f"Failed to list '{path}', error: {e}"}


@mcp.tool
def search_files(pattern: str, path: str = "."):
    """
    Recursively searches a directory for files whose name matches a glob
    pattern, e.g. "*.ts" or "server.py".

    Args:
        pattern: glob pattern to match file names against.
        path: directory to search within, relative to the workspace root. Defaults to the workspace root.
    """
    try:
        target = resolve_path(path)
        if not target.is_dir():
            return {"status": f"'{path}' is not a directory or does not exist"}

        matches = []
        for root, dirs, files in os.walk(target):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
            for name in files:
                if fnmatch.fnmatch(name, pattern):
                    matches.append(str((Path(root) / name).relative_to(FS_ROOT)))

        return {"status": "Search completed successfully", "matches": matches}
    except Exception as e:
        return {"status": f"Failed to search '{path}', error: {e}"}


@mcp.tool
def get_file_metadata(path: str):
    """
    Returns metadata about a file or directory: type, size, and last
    modified time.

    Args:
        path: path to the file or directory, relative to the workspace root.
    """
    try:
        target = resolve_path(path)
        if not target.exists():
            return {"status": f"'{path}' does not exist"}

        stat = target.stat()

        return {
            "status": "Metadata read successfully",
            "metadata": {
                "type": "directory" if target.is_dir() else "file",
                "size_bytes": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            },
        }
    except Exception as e:
        return {"status": f"Failed to get metadata for '{path}', error: {e}"}


if __name__ == "__main__":
    mcp.run(transport="stdio")
