import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const REQUIRED_KEYS = ['kuula_api_key'];
const OPTIONAL_KEYS = ['cubicasa_api_key', 'youtube_client_id', 'youtube_client_secret', 'youtube_refresh_token'];

/**
 * Load config from .tourrc (JSON) — checks CWD first, then home dir.
 */
export function loadConfig(overridePath) {
  const candidates = [
    overridePath,
    resolve(process.cwd(), '.tourrc'),
    join(homedir(), '.tourrc'),
  ].filter(Boolean);

  let configPath;
  for (const p of candidates) {
    if (existsSync(p)) {
      configPath = p;
      break;
    }
  }

  if (!configPath) {
    throw new Error(
      'No .tourrc config file found.\n' +
      'Create one in the current directory or your home folder.\n' +
      'See .tourrc.example for the required format.'
    );
  }

  let raw;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read config file ${configPath}: ${err.message}`);
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${configPath} — check syntax.`);
  }

  // Validate required keys
  const missing = REQUIRED_KEYS.filter(k => !config[k]);
  if (missing.length) {
    throw new Error(
      `Missing required config keys in ${configPath}: ${missing.join(', ')}\n` +
      'See .tourrc.example for the required format.'
    );
  }

  return { ...config, _path: configPath };
}
