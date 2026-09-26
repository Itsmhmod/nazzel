/**
 * @fileoverview Core domain types for Nazzel.
 *
 * This file has NO dependencies on any other layer.
 * All layers may import from here. Nothing here imports from anywhere else.
 */

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/** A single downloadable stream variant offered by a media URL. */
export interface IMediaFormat {
  /** yt-dlp format ID (e.g. "137", "bestvideo+bestaudio") */
  readonly formatId: string;
  /** File extension (e.g. "mp4", "webm", "m4a") */
  readonly ext: string;
  /** Human-readable resolution string (e.g. "1920x1080") or null for audio-only */
  readonly resolution: string | null;
  /** Frames per second, or null */
  readonly fps: number | null;
  /** Video codec identifier, or null for audio-only */
  readonly vcodec: string | null;
  /** Audio codec identifier, or null for video-only */
  readonly acodec: string | null;
  /** Estimated file size in bytes, or null if unknown */
  readonly filesize: number | null;
  /** Total bitrate in kbps, or null */
  readonly tbr: number | null;
  /** Human-readable format note from yt-dlp, or null */
  readonly note: string | null;
  readonly isVideoOnly: boolean;
  readonly isAudioOnly: boolean;
}

/** Analyzed metadata for a single media URL. */
export interface IMediaInfo {
  /** yt-dlp's internal ID for this media item */
  readonly id: string;
  /** Title of the media */
  readonly title: string;
  /** The original URL */
  readonly url: string;
  /** Duration in seconds, or null if unknown/live */
  readonly duration: number | null;
  /** Thumbnail URL, or null */
  readonly thumbnail: string | null;
  /** All available download formats */
  readonly formats: readonly IMediaFormat[];
  /** Whether this URL points to a playlist */
  readonly isPlaylist: boolean;
  /** Number of items in the playlist, if applicable */
  readonly playlistCount?: number;
  /** yt-dlp extractor name (e.g. "youtube", "twitter") */
  readonly extractor: string;
  /** Upload date as ISO-8601 string, or null */
  readonly uploadDate: string | null;
  /** Uploader / channel name, or null */
  readonly uploader: string | null;
  /** View count, or null */
  readonly viewCount: number | null;
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/** The canonical request to download a media URL. */
export interface IDownloadRequest {
  /** A pre-validated URL string. Never interpolate into shell commands. */
  readonly url: string;
  /** Specific yt-dlp format ID. If omitted, best quality is selected. */
  readonly formatId?: string;
  readonly audioOnly?: boolean;
  /** Absolute path to output directory. Validated before use. */
  readonly outputDir?: string;
  /** When true, TUI is suppressed and machine-readable JSON is emitted. */
  readonly noTui?: boolean;
}

/** A running download's real-time progress snapshot. */
export interface IDownloadProgress {
  readonly downloadId: string;
  /** Completion percentage, 0–100. May be null during fragment merging. */
  readonly percent: number | null;
  /** Human-readable speed string from yt-dlp (e.g. "2.34 MiB/s") */
  readonly speed: string | null;
  /** Estimated seconds remaining, or null */
  readonly eta: number | null;
  /** Bytes downloaded so far */
  readonly downloaded: number;
  /** Total bytes, or null if unknown */
  readonly total: number | null;
  /** Fragment progress for fragmented downloads */
  readonly fragment?: { readonly current: number; readonly total: number };
  /** Which phase: downloading, merging/converting, or verifying */
  readonly phase: 'downloading' | 'merging' | 'converting' | 'verifying';
  /** The target file being operated on */
  readonly activeFile?: string;
}

/** The successful outcome of a completed download. */
export interface IDownloadResult {
  readonly downloadId: string;
  /** Absolute path to the final output file */
  readonly filePath: string;
  /** File size in bytes */
  readonly fileSize: number;
  /** Duration in seconds from ffprobe verification */
  readonly duration: number | null;
  /** Whether ffprobe verification passed */
  readonly verified: boolean;
  readonly completedAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Dependency
// ---------------------------------------------------------------------------

export type DependencyName = 'node' | 'deno' | 'yt-dlp' | 'yt-dlp-wrap' | 'ffmpeg' | 'ffprobe';

export type DependencyStatus = 'ok' | 'missing' | 'outdated' | 'broken' | 'unknown';

export interface IDependencyStatus {
  readonly name: DependencyName;
  readonly status: DependencyStatus;
  /** Detected version string, or null if not found */
  readonly version: string | null;
  /** Resolved binary path, or null if not found */
  readonly path: string | null;
  readonly source: 'config' | 'managed' | 'system' | null;
  /** Minimum required version string */
  readonly minVersion: string;
  /** Human-readable explanation if status is not 'ok' */
  readonly reason?: string;
}

export interface IDependencyReport {
  readonly allOk: boolean;
  readonly deps: readonly IDependencyStatus[];
  readonly missingCritical: readonly DependencyName[];
  readonly outdated: readonly DependencyName[];
  readonly checkedAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export type DownloadStatus = 'completed' | 'failed' | 'interrupted' | 'cancelled';

export interface IHistoryEntry {
  readonly id: string;
  readonly timestamp: string; // ISO-8601
  readonly url: string;
  readonly title: string;
  readonly formatId: string;
  readonly filePath: string;
  readonly duration: number | null;
  readonly fileSize: number;
  readonly status: DownloadStatus;
  /** AppErrorCode if status is 'failed', otherwise undefined */
  readonly failureCode?: string;
  readonly schemaVersion: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface INazzelConfig {
  readonly outputDir: string;
  readonly concurrency: number;
  readonly maxRetries: number;
  readonly retryBackoffMs: number;
  readonly preferredFormat: string;
  readonly audioFormat: 'm4a' | 'mp3' | 'opus' | 'ogg' | 'wav' | 'flac' | 'aac';
  readonly videoFormat: 'mp4' | 'mkv' | 'webm' | 'mov' | 'avi';
  readonly historyFile: string;
  readonly ytdlpPath: string | null;
  readonly ffmpegPath: string | null;
  readonly ffprobePath: string | null;
  readonly denoPath: string | null;
}

// ---------------------------------------------------------------------------
// Process
// ---------------------------------------------------------------------------

export interface IProcessArgs {
  /** Resolved absolute path to the binary. Never a shell string. */
  readonly bin: string;
  /** Argument array. Each element is a separate argv token. */
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  /** Milliseconds before the process is forcibly killed. Default: 30_000 */
  readonly timeoutMs?: number;
}

export interface IProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------

export interface IFileStat {
  readonly size: number;
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly mtime: Date;
}

// ---------------------------------------------------------------------------
// FFprobe
// ---------------------------------------------------------------------------

export interface IStreamInfo {
  readonly index: number;
  readonly codecName: string;
  readonly codecType: 'video' | 'audio' | 'subtitle' | 'data' | string;
  readonly width?: number;
  readonly height?: number;
  readonly bitRate?: number;
}

export interface IProbeResult {
  readonly duration: number | null; // seconds
  readonly size: number | null; // bytes
  readonly bitRate: number | null; // bps
  readonly formatName: string;
  readonly streams: readonly IStreamInfo[];
}
