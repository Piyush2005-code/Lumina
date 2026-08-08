"""
Lumina — emailMCP
=================
The side-effecting tool the approval pipeline exists for.

Drafting is free: `create_draft` writes a JSON file inside Lumina's own data
directory and touches nothing else, so the agent can compose and revise without
anyone being asked to authorise anything.

Sending is not. `send_email` opens an SMTP connection and puts a message in
someone else's inbox, which cannot be undone. The backend classifies it
APPROVAL_REQUIRED, so the agent can propose it but only a human can cause it.
"""

import json
import os
import smtplib
import ssl
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

from fastmcp import FastMCP


mcp = FastMCP("EmailMCP")

DATA_DIR = Path(os.environ.get("LUMINA_DATA_DIR", Path.home() / ".lumina")).resolve()
DRAFTS_DIR = DATA_DIR / "drafts"
DRAFTS_DIR.mkdir(parents=True, exist_ok=True)


def _draft_path(draft_id: str) -> Path:
    # Draft ids are generated here, never supplied by a model, but a traversal
    # check costs nothing and this function takes a string from a tool call.
    safe = "".join(ch for ch in draft_id if ch.isalnum() or ch in "-_")
    if not safe:
        raise ValueError("invalid draft id")
    return DRAFTS_DIR / f"{safe}.json"


def _load(draft_id: str) -> dict:
    path = _draft_path(draft_id)
    if not path.is_file():
        raise FileNotFoundError(f"no draft with id '{draft_id}'")
    return json.loads(path.read_text())


def _smtp_settings() -> dict:
    return {
        "host": os.environ.get("SMTP_HOST", ""),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER", ""),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "sender": os.environ.get("SMTP_FROM") or os.environ.get("SMTP_USER", ""),
    }


@mcp.tool
def create_draft(to: str, subject: str, body: str, cc: str = ""):
    """
    Composes an email and saves it as a draft. Nothing is sent — this only writes
    a file inside Lumina's data directory, and is safe to call freely while
    iterating on wording.

    Args:
        to: recipient address, or several separated by commas.
        subject: the subject line.
        body: the plain-text body of the message.
        cc: optional carbon-copy addresses, separated by commas.
    """
    try:
        draft_id = uuid.uuid4().hex[:12]
        draft = {
            "id": draft_id,
            "to": to,
            "cc": cc,
            "subject": subject,
            "body": body,
            "status": "draft",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "sent_at": None,
        }
        _draft_path(draft_id).write_text(json.dumps(draft, indent=2))
        return {
            "status": "Draft saved. It has not been sent.",
            "draft_id": draft_id,
            "draft": draft,
        }
    except Exception as e:
        return {"status": f"Failed to create draft, error: {e}"}


@mcp.tool
def list_drafts():
    """Lists every saved draft with its id, recipient, subject and whether it has been sent."""
    try:
        drafts = []
        for path in sorted(DRAFTS_DIR.glob("*.json")):
            try:
                draft = json.loads(path.read_text())
            except Exception:
                continue
            drafts.append({
                "id": draft.get("id"),
                "to": draft.get("to"),
                "subject": draft.get("subject"),
                "status": draft.get("status"),
                "created_at": draft.get("created_at"),
            })
        return {"status": "Drafts listed successfully", "drafts": drafts}
    except Exception as e:
        return {"status": f"Failed to list drafts, error: {e}"}


@mcp.tool
def read_draft(draft_id: str):
    """
    Returns the full contents of a saved draft.

    Args:
        draft_id: the id returned by create_draft.
    """
    try:
        return {"status": "Draft read successfully", "draft": _load(draft_id)}
    except Exception as e:
        return {"status": f"Failed to read draft, error: {e}"}


@mcp.tool
def send_email(draft_id: str = "", to: str = "", subject: str = "", body: str = "", cc: str = ""):
    """
    Sends an email over SMTP. THIS CANNOT BE UNDONE — the message leaves the
    machine and arrives in someone else's inbox. Lumina requires explicit human
    approval before this runs.

    Either pass a draft_id to send a previously saved draft, or pass to/subject/body
    to send directly.

    Args:
        draft_id: id of a saved draft to send. Takes precedence over the fields below.
        to: recipient address, or several separated by commas.
        subject: the subject line.
        body: the plain-text body of the message.
        cc: optional carbon-copy addresses, separated by commas.
    """
    try:
        if draft_id:
            draft = _load(draft_id)
            if draft.get("status") == "sent":
                return {"status": f"Draft '{draft_id}' has already been sent; refusing to send it twice."}
            to, cc, subject, body = draft["to"], draft.get("cc", ""), draft["subject"], draft["body"]

        if not to or not subject:
            return {"status": "Refusing to send: 'to' and 'subject' are both required."}

        settings = _smtp_settings()

        missing = [key for key in ("host", "user", "password") if not settings[key]]
        if missing:
            # Fail loudly rather than pretending. A tool that reports success
            # without sending is worse than one that cannot send at all.
            return {
                "status": (
                    "Not sent — SMTP is not configured. "
                    f"Missing: {', '.join('SMTP_' + key.upper() for key in missing)}. "
                    "Set them in Lumina's credential store and try again."
                )
            }

        message = EmailMessage()
        message["From"] = settings["sender"]
        message["To"] = to
        if cc:
            message["Cc"] = cc
        message["Subject"] = subject
        message.set_content(body)

        context = ssl.create_default_context()

        if settings["port"] == 465:
            with smtplib.SMTP_SSL(settings["host"], settings["port"], context=context) as server:
                server.login(settings["user"], settings["password"])
                server.send_message(message)
        else:
            with smtplib.SMTP(settings["host"], settings["port"]) as server:
                server.starttls(context=context)
                server.login(settings["user"], settings["password"])
                server.send_message(message)

        sent_at = datetime.now(timezone.utc).isoformat()

        if draft_id:
            draft = _load(draft_id)
            draft["status"] = "sent"
            draft["sent_at"] = sent_at
            _draft_path(draft_id).write_text(json.dumps(draft, indent=2))

        return {
            "status": "Email sent successfully",
            "to": to,
            "subject": subject,
            "sent_at": sent_at,
        }

    except Exception as e:
        return {"status": f"Failed to send email, error: {e}"}


if __name__ == "__main__":
    mcp.run(transport="stdio")
