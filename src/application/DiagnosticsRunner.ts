import type { IDependencyManager } from './interfaces/IDependencyManager.js';
import type { IFileSystem } from './interfaces/IFileSystem.js';
import { ConfigManager } from './ConfigManager.js';
import type { IDependencyReport } from '@nazzel/domain/types.js';
import { request } from 'http';
import { request as httpsRequest } from 'https';
import * as path from 'path';

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

import type { IMediaEngine } from './interfaces/IMediaEngine.js';

export class DiagnosticsRunner {
  constructor(
    private readonly depManager: IDependencyManager,
    private readonly fileSystem: IFileSystem,
    private readonly configManager: ConfigManager,
    private readonly configPath: string,
    private readonly historyPath: string,
    private readonly mediaEngine?: IMediaEngine
  ) {}

  async run(targetUrl?: string): Promise<IDiagnosticsReport> {
    const dependencies = await this.depManager.detectAll();
    
    // Check config
    const configResult: IDiagnosticsReport['config'] = { status: 'ok', path: this.configPath, details: '' };
    try {
      await this.configManager.load();
    } catch (e: any) {
      configResult.status = 'error';
      configResult.details = e.message;
    }

    // Determine output dir path
    let outputDirPath = 'Unknown';
    try {
      const conf = this.configManager.get();
      outputDirPath = conf.outputDir;
    } catch {
      // Fallback if config is invalid
    }

    // Check output dir
    const outputDirResult: IDiagnosticsReport['outputDir'] = { status: 'ok', path: outputDirPath, details: '' };
    if (outputDirPath !== 'Unknown') {
      try {
        await this.fileSystem.ensureDir(outputDirPath);
        const tempTestFile = `${outputDirPath}/.nazzel-test-${Date.now()}`;
        await this.fileSystem.writeJson(tempTestFile, {});
        await this.fileSystem.delete(tempTestFile);
      } catch (e: any) {
        outputDirResult.status = 'error';
        outputDirResult.details = 'Not writable: ' + e.message;
      }
    } else {
      outputDirResult.status = 'error';
      outputDirResult.details = 'Could not read config to find output dir';
    }

    // Check history
    const historyResult: IDiagnosticsReport['history'] = { status: 'ok', path: this.historyPath, details: '' };
    try {
      await this.fileSystem.ensureDir(path.dirname(this.historyPath));
    } catch (e: any) {
      historyResult.status = 'error';
      historyResult.details = 'Cannot write to history directory: ' + e.message;
    }

    // Check network
    const networkResult: IDiagnosticsReport['network'] = { status: 'ok', details: 'Reachable' };
    
    const internetCheck = await this.checkUrlReachability('http://1.1.1.1');
    if (!internetCheck) {
      const fallbackCheck = await this.checkUrlReachability('https://dns.google');
      if (!fallbackCheck) {
        networkResult.status = 'offline';
        networkResult.details = 'Internet unreachable';
      }
    }

    let extractorResult: IDiagnosticsReport['extractor'] = { status: 'not_tested', details: 'No URL provided' };

    if (networkResult.status === 'ok' && targetUrl) {
      const platformCheck = await this.checkUrlReachability(targetUrl);
      if (!platformCheck) {
        networkResult.status = 'platform_unreachable';
        networkResult.details = `Target URL ${targetUrl} is unreachable`;
        extractorResult = { status: 'error', details: 'Network unreachable' };
      } else if (this.mediaEngine) {
        extractorResult = { status: 'ok', details: 'Analyzing...' };
        try {
          await this.mediaEngine.analyze(targetUrl);
          extractorResult = { status: 'ok', details: 'Extractor successfully analyzed URL' };
        } catch (e: any) {
          extractorResult = { status: 'error', details: 'Extractor failed: ' + e.message };
        }
      }
    }

    const isHealthy = 
      dependencies.allOk && 
      networkResult.status === 'ok' && 
      outputDirResult.status === 'ok' && 
      configResult.status === 'ok' &&
      historyResult.status === 'ok' &&
      (extractorResult.status === 'ok' || extractorResult.status === 'not_tested');

    return {
      dependencies,
      network: networkResult,
      outputDir: outputDirResult,
      config: configResult,
      history: historyResult,
      extractor: extractorResult,
      isHealthy,
    };
  }

  private checkUrlReachability(urlStr: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(urlStr);
        const reqFn = parsed.protocol === 'https:' ? httpsRequest : request;
        
        const req = reqFn(parsed, { method: 'HEAD', timeout: 3000 }, (_res) => {
          resolve(true); // Any response means we can reach the host
        });
        
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        
        req.end();
      } catch {
        resolve(false); // Invalid URL
      }
    });
  }
}
