const logger = require("../utils/logger");

class ExecutionQueue {
  constructor() {
    this.queues = new Map(); // key: lockKey (positionId or userId_symbol), value: Array of tasks
    this.processing = new Set(); // key: lockKey
    this.stats = { totalExecutions: 0, totalTimeMs: 0 };
  }

  /**
   * Enqueue a trade execution task.
   * Ensures that tasks for the same lockKey run sequentially.
   * 
   * @param {string} lockKey - Unique identifier (e.g., `pos_123` or `user_456_entry`)
   * @param {string} taskName - Name for logging
   * @param {Function} executeFn - Async function to execute
   * @param {number} retries - Number of times to retry on failure
   */
  async enqueue(lockKey, taskName, executeFn, retries = 2) {
    return new Promise((resolve, reject) => {
      const task = { taskName, executeFn, retries, resolve, reject };

      if (!this.queues.has(lockKey)) {
        this.queues.set(lockKey, []);
      }
      this.queues.get(lockKey).push(task);
      logger.debug(`[QUEUE] Enqueued ${taskName} for ${lockKey}. Queue size: ${this.queues.get(lockKey).length}`);

      this._processQueue(lockKey);
    });
  }

  async _processQueue(lockKey) {
    if (this.processing.has(lockKey)) {
      return; // Already processing this lock key
    }

    const queue = this.queues.get(lockKey);
    if (!queue || queue.length === 0) {
      this.queues.delete(lockKey);
      return; // Queue empty
    }

    this.processing.add(lockKey);
    const task = queue.shift();
    const startTime = Date.now();

    try {
      const result = await this._executeWithRetry(task);
      this.stats.totalExecutions++;
      this.stats.totalTimeMs += (Date.now() - startTime);
      task.resolve(result);
    } catch (err) {
      task.reject(err);
    } finally {
      this.processing.delete(lockKey);
      setImmediate(() => this._processQueue(lockKey)); // Process next in queue
    }
  }

  async _executeWithRetry(task) {
    let attempt = 0;
    while (attempt <= task.retries) {
      try {
        logger.debug(`[QUEUE] Executing ${task.taskName} (Attempt ${attempt + 1}/${task.retries + 1})`);
        const result = await task.executeFn();
        
        // If the execution function returns success: false, it was rejected logically (e.g. insufficient funds)
        // We do NOT retry logical failures, only exceptions (like DB deadlocks).
        if (result && result.success === false) {
          logger.warn(`[QUEUE] ${task.taskName} rejected logically: ${result.message}`);
          return result;
        }
        
        return result;
      } catch (err) {
        attempt++;
        logger.error(`[QUEUE] Error executing ${task.taskName}: ${err.message}`);
        if (attempt > task.retries) {
          throw err;
        }
        // Small delay before retry
        await new Promise(res => setTimeout(res, 200 * attempt));
      }
    }
  }

  getMetrics() {
    return {
      activeQueues: this.queues.size,
      processingLocks: this.processing.size,
      avgExecutionTimeMs: this.stats.totalExecutions > 0 
        ? Math.round(this.stats.totalTimeMs / this.stats.totalExecutions) 
        : 0
    };
  }
}

module.exports = new ExecutionQueue();
