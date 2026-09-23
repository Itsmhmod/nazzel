import { AppError } from '@nazzel/domain/errors.js';

type TaskFunction = (signal: AbortSignal) => Promise<void>;

interface QueueItem {
  id: string;
  task: TaskFunction;
  controller: AbortController;
  status: 'queued' | 'active';
}

export class QueueManager {
  private queue: QueueItem[] = [];
  private concurrency: number;
  private activeCount: number = 0;

  constructor(concurrency: number = 1) {
    this.concurrency = Math.max(1, concurrency);
  }

  /**
   * Updates the max concurrency. If increased, immediately starts pending tasks.
   */
  setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency);
    this.processQueue();
  }

  /**
   * Enqueues a task for execution. FIFO order.
   */
  enqueue(id: string, task: TaskFunction): void {
    if (this.queue.some(item => item.id === id)) {
      throw new AppError('CONFIG_INVALID', `Task with id ${id} already exists in queue`);
    }

    this.queue.push({
      id,
      task,
      controller: new AbortController(),
      status: 'queued',
    });

    this.processQueue();
  }

  /**
   * Cancels a queued or active task by ID.
   */
  cancel(id: string): void {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) {
      return; // Not found, do nothing
    }

    const item = this.queue[index];
    if (!item) { return; }

    if (item.status === 'queued') {
      // Remove from queue without executing
      this.queue.splice(index, 1);
    } else if (item.status === 'active') {
      // Abort the running task. It is the task's responsibility to handle the 
      // AbortSignal and reject its promise, which will then trigger slot release.
      item.controller.abort();
    }
  }

  /**
   * Returns the current queue snapshot for reporting.
   */
  getSnapshot(): { id: string; status: 'queued' | 'active' }[] {
    return this.queue.map(item => ({ id: item.id, status: item.status }));
  }

  private processQueue(): void {
    while (this.activeCount < this.concurrency) {
      const nextItem = this.queue.find(item => item.status === 'queued');
      if (!nextItem) {
        break; // Nothing left to process
      }

      void this.execute(nextItem);
    }
  }

  private async execute(item: QueueItem): Promise<void> {
    item.status = 'active';
    this.activeCount++;

    try {
      await item.task(item.controller.signal);
    } catch {
      // Expected if aborted or failed. Task handles its own error reporting.
    } finally {
      // Always release slot and remove from queue
      this.activeCount--;
      const index = this.queue.findIndex(i => i.id === item.id);
      if (index !== -1) {
        this.queue.splice(index, 1);
      }
      // Process next in queue
      this.processQueue();
    }
  }
}
