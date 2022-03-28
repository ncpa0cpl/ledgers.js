import { CopyList } from "../entity-containers/copy-list";
import { EntityList } from "../entity-containers/entity-list";
import { EntitySingleton } from "../entity-containers/entity-singleton";
import type { Entity } from "../entity/entity";
import type {
  Copy,
  EventData,
  SerializedEntities,
  SerializedEntityListEvents,
} from "../types";

export class EntitiesController {
  private singletons = new Map<string, EntitySingleton<Entity>>();
  private lists = new Map<string, EntityList<Entity>>();
  private copies = new Map<string, CopyList<Copy>>();

  private loadIntoSingleton(name: string, data: EventData<any>[]): void {
    if (!this.singletons.has(name)) {
      throw new Error();
    }

    const singleton = this.singletons.get(name)!;
    EntitySingleton._loadFrom(singleton, data);
  }

  private loadIntoList(
    name: string,
    data: SerializedEntityListEvents<any>
  ): void {
    if (!this.lists.has(name)) {
      throw new Error();
    }

    const list = this.lists.get(name)!;
    EntityList._loadFrom(list, data);
  }

  private loadIntoCopyList(name: string, data: Copy[]) {
    if (!this.copies.has(name)) {
      throw new Error();
    }

    const copies = this.copies.get(name)!;
    CopyList._loadFrom(copies, data);
  }

  registerSingleton(s: EntitySingleton<any>): void {
    if (this.singletons.has(s.getName())) {
      throw new Error();
    }

    this.singletons.set(s.getName(), s);
  }

  registerList(s: EntityList<any>): void {
    if (this.lists.has(s.getName())) {
      throw new Error();
    }

    this.lists.set(s.getName(), s);
  }

  registerCopyList(l: CopyList<Copy>, name: string): void {
    this.copies.set(name, l);
  }

  getSingletonByName<E extends Entity>(name: string): EntitySingleton<E> {
    const s = this.singletons.get(name);

    if (!s) {
      throw new Error();
    }

    return s as EntitySingleton<E>;
  }

  getListByName<E extends Entity>(name: string): EntityList<E> {
    const l = this.lists.get(name);

    if (!l) {
      throw new Error();
    }

    return l as EntityList<E>;
  }

  getCopiesByName<C extends Copy>(name: string): CopyList<C> {
    const c = this.copies.get(name);

    if (!c) {
      throw new Error();
    }

    return c as CopyList<C>;
  }

  findSingletonEntity<E extends Entity>(id: string): E | undefined {
    if (!id) return undefined;

    for (const s of this.singletons.values()) {
      if (s.getID() === id) {
        return s.get() as E;
      }
    }

    return undefined;
  }

  findListEntity<E extends Entity>(id: string): E | undefined {
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

    throw new Error();
  }

  getSnapshot(): object {
    const snapshot = {
      singletonEntities: {},
      listEntities: {},
      copies: {},
    };

    for (const [name, singleton] of this.singletons) {
      Object.assign(snapshot.singletonEntities, {
        [name]: singleton.get(),
      });
    }

    for (const [name, singleton] of this.lists) {
      Object.assign(snapshot.listEntities, { [name]: singleton.getAll() });
    }

    for (const [name, copies] of this.copies) {
      Object.assign(snapshot.copies, { [name]: copies.getAll() });
    }

    return snapshot;
  }

  serialize(): SerializedEntities {
    const serialized: SerializedEntities = {
      singletonEntities: {},
      listEntities: {},
      copies: {},
    };

    for (const [name, singleton] of this.singletons) {
      Object.assign(serialized.singletonEntities, {
        [name]: EntitySingleton._serialize(singleton),
      });
    }

    for (const [name, list] of this.lists) {
      Object.assign(serialized.listEntities, {
        [name]: EntityList._serialize(list),
      });
    }

    for (const [name, copies] of this.copies) {
      Object.assign(serialized.copies, { [name]: CopyList._serialize(copies) });
    }

    return serialized;
  }

  loadFrom(data: SerializedEntities): void {
    for (const [name, singleton] of Object.entries(data.singletonEntities)) {
      this.loadIntoSingleton(name, singleton);
    }

    for (const [name, list] of Object.entries(data.listEntities)) {
      this.loadIntoList(name, list);
    }

    for (const [name, copies] of Object.entries(data.copies)) {
      this.loadIntoCopyList(name, copies);
    }
  }
}
