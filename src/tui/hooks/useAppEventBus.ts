import { useEffect, useRef } from 'react';
import type { AppEventBus } from '@nazzel/application/AppEventBus.js';
import type { AppEvent } from '@nazzel/domain/events.js';

/**
 * Subscribes to the application event bus and fires the callback for every event.
 * If throttleMs is provided, events of type PROGRESS_UPDATE are throttled.
 */
export function useAppEventBus(eventBus: AppEventBus, callback: (event: AppEvent) => void, throttleMs?: number) {
  const lastProgressTime = useRef<number>(0);
  const latestCallback = useRef(callback);

  useEffect(() => {
    latestCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (event: AppEvent) => {
      if (throttleMs && event.type === 'PROGRESS_UPDATE') {
        const now = Date.now();
        if (now - lastProgressTime.current < throttleMs) {
          return;
        }
        lastProgressTime.current = now;
      }
      latestCallback.current(event);
    };

    const unsubscribe = eventBus.subscribe(handler);
    return () => unsubscribe();
  }, [eventBus, throttleMs]);
}
