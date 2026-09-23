import fs from 'fs';
import { pipeline } from 'stream/promises';
import { execa } from 'execa';
import extract from 'extract-zip';

async function main() {
  console.log('Downloading ffprobe...');
  const res2 = await fetch('https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffprobe-4.4.1-win-64.zip');
  await pipeline(res2.body, fs.createWriteStream('ffprobe.zip'));
  console.log('ffprobe downloaded. Extracting...');
  
  await extract('ffprobe.zip', { dir: process.cwd() });
  console.log('Extracted ffprobe.');
  
  console.log('Getting ffprobe fixture...');
  fs.mkdirSync('tests/fixtures/ffprobe-responses', { recursive: true });
  // Download a tiny media file to probe
  const res3 = await fetch('https://www.w3schools.com/html/mov_bbb.mp4');
  await pipeline(res3.body, fs.createWriteStream('test_video.mp4'));
  const { stdout: ffOutput } = await execa('./ffprobe.exe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', '--', 'test_video.mp4']);
  fs.writeFileSync('tests/fixtures/ffprobe-responses/video.json', ffOutput);

  console.log('All fixtures generated successfully.');
}

main().catch(console.error);
