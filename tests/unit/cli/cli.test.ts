import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCli } from '../../../src/cli/cli.js';

// We only mock downloadCommand because it's invoked directly by the root action
vi.mock('../../../src/cli/commands/download.js', () => ({
  downloadCommand: vi.fn()
}));

// Import after mock
import { downloadCommand } from '../../../src/cli/commands/download.js';

describe('CLI Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Prevent process exit in tests
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit() was called');
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes to downloadCommand by default', async () => {
    const cli = createCli();
    // Simulate `node nazzel https://example.com`
    await cli.parseAsync(['node', 'nazzel', 'https://example.com']);
    
    expect(downloadCommand).toHaveBeenCalledWith('https://example.com', expect.any(Object));
  });

  it('passes --no-tui and --audio-only to downloadCommand', async () => {
    const cli = createCli();
    await cli.parseAsync(['node', 'nazzel', 'https://example.com', '--no-tui', '--audio-only']);
    
    expect(downloadCommand).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      tui: false,
      audioOnly: true
    }));
  });
});
