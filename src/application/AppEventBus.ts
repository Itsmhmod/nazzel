import type { AppEvent } from '@nazzel/domain/events.js';
import { getLogger } from '@nazzel/shared/logger.js';

export type EventCallback = (event: AppEvent) => void;

export class AppEventBus {
  private subscribers: Set<EventCallback>;

  constructor() {
    this.subscribers = new Set();
  }

  /**
   * Subscribes to all application events.
   * @param callback Function to call when an event is emitted.
   * @returns A function to unsubscribe this specific callback.
   */
  subscribe(callback: EventCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Emits an application event to all subscribers synchronously.
   * @param event The typed AppEvent to emit.
   */
  emit(event: AppEvent): void {
    // Convert to array to prevent issues if a subscriber unsubscribes during emit loop
    const currentSubscribers = Array.from(this.subscribers);
    for (const subscriber of currentSubscribers) {
      try {
        subscriber(event);
      } catch (error: any) {
        // AppEventBus must not crash the application due to a bad subscriber
        getLogger().error('Error in AppEventBus subscriber:', { error: error.message });
      }
    }
  }

  /**
   * Clears all subscribers. Useful for testing or complete teardown.
   */
  clear(): void {
    this.subscribers.clear();
  }
}
