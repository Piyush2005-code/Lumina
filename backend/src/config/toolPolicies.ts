import type { ExecutionPolicy } from "../tools/Tool.js";

/**
 * Which tools a human has to authorise.
 *
 * Three inputs decide a tool's policy, in increasing priority:
 *
 *   1. the MCP server's own annotations (`readOnlyHint` / `destructiveHint`)
 *   2. the name heuristic below, for servers that publish no annotations
 *   3. the explicit overrides here, which always win
 *
 * The default for an unrecognised tool is APPROVAL_REQUIRED. Erring toward
 * asking is the only safe default: a tool nobody has classified is a tool
 * nobody has read.
 */

/** Exact qualified tool names, checked first and never overridden. */
export const POLICY_OVERRIDES: Record<string, ExecutionPolicy> = {
    "filesystem__read_file": "READ_ONLY",
    "filesystem__list_directory": "READ_ONLY",
    "filesystem__search_files": "READ_ONLY",
    "filesystem__get_file_metadata": "READ_ONLY",
    "filesystem__write_file": "APPROVAL_REQUIRED",

    "shell__command": "APPROVAL_REQUIRED",

    "email__list_drafts": "READ_ONLY",
    "email__read_draft": "READ_ONLY",
    // Creating a draft touches nothing outside Lumina's own data directory.
    "email__create_draft": "READ_ONLY",
    // Sending one cannot be taken back.
    "email__send_email": "APPROVAL_REQUIRED",
};

/** Verbs that mean "this leaves a mark", used when a server publishes no annotations. */
const MUTATING_PATTERN = /(^|_)(write|create|update|delete|remove|send|exec|execute|run|command|move|rename|install|kill|shutdown|push|commit|click|type|press)(_|$)/i;

/** Verbs that only observe. */
const READ_ONLY_PATTERN = /(^|_)(read|list|get|search|find|show|describe|stat|inspect|screenshot|size|position)(_|$)/i;

export interface AnnotationHints {
    readOnlyHint?: boolean | undefined;
    destructiveHint?: boolean | undefined;
}

export function resolveExecutionPolicy(qualifiedName: string, hints: AnnotationHints): ExecutionPolicy {

    const override = POLICY_OVERRIDES[qualifiedName];
    if (override !== undefined) {
        return override;
    }

    if (hints.destructiveHint === true) {
        return "APPROVAL_REQUIRED";
    }
    if (hints.readOnlyHint === true) {
        return "READ_ONLY";
    }

    // Check the mutating pattern first: "create_draft" contains both verbs and
    // the more dangerous reading should win when a name is ambiguous.
    if (MUTATING_PATTERN.test(qualifiedName)) {
        return "APPROVAL_REQUIRED";
    }
    if (READ_ONLY_PATTERN.test(qualifiedName)) {
        return "READ_ONLY";
    }

    return "APPROVAL_REQUIRED";
}
