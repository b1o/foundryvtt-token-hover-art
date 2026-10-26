/*
 * The writes of one data owner, one after the other, so that each write reads the result of the write before it
 * (FOUNDRY_MODULE_RULES.md 4.1 and 4.2).
 */

export class WriteQueue {

  /** The last write. The next write starts when it ends. */
  #lastWrite = Promise.resolve();

  /**
   * Run a write after the last write.
   * @template T
   * @param {function(): Promise<T>} write
   * @returns {Promise<T>}  The result of this write. A failed write does not stop the writes after it; only the
   *                        caller of the failed write gets its error.
   */
  run(write) {
    const result = this.#lastWrite.then(write);
    this.#lastWrite = result.then(() => undefined, () => undefined);
    return result;
  }
}
