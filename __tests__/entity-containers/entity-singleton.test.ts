import { BaseEntity, Entity, Ledger } from "../../src";
import { ErrorCode } from "../../src/errors/error-codes";
import { LedgerError } from "../../src/errors/ledger-error";
import { generateNextTestTimestamp } from "../helpers";

let setNextTimestampTo: number | undefined;

class TestLedger extends Ledger {
  name = "TestLedger";

  generateTimestamp(): number {
    if (setNextTimestampTo) {
      const tmp = setNextTimestampTo;
      setNextTimestampTo = undefined;
      return tmp;
    }
    return generateNextTestTimestamp();
  }
}
class TestSingleton extends BaseEntity {
  name = "TestSingleton";
  prop!: string;
}

describe("EntitySingleton", () => {
  let ledger: TestLedger;

  beforeEach(() => {
    ledger = new TestLedger();
  });

  describe(".eventCreate()", () => {
    it("should add the first create event", () => {
      const singleton = new Entity(ledger, TestSingleton);

      setNextTimestampTo = 1234567;
      singleton.create({ prop: "foo" });

      expect(singleton.isInitiated()).toEqual(true);
      expect(singleton.get()).toMatchObject({
        id: expect.any(String),
        prop: "foo",
        createdAt: 1234567,
        updatedAt: 1234567,
      });
    });

    it("should throw an error when dispatching a create event to already initialized singleton", () => {
      const singleton = new Entity(ledger, TestSingleton);
      singleton.create({ prop: "foo" });

      expect(() => singleton.create({ prop: "foo" })).toThrowError(
        new LedgerError(ErrorCode.ENTITY_ALREADY_CREATED),
      );
    });

    it("should immediately commit the event if no transaction is started", () => {
      const singleton = new Entity(ledger, TestSingleton);

      singleton.create({ prop: "foo" });

      expect(singleton["events"].isTransactionPending).toEqual(false);
      expect(singleton.isInitiated()).toEqual(true);
    });

    it("should not commit the event if a transaction is started", () => {
      const singleton = new Entity(ledger, TestSingleton);

      ledger.startTransaction();
      singleton.create({ prop: "foo" });
      expect(singleton["events"].isTransactionPending).toEqual(true);
      expect(singleton.isInitiated()).toEqual(true);
      ledger.rollbackTransaction();
      expect(singleton["events"].isTransactionPending).toEqual(false);
      expect(singleton.isInitiated()).toEqual(false);

      expect(() => singleton.get()).toThrowError(
        new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED),
      );
    });

    it("should use the provided ID if specified", () => {
      const singleton = new Entity(ledger, TestSingleton);

      singleton.create({ id: "123", prop: "foo" });

      expect(singleton.get()).toMatchObject({ id: "123", prop: "foo" });
    });
  });

  describe(".eventChange()", () => {
    it("should add the change event", () => {
      const singleton = new Entity(ledger, TestSingleton);

      setNextTimestampTo = 5555555;
      singleton.create({ prop: "foo" });

      expect(singleton.get()).toMatchObject({
        id: expect.any(String),
        prop: "foo",
        createdAt: 5555555,
        updatedAt: 5555555,
      });

      setNextTimestampTo = 5555560;
      singleton.change({
        prop: "bar",
      });

      expect(singleton.get()).toMatchObject({
        id: expect.any(String),
        prop: "bar",
        createdAt: 5555555,
        updatedAt: 5555560,
      });
    });

    it("should throw an error when dispatching a change event to a non-initialized singleton", () => {
      const singleton = new Entity(ledger, TestSingleton);

      expect(() => singleton.change({ prop: "bar" })).toThrowError(
        new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED),
      );
    });

    it("should immediately commit the event if no transaction is started", () => {
      const singleton = new Entity(ledger, TestSingleton);

      singleton.create({ prop: "foo" });
      singleton.change({ prop: "bar" });

      expect(singleton["events"].isTransactionPending).toEqual(false);
    });

    it("should not commit the event if a transaction is started", () => {
      const singleton = new Entity(ledger, TestSingleton);
      singleton.create({ prop: "foo" });

      ledger.startTransaction();
      singleton.change({ prop: "bar" });
      expect(singleton["events"].isTransactionPending).toEqual(true);
      expect(singleton.get()).toMatchObject({ prop: "bar" });
      ledger.rollbackTransaction();
      expect(singleton["events"].isTransactionPending).toEqual(false);
      expect(singleton.get()).toMatchObject({ prop: "foo" });
    });
  });

  describe(".getName()", () => {
    it("should return the name specified in the entity class", () => {
      const singleton = new Entity(ledger, TestSingleton);

      expect(singleton.getName()).toEqual("TestSingleton");
    });
  });

  describe(".getID()", () => {
    it("should throw an error if not initiated", () => {
      const singleton = new Entity(ledger, TestSingleton);

      expect(() => singleton.getID()).toThrowError(
        new LedgerError(ErrorCode.ENTITY_NOT_YET_CREATED),
      );
    });

    it("should correctly return the entity id", () => {
      const singleton = new Entity(ledger, TestSingleton);

      singleton.create({ id: "123", prop: "foo" });

      expect(singleton.getID()).toEqual("123");
    });
  });
});
