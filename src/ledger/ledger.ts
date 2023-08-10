import * as uuid from "uuid";
import type { BaseEntity } from "../entity/base-entity";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import type { SnapshotOf } from "../type-utils";
import type {
  Copy,
  MigrationInterface,
  Reference,
  SerializedLedger,
} from "../types";
import { EntityReferenceType } from "../types";
import { BreakpointController } from "./breakpoint-controller";
import { EntitiesController } from "./entities-controller";
import { MigrationController } from "./migration-controller";
import { Transaction } from "./transaction";

type InitializeArgs<T> = T extends new (...args: infer A) => any ? A : never;

export abstract class Ledger {
  private static migrations: MigrationController;
  protected static version = 1;

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

  static registerMigrations(
    ...migrations: MigrationInterface<any, any>[]
  ): void {
    this._ensureMigrationControllerExists();
    for (const migration of migrations) {
      this.migrations.registerMigration(migration);
    }
  }

  /** @internal */
  static _ensureMigrationControllerExists(): void {
    if (!this.hasOwnProperty("migrations")) {
      this.migrations = new MigrationController(this);
    }
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

  /** @internal */
  static _getMigrationController(l: Ledger): MigrationController {
    const c = Reflect.getPrototypeOf(l)?.constructor as typeof Ledger;
    c._ensureMigrationControllerExists();
    return c.migrations;
  }

  /** @internal */
  static _getVersion(l: Ledger): number {
    const c = Reflect.getPrototypeOf(l)?.constructor as typeof Ledger;
    return c.version;
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

  createReference<T extends BaseEntity | Copy>(entity: T): Reference<T> {
    let type: EntityReferenceType = EntityReferenceType.SINGLETON;
    const isSingleton = !!this.entities.findEntity(entity.id);

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
      name = (entity as BaseEntity).name;
    }

    return {
      id: entity.id,
      ledgerName: this.name,
      name,
      type,
    } as Reference<T>;
  }

  resolveReference<T extends BaseEntity | Copy>(ref: Reference<T>): T {
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

  tx<R = void>(callback: () => R): R {
    this.startTransaction();

    try {
      const r = callback();
      this.commitTransaction();
      return r;
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

  getSnapshot<T extends Ledger>(
    this: T,
    breakpoint?: string | number,
  ): SnapshotOf<T> {
    return this.entities.getSnapshot(breakpoint) as any;
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
