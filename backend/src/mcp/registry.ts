import { MCPServerRegistry } from "./MCPServerRegistry.js";
import { mcpServerConfigs } from "../config/mcpServers.js";

/**
 * The process-wide MCP registry. Kept in its own module so routes can report
 * connection health without importing the server bootstrap.
 */
export const mcpRegistry = new MCPServerRegistry(mcpServerConfigs);
