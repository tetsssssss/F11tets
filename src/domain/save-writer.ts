/**
 * Coalesces high-frequency race ticks into bounded IndexedDB writes.
 * Carries only the latest immutable Save reference: no sporting state is modified.
 * Critical changes may be flushed immediately, and switching slots awaits pending work.
 */
export class SaveWriter<T> {
  private pending: { value: T; slot: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();
  private revision = 0;
  private working = false;
  private lastError: unknown = null;

  constructor(
    private readonly write: (value: T, slot: number) => Promise<void>,
    private readonly status: (busy: boolean) => void,
    private readonly failed: (error: unknown) => void,
    private readonly intervalMs = 1200,
  ) {}

  schedule(value: T, slot: number, critical = false): void {
    this.pending = { value, slot };
    this.revision++;
    this.status(true);
    if (critical) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => { void this.flush(); }, this.intervalMs);
    }
  }

  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    // Never enqueue an unbounded backlog while compression/IndexedDB are slow.
    // Keep only the latest pending revision until the active write settles.
    if (this.working) return this.chain;
    const item = this.pending;
    if (!item) return this.chain;
    this.pending = null;
    const revision = this.revision;
    this.working = true;
    this.chain = this.chain.catch(() => {}).then(() => this.write(item.value, item.slot))
      .then(() => {
        this.lastError = null;
        if (!this.pending && revision === this.revision) this.status(false);
      })
      .catch((error) => {
        this.lastError = error;
        this.failed(error);
        if (!this.pending && revision === this.revision) this.status(false);
      })
      .finally(() => {
        this.working = false;
        // Explicit finishes/switches may have arrived while storage was busy.
        if (this.pending && !this.timer) void this.flush();
      });
    return this.chain;
  }

  async drain(): Promise<void> {
    // Used before changing a slot or replacing a career; no pending update is discarded.
    do {
      if (this.working) await this.chain;
      else if (this.pending) await this.flush();
      else await this.chain;
    } while (this.pending || this.working);
    // Never silently switch to a different career after a failed IndexedDB write.
    if (this.lastError !== null) throw this.lastError;
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    // A page closing can interrupt IndexedDB transactions; exports remain recommended.
    if (this.pending) void this.flush();
  }
}
