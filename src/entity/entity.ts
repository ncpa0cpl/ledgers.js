import type { Event } from "../events/event";

export abstract class Entity {
  abstract readonly name: string;
  readonly id!: string;

  createdAt!: number;
  updatedAt!: number;

  static _applyEvents<T extends Entity>(entity: T, events: Event<T>[]): void {
    if (events.length === 0) {
      throw new Error();
    }

    for (const event of events) {
      event.apply(entity);
    }

    entity.createdAt = events[0]!.timestamp;
    entity.updatedAt = events[events.length - 1]!.timestamp;
  }
}
