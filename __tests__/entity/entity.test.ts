import { BaseEntity } from "../../src";
import { ErrorCode } from "../../src/errors/error-codes";
import { LedgerError } from "../../src/errors/ledger-error";
import { eventMock } from "../helpers";

class TestEntity extends BaseEntity {
  name = "TestEntity";
}

describe("Entity", () => {
  describe(".applyEvents()", () => {
    let entity: TestEntity;

    beforeEach(() => {
      entity = new TestEntity();
    });

    it("should throw an error if the event list is empty", () => {
      expect(() => BaseEntity._applyEvents(entity, [])).toThrowError(
        new LedgerError(ErrorCode.EMPTY_EVENTS_LIST),
      );
    });

    it("should apply every event to the entity", () => {
      const evMocks = [
        eventMock({ apply: jest.fn() }),
        eventMock({ apply: jest.fn() }),
        eventMock({ apply: jest.fn() }),
      ];

      BaseEntity._applyEvents(entity, evMocks);

      expect(evMocks[0]?.apply).toHaveBeenCalledTimes(1);
      expect(evMocks[0]?.apply).toHaveBeenLastCalledWith(entity);

      expect(evMocks[1]?.apply).toHaveBeenCalledTimes(1);
      expect(evMocks[1]?.apply).toHaveBeenLastCalledWith(entity);

      expect(evMocks[2]?.apply).toHaveBeenCalledTimes(1);
      expect(evMocks[2]?.apply).toHaveBeenLastCalledWith(entity);
    });

    it("should correctly assign the timestamps if there is exactly one event", () => {
      const evMocks = [eventMock({ timestamp: 1234 })];

      BaseEntity._applyEvents(entity, evMocks);

      expect(entity.createdAt).toEqual(1234);
      expect(entity.updatedAt).toEqual(1234);
    });

    it("should correctly assign the timestamps if there is exactly two events", () => {
      const evMocks = [
        eventMock({ timestamp: 1234 }),
        eventMock({ timestamp: 5678 }),
      ];

      BaseEntity._applyEvents(entity, evMocks);

      expect(entity.createdAt).toEqual(1234);
      expect(entity.updatedAt).toEqual(5678);
    });

    it("should correctly assign the timestamps if there is exactly three events", () => {
      const evMocks = [
        eventMock({ timestamp: 1234 }),
        eventMock({ timestamp: 5678 }),
        eventMock({ timestamp: 9102 }),
      ];

      BaseEntity._applyEvents(entity, evMocks);

      expect(entity.createdAt).toEqual(1234);
      expect(entity.updatedAt).toEqual(9102);
    });

    it("should correctly assign the timestamps if there is exactly four events", () => {
      const evMocks = [
        eventMock({ timestamp: 1234 }),
        eventMock({ timestamp: 5678 }),
        eventMock({ timestamp: 9102 }),
        eventMock({ timestamp: 5555 }),
      ];

      BaseEntity._applyEvents(entity, evMocks);

      expect(entity.createdAt).toEqual(1234);
      expect(entity.updatedAt).toEqual(5555);
    });
  });
});
