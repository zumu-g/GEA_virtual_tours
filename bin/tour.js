#!/usr/bin/env node

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { program } from 'commander';
import { loadConfig } from '../src/config.js';
import { runPipeline } from '../src/pipeline.js';

program
  .name('tour')
  .description('Create a Kuula virtual tour and CubiCasa floor plan from DJI Osmo 360 photos')
  .version('1.0.0')
  .argument('<folder>', 'Path to folder containing 360° photos (and optional walkthrough MP4)')
  .option('-n, --name <name>', 'Tour name (defaults to folder name)')
  .option('-c, --config <path>', 'Path to .tourrc config file')
  .option('--youtube', 'Force YouTube upload even without video auto-detection')
  .option('--skip-cubicasa', 'Skip floor plan generation')
  .option('--skip-youtube', 'Skip YouTube upload')
  .option('--dry-run', 'Scan folder and show what would be uploaded without making API calls')
  .action(async (folder, opts) => {
    try {
      const folderPath = resolve(folder);

      if (!existsSync(folderPath)) {
        console.error(`Error: Folder not found: ${folderPath}`);
        process.exit(1);
      }

      // Load config
      const config = loadConfig(opts.config);

      if (opts.skipCubicasa) {
        delete config.cubicasa_api_key;
      }
      if (opts.skipYoutube) {
        delete config.youtube_client_id;
        delete config.youtube_client_secret;
        delete config.youtube_refresh_token;
      }

      if (opts.dryRun) {
        const { ingestFolder } = await import('../src/ingest.js');
        const { images, video } = ingestFolder(folderPath);
        console.log('\nDry run — files that would be processed:\n');
        console.log(`Images (${images.length}):`);
        for (const img of images) {
          console.log(`  [${img.room}] ${img.name} — ${img.path}`);
        }
        if (video) {
          console.log(`\nVideo: ${video}`);
        }
        console.log('\nNo API calls made.');
        return;
      }

      // Run the full pipeline
      await runPipeline(folderPath, config, {
        name: opts.name,
        youtube: opts.youtube,
      });
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
      process.exit(1);
    }
  });

program.parse();
