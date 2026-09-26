import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCli } from '../../../src/cli/cli.js';
import * as CompositionRoot from '../../../src/cli/CompositionRoot.js';

vi.mock('../../../src/cli/CompositionRoot.js', () => ({
  createCompositionRoot: vi.fn()
}));

describe('doctor command', () => {
  let mockDiagnosticsRunner: any;

  beforeEach(() => {
    mockDiagnosticsRunner = {
      run: vi.fn().mockImplementation(async () => {
        return {
          isHealthy: true,
          dependencies: { deps: [] },
          network: { status: 'ok', details: '' },
          outputDir: { status: 'ok', path: '' },
          config: { status: 'ok', path: '' },
          history: { status: 'ok', path: '' }
        };
      })
    };

    vi.mocked(CompositionRoot.createCompositionRoot).mockImplementation(async () => {
      return {
        diagnosticsRunner: mockDiagnosticsRunner
      } as any;
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs JSON when --json flag is passed', async () => {
    const cli = createCli();
    cli.exitOverride();
    await cli.parseAsync(['node', 'nazzel', 'doctor', '--json']);
    
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"type":"DIAGNOSTICS_REPORT"'));
  });

  it('outputs human readable format when --json is not passed', async () => {
    const cli = createCli();
    cli.exitOverride();
    await cli.parseAsync(['node', 'nazzel', 'doctor']);
    
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Nazzel Diagnostics Report'));
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('"type":"DIAGNOSTICS_REPORT"'));
  });
});
