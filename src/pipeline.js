import { basename } from 'node:path';
import { ingestFolder } from './ingest.js';
import { KuulaClient } from './kuula.js';
import { CubiCasaClient } from './cubicasa.js';
import { uploadToYouTube } from './youtube.js';

/**
 * Main pipeline: ingest → upload → floorplan → output.
 */
export async function runPipeline(folderPath, config, options = {}) {
  const tourName = options.name || `Tour — ${basename(folderPath)}`;
  const results = {
    tourUrl: null,
    floorplanPath: null,
    youtubeUrl: null,
  };

  // Step 1: Ingest
  console.log('\n[1/4] Scanning folder...');
  const { images, video } = ingestFolder(folderPath);
  console.log(`  Found ${images.length} image(s)${video ? ' + 1 walkthrough video' : ''}`);

  const rooms = [...new Set(images.map(i => i.room))];
  console.log(`  Rooms: ${rooms.join(', ')}`);

  // Step 2: Upload to Kuula
  console.log('\n[2/4] Uploading to Kuula...');
  const kuula = new KuulaClient(config.kuula_api_key);

  // Create tour
  const tour = await kuula.createTour(tourName);

  // Upload images (sequentially to avoid rate limits)
  const posts = [];
  for (const img of images) {
    const post = await kuula.uploadImage(img.path, img.name);
    posts.push({ ...post, room: img.room });

    // Add to tour
    await kuula.addPostToTour(tour.id, post.id);
  }

  // Create sequential hotspot links
  if (posts.length > 1) {
    console.log('  Linking rooms with hotspots...');
    for (let i = 0; i < posts.length - 1; i++) {
      const current = posts[i];
      const next = posts[i + 1];
      await kuula.createHotspot(tour.id, current.id, next.id, next.room || 'Next');
      // Reverse link
      await kuula.createHotspot(tour.id, next.id, current.id, current.room || 'Previous');
    }
    console.log(`    ✓ ${posts.length - 1} hotspot link(s) created`);
  }

  // Get shareable URL
  results.tourUrl = await kuula.getTourUrl(tour.id);

  // Step 3: CubiCasa floor plan
  if (config.cubicasa_api_key) {
    console.log('\n[3/4] Generating floor plan via CubiCasa...');
    const cubicasa = new CubiCasaClient(config.cubicasa_api_key);

    try {
      let order;
      if (video) {
        order = await cubicasa.submitVideo(video);
      } else {
        order = await cubicasa.submitImages(images.map(i => i.path));
      }

      // Wait for processing
      const completed = await cubicasa.waitForOrder(order.id);

      // Download the floorplan
      results.floorplanPath = await cubicasa.downloadFloorplan(order.id, folderPath);
    } catch (err) {
      console.error(`  ⚠ CubiCasa floor plan failed: ${err.message}`);
      console.error('  Continuing without floor plan...');
    }
  } else {
    console.log('\n[3/4] Skipping floor plan — cubicasa_api_key not set in .tourrc');
  }

  // Step 4: YouTube upload (optional)
  if (video && (config.youtube_client_id || options.youtube)) {
    console.log('\n[4/4] Uploading walkthrough to YouTube...');
    try {
      results.youtubeUrl = await uploadToYouTube(video, tourName, config);
    } catch (err) {
      console.error(`  ⚠ YouTube upload failed: ${err.message}`);
      console.error('  Continuing without YouTube link...');
    }
  } else {
    console.log('\n[4/4] Skipping YouTube upload' +
      (!video ? ' — no walkthrough video found' : ' — YouTube not configured'));
  }

  // Final output
  printResults(results);
  return results;
}

function printResults(results) {
  console.log('\n' + '═'.repeat(50));
  console.log('  VIRTUAL TOUR READY');
  console.log('═'.repeat(50));

  if (results.tourUrl) {
    console.log(`\n  Kuula Tour:   ${results.tourUrl}`);
  }
  if (results.floorplanPath) {
    console.log(`  Floor Plan:   ${results.floorplanPath}`);
  }
  if (results.youtubeUrl) {
    console.log(`  YouTube 360:  ${results.youtubeUrl}`);
  }

  console.log('\n' + '═'.repeat(50) + '\n');
}
