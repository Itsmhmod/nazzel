import { describe, it, expect, vi, beforeAll } from 'vitest';
import { AppEventBus } from '../../../src/application/AppEventBus.js';
import { initLogger, getLogger } from '../../../src/shared/logger.js';
import type { AppEvent } from '../../../src/domain/events.js';

describe('AppEventBus', () => {
  beforeAll(() => {
    initLogger({ level: 'error', tui: false });
  });

  it('allows subscribing and unsubscribing', () => {
    const bus = new AppEventBus();
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const unsub1 = bus.subscribe(callback1);
    bus.subscribe(callback2);

    const event: AppEvent = { type: 'DOWNLOAD_CANCELLED', downloadId: '1' };
    bus.emit(event);

    expect(callback1).toHaveBeenCalledWith(event);
    expect(callback2).toHaveBeenCalledWith(event);
    expect(callback1).toHaveBeenCalledTimes(1);

    // Unsubscribe callback1
    unsub1();

    const event2: AppEvent = { type: 'DOWNLOAD_CANCELLED', downloadId: '2' };
    bus.emit(event2);

    expect(callback1).toHaveBeenCalledTimes(1); // Not called again
    expect(callback2).toHaveBeenCalledTimes(2); // Called again
    expect(callback2).toHaveBeenCalledWith(event2);
  });

  it('safely handles a subscriber throwing an error', () => {
    const bus = new AppEventBus();

    // Spy on logger.error in test output
    const loggerErrorSpy = vi.spyOn(getLogger(), 'error');

    const throwCallback = vi.fn().mockImplementation(() => {
      throw new Error('Bad subscriber');
    });
    const goodCallback = vi.fn();

    bus.subscribe(throwCallback);
    bus.subscribe(goodCallback);

    const event: AppEvent = { type: 'DOWNLOAD_CANCELLED', downloadId: '1' };

    // Should not throw
    bus.emit(event);

    expect(throwCallback).toHaveBeenCalledTimes(1);
    expect(goodCallback).toHaveBeenCalledTimes(1); // Still executed
    expect(loggerErrorSpy).toHaveBeenCalled();

    loggerErrorSpy.mockRestore();
  });

  it('handles subscriber modifying subscription list during emit', () => {
    const bus = new AppEventBus();
    // eslint-disable-next-line prefer-const
    let unsub1: () => void;

    const callback1 = vi.fn().mockImplementation(() => {
      // Unsubscribes itself during execution
      unsub1();
    });
    const callback2 = vi.fn();

    unsub1 = bus.subscribe(callback1);
    bus.subscribe(callback2);

    bus.emit({ type: 'DOWNLOAD_CANCELLED', downloadId: '1' });

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);

    // Emit again
    bus.emit({ type: 'DOWNLOAD_CANCELLED', downloadId: '2' });

    expect(callback1).toHaveBeenCalledTimes(1); // Unsubscribed
    expect(callback2).toHaveBeenCalledTimes(2); // Still called
  });

  it('clears all subscribers', () => {
    const bus = new AppEventBus();
    const callback = vi.fn();
    bus.subscribe(callback);

    bus.clear();
    bus.emit({ type: 'DOWNLOAD_CANCELLED', downloadId: '1' });

    expect(callback).not.toHaveBeenCalled();
  });
});
