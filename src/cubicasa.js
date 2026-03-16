import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const API_BASE = 'https://api.cubi.casa/conversion';
const EXPORTER_BASE = 'https://api.cubi.casa/exporter';

/**
 * CubiCasa API client for floor plan generation.
 * Docs: https://conversion.docs.cubi.casa/
 *
 * Conversion types:
 *   t1 — from existing floor plan images (JPEG/PNG/TIFF/PDF)
 *   t3 — from CubiCasa SDK scan (ZIP with ARKit data + video)
 *
 * Note: t3 requires scans captured via CubiCasa's mobile SDK (CubiCapture).
 * For arbitrary 360° images, use t1 or contact CubiCasa for guidance.
 */
export class CubiCasaClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async request(method, path, body, isMultipart = false, base = API_BASE) {
    const url = `${base}${path}`;
    const headers = {
      'x-api-key': this.apiKey,
    };

    if (!isMultipart && body) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    const res = await fetch(url, { method, headers, body });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const hint = res.status === 401
        ? ' — check cubicasa_api_key in .tourrc'
        : res.status === 422
          ? ' — video/images may not meet CubiCasa requirements'
          : '';
      throw new Error(`CubiCasa ${method} ${path} failed (${res.status})${hint}\n${text}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    return res;
  }

  /**
   * Submit a video file for floor plan generation (t3 conversion).
   * Note: CubiCasa t3 requires a ZIP from their mobile SDK. If submitting
   * a raw MP4, this may need to be adapted or use a different conversion type.
   * Returns a ticket object with { id }.
   */
  async submitVideo(videoPath) {
    // CubiCasa Conversion API expects source_url (public URLs), not direct uploads.
    // For local files, you need to host the file at a public URL first,
    // or use their direct upload flow if available on your plan.
    console.log(`  ↑ Submitting video to CubiCasa: ${basename(videoPath)}`);
    console.log(`    Note: CubiCasa requires files at public URLs.`);
    console.log(`    If this fails, host the file and set source_url in .tourrc.`);

    const data = await this.request('POST', '/ticket', {
      conversion_type: 't3',
      priority: 'regular',
      source_url: [videoPath], // Must be a public URL in production
    });

    const ticketId = data.id;
    console.log(`    ✓ Ticket created (ID: ${ticketId || 'unknown'})`);
    return data;
  }

  /**
   * Submit images for floor plan generation (t1 conversion).
   * t1 accepts JPEG/PNG/TIFF/PDF — redraws existing floor plan sketches.
   * For 360° room photos, contact CubiCasa about supported conversion types.
   */
  async submitImages(imagePaths) {
    console.log(`  ↑ Submitting ${imagePaths.length} images to CubiCasa`);
    console.log(`    Note: CubiCasa t1 expects floor plan sketches/blueprints.`);

    const data = await this.request('POST', '/ticket', {
      conversion_type: 't1',
      priority: 'regular',
      source_url: imagePaths, // Must be public URLs in production
    });

    const ticketId = data.id;
    console.log(`    ✓ Ticket created (ID: ${ticketId || 'unknown'})`);
    return data;
  }

  /**
   * Wait for CubiCasa to deliver the floor plan.
   * CubiCasa uses webhooks (not polling) for delivery notification.
   * This method polls as a fallback — set up a webhook_url in production.
   */
  async waitForOrder(ticketId, { maxWaitMs = 600_000, pollIntervalMs = 30_000 } = {}) {
    const start = Date.now();
    console.log(`  Waiting for CubiCasa to process ticket ${ticketId}...`);
    console.log(`    Tip: Set webhook_url in .tourrc for instant delivery notifications.`);

    while (Date.now() - start < maxWaitMs) {
      try {
        const data = await this.request('GET', `/ticket/${ticketId}`);

        if (data.status === 'delivered' || data.status === 'completed' || data.status === 'done') {
          console.log(`    ✓ Floor plan ready`);
          return data;
        }

        if (data.status === 'deleted' || data.status === 'failed' || data.status === 'error') {
          throw new Error(
            `CubiCasa ticket ${ticketId} failed: ${data.message || 'CubiCasa was unable to produce a floor plan'}`
          );
        }

        console.log(`    Status: ${data.status} — checking again in ${pollIntervalMs / 1000}s...`);
      } catch (err) {
        if (err.message.includes('failed')) throw err;
        console.log(`    Polling error (will retry): ${err.message}`);
      }

      await sleep(pollIntervalMs);
    }

    throw new Error(
      `CubiCasa ticket ${ticketId} timed out after ${maxWaitMs / 60_000} minutes.\n` +
      'The floor plan may still be processing — check your CubiCasa dashboard.\n' +
      'CubiCasa turnaround: regular = 48h, fast = 24h, ultrafast = 6h.'
    );
  }

  /**
   * Download the completed floor plan via the Exporter API.
   * Requires the model_id from the delivered ticket webhook/response.
   */
  async downloadFloorplan(ticketOrModelId, outputDir) {
    // Try to get model_id from ticket
    let modelId = ticketOrModelId;
    try {
      const ticket = await this.request('GET', `/ticket/${ticketOrModelId}`);
      modelId = ticket.model_id || ticketOrModelId;
    } catch {
      // Assume ticketOrModelId is already a model_id
    }

    // Request floor plan export via Exporter API
    const exportData = await this.request('POST', `/floorplan/${modelId}`, {
      globalModelOptions: {
        unit: 'ft',
        showSpaceLabels: true,
        dimensions: { text: true, markers: true },
        area: true,
      },
      exports: [{
        zip: false,
        fileNamePrefix: 'floorplan',
        singleFloor: { format: 'pdf', dpi: 300 },
      }],
    }, false, EXPORTER_BASE);

    // Exporter returns signed S3 URLs
    const urls = Object.values(exportData).flatMap(floor =>
      Object.values(floor).flat()
    );
    const pdfUrl = urls.find(u => typeof u === 'string' && u.includes('.pdf')) || urls[0];

    if (!pdfUrl) {
      throw new Error(`No PDF download URL in CubiCasa export response`);
    }

    const res = await fetch(pdfUrl);
    if (!res.ok) {
      throw new Error(`Failed to download floor plan: ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const outputPath = join(outputDir, `floorplan-${modelId}.pdf`);
    writeFileSync(outputPath, buffer);
    console.log(`    ✓ Floor plan saved: ${outputPath}`);
    return outputPath;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
