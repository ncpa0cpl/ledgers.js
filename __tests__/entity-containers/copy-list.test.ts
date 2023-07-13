import { CopiesList, Ledger } from "../../src";

type TestCopy = {
  id: string;
  label: string;
};

class TestLedger extends Ledger {
  name = "TestLedger";
}

describe("CopyList", () => {
  let ledger: TestLedger;

  beforeEach(() => {
    ledger = new TestLedger();
  });

  describe(".has()", () => {
    it("should return false if the copy has never been saved to the list", () => {
      const copyList = new CopiesList<TestCopy>(ledger, "TestCopy");
      expect(copyList.has("1")).toEqual(false);
    });

    it("should return true if the copy has been saved to the list", () => {
      const copyList = new CopiesList<TestCopy>(ledger, "TestCopy");
      copyList.put({ id: "1", label: "foo" });
      expect(copyList.has("1")).toEqual(true);
    });

    it("should return true if the copy has been saved to the list during transaction, before commit", () => {
      const copyList = new CopiesList<TestCopy>(ledger, "TestCopy");
      ledger.startTransaction();
      copyList.put({ id: "1", label: "foo" });
      expect(copyList.has("1")).toEqual(true);
      ledger.commitTransaction();
    });

    it("should return true if the copy has been saved to the list during transaction, before commit", () => {
      const copyList = new CopiesList<TestCopy>(ledger, "TestCopy");
      ledger.startTransaction();
      copyList.put({ id: "1", label: "foo" });
      ledger.commitTransaction();
      expect(copyList.has("1")).toEqual(true);
    });

    it("should return false if the copy has been saved to the list during transaction, after rollback", () => {
      const copyList = new CopiesList<TestCopy>(ledger, "TestCopy");
      ledger.startTransaction();
      copyList.put({ id: "1", label: "foo" });
      ledger.rollbackTransaction();
      expect(copyList.has("1")).toEqual(false);
    });
  });

  describe(".put()", () => {
    it("should insert the copy into the list", () => {
      const copyList = new CopiesList<TestCopy>(ledger, "TestCopy");
      copyList.put({ id: "1", label: "foo" });
      expect(copyList.get("1")).toEqual({ id: "1", label: "foo" });
    });

    it("should update the copy in the list", () => {
      const copyList = new CopiesList<TestCopy>(ledger, "TestCopy");
      copyList.put({ id: "1", label: "foo" });
      expect(copyList.get("1")).toEqual({ id: "1", label: "foo" });
      copyList.put({ id: "1", label: "bar" });
      expect(copyList.get("1")).toEqual({ id: "1", label: "bar" });
    });

    it("should immediately commit the change when there is no transaction started", () => {
      const copyList = new CopiesList<TestCopy>(ledger, "TestCopy");
      copyList.put({ id: "1", label: "foo" });
      expect(copyList["isTransactionPending"]).toEqual(false);
    });

    it("should not commit the changes during transaction until the commit", () => {
      const copyList = new CopiesList<TestCopy>(ledger, "TestCopy");
      ledger.startTransaction();
      copyList.put({ id: "1", label: "foo" });
      expect(copyList["isTransactionPending"]).toEqual(true);
      ledger.commitTransaction();
      expect(copyList["isTransactionPending"]).toEqual(false);
    });

    it("should not commit the changes during transaction until the rollback", () => {
      const copyList = new CopiesList<TestCopy>(ledger, "TestCopy");
      ledger.startTransaction();
      copyList.put({ id: "1", label: "foo" });
      expect(copyList["isTransactionPending"]).toEqual(true);
      ledger.rollbackTransaction();
      expect(copyList["isTransactionPending"]).toEqual(false);
    });
  });

  describe(".getAll()", () => {
    it("should always retrieve all the saved copies", () => {
      const copyList = new CopiesList<TestCopy>(ledger, "TestCopy");
      copyList.put({ id: "1", label: "foo" });
      expect(copyList.getAll()).toEqual([{ id: "1", label: "foo" }]);
      copyList.put({ id: "2", label: "bar" });
      expect(copyList.getAll()).toEqual([
        { id: "1", label: "foo" },
        { id: "2", label: "bar" },
      ]);
      ledger.startTransaction();
      copyList.put({ id: "3", label: "baz" });
      expect(copyList.getAll()).toEqual([
        { id: "1", label: "foo" },
        { id: "2", label: "bar" },
        { id: "3", label: "baz" },
      ]);
      copyList.put({ id: "4", label: "coorg" });
      expect(copyList.getAll()).toEqual([
        { id: "1", label: "foo" },
        { id: "2", label: "bar" },
        { id: "3", label: "baz" },
        { id: "4", label: "coorg" },
      ]);
      ledger.rollbackTransaction();
      expect(copyList.getAll()).toEqual([
        { id: "1", label: "foo" },
        { id: "2", label: "bar" },
      ]);
      ledger.startTransaction();
      copyList.put({ id: "3", label: "baz" });
      copyList.put({ id: "2", label: "qux" });
      expect(copyList.getAll()).toEqual([
        { id: "1", label: "foo" },
        { id: "2", label: "qux" },
        { id: "3", label: "baz" },
      ]);
      ledger.rollbackTransaction();
      expect(copyList.getAll()).toEqual([
        { id: "1", label: "foo" },
        { id: "2", label: "bar" },
      ]);
      ledger.startTransaction();
      copyList.put({ id: "3", label: "baz" });
      copyList.put({ id: "2", label: "qux" });
      expect(copyList.getAll()).toEqual([
        { id: "1", label: "foo" },
        { id: "2", label: "qux" },
        { id: "3", label: "baz" },
      ]);
      ledger.commitTransaction();
      expect(copyList.getAll()).toEqual([
        { id: "1", label: "foo" },
        { id: "2", label: "qux" },
        { id: "3", label: "baz" },
      ]);
    });
  });
});
