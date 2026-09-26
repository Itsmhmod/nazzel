import type { IDependencyReport } from '../../domain/types.js';

export interface IDiagnosticsReport {
  dependencies: IDependencyReport;
  network: {
    status: 'ok' | 'offline' | 'platform_unreachable';
    details: string;
  };
  outputDir: {
    status: 'ok' | 'error';
    path: string;
    details?: string;
  };
  config: {
    status: 'ok' | 'error';
    path: string;
    details?: string;
  };
  history: {
    status: 'ok' | 'error';
    path: string;
    details?: string;
  };
  extractor?: {
    status: 'ok' | 'error' | 'not_tested';
    details: string;
  };
  isHealthy: boolean;
}

export interface IDiagnosticsRunner {
  run(targetUrl?: string): Promise<IDiagnosticsReport>;
}
