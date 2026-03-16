# GEA Virtual Tours

## What This Is
A Node.js CLI tool that creates virtual tours and floor plans from DJI Osmo 360 camera output. Single command: `tour ./property-photos/`

## Tech Stack
- Node.js 22 (ESM modules, built-in fetch/FormData)
- 1 dependency: commander (CLI framework)
- Node built-in test runner

## Pipeline
1. Ingest folder → detect 360° JPEGs + optional MP4
2. Upload to Kuula.co → create tour with sequential hotspot links
3. Submit to CubiCasa → generate floor plan PDF
4. (Optional) Upload MP4 to YouTube as unlisted 360° video
5. Output shareable URLs + floor plan file

## API Status (as of 2026-03-15)
- **Kuula:** No publicly documented REST API for content creation. Only a client-side Player API for embedded tours. May have enterprise API — contact contact@kuula.co. The client in src/kuula.js uses placeholder endpoints that will need updating once API access is confirmed.
- **CubiCasa:** Conversion API at api.cubi.casa/conversion. Uses x-api-key auth. t1=from images, t3=from SDK scan. t3 requires CubiCapture mobile SDK (ARKit data). Source files must be at public URLs. Delivery via webhooks. Exporter API at api.cubi.casa/exporter for PDF/PNG/SVG output.
- **YouTube:** Standard Data API v3, OAuth2 refresh token flow. Works as expected.

## Key Files
- `bin/tour.js` — CLI entry point
- `src/pipeline.js` — orchestrates the full flow
- `src/kuula.js` — Kuula API client (needs real endpoint verification)
- `src/cubicasa.js` — CubiCasa Conversion + Exporter API client
- `src/youtube.js` — YouTube upload with OAuth2
- `src/config.js` — .tourrc config loader
- `src/ingest.js` — folder scanner (tested, 4/4 pass)

## Commands
- `npm test` — run unit tests
- `npm link` — install `tour` CLI globally
- `tour --dry-run ./folder/` — preview without API calls
