# Design Token Airtable Sync

Sync your design tokens from local JSON files to Airtable, resolving references and supporting semantic tokens.

## Features
- Reads semantic tokens from `/tokens/Modes/Light.json` and `/tokens/Modes/Dark.json`
- Resolves references to hex codes using `/tokens/Core.json`
- Populates Airtable columns: Token name, Component, Light value name, Light value, Dark value name, Dark value, Usage
- Groups components (e.g., `icon-*` → `icon`, `border-*` → `border`, etc.)
- Removes duplicates and cleans up the table

## Prerequisites
- Node.js (v16 or higher recommended)
- An Airtable account and base
- An Airtable API key or personal access token
- Your design tokens in the `/tokens` folder (see below)

## Installation

```sh
npm install
```

## Configuration

Set the following environment variables (in your shell, .env file, or GitHub Actions secrets):

- `AIRTABLE_API_KEY` — Your Airtable API key or personal access token
- `AIRTABLE_BASE_ID` — The ID of your Airtable base
- `AIRTABLE_TABLE_NAME` — The name of your Airtable table (e.g., `Semantic design tokens`)

Example:
```sh
export AIRTABLE_API_KEY=your_api_key
export AIRTABLE_BASE_ID=your_base_id
export AIRTABLE_TABLE_NAME="Semantic design tokens"
```

## Token File Structure

- `/tokens/Core.json` — Contains the actual hex values for all color primitives, structured by theme (e.g., `Light`, `Dark`)
- `/tokens/Modes/Light.json` — Contains semantic tokens for the light theme, with references to Core tokens
- `/tokens/Modes/Dark.json` — Contains semantic tokens for the dark theme, with references to Core tokens

## Usage

To sync your tokens to Airtable, run:

```sh
npm run sync
```

This will:
- Read and resolve all semantic tokens
- Insert/update them in your Airtable table
- Remove any duplicate tokens by `Token name`

## Airtable Table Setup

Your table should have the following columns (all as "Single line text"):
- `Token name`
- `Component`
- `Light value name`
- `Light value`
- `Dark value name`
- `Dark value`
- `Usage`

## Customization
- The script can be easily modified to support other token structures or additional columns.
- See `scripts/syncDesignTokensToAirtable.js` for details.

## License
MIT
