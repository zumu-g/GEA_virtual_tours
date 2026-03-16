import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const API_BASE = 'https://api.kuula.co/api/v1';

/**
 * Kuula API client.
 * Docs: https://kuula.co/api/docs
 */
export class KuulaClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async request(method, path, body, isMultipart = false) {
    const url = `${API_BASE}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (!isMultipart && body) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    const res = await fetch(url, { method, headers, body });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const hint = res.status === 401
        ? ' — check kuula_api_key in .tourrc'
        : res.status === 413
          ? ' — image file may be too large'
          : '';
      throw new Error(`Kuula ${method} ${path} failed (${res.status})${hint}\n${text}`);
    }

    return res.json();
  }

  /**
   * Upload a single 360° image.
   * Returns the post object with id, public URL, etc.
   */
  async uploadImage(filePath, title) {
    const form = new FormData();
    const fileData = readFileSync(filePath);
    const blob = new Blob([fileData], { type: 'image/jpeg' });
    form.append('file', blob, basename(filePath));
    form.append('name', title || basename(filePath));
    form.append('is360', 'true');

    console.log(`  ↑ Uploading: ${title || basename(filePath)}`);
    const data = await this.request('POST', '/posts', form, true);
    console.log(`    ✓ Uploaded (ID: ${data.data?.id || 'unknown'})`);
    return data.data;
  }

  /**
   * Create a new tour (collection of posts).
   */
  async createTour(name) {
    console.log(`  Creating tour: "${name}"`);
    const data = await this.request('POST', '/tours', { name });
    console.log(`    ✓ Tour created (ID: ${data.data?.id || 'unknown'})`);
    return data.data;
  }

  /**
   * Add a post (uploaded image) to a tour.
   */
  async addPostToTour(tourId, postId) {
    return this.request('POST', `/tours/${tourId}/posts`, { post: postId });
  }

  /**
   * Create a hotspot link between two posts within a tour.
   * Links from sourcePostId to targetPostId.
   */
  async createHotspot(tourId, sourcePostId, targetPostId, label) {
    return this.request('POST', `/tours/${tourId}/hotspots`, {
      post: sourcePostId,
      target: targetPostId,
      type: 'link',
      label: label || 'Next',
    });
  }

  /**
   * Get the public share URL for a tour.
   */
  async getTourUrl(tourId) {
    const data = await this.request('GET', `/tours/${tourId}`);
    return data.data?.public_url || `https://kuula.co/share/${tourId}`;
  }
}
