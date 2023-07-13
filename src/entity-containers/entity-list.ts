import { BaseEntity } from "../entity/base-entity";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import type { GenerateEventData } from "../events/event";
import { Event } from "../events/event";
import { EventList } from "../events/event-list";
import { Ledger } from "../ledger/ledger";
import type { TransactionInterface } from "../ledger/transaction";
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
    if (list.committedEvents.size > 0) {
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

      list.committedEvents.set(id, eventList);
    }
  }

  /** @internal */
  static _serialize<E extends BaseEntity>(
    list: EntityList<E>,
  ): SerializedEntityListEvents {
    if (list.isInTransaction) {
      throw new LedgerError(ErrorCode.SERIALIZING_DURING_TRANSACTION);
    }

    return [...list.committedEvents.entries()].map(
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
  private committedEvents = new Map<string, EventList<E>>();
  private stagedEvents: Map<string, EventList<E>> | null = null;
  private txInterface: TransactionInterface;

  constructor(ledger: Ledger, entityConstructor: new (parent: Ledger) => E) {
    this.parentLedger = ledger;
    this.entityConstructor = entityConstructor;
    this.entityName = new entityConstructor(ledger).name;

    if (!this.entityName) {
      throw new LedgerError(ErrorCode.ENTITY_NAME_NOT_SPECIFIED);
    }

    Ledger._getEntityController(ledger).registerList(this);

    this.txInterface = {
      commit: () => this.commit(),
      rollback: () => this.rollback(),
    };
  }

  /**
   * If there are uncommitted changes on this entity, this value will be `true`.
   */
  get isInTransaction(): boolean {
    return !!this.stagedEvents;
  }

  private commit() {
    this.committedEvents = this.stagedEvents ?? this.committedEvents;
    this.stagedEvents = null;
  }

  private rollback() {
    this.stagedEvents = null;
  }

  private copyEvents(): Map<string, EventList<E>> {
    const copy = new Map<string, EventList<E>>();

    for (const [id, eventList] of this.committedEvents) {
      copy.set(id, eventList.copy());
    }

    return copy;
  }

  private perform<R>(action: (events: Map<string, EventList<E>>) => R): R {
    const tx = Ledger._getTransaction(this.parentLedger);

    if (tx) {
      if (this.stagedEvents === null) {
        this.stagedEvents = this.copyEvents();
      }

      tx.add(this.txInterface);
      return action(this.stagedEvents);
    } else {
      return action(this.committedEvents);
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
    this.perform((entities) => {
      const meta: GenerateEventData = {
        ...eventMetadata,
        entity: this.entityName,
      };

      for (const eventList of entities.values()) {
        const event = Event._generateBreakpointEvent<E>(
          this.parentLedger,
          breakpoint,
          meta,
        );

        eventList.add(event);
      }
    });
  }

  create(initData: EntityData<E>, eventMetadata?: AdditionalEventData): string {
    return this.perform((entities) => {
      initData.id ??= this.parentLedger.generateNextID();

      if (entities.has(initData.id)) {
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
          Event._generateBreakpointEvent<E>(
            this.parentLedger,
            breakpoint,
            meta,
          ),
        );
      }

      const event = Event._generateCreateEvent(
        this.parentLedger,
        initData,
        meta,
      );

      eventList.add(event);
      entities.set(initData.id, eventList);

      return initData.id;
    });
  }

  change(
    id: string,
    changes: EntityChangeData<E>,
    eventMetadata?: AdditionalEventData,
  ): void {
    this.perform((entities) => {
      const eventList = entities.get(id);

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
    });
  }

  getName(): string {
    return this.entityName;
  }

  getAll(breakpoint?: string | number): E[] {
    return this.perform((entities) => {
      const result: E[] = [];

      for (const events of entities.values()) {
        if (
          breakpoint !== undefined &&
          !events.hasCreateEventBeforeBreakpoint(breakpoint)
        )
          continue;

        result.push(this.createEntityFromEvents(events, breakpoint));
      }

      return result;
    });
  }

  get(id: string, breakpoint?: string | number): E {
    return this.perform((entities) => {
      const eventList = entities.get(id);

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
    });
  }

  delete(id: string): void {
    this.perform((entities) => {
      entities.delete(id);
    });
  }

  has(id: string): boolean {
    return this.perform((entities) => entities.has(id));
  }
}
