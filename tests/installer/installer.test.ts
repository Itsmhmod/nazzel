import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// This is a static analysis / content verification test for the shell scripts,
// rather than a full runtime integration test which would require mocked curl/GitHub.
// The true real-world test happens locally on the Windows machine and in future CIs.

describe('Installer Scripts Static Analysis', () => {
  const rootDir = process.cwd();

  it('install.sh contains required platform and architecture detection', () => {
    const scriptPath = path.join(rootDir, 'install.sh');
    const content = fs.readFileSync(scriptPath, 'utf8');

    // Platform detection
    expect(content).toContain('uname -s');
    expect(content).toContain('darwin)');
    expect(content).toContain('linux)');

    // Architecture detection
    expect(content).toContain('uname -m');
    expect(content).toContain('x86_64|amd64)');
    expect(content).toContain('aarch64|arm64)');
  });

  it('install.sh enforces integrity verification via SHA256SUMS', () => {
    const scriptPath = path.join(rootDir, 'install.sh');
    const content = fs.readFileSync(scriptPath, 'utf8');

    expect(content).toContain('curl -sSL -o SHA256SUMS');
    expect(content).toMatch(/shasum -a 256 -c|sha256sum -c/);
    expect(content).toContain('Checksum mismatch!');
  });

  it('install.ps1 contains required platform and architecture detection', () => {
    const scriptPath = path.join(rootDir, 'install.ps1');
    const content = fs.readFileSync(scriptPath, 'utf8');

    expect(content).toContain('$env:PROCESSOR_ARCHITECTURE');
    expect(content).toContain('AMD64');
    expect(content).toContain('ARM64');
  });

  it('install.ps1 enforces integrity verification via SHA256SUMS', () => {
    const scriptPath = path.join(rootDir, 'install.ps1');
    const content = fs.readFileSync(scriptPath, 'utf8');

    expect(content).toContain('Get-FileHash -Path $TmpExePath -Algorithm SHA256');
    expect(content).toContain('Checksum mismatch!');
  });

  it('scripts use atomic installation and cleanup', () => {
    const shContent = fs.readFileSync(path.join(rootDir, 'install.sh'), 'utf8');
    const psContent = fs.readFileSync(path.join(rootDir, 'install.ps1'), 'utf8');

    // Temp directory creation and cleanup
    expect(shContent).toContain('mktemp -d');
    expect(shContent).toContain('trap cleanup EXIT');
    expect(shContent).toContain('mv -f "$EXACT_ASSET_NAME" "${INSTALL_DIR}/${EXE_NAME}"'); // atomic move

    expect(psContent).toContain('New-Guid');
    expect(psContent).toContain('Remove-Item -Path $TmpDir -Recurse -Force');
    expect(psContent).toContain('Move-Item -Path $TmpExePath -Destination $FinalExePath -Force');
  });
});
