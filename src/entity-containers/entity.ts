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
  SerializedEvent,
} from "../types";
import { extractEntityIdFromEvent } from "../utilities/extract-entity-id-from-event";

export class Entity<E extends BaseEntity> {
  /** @internal */
  static _loadFrom<E2 extends BaseEntity>(
    entity: Entity<E2>,
    eventData: SerializedEvent[],
  ): void {
    if (entity.committedEvent.length > 0) {
      throw new LedgerError(ErrorCode.DESERIALIZING_ON_NON_EMPTY_LEDGER);
    }

    const migrationController = Ledger._getMigrationController(
      entity.parentLedger,
    );

    for (const e of eventData) {
      if (entity.entityName !== e.metadata.entity) {
        throw new LedgerError(ErrorCode.EVENT_ASSOCIATION_ERROR);
      }

      const event = migrationController.migrateEvent(Event._loadFrom(e));

      entity.committedEvent.add(event);
    }
  }

  /** @internal */
  static _serialize<E extends BaseEntity>(
    entity: Entity<E>,
  ): SerializedEvent[] {
    if (entity.isInTransaction) {
      throw new LedgerError(ErrorCode.SERIALIZING_DURING_TRANSACTION);
    }

    return entity.committedEvent.serialize();
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
  private committedEvent: EventList<E>;
  private stagedEvent: EventList<E> | null = null;
  private txInterface: TransactionInterface;

  constructor(ledger: Ledger, entityConstructor: new (parent: Ledger) => E) {
    this.parentLedger = ledger;
    this.entityConstructor = entityConstructor;
    const tmpEntity = new entityConstructor(ledger);
    this.entityName = tmpEntity.name;
    this.committedEvent = new EventList<E>(this.parentLedger);

    if (!this.entityName) {
      throw new LedgerError(ErrorCode.ENTITY_NAME_NOT_SPECIFIED);
    }

    Ledger._getEntityController(ledger).registerSingleton(this);

    this.txInterface = {
      commit: () => this.commit(),
      rollback: () => this.rollback(),
    };
  }

  /**
   * If there are uncommitted changes on this entity, this value will be `true`.
   */
  get isInTransaction(): boolean {
    return !!this.stagedEvent;
  }

  private commit() {
    this.committedEvent = this.stagedEvent ?? this.committedEvent;
    this.stagedEvent = null;
  }

  private rollback() {
    this.stagedEvent = null;
  }

  private perform<R>(action: (eventList: EventList<E>) => R): R {
    const tx = Ledger._getTransaction(this.parentLedger);

    if (tx) {
      if (this.stagedEvent === null) {
        this.stagedEvent = this.committedEvent.copy();
      }

      tx.add(this.txInterface);
      return action(this.stagedEvent);
    } else {
      return action(this.committedEvent);
    }
  }

  private eventBreakpoint(
    breakpoint: string | number,
    eventMetadata?: AdditionalEventData,
  ): void {
    this.perform((eventList) => {
      if (eventList.length === 0) {
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

      this.committedEvent.add(event);
    });
  }

  create(initData: EntityData<E>, eventMetadata?: AdditionalEventData): string {
    return this.perform((eventList) => {
      if (eventList.length > 0) {
        throw new LedgerError(ErrorCode.ENTITY_ALREADY_CREATED);
      }

      const meta: GenerateEventData = {
        ...eventMetadata,
        entity: this.entityName,
      };

      initData.id ??= this.parentLedger.generateNextID();

      const event = Event._generateCreateEvent(
        this.parentLedger,
        initData,
        meta,
      );

      eventList.add(event);

      return initData.id;
    });
  }

  change(
    changes: EntityChangeData<E>,
    eventMetadata?: AdditionalEventData,
  ): void {
    this.perform((eventList) => {
      if (eventList.length === 0) {
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

      eventList.add(event);
    });
  }

  getName(): string {
    return this.entityName;
  }

  isInitiated(): boolean {
    return this.perform((eventList) => eventList.length > 0);
  }

  getID(): string {
    return this.perform((eventList) => {
      const firstEvent = eventList.getFirst();

      if (firstEvent === undefined) {
        throw new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED);
      }

      return extractEntityIdFromEvent(firstEvent);
    });
  }

  get(breakpoint?: string | number): E {
    return this.perform((eventList) => {
      if (eventList.length === 0) {
        throw new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED);
      }

      if (
        breakpoint !== undefined &&
        !eventList.hasCreateEventBeforeBreakpoint(breakpoint)
      ) {
        throw new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED);
      }

      const entity = new this.entityConstructor(this.parentLedger);

      BaseEntity._applyEvents(entity, eventList.getAsArray(breakpoint));

      return entity;
    });
  }
}
