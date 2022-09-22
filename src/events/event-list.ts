import type { Entity } from "../entity/entity";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import { Ledger } from "../ledger/ledger";
import type { SerializedEvent } from "../types";
import { EventType } from "../types";
import type { Event } from "./event";

export class EventList<E extends Entity> {
  private committed: Event<E>[] = [];
  private staged: Event<E>[] = [];

  constructor(private ledger: Ledger) {}

  get isTransactionPending(): boolean {
    return this.staged.length > 0;
  }

  get length(): number {
    return this.staged.length + this.committed.length;
  }

  commit(): EventList<E> {
    this.committed.push(...this.staged.splice(0));

    return this;
  }

  rollback(): EventList<E> {
    this.staged.splice(0);

    return this;
  }

  add(event: Event<E>): EventList<E> {
    this.staged.push(event);

    return this;
  }

  hasCreateEventBeforeBreakpoint(breakpoint: string | number): boolean {
    const events = this.getAsArray(breakpoint);
    return events.some((e) => e.type === EventType.CREATE);
  }

  getAsArray(breakpoint?: string | number): Event<E>[] {
    const events = [...this.committed, ...this.staged];

    if (breakpoint !== undefined) {
      return Ledger._getBreakpointController(
        this.ledger
      ).getEventsUntilBreakpoint(breakpoint, events);
    }

    return events;
  }

  serialize(): SerializedEvent[] {
    if (this.isTransactionPending) {
      throw new LedgerError(ErrorCode.SERIALIZING_DURING_TRANSACTION);
    }

    return this.committed.map((e) => e.serialize());
  }
}
