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
  version: "1.1.0",
});

// Get available Bibles
server.registerTool(
  "get_bibles",
  {
    description:
      "Get available Bible translations from Hey Bible. Returns a list of Bibles with their ID, name, abbreviation, and source.",
    inputSchema: {},
  },
  async () => {
    try {
      const response = await api.biblesGet();
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
            text: `Error fetching bibles: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Get Bible books
server.registerTool(
  "get_books",
  {
    description:
      "Get the list of Bible books from Hey Bible. Returns books with their name, 3-letter code, and chapter count.",
    inputSchema: {},
  },
  async () => {
    try {
      const response = await api.booksGet();
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
            text: `Error fetching books: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Search for verses
server.registerTool(
  "search_verses",
  {
    description:
      "Search for Bible verses by book and chapter. Saves the result to the user's Hey Bible account. If start_verse and end_verse are omitted, returns the full chapter.",
    inputSchema: {
      book: z
        .string()
        .describe('Book name (e.g. "John", "Genesis", "1 Corinthians")'),
      chapter: z.number().min(1).describe("Chapter number"),
      start_verse: z
        .number()
        .min(1)
        .optional()
        .describe("Starting verse number (defaults to 1)"),
      end_verse: z
        .number()
        .min(1)
        .optional()
        .describe("Ending verse number (defaults to last verse in chapter)"),
      bible_id: z
        .string()
        .optional()
        .describe(
          "Bible translation ID (defaults to ESV). Use get_bibles to see available IDs."
        ),
    },
  },
  async ({ book, chapter, start_verse, end_verse, bible_id }) => {
    try {
      const response = await api.searchGet({
        book,
        chapter,
        startVerse: start_verse,
        endVerse: end_verse,
        bibleId: bible_id,
      });
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
            text: `Error searching verses: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Get favorite verses
server.registerTool(
  "get_favorites",
  {
    description:
      "Get favorite Bible verses from Hey Bible. Returns favorited verses with their notes, images, conversations, and tags.",
    inputSchema: {
      tag: z
        .string()
        .optional()
        .describe("Filter favorites by tag name"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of favorites to return (1-100)."),
      offset: z
        .number()
        .min(0)
        .optional()
        .describe("Number of favorites to skip for pagination."),
    },
  },
  async ({ tag, limit, offset }) => {
    try {
      const response = await api.favoritesGet({ tag, limit, offset });
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
            text: `Error fetching favorites: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Get chats
server.registerTool(
  "get_chats",
  {
    description:
      "Get chat conversations from Hey Bible. Returns chats with verse context. If ID is provided, returns a single chat with its messages.",
    inputSchema: {
      id: z
        .string()
        .optional()
        .describe("Specific chat ID (UUID) to retrieve with full messages."),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of chats to return (1-100). Ignored if id is specified."),
      offset: z
        .number()
        .min(0)
        .optional()
        .describe("Number of chats to skip for pagination. Ignored if id is specified."),
    },
  },
  async ({ id, limit, offset }) => {
    try {
      const response = await api.chatsGet({ id, limit, offset });
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
            text: `Error fetching chats: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Get tags
server.registerTool(
  "get_tags",
  {
    description:
      "Get all tags defined by the user in Hey Bible. Tags can be used to filter favorites.",
    inputSchema: {},
  },
  async () => {
    try {
      const response = await api.tagsGet();
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
            text: `Error fetching tags: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Get notes
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

// Get images
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

server.registerTool(
  "generate_image",
  {
    description:
      "Generate a new Hey Bible verse image and save it to the API key owner's gallery. Charges credits. Does not publish anything. Returns the image id and a 24-hour signed URL. Themes include medieval, landscape, literal, stained_glass, fantasy, animals, celestial, flowers, watercolor, minimalist, and custom.",
    inputSchema: {
      book: z.string().optional().describe("Book name, required unless verse_id is set"),
      chapter: z.number().min(1).optional().describe("Chapter number"),
      start_verse: z.number().min(1).optional().describe("Starting verse"),
      end_verse: z.number().min(1).optional().describe("Ending verse"),
      bible_id: z.string().optional().describe("Bible translation ID. Defaults to the account default."),
      verse_id: z.number().optional().describe("Existing Hey Bible verse id, if already known"),
      theme: z
        .enum([
          "animals",
          "celestial",
          "custom",
          "fantasy",
          "flowers",
          "landscape",
          "literal",
          "medieval",
          "minimalist",
          "stained_glass",
          "watercolor",
        ])
        .optional()
        .describe("Image theme. Defaults to landscape. Use medieval for knights, castles, and chivalry."),
      theme_content: z.string().optional().describe("Required when theme is custom"),
      size: z.enum(["portrait", "square", "landscape"]).optional().describe("Defaults to square"),
      model: z.string().optional().describe("Optional Venice model id. Defaults to the app default."),
      quote: z.string().optional().describe("Overlay text. Defaults to the verse text."),
      source: z.string().optional().describe("Citation line. Defaults to the verse reference."),
      copyright: z.string().optional().describe("Optional copyright line for the overlay"),
    },
  },
  async (input) => {
    try {
      const response = await fetch("https://api.heybible.app/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hey-Bible-Api-Key": API_KEY as string,
        },
        body: JSON.stringify(input),
      });
      const text = await response.text();
      if (!response.ok) {
        return {
          content: [{ type: "text", text: `Error generating image (${response.status}): ${text}` }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error generating image: ${message}` }],
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
