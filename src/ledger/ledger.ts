import * as uuid from "uuid";
import type { Entity } from "../entity/entity";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import type { Copy, Reference, SerializedLedger } from "../types";
import { EntityReferenceType } from "../types";
import { BreakpointController } from "./breakpoint-controller";
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
      throw new LedgerError(ErrorCode.LEDGER_NAMES_DO_NOT_MATCH);
    }

    ledger.entities.loadFrom(data);
    ledger.breakpoints.loadFrom(data);

    return ledger as InstanceType<T>;
  }

  /** @internal */
  static _getTransaction(l: Ledger) {
    return l.transaction;
  }

  /** @internal */
  static _getEntityController(l: Ledger): EntitiesController {
    return l.entities;
  }

  /** @internal */
  static _getBreakpointController(l: Ledger): BreakpointController {
    return l.breakpoints;
  }

  private entities = new EntitiesController();
  private breakpoints = new BreakpointController(this);
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
          throw new LedgerError(ErrorCode.ENTITY_NOT_FOUND);
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
      throw new LedgerError(ErrorCode.LEDGER_NAMES_DO_NOT_MATCH);
    }

    switch (ref.type) {
      case EntityReferenceType.SINGLETON: {
        const singleton = this.entities.getSingletonByName(ref.name);

        if (!singleton.isInitiated() || singleton.getID() !== ref.id) {
          throw new LedgerError(ErrorCode.ENTITY_NOT_FOUND);
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
          throw new LedgerError(ErrorCode.ENTITY_NOT_FOUND);
        }

        return copy as T;
      }
      default:
        throw new Error();
    }
  }

  startTransaction(): void {
    if (this.transaction) {
      throw new LedgerError(ErrorCode.TRANSACTION_ALREADY_IN_PROGRESS);
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

  tx(callback: () => void): void {
    this.startTransaction();

    try {
      callback();
      this.commitTransaction();
    } catch (e) {
      this.rollbackTransaction();
      throw e;
    }
  }

  addBreakpoint(breakpoint: string | number): void {
    this.breakpoints.addBreakpoint(breakpoint);
  }

  hasBreakpoint(breakpoint: string | number): boolean {
    return this.breakpoints.hasBreakpoint(breakpoint);
  }

  getExistingBreakpoints(): Array<string | number> {
    return this.breakpoints.getBreakpoints();
  }

  serialize(): SerializedLedger {
    if (this.transaction) {
      throw new LedgerError(ErrorCode.SERIALIZING_DURING_TRANSACTION);
    }

    return {
      name: this.name,
      ...this.entities.serialize(),
      ...this.breakpoints.serialize(),
    };
  }

  getSnapshot(breakpoint?: string | number): object {
    return { ...this.entities.getSnapshot(breakpoint) };
  }

  getHistory(): Array<{
    time: number;
    breakpoint?: string | number;
    snapshot: object;
  }> {
    return [
      ...this.breakpoints.getBreakpointsWithTimestamps().map((breakpoint) => ({
        time: breakpoint.createdAt,
        breakpoint: breakpoint.breakpointID,
        snapshot: this.getSnapshot(breakpoint.breakpointID),
      })),
      {
        time: this.generateTimestamp(),
        snapshot: this.getSnapshot(),
      },
    ];
  }
}
