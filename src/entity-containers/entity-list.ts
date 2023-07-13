import { BaseEntity } from "../entity/base-entity";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import type { GenerateEventData } from "../events/event";
import { Event } from "../events/event";
import { EventList } from "../events/event-list";
import { Ledger } from "../ledger/ledger";
import type {
  AdditionalEventData,
  EntityChangeData,
  EntityData,
  SerializedEntityListEvents,
  SerializedEvent,
} from "../types";

export class EntityList<E extends BaseEntity> {
  /** @internal */
  static _loadFrom<E2 extends BaseEntity>(
    list: EntityList<E2>,
    eventData: SerializedEntityListEvents,
  ): void {
    if (list.entitiesEvents.size > 0) {
      throw new LedgerError(ErrorCode.DESERIALIZING_ON_NON_EMPTY_LEDGER);
    }

    const migrationController = Ledger._getMigrationController(
      list.parentLedger,
    );

    for (const [id, events] of eventData) {
      const eventList = new EventList<E2>(list.parentLedger);

      for (const e of events) {
        if (list.entityName !== e.metadata.entity) {
          throw new LedgerError(ErrorCode.EVENT_ASSOCIATION_ERROR);
        }

        const event = migrationController.migrateEvent(Event._loadFrom(e));

        eventList.add(event);
      }

      eventList.commit();

      list.entitiesEvents.set(id, eventList);
    }
  }

  /** @internal */
  static _serialize<E extends BaseEntity>(
    list: EntityList<E>,
  ): SerializedEntityListEvents {
    for (const [, eventList] of list.entitiesEvents) {
      if (eventList.isTransactionPending) {
        throw new LedgerError(ErrorCode.SERIALIZING_DURING_TRANSACTION);
      }
    }

    return [...list.entitiesEvents.entries()].map(
      ([id, events]): [string, SerializedEvent[]] => [id, events.serialize()],
    );
  }

  /** @internal */
  static _addBreakpointEvent<E extends BaseEntity>(
    list: EntityList<E>,
    breakpoint: string | number,
  ): void {
    return list.eventBreakpoint(breakpoint);
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
    breakpoint?: string | number,
  ): E {
    if (events.length === 0) {
      throw new LedgerError(ErrorCode.EMPTY_EVENTS_LIST);
    }

    const entity = new this.entityConstructor(this.parentLedger);

    BaseEntity._applyEvents(entity, events.getAsArray(breakpoint));

    return entity;
  }

  private eventBreakpoint(
    breakpoint: string | number,
    eventMetadata?: AdditionalEventData,
  ): void {
    const meta: GenerateEventData = {
      ...eventMetadata,
      entity: this.entityName,
    };

    for (const eventList of this.entitiesEvents.values()) {
      const event = Event._generateBreakpointEvent<E>(
        this.parentLedger,
        breakpoint,
        meta,
      );

      eventList.add(event);
      this.addToTransaction(eventList);
    }
  }

  create(initData: EntityData<E>, eventMetadata?: AdditionalEventData): string {
    initData.id ??= this.parentLedger.generateNextID();

    if (this.entitiesEvents.has(initData.id)) {
      throw new LedgerError(ErrorCode.DUPLICATE_IDENTIFIER);
    }

    const meta: GenerateEventData = {
      ...eventMetadata,
      entity: this.entityName,
    };

    const previousBreakpoints = Ledger._getBreakpointController(
      this.parentLedger,
    ).getBreakpoints();

    const eventList = new EventList<E>(this.parentLedger);

    for (const breakpoint of previousBreakpoints) {
      eventList.add(
        Event._generateBreakpointEvent<E>(this.parentLedger, breakpoint, meta),
      );
    }

    const event = Event._generateCreateEvent(this.parentLedger, initData, meta);

    eventList.add(event);

    this.entitiesEvents.set(initData.id, eventList);

    this.addToTransaction(eventList);

    return initData.id;
  }

  change(
    id: string,
    changes: EntityChangeData<E>,
    eventMetadata?: AdditionalEventData,
  ): void {
    const eventList = this.entitiesEvents.get(id);

    if (eventList === undefined) {
      throw new LedgerError(ErrorCode.UNKNOWN_IDENTIFIER);
    }

    const meta: GenerateEventData = {
      ...eventMetadata,
      entity: this.entityName,
    };

    const event = Event._generateChangeEvent<E>(
      this.parentLedger,
      changes,
      meta,
    );

    eventList.add(event);

    this.addToTransaction(eventList);
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
