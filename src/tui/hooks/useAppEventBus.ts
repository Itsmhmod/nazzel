import { useEffect, useRef } from 'react';
import type { IAppEventBus } from '@nazzel/application/interfaces/IAppEventBus.js';
import type { AppEvent } from '@nazzel/domain/events.js';

/**
 * Subscribes to the application event bus and fires the callback for every event.
 * If throttleMs is provided, events of type PROGRESS_UPDATE are throttled.
 */
export function useAppEventBus(
  eventBus: IAppEventBus,
  callback: (event: AppEvent) => void,
  throttleMs?: number,
) {
  const lastProgressTime = useRef<number>(0);
  const pendingEvent = useRef<AppEvent | null>(null);
  const timerId = useRef<NodeJS.Timeout | null>(null);
  const latestCallback = useRef(callback);

  useEffect(() => {
    latestCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (event: AppEvent) => {
      if (throttleMs && event.type === 'PROGRESS_UPDATE') {
        const now = Date.now();
        const timeSinceLast = now - lastProgressTime.current;

        if (timeSinceLast < throttleMs) {
          pendingEvent.current = event;
          if (!timerId.current) {
            timerId.current = setTimeout(() => {
              if (pendingEvent.current) {
                latestCallback.current(pendingEvent.current);
                lastProgressTime.current = Date.now();
                pendingEvent.current = null;
              }
              timerId.current = null;
            }, throttleMs - timeSinceLast);
          }
          return;
        }

        lastProgressTime.current = now;
        pendingEvent.current = null;
        if (timerId.current) {
          clearTimeout(timerId.current);
          timerId.current = null;
        }
      }
      latestCallback.current(event);
    };

    const unsubscribe = eventBus.subscribe(handler);
    return () => {
      unsubscribe();
      if (timerId.current) {
        clearTimeout(timerId.current);
      }
    };
  }, [eventBus, throttleMs]);
}
