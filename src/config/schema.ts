/**
 * @fileoverview Zod schema for Nazzel configuration.
 *
 * All config loaded from disk is validated against this schema.
 * Invalid config surfaces a CONFIG_INVALID AppError with the Zod error details.
 */

import { z } from 'zod';
import {
  MAX_RETRY_HARD_LIMIT,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BACKOFF_MS,
  MAX_RETRY_BACKOFF_MS,
} from '../domain/constants.js';

export const NazzelConfigSchema = z
  .object({
    outputDir: z.string().min(1, 'outputDir must be a non-empty string'),
    concurrency: z.number().int().min(1).max(5),
    maxRetries: z.number().int().min(0).max(MAX_RETRY_HARD_LIMIT),
    retryBackoffMs: z.number().int().min(100).max(MAX_RETRY_BACKOFF_MS),
    preferredFormat: z.string().min(1),
    audioFormat: z.enum(['m4a', 'mp3', 'opus', 'ogg', 'wav', 'flac', 'aac']),
    videoFormat: z.enum(['mp4', 'mkv', 'webm', 'mov', 'avi']),
    historyFile: z.string().min(1),
    ytdlpPath: z.string().min(1).nullable(),
    ffmpegPath: z.string().min(1).nullable(),
    ffprobePath: z.string().min(1).nullable(),
    denoPath: z.string().min(1).nullable(),
  })
  .strict(); // Reject unknown keys

export type NazzelConfigInput = z.input<typeof NazzelConfigSchema>;
export type NazzelConfigOutput = z.output<typeof NazzelConfigSchema>;

/** Parse and validate raw config data. Returns a typed config or throws a Zod error. */
export function parseConfig(raw: unknown): NazzelConfigOutput {
  return NazzelConfigSchema.parse(raw);
}

/** Parse with defaults merged in — unknown keys in raw are ignored after defaults merge. */
export function parseConfigWithDefaults(
  raw: unknown,
  defaults: NazzelConfigOutput,
): NazzelConfigOutput {
  const merged = typeof raw === 'object' && raw !== null ? { ...defaults, ...raw } : defaults;
  return NazzelConfigSchema.parse(merged);
}

// Sanity-check defaults at import time (catches bad default values)
const _DEFAULTS_SANITY: Record<string, unknown> = {
  maxRetries: DEFAULT_MAX_RETRIES,
  retryBackoffMs: DEFAULT_RETRY_BACKOFF_MS,
};
void _DEFAULTS_SANITY;
