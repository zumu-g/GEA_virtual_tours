import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';

/**
 * Upload a 360° video to YouTube as unlisted.
 * Uses OAuth2 refresh token flow (no browser needed).
 */
export async function uploadToYouTube(videoPath, title, config) {
  const { youtube_client_id, youtube_client_secret, youtube_refresh_token } = config;

  if (!youtube_client_id || !youtube_client_secret || !youtube_refresh_token) {
    console.log('  ⏭  Skipping YouTube upload — credentials not configured in .tourrc');
    return null;
  }

  // Get a fresh access token
  console.log('  🔑 Refreshing YouTube access token...');
  const tokenRes = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: youtube_client_id,
      client_secret: youtube_client_secret,
      refresh_token: youtube_refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(
      `YouTube token refresh failed (${tokenRes.status}) — check YouTube credentials in .tourrc`
    );
  }

  const { access_token } = await tokenRes.json();

  // Initiate resumable upload
  const fileSize = statSync(videoPath).size;
  const metadata = {
    snippet: {
      title: title || `360° Tour — ${basename(videoPath)}`,
      description: 'Immersive 360° walkthrough video. View in VR or drag to look around.',
      tags: ['360', 'virtual tour', 'VR', '360 video'],
    },
    status: {
      privacyStatus: 'unlisted',
    },
  };

  console.log(`  ↑ Initiating YouTube upload: ${basename(videoPath)} (${(fileSize / 1e6).toFixed(1)} MB)`);

  const initRes = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(fileSize),
    },
    body: JSON.stringify(metadata),
  });

  if (!initRes.ok) {
    const text = await initRes.text().catch(() => '');
    throw new Error(`YouTube upload init failed (${initRes.status})\n${text}`);
  }

  const uploadUri = initRes.headers.get('location');
  if (!uploadUri) {
    throw new Error('YouTube did not return a resumable upload URI');
  }

  // Upload the actual file
  const videoData = readFileSync(videoPath);
  const uploadRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'video/mp4',
      'Content-Length': String(fileSize),
    },
    body: videoData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    throw new Error(`YouTube upload failed (${uploadRes.status})\n${text}`);
  }

  const result = await uploadRes.json();
  const videoId = result.id;
  const youtubeUrl = `https://youtu.be/${videoId}`;
  console.log(`    ✓ YouTube upload complete: ${youtubeUrl}`);

  // Mark as 360° via projection metadata
  try {
    await fetch(`https://www.googleapis.com/youtube/v3/videos?part=recordingDetails`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: videoId,
        recordingDetails: {
          // YouTube auto-detects 360° from equirectangular metadata
          // DJI Osmo 360 embeds the correct projection tags
        },
      }),
    });
  } catch {
    // Non-critical — YouTube usually auto-detects 360° from DJI metadata
  }

  return youtubeUrl;
}
