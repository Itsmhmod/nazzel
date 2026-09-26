import type { AppEvent } from '@nazzel/domain/events.js';

export type EventCallback = (event: AppEvent) => void;

export interface IAppEventBus {
  /**
   * Subscribes to all application events.
   * @param callback Function to call when an event is emitted.
   * @returns A function to unsubscribe this specific callback.
   */
  subscribe(callback: EventCallback): () => void;

  /**
   * Emits an application event to all subscribers synchronously.
   * @param event The typed AppEvent to emit.
   */
  emit(event: AppEvent): void;

  /**
   * Clears all subscribers. Useful for testing or complete teardown.
   */
  clear(): void;
}
