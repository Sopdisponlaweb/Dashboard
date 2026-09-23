#!/usr/bin/env node
/**
 * Servidor MCP local para Sopdisponal.
 *
 * Conecta Claude Desktop / Claude Code con datos reales de la plataforma
 * (afiliados, pagos, créditos). Las herramientas de lectura consultan directo;
 * las de escritura siguen el patrón "proponer -> confirmar humano -> aplicar"
 * (ver README.md).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerReadTools } from "./read-tools.js";
import { registerWriteTools } from "./write-tools.js";

const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "MCP_SUPABASE_EMAIL", "MCP_SUPABASE_PASSWORD"];

for (const name of requiredEnvVars) {
  if (!process.env[name]) {
    console.error(`ERROR: falta la variable de entorno ${name}. Revisa mcp-server/README.md.`);
    process.exit(1);
  }
}

const server = new McpServer({ name: "sopdisponal-mcp-server", version: "1.0.0" });

registerReadTools(server);
registerWriteTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("sopdisponal-mcp-server corriendo por stdio.");
}

main().catch((error) => {
  console.error("Error al iniciar el servidor MCP:", error);
  process.exit(1);
});
