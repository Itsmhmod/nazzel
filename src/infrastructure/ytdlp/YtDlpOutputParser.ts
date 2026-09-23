import { AppError } from '@nazzel/domain/errors.js';
import type { IMediaInfo, IDownloadProgress } from '@nazzel/domain/types.js';

export class YtDlpOutputParser {
  /**
   * Parses the single-line JSON output of `yt-dlp --dump-json`.
   */
  parseMediaInfo(rawJson: string, fallbackUrl: string): IMediaInfo {
    let raw: any;
    try {
      raw = JSON.parse(rawJson);
    } catch (err) {
      throw AppError.from('EXTRACTOR_FAILURE', err, { url: fallbackUrl, reason: 'Failed to parse JSON output' });
    }

    return {
      id: raw.id || 'unknown',
      title: raw.title || 'Untitled',
      url: raw.webpage_url || fallbackUrl,
      duration: typeof raw.duration === 'number' ? raw.duration : null,
      thumbnail: raw.thumbnail || null,
      isPlaylist: raw._type === 'playlist',
      playlistCount: raw.playlist_count,
      extractor: raw.extractor || 'unknown',
      uploadDate: raw.upload_date || null,
      uploader: raw.uploader || null,
      viewCount: raw.view_count || null,
      formats: Array.isArray(raw.formats) ? raw.formats.map((f: any) => ({
        formatId: f.format_id,
        ext: f.ext,
        resolution: f.format_note === 'audio only' ? null : (f.resolution || `${f.width}x${f.height}` || null),
        fps: f.fps || null,
        vcodec: f.vcodec === 'none' ? null : f.vcodec,
        acodec: f.acodec === 'none' ? null : f.acodec,
        filesize: f.filesize || f.filesize_approx || null,
        tbr: f.tbr || null,
        note: f.format_note || null,
        isVideoOnly: f.acodec === 'none' && f.vcodec !== 'none',
        isAudioOnly: f.vcodec === 'none' && f.acodec !== 'none',
      })) : [],
    };
  }

  /**
   * Parses a single line from the yt-dlp download stdout.
   * Returns progress if it's a progress event, or null otherwise.
   */
  parseProgressLine(line: string, url: string): IDownloadProgress | null {
    if (!line.startsWith('{"_type":"progress"')) {
      return null;
    }

    try {
      const raw = JSON.parse(line);
      const fragment = raw.frag_count && raw.frag_count !== 'NA' ? {
        current: Number(raw.frag_index),
        total: Number(raw.frag_count)
      } : undefined;

      const progress: IDownloadProgress = {
        downloadId: url,
        percent: raw.percent === 'NA' ? null : Number(raw.percent),
        speed: raw.speed === 'NA' ? null : raw.speed,
        eta: raw.eta === 'NA' ? null : Number(raw.eta),
        downloaded: raw.downloaded === 'NA' ? 0 : Number(raw.downloaded),
        total: raw.total === 'NA' ? null : Number(raw.total),
        phase: 'downloading',
      };

      if (fragment) {
        (progress as any).fragment = fragment;
      }

      return progress;
    } catch {
      return null;
    }
  }

  /**
   * Parses the final metadata JSON emitted at the end of a download.
   */
  parseFinalMetadata(line: string): any | null {
    if (line.startsWith('{') && line.includes('"id":') && !line.includes('"_type":"progress"')) {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }
    return null;
  }
}
