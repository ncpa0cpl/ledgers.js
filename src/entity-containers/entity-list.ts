import { Entity } from "../entity/entity";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import { Event } from "../events/event";
import { EventList } from "../events/event-list";
import { Ledger } from "../ledger/ledger";
import type {
  EntityChangeData,
  EntityData,
  SerializedEntityListEvents,
  SerializedEvent,
} from "../types";

export class EntityList<E extends Entity> {
  static _loadFrom<E2 extends Entity>(
    list: EntityList<E2>,
    eventData: SerializedEntityListEvents<any>
  ): void {
    if (list.entitiesEvents.size > 0) {
      throw new LedgerError(ErrorCode.DESERIALIZING_ON_NON_EMPTY_LEDGER);
    }

    for (const [id, events] of eventData) {
      const eventList = new EventList<E2>(list.parentLedger);
      events.forEach((e) => eventList.add(Event._loadFrom(e)));
      eventList.commit();

      list.entitiesEvents.set(id, eventList);
    }
  }

  static _serialize<E extends Entity>(
    list: EntityList<E>
  ): SerializedEntityListEvents<E> {
    for (const [, eventList] of list.entitiesEvents) {
      if (eventList.isTransactionPending) {
        throw new LedgerError(ErrorCode.SERIALIZING_DURING_TRANSACTION);
      }
    }

    return [...list.entitiesEvents.entries()].map(
      ([id, events]): [string, SerializedEvent[]] => [id, events.serialize()]
    );
  }

  private readonly parentLedger: Ledger;
  private readonly entityName: string;
  private readonly entityConstructor: new (parent: Ledger) => E;
  private readonly entitiesEvents = new Map<string, EventList<E>>();

  constructor(ledger: Ledger, entityConstructor: new (parent: Ledger) => E) {
    this.parentLedger = ledger;
    this.entityConstructor = entityConstructor;
    this.entityName = new entityConstructor(ledger).name;

    if (!this.entityName) {
      throw new LedgerError(ErrorCode.ENTITY_NAME_NOT_SPECIFIED);
    }

    Ledger._getEntityController(ledger).registerList(this);
  }

  private postTransaction() {
    const deleteEntries: string[] = [];

    for (const [id, eventList] of this.entitiesEvents) {
      if (eventList.length === 0) deleteEntries.push(id);
    }

    for (const id of deleteEntries) {
      this.entitiesEvents.delete(id);
    }
  }

  private addToTransaction(eventList: EventList<E>): void {
    const tx = Ledger._getTransaction(this.parentLedger);

    if (tx) {
      tx.add(eventList);
      tx.addPostTxHook(() => this.postTransaction());
    } else {
      eventList.commit();
      this.postTransaction();
    }
  }

  private createEntityFromEvents(
    events: EventList<E>,
    breakpoint?: string | number
  ): E {
    if (events.length === 0) {
      throw new LedgerError(ErrorCode.EMPTY_EVENTS_LIST);
    }

    const entity = new this.entityConstructor(this.parentLedger);

    Entity._applyEvents(entity, events.getAsArray(breakpoint));

    return entity;
  }

  eventCreate(initData: EntityData<E>): string {
    initData.id ??= this.parentLedger.generateNextID();

    if (this.entitiesEvents.has(initData.id)) {
      throw new LedgerError(ErrorCode.DUPLICATE_IDENTIFIER);
    }

    const previousBreakpoints = Ledger._getBreakpointController(
      this.parentLedger
    ).getBreakpoints();

    const eventList = new EventList<E>(this.parentLedger);

    for (const breakpoint of previousBreakpoints) {
      eventList.add(
        Event.generateBreakpointEvent<E>(this.parentLedger, breakpoint)
      );
    }

    const event = Event.generateCreateEvent(this.parentLedger, initData);

    eventList.add(event);

    this.entitiesEvents.set(initData.id, eventList);

    this.addToTransaction(eventList);

    return initData.id;
  }

  eventChange(id: string, changes: EntityChangeData<E>): void {
    const eventList = this.entitiesEvents.get(id);

    if (eventList === undefined) {
      throw new LedgerError(ErrorCode.UNKNOWN_IDENTIFIER);
    }

    const event = Event.generateChangeEvent<E>(this.parentLedger, changes);

    eventList.add(event);

    this.addToTransaction(eventList);
  }

  eventBreakpoint(breakpoint: string | number): void {
    for (const eventList of this.entitiesEvents.values()) {
      const event = Event.generateBreakpointEvent<E>(
        this.parentLedger,
        breakpoint
      );

      eventList.add(event);
      this.addToTransaction(eventList);
    }
  }

  getName(): string {
    return this.entityName;
  }

  getAll(breakpoint?: string | number): E[] {
    const entities: E[] = [];

    for (const events of this.entitiesEvents.values()) {
      if (
        breakpoint !== undefined &&
        !events.hasCreateEventBeforeBreakpoint(breakpoint)
      )
        continue;

      entities.push(this.createEntityFromEvents(events, breakpoint));
    }

    return entities;
  }

  get(id: string, breakpoint?: string | number): E {
    const eventList = this.entitiesEvents.get(id);

    if (!eventList) {
      throw new LedgerError(ErrorCode.UNKNOWN_IDENTIFIER);
    }

    if (
      breakpoint !== undefined &&
      !eventList.hasCreateEventBeforeBreakpoint(breakpoint)
    ) {
      throw new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED);
    }

    return this.createEntityFromEvents(eventList, breakpoint);
  }

  has(id: string): boolean {
    return this.entitiesEvents.has(id);
  }
}
