import type { BaseEntity } from "../entity/base-entity";
import { Ledger } from "../ledger/ledger";
import type { SerializedEvent } from "../types";
import { EventType } from "../types";
import type { Event } from "./event";

export class EventList<E extends BaseEntity> {
  private events: Event<E>[] = [];

  constructor(private ledger: Ledger) {}

  get length(): number {
    return this.events.length;
  }

  add(event: Event<E>): EventList<E> {
    this.events.push(event);

    return this;
  }

  hasCreateEventBeforeBreakpoint(breakpoint: string | number): boolean {
    const events = this.getAsArray(breakpoint);
    return events.some((e) => e.eventMetadata.type === EventType.CREATE);
  }

  getFirst() {
    return this.events[0];
  }

  getAsArray(breakpoint?: string | number): Event<E>[] {
    const events = this.events.slice();

    if (breakpoint !== undefined) {
      return Ledger._getBreakpointController(
        this.ledger,
      ).getEventsUntilBreakpoint(breakpoint, events);
    }

    return events;
  }

  serialize(): SerializedEvent[] {
    return this.events.map((e) => e.serialize());
  }

  copy() {
    const copy = new EventList<E>(this.ledger);
    copy.events = this.events.slice();
    return copy;
  }
}
