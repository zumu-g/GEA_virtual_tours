import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ingestFolder } from '../src/ingest.js';

const TMP = join(tmpdir(), 'tour-test-' + Date.now());

describe('ingestFolder', () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it('finds flat JPEG files and numbers rooms sequentially', () => {
    writeFileSync(join(TMP, 'photo1.jpg'), 'fake');
    writeFileSync(join(TMP, 'photo2.jpg'), 'fake');

    const { images, video } = ingestFolder(TMP);
    assert.equal(images.length, 2);
    assert.equal(images[0].room, 'Room 1');
    assert.equal(images[1].room, 'Room 2');
    assert.equal(video, null);
  });

  it('uses subfolder names as room names', () => {
    mkdirSync(join(TMP, 'kitchen'));
    mkdirSync(join(TMP, 'bedroom-1'));
    writeFileSync(join(TMP, 'kitchen', 'img.jpg'), 'fake');
    writeFileSync(join(TMP, 'bedroom-1', 'img.jpg'), 'fake');

    const { images } = ingestFolder(TMP);
    assert.equal(images.length, 2);
    assert.equal(images[0].room, 'Bedroom 1');
    assert.equal(images[1].room, 'Kitchen');
  });

  it('detects walkthrough video', () => {
    writeFileSync(join(TMP, 'photo.jpg'), 'fake');
    writeFileSync(join(TMP, 'walkthrough.mp4'), 'fake');

    const { images, video } = ingestFolder(TMP);
    assert.equal(images.length, 1);
    assert.ok(video.endsWith('walkthrough.mp4'));
  });

  it('throws on empty folder', () => {
    assert.throws(() => ingestFolder(TMP), /No 360° images found/);
  });
});
