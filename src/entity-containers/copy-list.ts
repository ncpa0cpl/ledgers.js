import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import { Ledger } from "../ledger/ledger";
import type { TransactionInterface } from "../ledger/transaction";
import type { Copy } from "../types";

export class CopiesList<C extends Copy, Name extends string = string> {
  /** @internal */
  static _loadFrom<D extends Copy>(copyList: CopiesList<any>, copies: D[]) {
    if (copyList.committed.size > 0) {
      throw new LedgerError(ErrorCode.DESERIALIZING_ON_NON_EMPTY_LEDGER);
    }

    for (const c of copies) {
      copyList.put(c);
    }
  }

  /** @internal */
  static _serialize<C extends Copy>(list: CopiesList<C>): C[] {
    if (list.isInTransaction) {
      throw new LedgerError(ErrorCode.SERIALIZING_DURING_TRANSACTION);
    }

    return list.getAll();
  }

  private parentLedger: Ledger;
  private name: string;
  private committed = new Map<string, C>();
  private staged: Map<string, C> | null = null;
  private txInterface: TransactionInterface;

  constructor(parentLedger: Ledger, name: Name) {
    this.parentLedger = parentLedger;
    this.name = name;

    Ledger._getEntityController(parentLedger).registerCopyList(this, this.name);

    this.txInterface = {
      commit: () => this.commit(),
      rollback: () => this.rollback(),
    };
  }

  /**
   * If there are uncommitted changes on this entity, this value will be `true`.
   */
  get isInTransaction(): boolean {
    return !!this.staged;
  }

  private commit() {
    this.committed = this.staged ?? this.committed;
    this.staged = null;
  }

  private rollback() {
    this.staged = null;
  }

  private perform<R>(action: (copies: Map<string, C>) => R): R {
    const tx = Ledger._getTransaction(this.parentLedger);

    if (tx) {
      if (this.staged === null) {
        this.staged = new Map(this.committed);
      }

      tx.add(this.txInterface);
      return action(this.staged);
    } else {
      return action(this.committed);
    }
  }

  has(id: string): boolean {
    return this.perform((copies) => copies.has(id));
  }

  put(copy: C): void {
    this.perform((copies) => copies.set(copy.id, copy));
  }

  get(id: string): C | undefined {
    return this.perform((copies) => copies.get(id));
  }

  delete(id: string) {
    this.perform((copies) => copies.delete(id));
  }

  getAll(): C[] {
    return this.perform((copies) => [...copies.values()]);
  }
}
