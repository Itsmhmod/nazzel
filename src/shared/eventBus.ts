/**
 * @fileoverview Typed internal event bus.
 *
 * All application-layer communication uses this bus.
 * Infrastructure never emits directly to the bus.
 * The TUI subscribes to the bus read-only.
 *
 * Uses Node.js EventEmitter under the hood with type-safe wrappers.
 */

import { EventEmitter } from 'events';
import type { AppEvent } from '../domain/events.js';

export type AppEventHandler<T extends AppEvent> = (event: T) => void;

export interface IAppEventBus {
  emit(event: AppEvent): void;
  on<T extends AppEvent['type']>(
    type: T,
    handler: AppEventHandler<Extract<AppEvent, { type: T }>>,
  ): () => void;
  once<T extends AppEvent['type']>(
    type: T,
    handler: AppEventHandler<Extract<AppEvent, { type: T }>>,
  ): () => void;
  off<T extends AppEvent['type']>(
    type: T,
    handler: AppEventHandler<Extract<AppEvent, { type: T }>>,
  ): void;
  removeAllListeners(): void;
}

export class AppEventBus implements IAppEventBus {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Prevent memory leak warnings for many subscribers
    this.emitter.setMaxListeners(50);
  }

  emit(event: AppEvent): void {
    this.emitter.emit(event.type, event);
  }

  on<T extends AppEvent['type']>(
    type: T,
    handler: AppEventHandler<Extract<AppEvent, { type: T }>>,
  ): () => void {
    this.emitter.on(type, handler as (...args: unknown[]) => void);
    return () => this.off(type, handler);
  }

  once<T extends AppEvent['type']>(
    type: T,
    handler: AppEventHandler<Extract<AppEvent, { type: T }>>,
  ): () => void {
    this.emitter.once(type, handler as (...args: unknown[]) => void);
    return () => this.off(type, handler);
  }

  off<T extends AppEvent['type']>(
    type: T,
    handler: AppEventHandler<Extract<AppEvent, { type: T }>>,
  ): void {
    this.emitter.off(type, handler as (...args: unknown[]) => void);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
