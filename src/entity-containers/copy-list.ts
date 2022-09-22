import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import { Ledger } from "../ledger/ledger";
import type { TransactionInterface } from "../ledger/transaction";
import type { Copy } from "../types";

export class CopyList<C extends Copy> {
  /** @internal */
  static _loadFrom<D extends Copy>(copyList: CopyList<any>, copies: D[]) {
    if (copyList.committed.size > 0) {
      throw new LedgerError(ErrorCode.DESERIALIZING_ON_NON_EMPTY_LEDGER);
    }

    for (const c of copies) {
      copyList.put(c);
    }
  }

  /** @internal */
  static _serialize<C extends Copy>(list: CopyList<C>): C[] {
    if (list.isTransactionPending) {
      throw new LedgerError(ErrorCode.SERIALIZING_DURING_TRANSACTION);
    }

    return list.getAll();
  }

  private parentLedger: Ledger;
  private name: string;
  private committed = new Map<string, C>();
  private staged = new Map<string, C>();
  private txInterface: TransactionInterface;

  constructor(parentLedger: Ledger, name: string) {
    this.parentLedger = parentLedger;
    this.name = name;

    Ledger._getEntityController(parentLedger).registerCopyList(this, this.name);

    this.txInterface = {
      commit: () => this.commit(),
      rollback: () => this.rollback(),
    };
  }

  private mergeMaps() {
    const tmpCopies = new Map(this.committed);

    for (const [name, copy] of this.staged) {
      tmpCopies.set(name, copy);
    }

    return tmpCopies;
  }

  private get isTransactionPending(): boolean {
    return this.staged.size > 0;
  }

  private commit() {
    this.committed = this.mergeMaps();
    this.staged = new Map();
  }

  private rollback() {
    this.staged.clear();
  }

  private addToTransaction(): void {
    const tx = Ledger._getTransaction(this.parentLedger);

    if (tx) {
      tx.add(this.txInterface);
    } else {
      this.commit();
    }
  }

  has(id: string): boolean {
    return this.committed.has(id) || this.staged.has(id);
  }

  put(copy: C): void {
    this.staged.set(copy.id, copy);
    this.addToTransaction();
  }

  get(id: string): C | undefined {
    return this.staged.get(id) ?? this.committed.get(id);
  }

  getAll(): C[] {
    return [...this.mergeMaps().values()];
  }
}
