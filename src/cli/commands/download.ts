import { createCompositionRoot } from '../CompositionRoot.js';
import { initLogger } from '@nazzel/shared/logger.js';
import { AppError } from '@nazzel/domain/errors.js';
import type { IDownloadRequest } from '@nazzel/domain/types.js';
import React from 'react';
import { render } from 'ink';
import { App } from '../../tui/App.js';

export async function downloadCommand(url: string | undefined, options: any) {
  if (options.tui === false) {
    // Machine-readable mode: errors to stderr, events to stdout
    initLogger({ level: 'info', tui: false });

    if (!url) {
      throw AppError.from('CONFIG_INVALID', 'URL is required in --no-tui mode');
    }

    const { orchestrator, eventBus } = await createCompositionRoot();
    
    // Output NDJSON to stdout
    eventBus.subscribe((event) => {
      process.stdout.write(JSON.stringify(event) + '\n');
    });

    const downloadId = 'dl-' + Date.now().toString(36);
    
    const request: IDownloadRequest = {
      url,
      formatId: options.format,
      audioOnly: options.audioOnly,
      outputDir: options.output
    };

    return new Promise<void>((resolve, reject) => {
      // Listen for terminal events
      eventBus.subscribe((event) => {
        if (event.type === 'DOWNLOAD_COMPLETED' && event.result.filePath) {
          resolve();
        } else if (event.type === 'DOWNLOAD_FAILED' && event.downloadId === downloadId) {
          // Reject with the application error so the CLI can exit with the correct code
          reject(event.error);
        } else if (event.type === 'DOWNLOAD_CANCELLED' && event.downloadId === downloadId) {
          reject(new AppError('CANCELLED', 'Download cancelled by user'));
        }
      });

      // Start the download
      // DownloadOrchestrator requires metadataTitle. We can just pass 'Unknown' or analyze it first.
      // In a real CLI, we might analyze it. For now, just queue it.
      orchestrator.download(request, downloadId, 'Metadata Resolution Pending');
    });

  } else {
    // TUI Mode (Phase 4)
    initLogger({ level: 'error', tui: true });
    const root = await createCompositionRoot();

    return new Promise<void>((resolve, reject) => {
      const deps = {
        orchestrator: root.orchestrator,
        eventBus: root.eventBus,
        diagnosticsRunner: root.diagnosticsRunner,
        historyManager: root.historyManager,
        depManager: root.depManager,
      };

      const { waitUntilExit } = render(React.createElement(App, { deps, initialUrl: url }));

      waitUntilExit().then(() => {
        resolve();
      }).catch(reject);
    });
  }
}
