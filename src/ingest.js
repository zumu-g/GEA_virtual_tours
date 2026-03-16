import { readdirSync, statSync } from 'node:fs';
import { join, extname, basename, relative } from 'node:path';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png']);
const VIDEO_EXTS = new Set(['.mp4', '.mov']);

/**
 * Scan a directory for 360° images and optional walkthrough video.
 * Returns { images: [{path, name, room}], video: string|null }
 *
 * If subfolders exist, room names come from folder names.
 * If flat, rooms are numbered sequentially.
 */
export function ingestFolder(folderPath) {
  const entries = readdirSync(folderPath, { withFileTypes: true });
  const images = [];
  let video = null;

  // Check for subfolders (room-based structure)
  const subfolders = entries.filter(e => e.isDirectory());

  if (subfolders.length > 0) {
    // Subfolder mode: each subfolder is a room
    for (const dir of subfolders.sort((a, b) => a.name.localeCompare(b.name))) {
      const roomPath = join(folderPath, dir.name);
      const roomName = formatRoomName(dir.name);
      const roomFiles = readdirSync(roomPath)
        .filter(f => IMAGE_EXTS.has(extname(f).toLowerCase()))
        .sort();

      for (const file of roomFiles) {
        images.push({
          path: join(roomPath, file),
          name: `${roomName} — ${basename(file, extname(file))}`,
          room: roomName,
        });
      }
    }
  }

  // Also scan top-level files
  const topFiles = entries
    .filter(e => e.isFile())
    .sort((a, b) => a.name.localeCompare(b.name));

  let position = images.length + 1;
  for (const entry of topFiles) {
    const ext = extname(entry.name).toLowerCase();

    if (VIDEO_EXTS.has(ext) && !video) {
      video = join(folderPath, entry.name);
    } else if (IMAGE_EXTS.has(ext)) {
      const roomName = subfolders.length > 0
        ? 'Main'
        : `Room ${position}`;
      images.push({
        path: join(folderPath, entry.name),
        name: basename(entry.name, extname(entry.name)),
        room: roomName,
      });
      position++;
    }
  }

  if (images.length === 0) {
    throw new Error(
      `No 360° images found in ${folderPath}\n` +
      'Expected .jpg, .jpeg, or .png files (equirectangular format from DJI Osmo 360).'
    );
  }

  return { images, video };
}

function formatRoomName(dirName) {
  return dirName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
