# @hey-bible/mcp

MCP server for the Hey Bible API. Provides tools for searching Bible verses, browsing translations, and accessing your favorites, notes, images, chats, and tags.

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

### get_bibles

Get available Bible translations.

### get_books

Get the list of Bible books with their 3-letter codes and chapter counts.

### search_verses

Search for Bible verses by book and chapter. Saves the result to the user's account.

Parameters:
- `book` (required): Book name (e.g. "John", "Genesis", "1 Corinthians")
- `chapter` (required): Chapter number
- `start_verse` (optional): Starting verse number
- `end_verse` (optional): Ending verse number
- `bible_id` (optional): Bible translation ID (defaults to ESV)

### get_favorites

Get favorite Bible verses with their notes, images, conversations, and tags.

Parameters:
- `tag` (optional): Filter favorites by tag name
- `limit` (optional): Number of favorites to return (1-100)
- `offset` (optional): Number of favorites to skip for pagination

### get_chats

Get chat conversations with verse context.

Parameters:
- `id` (optional): Specific chat ID (UUID) to retrieve with full messages
- `limit` (optional): Number of chats to return (1-100)
- `offset` (optional): Number of chats to skip for pagination

### get_tags

Get all user-defined tags. Tags can be used to filter favorites.

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

## Releasing

Releases are automated via GitHub Actions. When you push a version tag, the workflow will:

1. Create a GitHub release with auto-generated release notes
2. Publish the package to npm with the version from the tag

The `package.json` version doesn't need to be updated manually — the CI extracts the version from the git tag and sets it in the build before publishing.

```bash
# 1. Commit your changes
git add .
git commit -m "feat: description of changes"

# 2. Tag with the new version
git tag v1.1.0

# 3. Push the commit and tag
git push origin main --tags
```

The workflow handles the rest. You'll need an `NPM_TOKEN` secret configured in the repository settings.

## License

MIT
