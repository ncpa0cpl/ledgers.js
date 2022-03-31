import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import { Ledger } from "../ledger/ledger";
import type { TransactionInterface } from "../ledger/transaction";
import type { Copy } from "../types";

export class CopyList<C extends Copy> {
  static _loadFrom<D extends Copy>(copyList: CopyList<any>, copies: D[]) {
    if (copyList.committed.size > 0) {
      throw new LedgerError(ErrorCode.DESERIALIZING_ON_NON_EMPTY_LEDGER);
    }

    for (const c of copies) {
      copyList.put(c);
    }
  }

  static _serialize<C extends Copy>(list: CopyList<C>): C[] {
    if (list.isTransactionPending) {
      throw new LedgerError(ErrorCode.SERIALIZING_DURING_TRANSACTION);
    }

    return list.getAll();
  }

  private parentLedger: Ledger;
  private name: string;
  private committed = new Map<string, C>();
  private stagged = new Map<string, C>();
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

    for (const [name, copy] of this.stagged) {
      tmpCopies.set(name, copy);
    }

    return tmpCopies;
  }

  private get isTransactionPending(): boolean {
    return this.stagged.size > 0;
  }

  private commit() {
    this.committed = this.mergeMaps();
    this.stagged = new Map();
  }

  private rollback() {
    this.stagged.clear();
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
    return this.committed.has(id) || this.stagged.has(id);
  }

  put(copy: C): void {
    this.stagged.set(copy.id, copy);
    this.addToTransaction();
  }

  get(id: string): C | undefined {
    return this.stagged.get(id) ?? this.committed.get(id);
  }

  getAll(): C[] {
    return [...this.mergeMaps().values()];
  }
}
