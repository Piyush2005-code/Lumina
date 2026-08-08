/**
 * Proves the approval gate is an enforcement point, not a UI convention.
 *
 * Every assertion here bypasses the frontend entirely and calls the executor
 * directly — which is exactly what an attacker (or a bug) would do. If approval
 * only existed in React, every one of these would pass when it should fail.
 *
 * Run with:  npm test
 */

import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// Isolated database per run, so tests never touch real conversations.
const dbPath = path.join(os.tmpdir(), `lumina-test-${Date.now()}.db`);
process.env.LUMINA_DB_PATH = dbPath;
process.env.LOG_LEVEL = "silent";

const { getDatabase } = await import("../dist/db/Database.js");
const { toolRegistry } = await import("../dist/tools/ToolRegistry.js");
const { ToolRouter } = await import("../dist/tools/ToolRouter.js");
const { ToolExecutor } = await import("../dist/tools/ToolExecutor.js");
const { defaultToolPolicy } = await import("../dist/tools/ToolPolicy.js");
const { approvalStore } = await import("../dist/approvals/ApprovalStore.js");
const { toolExecutionStore } = await import("../dist/tools/ToolExecutionStore.js");
const { conversationStore } = await import("../dist/runtime/ConversationStore.js");
const { resolveExecutionPolicy } = await import("../dist/config/toolPolicies.js");

getDatabase();

let sent = 0;

toolRegistry.register({
    name: "email__send_email",
    description: "Sends an email",
    parameters: { type: "object", required: ["to"], properties: { to: { type: "string" } } },
    source: { kind: "native" },
    executionPolicy: "APPROVAL_REQUIRED",
    async execute(args) {
        sent++;
        return { content: [{ type: "text", text: `sent to ${args.to}` }] };
    },
});

toolRegistry.register({
    name: "filesystem__read_file",
    description: "Reads a file",
    parameters: { type: "object", required: ["path"], properties: { path: { type: "string" } } },
    source: { kind: "native" },
    executionPolicy: "READ_ONLY",
    async execute() {
        return { content: [{ type: "text", text: "file contents" }] };
    },
});

const executor = new ToolExecutor(new ToolRouter(toolRegistry), defaultToolPolicy);

/** Sets up a conversation + execution row the way the runtime would. */
function propose(toolName, args) {
    const conversationId = conversationStore.create("test");
    const execution = toolExecutionStore.create({
        conversationId,
        toolCallId: "call-1",
        toolName,
        arguments: args,
        policy: "APPROVAL_REQUIRED",
    });
    const approval = approvalStore.create({
        conversationId,
        toolExecutionId: execution.id,
        toolName,
        arguments: args,
        reason: "test",
    });
    return { conversationId, execution, approval };
}

test("read-only tools run without anyone being asked", async () => {
    const outcome = await executor.execute("filesystem__read_file", { path: "README.md" });
    assert.equal(outcome.status, "executed");
});

test("a malformed call is denied before it can ask for approval", async () => {
    const outcome = await executor.execute("email__send_email", {});
    assert.equal(outcome.status, "denied");
    assert.match(outcome.reason, /Missing required argument/);
});

test("a side-effecting tool will not run unapproved", async () => {
    const before = sent;
    const outcome = await executor.execute("email__send_email", { to: "alice@example.com" });
    assert.equal(outcome.status, "requires_approval");
    assert.equal(sent, before, "nothing may be sent while approval is outstanding");
});

test("an undecided approval does not authorise anything", async () => {
    const { approval } = propose("email__send_email", { to: "alice@example.com" });
    const outcome = await executor.execute(
        "email__send_email",
        { to: "alice@example.com" },
        { approvalId: approval.id },
    );
    assert.equal(outcome.status, "denied");
    assert.match(outcome.reason, /WAITING_FOR_APPROVAL/);
});

test("a rejected approval does not authorise anything", async () => {
    const { approval } = propose("email__send_email", { to: "alice@example.com" });
    approvalStore.decide(approval.id, false);
    const outcome = await executor.execute(
        "email__send_email",
        { to: "alice@example.com" },
        { approvalId: approval.id },
    );
    assert.equal(outcome.status, "denied");
});

test("approving one recipient does not authorise a different one", async () => {
    const { approval } = propose("email__send_email", { to: "alice@example.com" });
    approvalStore.decide(approval.id, true);

    const before = sent;
    const tampered = await executor.execute(
        "email__send_email",
        { to: "attacker@example.com" },
        { approvalId: approval.id },
    );

    assert.equal(tampered.status, "denied");
    assert.match(tampered.reason, /differ from what was approved/);
    assert.equal(sent, before, "the tampered call must not reach the tool");
});

test("an approval authorises exactly the tool it was raised for", async () => {
    const { approval } = propose("email__send_email", { to: "alice@example.com" });
    approvalStore.decide(approval.id, true);

    const outcome = await executor.execute(
        "filesystem__read_file",
        { path: "x" },
        { approvalId: approval.id },
    );
    // Read-only tools never consult an approval, so this succeeds — the point is
    // that it succeeds on its own policy, and the approval is still unspent.
    assert.equal(outcome.status, "executed");
    assert.equal(approvalStore.get(approval.id).status, "APPROVED");
});

test("an approved call runs exactly once", async () => {
    const { approval } = propose("email__send_email", { to: "bob@example.com" });
    approvalStore.decide(approval.id, true);

    const before = sent;

    const first = await executor.execute(
        "email__send_email",
        { to: "bob@example.com" },
        { approvalId: approval.id },
    );
    assert.equal(first.status, "executed");
    assert.equal(sent, before + 1);

    // Replaying the same approval must not send a second email.
    const replay = await executor.execute(
        "email__send_email",
        { to: "bob@example.com" },
        { approvalId: approval.id },
    );
    assert.equal(replay.status, "denied");
    assert.match(replay.reason, /already been used/);
    assert.equal(sent, before + 1, "a consumed approval must not authorise a second send");
});

test("argument key order does not change an approval's identity", async () => {
    const { approval } = propose("email__send_email", { to: "carol@example.com", subject: "hi" });
    approvalStore.decide(approval.id, true);

    const outcome = await executor.execute(
        "email__send_email",
        { subject: "hi", to: "carol@example.com" },
        { approvalId: approval.id },
    );
    assert.equal(outcome.status, "executed");
});

test("an unknown tool is denied rather than executed", async () => {
    const outcome = await executor.execute("shell__rm_rf", { path: "/" });
    assert.equal(outcome.status, "denied");
});

test("policy classification errs toward asking", () => {
    assert.equal(resolveExecutionPolicy("email__send_email", {}), "APPROVAL_REQUIRED");
    assert.equal(resolveExecutionPolicy("filesystem__read_file", {}), "READ_ONLY");
    assert.equal(resolveExecutionPolicy("shell__command", {}), "APPROVAL_REQUIRED");
    // Unlisted verbs fall back to the name heuristic...
    assert.equal(resolveExecutionPolicy("github__delete_repo", {}), "APPROVAL_REQUIRED");
    assert.equal(resolveExecutionPolicy("github__list_issues", {}), "READ_ONLY");
    // ...and an unrecognisable name is treated as dangerous, not safe.
    assert.equal(resolveExecutionPolicy("weird__frobnicate", {}), "APPROVAL_REQUIRED");
    // A server's own annotation is honoured when there is no override.
    assert.equal(resolveExecutionPolicy("weird__frobnicate", { readOnlyHint: true }), "READ_ONLY");
    // An explicit override beats a server that claims to be harmless.
    assert.equal(resolveExecutionPolicy("shell__command", { readOnlyHint: true }), "APPROVAL_REQUIRED");
});

test.after(() => {
    try { fs.unlinkSync(dbPath); } catch { /* best effort */ }
});
