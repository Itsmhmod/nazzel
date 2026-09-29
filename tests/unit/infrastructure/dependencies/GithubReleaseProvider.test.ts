import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GithubReleaseProvider } from '../../../../src/infrastructure/dependencies/GithubReleaseProvider.js';

// GithubReleaseProvider uses globalThis.fetch — mock it directly.
const mockFetch = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

describe('GithubReleaseProvider', () => {
  it('getLatestRelease fetches correctly', async () => {
    const payload = { tag_name: 'v1.0.0', assets: [], prerelease: false, draft: false };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    const result = await GithubReleaseProvider.getLatestRelease('owner/repo');
    expect(result.tag_name).toBe('v1.0.0');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [calledUrl] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(calledUrl).toContain('api.github.com/repos/owner/repo/releases/latest');
  });

  it('downloadChecksums parses checksums correctly', async () => {
    const body = 'abc123def  file1.zip\ndef456abc  file2.tar.xz\n';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => body,
    });

    const result = await GithubReleaseProvider.downloadChecksums('https://example.com/SHA256SUMS');
    expect(result['file1.zip']).toBe('abc123def');
    expect(result['file2.tar.xz']).toBe('def456abc');
  });

  it('getLatestRelease throws on non-200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    await expect(GithubReleaseProvider.getLatestRelease('owner/repo')).rejects.toMatchObject({
      code: 'NETWORK_FAILURE',
    });
  });
});
