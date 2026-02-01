# @hey-bible/mcp

MCP server for the Hey Bible API. Provides tools for accessing your saved Bible verses, notes, and AI-generated images.

## Installation

```bash
npm install -g @hey-bible/mcp
```

Or run directly with npx:

```bash
npx @hey-bible/mcp
```

## Configuration

Set your Hey Bible API key as an environment variable:

```bash
export HEY_BIBLE_API_KEY=your_api_key_here
```

Get your API key from [Hey Bible](https://heybible.app) under Account > API Keys.

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "hey-bible": {
      "command": "npx",
      "args": ["-y", "@hey-bible/mcp"],
      "env": {
        "HEY_BIBLE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Then restart Claude Desktop.

## Available Tools

### get_verses

Get saved Bible verses with their content, notes, and images.

Parameters:
- `id` (optional): Specific verse ID to retrieve
- `limit` (optional): Number of verses to return (1-100)
- `offset` (optional): Number of verses to skip for pagination

### get_notes

Get notes associated with Bible verses.

Parameters:
- `id` (optional): Specific note ID to retrieve
- `limit` (optional): Number of notes to return (1-100)
- `offset` (optional): Number of notes to skip for pagination

### get_images

Get AI-generated images associated with Bible verses.

Parameters:
- `id` (optional): Specific image ID to retrieve (returns signed URL with 24 hour expiry)
- `limit` (optional): Number of images to return (1-100)
- `offset` (optional): Number of images to skip for pagination

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
HEY_BIBLE_API_KEY=your_key node dist/index.js
```

## License

MIT
