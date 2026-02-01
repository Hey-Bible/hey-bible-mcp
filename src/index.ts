#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Configuration, HeyBibleApi } from "@hey-bible/client";

const API_KEY = process.env.HEY_BIBLE_API_KEY;

if (!API_KEY) {
  console.error("Error: HEY_BIBLE_API_KEY environment variable is required");
  process.exit(1);
}

const config = new Configuration({
  apiKey: API_KEY,
});

const api = new HeyBibleApi(config);

const server = new McpServer({
  name: "hey-bible",
  version: "1.0.0",
});

// Get verses tool
server.registerTool(
  "get_verses",
  {
    description:
      "Get saved Bible verses from Hey Bible. Returns verses with their book, chapter, verse numbers, content, and any associated notes and images.",
    inputSchema: {
      id: z
        .number()
        .optional()
        .describe("Specific verse ID to retrieve. If provided, returns only that verse."),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of verses to return (1-100). Ignored if id is specified."),
      offset: z
        .number()
        .min(0)
        .optional()
        .describe("Number of verses to skip for pagination. Ignored if id is specified."),
    },
  },
  async ({ id, limit, offset }) => {
    try {
      const response = await api.versesGet({ id, limit, offset });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching verses: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Get notes tool
server.registerTool(
  "get_notes",
  {
    description:
      "Get notes from Hey Bible. Notes are user-created annotations associated with Bible verses.",
    inputSchema: {
      id: z
        .number()
        .optional()
        .describe("Specific note ID to retrieve. If provided, returns only that note."),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of notes to return (1-100). Ignored if id is specified."),
      offset: z
        .number()
        .min(0)
        .optional()
        .describe("Number of notes to skip for pagination. Ignored if id is specified."),
    },
  },
  async ({ id, limit, offset }) => {
    try {
      const response = await api.notesGet({ id, limit, offset });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching notes: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Get images tool
server.registerTool(
  "get_images",
  {
    description:
      "Get AI-generated images from Hey Bible. Images are associated with Bible verses. When fetching a specific image by ID, a signed URL is returned for accessing the image.",
    inputSchema: {
      id: z
        .number()
        .optional()
        .describe(
          "Specific image ID to retrieve. If provided, returns that image with a signed URL (24 hour expiry)."
        ),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of images to return (1-100). Ignored if id is specified."),
      offset: z
        .number()
        .min(0)
        .optional()
        .describe("Number of images to skip for pagination. Ignored if id is specified."),
    },
  },
  async ({ id, limit, offset }) => {
    try {
      const response = await api.imagesGet({ id, limit, offset });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error fetching images: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Hey Bible MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
