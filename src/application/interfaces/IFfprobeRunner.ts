import type { IProbeResult } from '../../domain/types.js';

export interface IFfprobeRunner {
  probe(filePath: string, signal?: AbortSignal): Promise<IProbeResult>;
}
