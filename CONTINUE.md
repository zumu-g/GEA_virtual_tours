# Continuation Prompt

Copy and paste this into a new Claude Code session to pick up where we left off:

---

## Context

I'm building a virtual tour and floorplan CLI tool at this directory. The project is fully scaffolded and functional with a dry-run mode. Here's the current state:

### What's Done
- Full CLI tool: `tour ./property-photos/` — scans folder, uploads to Kuula, submits to CubiCasa for floorplan, optionally uploads MP4 to YouTube
- Folder ingestion with subfolder-based room naming (tested, 4/4 pass)
- CLI flags: `--dry-run`, `--skip-cubicasa`, `--skip-youtube`, `--name`, `--config`
- `.tourrc` config file for API keys
- Node.js 22, ESM, 1 dependency (commander)

### What Needs Work
1. **Kuula API** — Research found Kuula has no public REST API for content creation (only a client-side Player API). `src/kuula.js` has placeholder endpoints. Options:
   - Contact Kuula (`contact@kuula.co`) about enterprise API access
   - Switch to a self-hosted 360 viewer (Pannellum or Marzipano) — would generate a static HTML tour with hotspots instead of uploading to Kuula
   - Use Puppeteer/Playwright to automate Kuula's web UI (fragile, possibly against ToS)

2. **CubiCasa API** — `src/cubicasa.js` now targets the real Conversion API (`api.cubi.casa/conversion`). Key constraint: their `t3` conversion (floor plan from video) requires scans from their CubiCapture mobile SDK, not arbitrary 360° photos. The `t1` type accepts floor plan sketches/blueprints. Options:
   - Use CubiCasa's mobile app alongside DJI Osmo for capture
   - Accept a pre-made floor plan image via `--floorplan ./plan.png` flag instead
   - Explore alternative AI floor plan services

3. **Testing against real APIs** — Once API access is confirmed, test the upload/submit/download flow end-to-end with real DJI Osmo 360 files.

### Key Files
- `src/kuula.js` — needs real API endpoints or a Pannellum replacement
- `src/cubicasa.js` — updated with real CubiCasa Conversion + Exporter API endpoints
- `src/pipeline.js` — orchestrator, works end-to-end
- `CLAUDE.md` — full project context for Claude

### Next Steps (pick one)
- [ ] Replace Kuula with Pannellum self-hosted viewer
- [ ] Add `--floorplan` flag for manual floor plan attachment
- [ ] Test CubiCasa API with real credentials
- [ ] Add integration tests with mocked API responses
- [ ] Deploy and test end-to-end with real DJI Osmo 360 photos
