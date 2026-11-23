// These tests drive the MCP server through an in-memory MCP client. Every
// HTTP call goes to a fake fetch, so they never reach the real API, need no
// API key, and spend no credits.
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { createApi, createServer, MissingApiKeyError, SERVER_VERSION } from "../src/server.js";

interface FakeCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakeFetch(status: number, body: unknown) {
  const calls: FakeCall[] = [];
  const fetchApi = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { calls, fetchApi };
}

const TEST_ENV = { HEY_BIBLE_API_KEY: "test-key", HEY_BIBLE_API_URL: "http://api.test" };

const openClients: Client[] = [];

async function connect(fetchApi: ReturnType<typeof fakeFetch>["fetchApi"], env = TEST_ENV) {
  const server = createServer(createApi({ env, fetchApi }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  openClients.push(client);
  return client;
}

afterEach(async () => {
  await Promise.all(openClients.splice(0).map((client) => client.close()));
});

function textOf(result: CallToolResult): string {
  return result.content.map((part) => (part.type === "text" ? part.text : "")).join("");
}

const SUCCESS_BODY = {
  image: {
    id: 42,
    verse_id: 7,
    storage_path: "user/42.png",
    signed_url: "https://example.test/42.png?token=abc",
    prompt: "an eagle over the mountains",
    size: "landscape",
    model: "flux-2-pro",
    created_at: "2026-11-22T00:00:00Z",
    quote: "But those who wait for Yahweh will renew their strength.",
    source: "Isaiah 40:31 (WEB)",
    copyright: null,
    fums_token: null,
  },
  credits_charged: 3,
};

describe("server version", () => {
  it("reports the version in package.json, which the release workflow sets from the tag", async () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
    expect(SERVER_VERSION).toBe(pkg.version);
    const client = await connect(fakeFetch(200, {}).fetchApi);
    expect(client.getServerVersion()).toMatchObject({ name: "hey-bible", version: pkg.version });
  });
});

describe("createApi", () => {
  it("requires HEY_BIBLE_API_KEY", () => {
    expect(() => createApi({ env: {} })).toThrow(MissingApiKeyError);
  });

  it("sends requests to HEY_BIBLE_API_URL when it is set", async () => {
    const { calls, fetchApi } = fakeFetch(200, { bibles: [] });
    await createApi({ env: TEST_ENV, fetchApi }).biblesGet();
    expect(calls[0].url).toBe("http://api.test/bibles");
    expect(calls[0].headers["X-Hey-Bible-Api-Key"]).toBe("test-key");
  });

  it("uses the production API when HEY_BIBLE_API_URL is unset or empty", async () => {
    for (const env of [{ HEY_BIBLE_API_KEY: "k" }, { HEY_BIBLE_API_KEY: "k", HEY_BIBLE_API_URL: "" }]) {
      const { calls, fetchApi } = fakeFetch(200, { bibles: [] });
      await createApi({ env, fetchApi }).biblesGet();
      expect(calls[0].url).toBe("https://api.heybible.app/bibles");
    }
  });
});

describe("generate_image", () => {
  it("is listed with a description that warns about credits and the full input schema", async () => {
    const client = await connect(fakeFetch(200, {}).fetchApi);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "generate_image");
    expect(tool).toBeDefined();
    expect(tool!.description).toMatch(/spends the account's credits/);
    expect(tool!.description).toMatch(/ask the user before calling it/);

    const schema = tool!.inputSchema as {
      properties: Record<string, { type?: string; enum?: string[] }>;
      required?: string[];
    };
    expect(Object.keys(schema.properties).sort()).toEqual(
      [
        "bible_id",
        "book",
        "chapter",
        "copyright",
        "end_verse",
        "model",
        "quote",
        "size",
        "source",
        "start_verse",
        "theme",
        "theme_content",
        "verse_id",
      ].sort()
    );
    expect(schema.required ?? []).toEqual([]);
    expect(schema.properties.verse_id.type).toBe("integer");
    expect(schema.properties.size.enum).toEqual(["portrait", "square", "landscape"]);
    expect(schema.properties.theme.enum).toEqual([
      "hey_bible",
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
    ]);
  });

  it("sends POST /images with the API key and a snake_case body", async () => {
    const { calls, fetchApi } = fakeFetch(200, SUCCESS_BODY);
    const client = await connect(fetchApi);
    await client.callTool({
      name: "generate_image",
      arguments: {
        book: "Isaiah",
        chapter: 40,
        start_verse: 31,
        bible_id: "web",
        theme: "watercolor",
        size: "landscape",
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://api.test/images");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers["X-Hey-Bible-Api-Key"]).toBe("test-key");
    expect(calls[0].headers["Content-Type"]).toBe("application/json");
    expect(calls[0].body).toEqual({
      book: "Isaiah",
      chapter: 40,
      start_verse: 31,
      bible_id: "web",
      theme: "watercolor",
      size: "landscape",
    });
  });

  it("passes verse_id, custom theme content and overlay text through", async () => {
    const { calls, fetchApi } = fakeFetch(200, SUCCESS_BODY);
    const client = await connect(fetchApi);
    await client.callTool({
      name: "generate_image",
      arguments: {
        verse_id: 7,
        theme: "custom",
        theme_content: "an eagle rising over a mountain lake at dawn",
        model: "flux-2-pro",
        quote: "They will mount up with wings like eagles.",
        source: "Isaiah 40:31",
      },
    });
    expect(calls[0].body).toEqual({
      verse_id: 7,
      theme: "custom",
      theme_content: "an eagle rising over a mountain lake at dawn",
      model: "flux-2-pro",
      quote: "They will mount up with wings like eagles.",
      source: "Isaiah 40:31",
    });
  });

  it("returns the new image's id and signed link", async () => {
    const client = await connect(fakeFetch(200, SUCCESS_BODY).fetchApi);
    const result = (await client.callTool({
      name: "generate_image",
      arguments: { book: "Isaiah", chapter: 40, start_verse: 31 },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(textOf(result));
    expect(body.image_id).toBe(42);
    expect(body.signed_url).toBe("https://example.test/42.png?token=abc");
    expect(body.credits_charged).toBe(3);
    expect(body.signed_url_error).toBeUndefined();
    expect(body.image.quote).toBe("But those who wait for Yahweh will renew their strength.");
  });

  it("passes on signed_url_error when the link could not be signed", async () => {
    const signedUrlError =
      "Image was created but its URL could not be signed. Fetch it with GET /api/images?id=42 instead of generating again.";
    const client = await connect(
      fakeFetch(200, {
        ...SUCCESS_BODY,
        image: { ...SUCCESS_BODY.image, signed_url: null, signed_url_error: signedUrlError },
      }).fetchApi
    );
    const result = (await client.callTool({
      name: "generate_image",
      arguments: { verse_id: 7 },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(textOf(result));
    expect(body.image_id).toBe(42);
    expect(body.signed_url).toBeNull();
    expect(body.signed_url_error).toBe(signedUrlError);
  });

  it("returns a 400 as a tool error with the API's message", async () => {
    const client = await connect(
      fakeFetch(400, { error: "theme_content is required when theme is custom" }).fetchApi
    );
    const result = (await client.callTool({
      name: "generate_image",
      arguments: { verse_id: 7, theme: "custom" },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      "Error generating image (400): theme_content is required when theme is custom"
    );
  });

  it("says the account is out of credits on a 402", async () => {
    const client = await connect(
      fakeFetch(402, { error: "Insufficient credits. This model requires 3 credits." }).fetchApi
    );
    const result = (await client.callTool({
      name: "generate_image",
      arguments: { book: "Isaiah", chapter: 40, start_verse: 31 },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/out of credits/);
    expect(textOf(result)).toMatch(/Insufficient credits\. This model requires 3 credits\./);
  });

  it("rejects input outside the schema without calling the API", async () => {
    const { calls, fetchApi } = fakeFetch(200, SUCCESS_BODY);
    const client = await connect(fetchApi);
    const outcome = await client
      .callTool({ name: "generate_image", arguments: { verse_id: 7, theme: "vaporwave" } })
      .then(
        (result) => (result as CallToolResult).isError === true,
        () => true
      );
    expect(outcome).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("other tools", () => {
  it("report the API's error message instead of a generic one", async () => {
    const client = await connect(fakeFetch(500, { error: "Database unavailable" }).fetchApi);
    const result = (await client.callTool({ name: "get_bibles", arguments: {} })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Error fetching bibles (500): Database unavailable");
  });
});
