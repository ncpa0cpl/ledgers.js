import * as uuid from "uuid";
import type { Entity } from "../entity/entity";
import type { Copy, Reference, SerializedLedger } from "../types";
import { EntityReferenceType } from "../types";
import { EntitiesController } from "./entities-controller";
import { Transaction } from "./transaction";

type InitializeArgs<T> = T extends new (...args: infer A) => any ? A : never;

export abstract class Ledger {
  static loadFrom<T extends new (...args: any[]) => Ledger>(
    this: T,
    data: SerializedLedger,
    ...args: InitializeArgs<T>
  ): InstanceType<T> {
    const ledger = new this(...args);

    if (data.name !== ledger.name) {
      throw new Error();
    }

    ledger.entities.loadFrom(data);

    return ledger as InstanceType<T>;
  }

  static _getTransaction(l: Ledger) {
    return l.transaction;
  }

  static _getEntityController(l: Ledger): EntitiesController {
    return l.entities;
  }

  private entities = new EntitiesController();
  private transaction?: Transaction;

  abstract name: string;

  generateNextID(): string {
    return uuid.v4();
  }

  generateTimestamp(): number {
    return Date.now();
  }

  createReference<T extends Entity | Copy>(entity: T): Reference<T> {
    let type: EntityReferenceType = EntityReferenceType.SINGLETON;
    const isSingleton = !!this.entities.findSingletonEntity(entity.id);

    if (!isSingleton) {
      type = EntityReferenceType.LIST;
      const isList = !!this.entities.findListEntity(entity.id);

      if (!isList) {
        type = EntityReferenceType.COPY;
        const isCopy = !!this.entities.findCopy(entity.id);

        if (!isCopy) {
          throw new Error();
        }
      }
    }

    let name: string;

    if (type === EntityReferenceType.COPY) {
      name = this.entities.getCopyName(entity.id);
    } else {
      name = (entity as Entity).name;
    }

    return {
      id: entity.id,
      ledgerName: this.name,
      name,
      type,
    };
  }

  resolveReference<T extends Entity | Copy>(ref: Reference<T>): T {
    if (ref.ledgerName !== this.name) {
      throw new Error();
    }

    switch (ref.type) {
      case EntityReferenceType.SINGLETON: {
        const singleton = this.entities.getSingletonByName(ref.name);

        if (singleton.getID() !== ref.id) {
          throw new Error();
        }

        return singleton.get() as T;
      }
      case EntityReferenceType.LIST: {
        const list = this.entities.getListByName(ref.name);

        return list.get(ref.id) as T;
      }
      case EntityReferenceType.COPY: {
        const copyList = this.entities.getCopiesByName(ref.name);

        const copy = copyList.get(ref.id);

        if (!copy) {
          throw new Error();
        }

        return copy as T;
      }
      default:
        throw new Error();
    }
  }

  startTransaction(): void {
    if (this.transaction) {
      throw new Error();
    }

    this.transaction = new Transaction();
  }

  commitTransaction(): void {
    this.transaction?.commit();

    this.transaction = undefined;
  }

  rollbackTransaction(): void {
    this.transaction?.rollback();

    this.transaction = undefined;
  }

  tx(callback: () => void) {
    this.startTransaction();

    try {
      callback();
      this.commitTransaction();
    } catch (e) {
      this.rollbackTransaction();
      throw e;
    }
  }

  serialize(): SerializedLedger {
    if (this.transaction) {
      throw new Error();
    }

    return {
      name: this.name,
      ...this.entities.serialize(),
    };
  }

  snapshot(): object {
    return this.entities.getSnapshot();
  }
}
