/**
 * @fileoverview Default configuration values for Nazzel.
 *
 * These are the values used when no user config file exists
 * or when a config key is missing from the user's file.
 */

import { join } from 'path';
import os from 'os';
import type { INazzelConfig } from '../domain/types.js';
import { APP_NAME } from '../domain/constants.js';

/** Resolve the platform-appropriate user config directory. */
function getConfigDir(): string {
  const xdg = process.env['XDG_CONFIG_HOME'];
  if (xdg) {
    return join(xdg, APP_NAME);
  }
  if (process.platform === 'win32') {
    const appData = process.env['APPDATA'];
    return join(appData ?? join(os.homedir(), 'AppData', 'Roaming'), APP_NAME);
  }
  return join(os.homedir(), '.config', APP_NAME);
}

export const CONFIG_DIR = getConfigDir();
export const CONFIG_FILE_PATH = join(CONFIG_DIR, 'config.json');
export const HISTORY_FILE_PATH = join(CONFIG_DIR, 'history.ndjson');

export const DEFAULT_CONFIG: INazzelConfig = {
  outputDir: join(os.homedir(), 'Downloads'),
  concurrency: 1,
  maxRetries: 3,
  retryBackoffMs: 2_000,
  preferredFormat: 'bestvideo+bestaudio/best',
  audioFormat: 'm4a',
  videoFormat: 'mp4',
  historyFile: HISTORY_FILE_PATH,
  ytdlpPath: null,
  ffmpegPath: null,
  ffprobePath: null,
  denoPath: null,
};
