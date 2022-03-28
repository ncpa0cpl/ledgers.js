export type TransactionInterface = {
  commit(): void;
  rollback(): void;
};

export class Transaction {
  private transactionInterfaces = new Set<TransactionInterface>();
  private postTransactionHooks = new Set<Function>();

  commit(): void {
    this.transactionInterfaces.forEach((t) => t.commit());
    this.postTransactionHooks.forEach((fn) => fn());
  }

  rollback(): void {
    this.transactionInterfaces.forEach((t) => t.rollback());
    this.postTransactionHooks.forEach((fn) => fn());
  }

  add(txInterface: TransactionInterface): void {
    this.transactionInterfaces.add(txInterface);
  }

  addPostTxHook(fn: Function): void {
    this.postTransactionHooks.add(fn);
  }
}
