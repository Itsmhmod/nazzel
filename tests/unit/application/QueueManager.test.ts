import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueManager } from '../../../src/application/QueueManager.js';
import { AppError } from '../../../src/domain/errors.js';

describe('QueueManager', () => {
  let manager: QueueManager;

  beforeEach(() => {
    manager = new QueueManager(2); // Concurrency: 2
  });

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  it('executes tasks in FIFO order honoring concurrency limits', async () => {
    const executed: string[] = [];
    
    // Create slow tasks
    const task1 = vi.fn().mockImplementation(async () => { await delay(50); executed.push('1'); });
    const task2 = vi.fn().mockImplementation(async () => { await delay(20); executed.push('2'); });
    const task3 = vi.fn().mockImplementation(async () => { await delay(10); executed.push('3'); });

    manager.enqueue('1', task1);
    manager.enqueue('2', task2);
    manager.enqueue('3', task3);

    // Initial state: 1 and 2 active, 3 queued
    let snapshot = manager.getSnapshot();
    expect(snapshot).toEqual([
      { id: '1', status: 'active' },
      { id: '2', status: 'active' },
      { id: '3', status: 'queued' }
    ]);

    await delay(25); 
    // At 25ms, task 2 finishes, releasing slot for 3. 3 starts, not done yet.
    snapshot = manager.getSnapshot();
    expect(snapshot).toEqual([
      { id: '1', status: 'active' },
      { id: '3', status: 'active' }
    ]);
    expect(executed).toEqual(['2']);

    await delay(40);
    // All done
    expect(executed).toEqual(['2', '3', '1']); // 3 finishes before 1
    expect(manager.getSnapshot()).toEqual([]);
  });

  it('removes queued item when cancelled', () => {
    manager = new QueueManager(1); // Concurrency: 1
    const task1 = vi.fn().mockImplementation(async () => { await delay(50); });
    const task2 = vi.fn().mockImplementation(async () => { await delay(50); });
    
    manager.enqueue('1', task1);
    manager.enqueue('2', task2);

    expect(manager.getSnapshot()[1].status).toBe('queued');
    
    manager.cancel('2');
    
    expect(manager.getSnapshot()).toEqual([
      { id: '1', status: 'active' }
    ]);
  });

  it('aborts active item when cancelled, releasing slot', async () => {
    manager = new QueueManager(1);
    let abortWasSignaled = false;

    const task1 = vi.fn().mockImplementation(async (signal: AbortSignal) => {
      signal.addEventListener('abort', () => {
        abortWasSignaled = true;
      });
      // Simulate long task that respects abort
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, 100);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Aborted'));
        });
      });
    });

    const task2 = vi.fn().mockResolvedValue(undefined);

    manager.enqueue('1', task1);
    manager.enqueue('2', task2);

    expect(manager.getSnapshot()).toEqual([
      { id: '1', status: 'active' },
      { id: '2', status: 'queued' }
    ]);

    manager.cancel('1');

    await delay(10); // Wait for microtasks

    expect(abortWasSignaled).toBe(true);
    expect(task2).toHaveBeenCalledTimes(1); // task 2 started immediately after 1 aborted
    expect(manager.getSnapshot()).toEqual([]); // all finished
  });

  it('releases slot when task fails', async () => {
    manager = new QueueManager(1);
    
    const task1 = vi.fn().mockRejectedValue(new Error('Crash'));
    const task2 = vi.fn().mockResolvedValue(undefined);

    manager.enqueue('1', task1);
    manager.enqueue('2', task2);

    await delay(10); // Wait for microtasks

    expect(task1).toHaveBeenCalledTimes(1);
    expect(task2).toHaveBeenCalledTimes(1); // 2 runs because 1 released slot on failure
    expect(manager.getSnapshot()).toEqual([]);
  });

  it('prevents duplicate IDs', () => {
    manager.enqueue('1', vi.fn().mockResolvedValue(undefined));
    
    expect(() => {
      manager.enqueue('1', vi.fn().mockResolvedValue(undefined));
    }).toThrow(AppError);
  });
});
