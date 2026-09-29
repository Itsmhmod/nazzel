import { NodeFileSystem } from '@nazzel/infrastructure/filesystem/NodeFileSystem.js';
import { ProcessRunner } from '@nazzel/infrastructure/process/ProcessRunner.js';
import { ConfigManager } from '@nazzel/application/ConfigManager.js';
import { CONFIG_FILE_PATH } from '@nazzel/config/defaults.js';
import { DependencyManager } from '@nazzel/infrastructure/dependencies/DependencyManager.js';
import { YtDlpEngine } from '@nazzel/infrastructure/ytdlp/YtDlpEngine.js';
import { AppEventBus } from '@nazzel/application/AppEventBus.js';
import { QueueManager } from '@nazzel/application/QueueManager.js';
import { HistoryManager } from '@nazzel/application/HistoryManager.js';
import { RecoveryManager } from '@nazzel/application/RecoveryManager.js';
import { DownloadOrchestrator } from '@nazzel/application/DownloadOrchestrator.js';
import { FfprobeRunner } from '@nazzel/infrastructure/ffmpeg/FfprobeRunner.js';
import { DiagnosticsRunner } from '@nazzel/application/DiagnosticsRunner.js';

export type CompositionRoot = Awaited<ReturnType<typeof createCompositionRoot>>;

export async function createCompositionRoot(configPath?: string) {
  const fileSystem = new NodeFileSystem();
  const processRunner = new ProcessRunner();

  // 1. Config
  const configManager = new ConfigManager(fileSystem, configPath);
  const config = await configManager.load();

  // 2. Dependencies
  const depManager = new DependencyManager(processRunner, fileSystem, config);

  // Try to get yt-dlp path. If it fails, that's fine for some commands (like doctor, config),
  // but we can initialize the engine with a fallback or throw. We'll attempt it now,
  // but commands that need it will re-validate or just use the orchestrator.
  // Wait, DependencyManager.getBinaryPath throws if missing.
  // Doctor command shouldn't fail composition root if yt-dlp is missing.
  // So we catch it and use an empty string, letting the engine fail later if invoked.
  let ytdlpBin = '';
  try {
    ytdlpBin = await depManager.getBinaryPath('yt-dlp');
  } catch {
    // Ignore here. Doctor/installer will handle missing binaries.
  }

  let ffprobeBin = '';
  try {
    ffprobeBin = await depManager.getBinaryPath('ffprobe');
  } catch {}

  let ffmpegBin = '';
  try {
    ffmpegBin = await depManager.getBinaryPath('ffmpeg');
  } catch {}

  let jsRuntimeBin: string | null = null;
  try {
    jsRuntimeBin = await depManager.getBinaryPath('deno');
  } catch {
    try {
      jsRuntimeBin = await depManager.getBinaryPath('node');
    } catch {
      // Both optional/missing/outdated. yt-dlp will fallback to system path or fail internally if needed.
    }
  }

  const ffprobeRunner = new FfprobeRunner(processRunner, ffprobeBin);
  const ytDlpEngine = new YtDlpEngine(
    processRunner,
    ytdlpBin,
    ffprobeRunner,
    jsRuntimeBin,
    ffmpegBin,
  );

  // 3. App Layer
  const eventBus = new AppEventBus();
  const queueManager = new QueueManager(config.concurrency || 1);
  const historyManager = new HistoryManager(fileSystem, config.historyFile);
  const recoveryManager = new RecoveryManager();

  const orchestrator = new DownloadOrchestrator(
    eventBus,
    ytDlpEngine,
    queueManager,
    recoveryManager,
    historyManager,
    configManager,
    depManager,
    fileSystem,
  );

  const diagnosticsRunner = new DiagnosticsRunner(
    depManager,
    fileSystem,
    configManager,
    configPath || CONFIG_FILE_PATH,
    config.historyFile,
    ytDlpEngine,
  );

  return {
    orchestrator,
    eventBus,
    configManager,
    historyManager,
    diagnosticsRunner,
    depManager,
    queueManager,
  };
}
