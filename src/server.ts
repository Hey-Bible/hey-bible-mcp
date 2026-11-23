import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  Configuration,
  GenerateImageRequestSizeEnum,
  GenerateImageRequestThemeEnum,
  HeyBibleApi,
  type FetchAPI,
} from "@hey-bible/client";

export const SERVER_VERSION = "1.1.0";

export class MissingApiKeyError extends Error {
  constructor() {
    super("HEY_BIBLE_API_KEY environment variable is required");
    this.name = "MissingApiKeyError";
  }
}

export interface ApiOptions {
  /** Environment to read HEY_BIBLE_API_KEY and HEY_BIBLE_API_URL from. Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** fetch implementation for the client. Tests pass a fake one. */
  fetchApi?: FetchAPI;
}

/**
 * Build a HeyBibleApi client from HEY_BIBLE_API_KEY and, when set,
 * HEY_BIBLE_API_URL (a base URL override, for example a local stack).
 */
export function createApi({ env = process.env, fetchApi }: ApiOptions = {}): HeyBibleApi {
  const apiKey = env.HEY_BIBLE_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError();
  }
  // An empty HEY_BIBLE_API_URL means "not set", so the client keeps its default.
  const basePath = env.HEY_BIBLE_API_URL || undefined;
  return new HeyBibleApi(new Configuration({ apiKey, basePath, fetchApi }));
}

function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

interface ApiFailure {
  status?: number;
  message: string;
}

/**
 * Pull the status and the API's own message out of a failed call. The client
 * throws a ResponseError whose message is generic; the useful text is the
 * `error` field of the response body. The client is compiled to ES5, so
 * `instanceof ResponseError` does not work and the name is checked instead.
 */
async function describeFailure(error: unknown): Promise<ApiFailure> {
  const response = (error as { name?: string; response?: Response } | null)?.response;
  if ((error as { name?: string } | null)?.name === "ResponseError" && response) {
    let message = `HTTP ${response.status}`;
    try {
      const text = await response.text();
      try {
        const body = JSON.parse(text) as { error?: unknown; message?: unknown };
        const apiMessage = body.error ?? body.message;
        message = typeof apiMessage === "string" ? apiMessage : text || message;
      } catch {
        message = text || message;
      }
    } catch {
      // The body could not be read; keep the status line.
    }
    return { status: response.status, message };
  }
  return { message: error instanceof Error ? error.message : "Unknown error" };
}

async function failure(action: string, error: unknown): Promise<CallToolResult> {
  const { status, message } = await describeFailure(error);
  return errorResult(`Error ${action}${status ? ` (${status})` : ""}: ${message}`);
}

const THEMES = Object.values(GenerateImageRequestThemeEnum) as [
  GenerateImageRequestThemeEnum,
  ...GenerateImageRequestThemeEnum[],
];
const SIZES = Object.values(GenerateImageRequestSizeEnum) as [
  GenerateImageRequestSizeEnum,
  ...GenerateImageRequestSizeEnum[],
];

export const GENERATE_IMAGE_DESCRIPTION =
  "Draw a new picture for a Bible verse and save it to the user's Hey Bible account, the same way the app does. " +
  "This spends the account's credits (the cost depends on the model), so ask the user before calling it. " +
  "Name the verse with verse_id, or with book and chapter (plus start_verse, end_verse and bible_id). " +
  "Returns the new image's id and a signed link to the image that works for 24 hours. " +
  "If signed_url is null, fetch the image later with get_images and the id instead of generating it again.";

/** Create the MCP server with every Hey Bible tool registered against `api`. */
export function createServer(api: HeyBibleApi): McpServer {
  const server = new McpServer({
    name: "hey-bible",
    version: SERVER_VERSION,
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
        return jsonResult(await api.biblesGet());
      } catch (error) {
        return failure("fetching bibles", error);
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
        return jsonResult(await api.booksGet());
      } catch (error) {
        return failure("fetching books", error);
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
        return jsonResult(
          await api.searchGet({
            book,
            chapter,
            startVerse: start_verse,
            endVerse: end_verse,
            bibleId: bible_id,
          })
        );
      } catch (error) {
        return failure("searching verses", error);
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
        return jsonResult(await api.favoritesGet({ tag, limit, offset }));
      } catch (error) {
        return failure("fetching favorites", error);
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
        return jsonResult(await api.chatsGet({ id, limit, offset }));
      } catch (error) {
        return failure("fetching chats", error);
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
        return jsonResult(await api.tagsGet());
      } catch (error) {
        return failure("fetching tags", error);
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
        return jsonResult(await api.notesGet({ id, limit, offset }));
      } catch (error) {
        return failure("fetching notes", error);
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
        return jsonResult(await api.imagesGet({ id, limit, offset }));
      } catch (error) {
        return failure("fetching images", error);
      }
    }
  );

  // Generate a verse image. This spends the account's credits.
  server.registerTool(
    "generate_image",
    {
      description: GENERATE_IMAGE_DESCRIPTION,
      inputSchema: {
        verse_id: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            "ID of a verse already saved to the account (from search_verses or get_favorites). When set, book, chapter, start_verse, end_verse and bible_id are ignored."
          ),
        book: z
          .string()
          .optional()
          .describe('Book name (e.g. "Isaiah"). Required with chapter when verse_id is not set.'),
        chapter: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Chapter number. Required with book when verse_id is not set."),
        start_verse: z.number().int().min(1).optional().describe("First verse of the passage"),
        end_verse: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Last verse of the passage. Defaults to start_verse."),
        bible_id: z
          .string()
          .optional()
          .describe("Bible translation ID. Use get_bibles to see available IDs."),
        theme: z
          .enum(THEMES)
          .optional()
          .describe("Picture style. Defaults to hey_bible, the app's house style. custom draws theme_content."),
        theme_content: z
          .string()
          .optional()
          .describe("What to draw. Required when theme is custom."),
        size: z
          .enum(SIZES)
          .optional()
          .describe("Image shape: portrait (9:16), square (1:1, the default) or landscape (16:9)."),
        model: z
          .string()
          .optional()
          .describe("Image model ID. Defaults to the app's default model. Models cost different numbers of credits."),
        quote: z
          .string()
          .optional()
          .describe(
            "Text printed on the picture. Defaults to the verse text. At most 40 words for square and 70 for portrait or landscape."
          ),
        source: z
          .string()
          .optional()
          .describe("Citation printed under the quote. Defaults to the verse reference."),
        copyright: z
          .string()
          .optional()
          .describe("Copyright line. Ignored when the translation has its own."),
      },
    },
    async (input) => {
      try {
        const { image, creditsCharged } = await api.imagesPost({
          generateImageRequest: {
            verseId: input.verse_id,
            book: input.book,
            chapter: input.chapter,
            startVerse: input.start_verse,
            endVerse: input.end_verse,
            bibleId: input.bible_id,
            theme: input.theme,
            themeContent: input.theme_content,
            size: input.size,
            model: input.model,
            quote: input.quote,
            source: input.source,
            copyright: input.copyright,
          },
        });
        return jsonResult({
          image_id: image?.id ?? null,
          signed_url: image?.signedUrl ?? null,
          ...(image?.signedUrlError ? { signed_url_error: image.signedUrlError } : {}),
          credits_charged: creditsCharged ?? null,
          image,
        });
      } catch (error) {
        const { status, message } = await describeFailure(error);
        if (status === 402) {
          return errorResult(
            `The Hey Bible account is out of credits, so no image was made (402): ${message} Add credits in the Hey Bible app, then try again.`
          );
        }
        return errorResult(`Error generating image${status ? ` (${status})` : ""}: ${message}`);
      }
    }
  );

  return server;
}
