import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import type { Event } from "../events/event";

export abstract class Entity {
  abstract readonly name: string;
  readonly id!: string;

  createdAt!: number;
  updatedAt!: number;

  static _applyEvents<T extends Entity>(entity: T, events: Event<T>[]): void {
    if (events.length === 0) {
      throw new LedgerError(ErrorCode.EMPTY_EVENTS_LIST);
    }

    for (const event of events) {
      event.apply(entity);
    }

    entity.createdAt = events[0]!.timestamp;
    entity.updatedAt = events[events.length - 1]!.timestamp;
  }
}
