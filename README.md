# GEA Virtual Tours

CLI tool that creates virtual tours and floor plans from DJI Osmo 360 photos.

## Architecture

```
tour ./property-photos/
        │
        ├─→ [1] Scan folder for 360° JPEGs + optional MP4
        ├─→ [2] Upload to Kuula.co → create tour with hotspot links
        ├─→ [3] Submit to CubiCasa → generate floor plan PDF
        ├─→ [4] (Optional) Upload MP4 to YouTube as unlisted 360° video
        │
        └─→ Output: Kuula tour URL + floor plan PDF + YouTube URL
```

## Requirements

- Node.js 18+ (uses built-in `fetch`)
- DJI Osmo 360 equirectangular JPEG files (stitched via DJI Studio)
- Kuula Pro/Business account with API access
- CubiCasa API key (optional, for floor plan generation)

## Setup

```bash
# Install dependencies
npm install

# Link the CLI globally
npm link

# Copy and edit the config file
cp .tourrc.example .tourrc
# Edit .tourrc with your API keys
```

## Configuration (.tourrc)

Create a `.tourrc` file in your project directory or home folder:

```json
{
  "kuula_api_key": "YOUR_KUULA_API_KEY",
  "cubicasa_api_key": "YOUR_CUBICASA_API_KEY",

  "youtube_client_id": "",
  "youtube_client_secret": "",
  "youtube_refresh_token": ""
}
```

Only `kuula_api_key` is required. CubiCasa and YouTube credentials are optional.

## Usage

```bash
# Basic: process a folder of 360° photos
tour ./property-photos/

# With a custom tour name
tour -n "123 Main Street" ./property-photos/

# Dry run (see what would be uploaded)
tour --dry-run ./property-photos/

# Skip floor plan generation
tour --skip-cubicasa ./property-photos/

# Skip YouTube upload
tour --skip-youtube ./property-photos/

# Use a specific config file
tour -c ~/my-config/.tourrc ./property-photos/
```

## Folder Structure

### Flat (rooms numbered automatically)

```
property-photos/
├── IMG_001.jpg      → Room 1
├── IMG_002.jpg      → Room 2
├── IMG_003.jpg      → Room 3
└── walkthrough.mp4  → (optional) sent to CubiCasa + YouTube
```

### Subfolders (room names from folder names)

```
property-photos/
├── kitchen/
│   └── pano.jpg     → Kitchen
├── bedroom-1/
│   └── pano.jpg     → Bedroom 1
├── living-room/
│   └── pano.jpg     → Living Room
└── walkthrough.mp4
```

## Pipeline Steps

1. **Scans** the folder for equirectangular JPEGs and an optional MP4
2. **Uploads** each image to Kuula and creates a new tour
3. **Links** rooms with navigation hotspots (next/previous)
4. **Submits** the video (or images) to CubiCasa for floor plan generation
5. **Downloads** the floor plan PDF to the source folder
6. **Optionally uploads** the walkthrough MP4 to YouTube as an unlisted 360° video
7. **Outputs** all URLs and file paths

## Output

```
══════════════════════════════════════════════════
  VIRTUAL TOUR READY
══════════════════════════════════════════════════

  Kuula Tour:   https://kuula.co/share/abc123
  Floor Plan:   ./property-photos/floorplan-xyz.pdf
  YouTube 360:  https://youtu.be/def456

══════════════════════════════════════════════════
```

## API Integration Notes

### Kuula

The Kuula API client (`src/kuula.js`) targets a REST API for uploading 360° photos and creating tours. Kuula's publicly documented API is a client-side Player API for embedded tours — if a server-side content creation API exists, it may require enterprise access. Contact `contact@kuula.co` to confirm API availability for your account tier. The client is built with clean abstractions so endpoints can be updated easily once access is confirmed.

### CubiCasa

The CubiCasa API client (`src/cubicasa.js`) targets their Conversion API. Key details:
- **Base URL:** `https://api.cubi.casa/conversion`
- **Auth:** `x-api-key` header (get key from CubiCasa developer dashboard)
- **Conversion types:** `t1` (from floor plan images), `t3` (from CubiCasa SDK scan ZIP)
- **Note:** The `t3` type (floor plan from video) requires scans captured via CubiCasa's mobile SDK (CubiCapture), which bundles ARKit spatial data. Arbitrary 360° photos/video may need the `t1` path or a custom arrangement with CubiCasa.
- **Contact:** `sales@cubicasa.com` for API access, `developer.support@cubicasa.com` for technical questions

### YouTube

The YouTube upload (`src/youtube.js`) uses the standard YouTube Data API v3 with OAuth2 refresh token flow. DJI Osmo 360 embeds equirectangular projection metadata that YouTube auto-detects for 360° playback.

## YouTube Setup (Optional)

To enable automatic YouTube uploads:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the YouTube Data API v3
3. Create OAuth 2.0 credentials (Desktop app type)
4. Use the [OAuth Playground](https://developers.google.com/oauthplayground/) to generate a refresh token with `youtube.upload` scope
5. Add the credentials to `.tourrc`

## Tests

```bash
npm test
```

## Project Structure

```
├── bin/tour.js          # CLI entry point (commander)
├── src/
│   ├── config.js        # .tourrc loader with validation
│   ├── ingest.js        # Folder scanner (images + video detection)
│   ├── kuula.js         # Kuula API client
│   ├── cubicasa.js      # CubiCasa API client
│   ├── youtube.js       # YouTube 360° upload
│   └── pipeline.js      # Orchestrates the full pipeline
├── test/
│   └── ingest.test.js   # Unit tests for folder scanning
├── .tourrc.example      # Sample config
├── .gitignore
└── package.json         # 1 dependency (commander)
```
