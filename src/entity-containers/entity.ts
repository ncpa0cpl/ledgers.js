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
  SerializedEvent,
} from "../types";
import { extractEntityIdFromEvent } from "../utilities/extract-entity-id-from-event";

export class Entity<E extends BaseEntity> {
  /** @internal */
  static _loadFrom<E2 extends BaseEntity>(
    singleton: Entity<E2>,
    eventData: SerializedEvent[],
  ): void {
    if (singleton.events.length > 0) {
      throw new LedgerError(ErrorCode.DESERIALIZING_ON_NON_EMPTY_LEDGER);
    }

    const migrationController = Ledger._getMigrationController(
      singleton.parentLedger,
    );

    for (const e of eventData) {
      if (singleton.entityName !== e.metadata.entity) {
        throw new LedgerError(ErrorCode.EVENT_ASSOCIATION_ERROR);
      }

      const event = migrationController.migrateEvent(Event._loadFrom(e));

      singleton.events.add(event);
    }

    singleton.events.commit();
  }

  /** @internal */
  static _serialize<E extends BaseEntity>(
    singleton: Entity<E>,
  ): SerializedEvent[] {
    return singleton.events.serialize();
  }

  /** @internal */
  static _addBreakpointEvent<E extends BaseEntity>(
    entity: Entity<E>,
    breakpoint: string | number,
  ): void {
    return entity.eventBreakpoint(breakpoint);
  }

  private readonly parentLedger: Ledger;
  private readonly entityName: string;
  private readonly entityConstructor: new (parent: Ledger) => E;
  private events: EventList<E>;

  constructor(ledger: Ledger, entityConstructor: new (parent: Ledger) => E) {
    this.parentLedger = ledger;
    this.entityConstructor = entityConstructor;
    const tmpEntity = new entityConstructor(ledger);
    this.entityName = tmpEntity.name;
    this.events = new EventList<E>(this.parentLedger);

    if (!this.entityName) {
      throw new LedgerError(ErrorCode.ENTITY_NAME_NOT_SPECIFIED);
    }

    Ledger._getEntityController(ledger).registerSingleton(this);
  }

  private addToTransaction(): void {
    const tx = Ledger._getTransaction(this.parentLedger);

    if (tx) {
      tx.add(this.events);
    } else {
      this.events.commit();
    }
  }

  private eventBreakpoint(
    breakpoint: string | number,
    eventMetadata?: AdditionalEventData,
  ): void {
    if (this.events.length === 0) {
      throw new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED);
    }

    const meta: GenerateEventData = {
      ...eventMetadata,
      entity: this.entityName,
    };

    const event = Event._generateBreakpointEvent<E>(
      this.parentLedger,
      breakpoint,
      meta,
    );

    this.events.add(event);

    this.addToTransaction();
  }

  create(initData: EntityData<E>, eventMetadata?: AdditionalEventData): string {
    if (this.events.length > 0) {
      throw new LedgerError(ErrorCode.ENTITY_ALREADY_CREATED);
    }

    const meta: GenerateEventData = {
      ...eventMetadata,
      entity: this.entityName,
    };

    initData.id ??= this.parentLedger.generateNextID();

    const event = Event._generateCreateEvent(this.parentLedger, initData, meta);

    this.events.add(event);

    this.addToTransaction();

    return initData.id;
  }

  change(
    changes: EntityChangeData<E>,
    eventMetadata?: AdditionalEventData,
  ): void {
    if (this.events.length === 0) {
      throw new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED);
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

    this.events.add(event);

    this.addToTransaction();
  }

  getName(): string {
    return this.entityName;
  }

  isInitiated(): boolean {
    return this.events.length !== 0;
  }

  getID(): string {
    const eventList = this.events.getAsArray();
    const firstEvent = eventList[0];

    if (firstEvent === undefined) {
      throw new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED);
    }

    return extractEntityIdFromEvent(firstEvent);
  }

  get(breakpoint?: string | number): E {
    if (this.events.length === 0) {
      throw new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED);
    }

    if (
      breakpoint !== undefined &&
      !this.events.hasCreateEventBeforeBreakpoint(breakpoint)
    ) {
      throw new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED);
    }

    const entity = new this.entityConstructor(this.parentLedger);

    BaseEntity._applyEvents(entity, this.events.getAsArray(breakpoint));

    return entity;
  }
}
