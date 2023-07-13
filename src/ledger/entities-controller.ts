import { CopiesList } from "../entity-containers/copy-list";
import { Entity } from "../entity-containers/entity";
import { EntityList } from "../entity-containers/entity-list";
import type { BaseEntity } from "../entity/base-entity";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import type {
  Copy,
  SerializedEntities,
  SerializedEntityListEvents,
  SerializedEvent,
} from "../types";

export class EntitiesController {
  /** @internal */
  static _getAllEntities(controller: EntitiesController) {
    return [...controller.singletons.values()];
  }

  /** @internal */
  static _getAllEntityLists(controller: EntitiesController) {
    return [...controller.lists.values()];
  }

  private singletons = new Map<string, Entity<BaseEntity>>();
  private lists = new Map<string, EntityList<BaseEntity>>();
  private copies = new Map<string, CopiesList<Copy>>();

  private loadIntoSingleton(name: string, data: SerializedEvent[]): void {
    if (!this.singletons.has(name)) {
      throw new LedgerError(ErrorCode.UNKNOWN_ENTITY_NAME);
    }

    const singleton = this.singletons.get(name)!;
    Entity._loadFrom(singleton, data);
  }

  private loadIntoList(name: string, data: SerializedEntityListEvents): void {
    if (!this.lists.has(name)) {
      throw new LedgerError(ErrorCode.UNKNOWN_ENTITY_NAME);
    }

    const list = this.lists.get(name)!;
    EntityList._loadFrom(list, data);
  }

  private loadIntoCopyList(name: string, data: Copy[]) {
    if (!this.copies.has(name)) {
      throw new LedgerError(ErrorCode.UNKNOWN_ENTITY_NAME);
    }

    const copies = this.copies.get(name)!;
    CopiesList._loadFrom(copies, data);
  }

  registerSingleton(s: Entity<any>): void {
    if (this.singletons.has(s.getName())) {
      throw new LedgerError(ErrorCode.DUPLICATE_ENTITY);
    }

    this.singletons.set(s.getName(), s);
  }

  registerList(s: EntityList<any>): void {
    if (this.lists.has(s.getName())) {
      throw new LedgerError(ErrorCode.DUPLICATE_ENTITY);
    }

    this.lists.set(s.getName(), s);
  }

  registerCopyList(l: CopiesList<Copy>, name: string): void {
    if (this.copies.has(name)) {
      throw new LedgerError(ErrorCode.DUPLICATE_ENTITY);
    }

    this.copies.set(name, l);
  }

  getSingletonByName<E extends BaseEntity>(name: string): Entity<E> {
    const s = this.singletons.get(name);

    if (!s) {
      throw new LedgerError(ErrorCode.UNKNOWN_ENTITY_NAME);
    }

    return s as Entity<E>;
  }

  getListByName<E extends BaseEntity>(name: string): EntityList<E> {
    const l = this.lists.get(name);

    if (!l) {
      throw new LedgerError(ErrorCode.UNKNOWN_ENTITY_NAME);
    }

    return l as EntityList<E>;
  }

  getCopiesByName<C extends Copy>(name: string): CopiesList<C> {
    const c = this.copies.get(name);

    if (!c) {
      throw new LedgerError(ErrorCode.UNKNOWN_ENTITY_NAME);
    }

    return c as CopiesList<C>;
  }

  findEntity<E extends BaseEntity>(id: string): E | undefined {
    if (!id) return undefined;

    for (const s of this.singletons.values()) {
      if (s.isInitiated() && s.getID() === id) {
        return s.get() as E;
      }
    }

    return undefined;
  }

  findListEntity<E extends BaseEntity>(id: string): E | undefined {
    if (!id) return undefined;

    for (const l of this.lists.values()) {
      if (l.has(id)) {
        return l.get(id) as E;
      }
    }

    return undefined;
  }

  findCopy<C extends Copy>(id: string): C | undefined {
    if (!id) return undefined;

    for (const l of this.copies.values()) {
      if (l.has(id)) {
        return l.get(id) as C;
      }
    }

    return undefined;
  }

  getCopyName(id: string): string {
    for (const [name, l] of this.copies) {
      if (l.has(id)) {
        return name;
      }
    }

    throw new LedgerError(ErrorCode.UNKNOWN_IDENTIFIER);
  }

  getSnapshot(breakpoint?: string | number): object {
    const snapshot = {
      entities: {},
      listEntities: {},
      copies: {},
    };

    for (const [name, entity] of this.singletons) {
      Object.assign(snapshot.entities, {
        [name]: entity.get(breakpoint),
      });
    }

    for (const [name, entities] of this.lists) {
      Object.assign(snapshot.listEntities, {
        [name]: entities.getAll(breakpoint),
      });
    }

    for (const [name, copies] of this.copies) {
      Object.assign(snapshot.copies, { [name]: copies.getAll() });
    }

    return snapshot;
  }

  serialize(): SerializedEntities {
    const serialized: SerializedEntities = {
      entities: {},
      listEntities: {},
      copies: {},
    };

    for (const [name, singleton] of this.singletons) {
      Object.assign(serialized.entities, {
        [name]: Entity._serialize(singleton),
      });
    }

    for (const [name, list] of this.lists) {
      Object.assign(serialized.listEntities, {
        [name]: EntityList._serialize(list),
      });
    }

    for (const [name, copies] of this.copies) {
      Object.assign(serialized.copies, {
        [name]: CopiesList._serialize(copies),
      });
    }

    return serialized;
  }

  loadFrom(data: SerializedEntities): void {
    for (const [name, entity] of Object.entries(data.entities)) {
      this.loadIntoSingleton(name, entity);
    }

    for (const [name, list] of Object.entries(data.listEntities)) {
      this.loadIntoList(name, list);
    }

    for (const [name, copies] of Object.entries(data.copies)) {
      this.loadIntoCopyList(name, copies);
    }
  }
}
