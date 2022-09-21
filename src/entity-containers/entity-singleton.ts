import { Entity } from "../entity/entity";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import { Event } from "../events/event";
import { EventList } from "../events/event-list";
import { Ledger } from "../ledger/ledger";
import type { EntityChangeData, EntityData, EventData } from "../types";

export class EntitySingleton<E extends Entity> {
  static _loadFrom<E2 extends Entity>(
    singleton: EntitySingleton<E2>,
    eventData: EventData<any>[]
  ): void {
    if (singleton.events.length > 0) {
      throw new LedgerError(ErrorCode.DESERIALIZING_ON_NON_EMPTY_LEDGER);
    }

    eventData.forEach((e) => singleton.events.add(new Event(e)));
    singleton.events.commit();
  }

  static _serialize<E extends Entity>(
    singleton: EntitySingleton<E>
  ): EventData<E>[] {
    return singleton.events.serialize();
  }

  private readonly parentLedger: Ledger;
  private readonly entityName: string;
  private readonly entityConstructor: new (parent: Ledger) => E;
  private events: EventList<E>;

  constructor(ledger: Ledger, entityConstructor: new (parent: Ledger) => E) {
    this.parentLedger = ledger;
    this.entityConstructor = entityConstructor;
    this.entityName = new entityConstructor(ledger).name;
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

  eventCreate(initData: EntityData<E>): string {
    if (this.events.length > 0) {
      throw new LedgerError(ErrorCode.ENTITY_ALREADY_CREATED);
    }

    initData.id ??= this.parentLedger.generateNextID();

    const event = Event.generateCreateEvent(this.parentLedger, initData);

    this.events.add(event);

    this.addToTransaction();

    return initData.id;
  }

  eventChange(changes: EntityChangeData<E>): void {
    if (this.events.length === 0) {
      throw new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED);
    }

    const event = Event.generateChangeEvent<E>(this.parentLedger, changes);

    this.events.add(event);

    this.addToTransaction();
  }

  eventBreakpoint(breakpoint: string | number): void {
    if (this.events.length === 0) {
      throw new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED);
    }

    const event = Event.generateBreakpointEvent<E>(
      this.parentLedger,
      breakpoint
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

    return firstEvent.data.id!;
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

    Entity._applyEvents(entity, this.events.getAsArray(breakpoint));

    return entity;
  }
}
