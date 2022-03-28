import { Entity } from "../entity/entity";
import { Event } from "../events/event";
import { EventList } from "../events/event-list";
import { Ledger } from "../ledger/ledger";
import type {
  EntityChangeData,
  EntityData,
  EventData,
  SerializedEntityListEvents,
} from "../types";

export class EntityList<E extends Entity> {
  static _loadFrom<E2 extends Entity>(
    list: EntityList<E2>,
    eventData: SerializedEntityListEvents<any>
  ): void {
    if (list.entitiesEvents.size > 0) {
      throw new Error();
    }

    for (const [id, events] of eventData) {
      const eventList = new EventList<E2>();
      events.forEach((e) => eventList.add(new Event(e)));
      eventList.commit();

      list.entitiesEvents.set(id, eventList);
    }
  }

  static _serialize<E extends Entity>(
    list: EntityList<E>
  ): SerializedEntityListEvents<E> {
    for (const [_, eventList] of list.entitiesEvents) {
      if (eventList.isTransactionPending) {
        throw new Error();
      }
    }

    return [...list.entitiesEvents.entries()].map(
      ([id, events]): [string, EventData<E>[]] => [id, events.serialize()]
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
      throw new Error();
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

  private createEntityFromEvents(events: EventList<E>): E {
    if (events.length === 0) {
      throw new Error();
    }

    const entity = new this.entityConstructor(this.parentLedger);

    Entity._applyEvents(entity, events.getAsArray());

    return entity;
  }

  eventCreate(initData: EntityData<E>): string {
    initData.id ??= this.parentLedger.generateNextID();

    if (this.entitiesEvents.has(initData.id)) {
      throw new Error();
    }

    const event = Event.generateCreateEvent(this.parentLedger, initData);

    const eventList = new EventList<E>().add(event);

    this.entitiesEvents.set(initData.id, eventList);

    this.addToTransaction(eventList);

    return initData.id;
  }

  eventChange(id: string, changes: EntityChangeData<E>): void {
    if (this.entitiesEvents.has(id)) {
      throw new Error();
    }

    const eventList = this.entitiesEvents.get(id);

    if (eventList === undefined) {
      throw new Error();
    }

    const event = Event.generateChangeEvent<E>(this.parentLedger, changes);

    eventList.add(event);

    this.addToTransaction(eventList);
  }

  getName(): string {
    return this.entityName;
  }

  getAll(): E[] {
    const entities: E[] = [];

    for (const events of this.entitiesEvents.values()) {
      entities.push(this.createEntityFromEvents(events));
    }

    return entities;
  }

  get(id: string): E {
    if (!this.entitiesEvents.has(id)) {
      throw new Error();
    }

    const eventList = this.entitiesEvents.get(id)!;

    return this.createEntityFromEvents(eventList);
  }

  has(id: string): boolean {
    return this.entitiesEvents.has(id);
  }
}
