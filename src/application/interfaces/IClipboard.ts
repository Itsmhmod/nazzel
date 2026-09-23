export interface IClipboard {
  /**
   * Reads the current text content from the system clipboard.
   * Returns empty string if clipboard is empty or unreadable.
   */
  readText(): Promise<string>;
}
