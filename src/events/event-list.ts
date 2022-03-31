import type { Entity } from "../entity/entity";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import type { EventData } from "../types";
import type { Event } from "./event";

export class EventList<E extends Entity> {
  private committed: Event<E>[] = [];
  private stagged: Event<E>[] = [];

  get isTransactionPending(): boolean {
    return this.stagged.length > 0;
  }

  get length(): number {
    return this.stagged.length + this.committed.length;
  }

  commit(): EventList<E> {
    this.committed.push(...this.stagged.splice(0));

    return this;
  }

  rollback(): EventList<E> {
    this.stagged.splice(0);

    return this;
  }

  add(event: Event<E>): EventList<E> {
    this.stagged.push(event);

    return this;
  }

  getAsArray(): Event<E>[] {
    return [...this.committed, ...this.stagged];
  }

  serialize(): EventData<E>[] {
    if (this.isTransactionPending) {
      throw new LedgerError(ErrorCode.SERIALIZING_DURING_TRANSACTION);
    }

    return this.committed.map((e) => e.serialize());
  }
}
