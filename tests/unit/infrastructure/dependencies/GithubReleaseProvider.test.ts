import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GithubReleaseProvider } from '../../../../src/infrastructure/dependencies/GithubReleaseProvider.js';
import * as https from 'https';
import { EventEmitter } from 'events';

vi.mock('https');

describe('GithubReleaseProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('getLatestRelease fetches correctly', async () => {
    const mockResponse = new EventEmitter() as any;
    mockResponse.statusCode = 200;
    
    vi.mocked(https.get).mockImplementation((url, options, cb) => {
      const callback = typeof options === 'function' ? options : cb;
      if (callback) {(callback as any)(mockResponse);}
      const req = new EventEmitter() as any;
      req.end = vi.fn();
      return req;
    });

    const promise = GithubReleaseProvider.getLatestRelease('owner/repo');
    mockResponse.emit('data', Buffer.from(JSON.stringify({ tag_name: 'v1.0.0', assets: [] })));
    mockResponse.emit('end');

    const result = await promise;
    expect(result.tag_name).toBe('v1.0.0');
  });

  it('downloadChecksums parses checksums correctly', async () => {
    const mockResponse = new EventEmitter() as any;
    mockResponse.statusCode = 200;
    
    vi.mocked(https.get).mockImplementation((url, options, cb) => {
      const callback = typeof options === 'function' ? options : cb;
      if (callback) {(callback as any)(mockResponse);}
      const req = new EventEmitter() as any;
      req.end = vi.fn();
      return req;
    });

    const promise = GithubReleaseProvider.downloadChecksums('http://url');
    mockResponse.emit('data', Buffer.from('abc123def  file1.zip\ndef456abc  file2.tar.xz\n'));
    mockResponse.emit('end');

    const result = await promise;
    expect(result['file1.zip']).toBe('abc123def');
    expect(result['file2.tar.xz']).toBe('def456abc');
  });
});
