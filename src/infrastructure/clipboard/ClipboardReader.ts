import type { IClipboard } from '@nazzel/application/interfaces/IClipboard.js';
import clipboardy from 'clipboardy';

export class ClipboardReader implements IClipboard {
  async readText(): Promise<string> {
    try {
      const text = await clipboardy.read();
      return text ? text.trim() : '';
    } catch {
      // Clipboard read failed (e.g. no X11 display, no permissions)
      return '';
    }
  }
}
