#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApi, createServer, MissingApiKeyError } from "./server.js";

async function main() {
  let api;
  try {
    api = createApi();
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const server = createServer(api);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Hey Bible MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
