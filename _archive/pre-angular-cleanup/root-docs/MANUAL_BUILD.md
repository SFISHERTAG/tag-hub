# TAG CSM Operating Manual — Build System

## Overview

The TAG CSM Operating Manual is built from a structured JSON file (`manual-content.json`) and generated into 14 standalone HTML files using `generate-manual.js`.

## Files

- **manual-content.json** — Complete content for all 13 manual sections (00–13) in flattened JSON format
- **generate-manual.js** — Node.js script that reads the JSON and generates standalone HTML files
- **00.html through 13.html** — Generated standalone pages (one file per section)

## Structure

Each section is stored in the `pages` array with:
- `id` — Unique page ID (p0–p13)
- `num` — Section number (00–13)
- `title` — Page title
- `eyebrow` — Section category label
- `lede` — Opening summary paragraph
- `status` — Version/verification status
- `blocks` — Array of content blocks

### Block Types

Blocks can be one of several types:

#### paragraph
- `title` (optional) — Block heading
- `content` — Text content (supports `\n\n` for paragraph breaks)
- `caveatLabel` (optional) — Title for warning box
- `caveat` (optional) — Warning box content

#### heading
- `title` — Heading with optional section reference (e.g., "§02.1 Title")
- `content` — Body text

#### table
- `title` (optional) — Table caption
- `headers` — Array of column headers
- `rows` — Array of row arrays (each row is an array of cells)

#### note
- `severity` — "" (default), "hard", or "good"
- `title` — Note label
- `content` — Note text

#### procedure
- `ref` — Reference number (e.g., "06.1")
- `title` — Step title
- `steps` — Array of step descriptions
- `note` (optional) — Additional note below steps
- `warning` (optional) — Warning above steps

#### instrument
- `title` — Calculator/selector title
- `fields` — Array of input fields:
  - `label` — Field label
  - `id` — Element ID
  - `type` — "number" or "select"
  - `default` — Default value (for number inputs)
  - `options` — Array of options (for select inputs)
- `outputs` (optional) — Array of output cells:
  - `label` — Cell label
  - `id` — Element ID

## Building

Run the generator:

```bash
node generate-manual.js
```

This will regenerate all HTML files from the JSON source.

## Updating Content

1. Edit `manual-content.json` to update content blocks
2. Run `node generate-manual.js` to regenerate HTML files
3. Review the generated files in your browser

## Page Structure

Each generated HTML file includes:
- Complete CSS (inline, same as source document)
- Responsive design with mobile breakpoints
- Section number in footer
- Self-contained — no external dependencies

## Notes

- The JSON is "flat" — each block is stored as a simple object with a type and content
- The generator converts blocks to semantic HTML with proper styling
- Instruments (interactive calculators) render as shells — JavaScript functionality should be added separately if needed
- Table values with "$" or numeric prefixes get `class="v"` for monospace rendering

## Next Steps

- Add JavaScript for interactive instruments (unit economics calculator, cost per call check, etc.) if used in standalone pages
- Consider adding a navigation/index page linking all 13 sections
- Add print stylesheets if needed for PDF generation
