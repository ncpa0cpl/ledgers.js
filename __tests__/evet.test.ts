import { Event } from "../src/events/event";
import { EventType } from "../src/types";

describe("Event", () => {
  it("correctly serializes and deserializes empty arrays", () => {
    const data = {
      foo: 1,
      bar: [],
      baz: "2",
    };

    const event = new Event(
      { id: "123", data },
      {
        entity: "Entity",
        ledgerVersion: 1,
        timestamp: 1,
        type: EventType.CREATE,
      },
    );

    const serializedEvent = event.serialize();

    const out = {};
    Event._loadFrom(serializedEvent).apply(out);

    expect(out).toMatchObject({
      foo: 1,
      bar: [],
      baz: "2",
    });
  });

  it("correctly serializes and deserializes empty objects", () => {
    const data = {
      foo: 1,
      bar: {},
      baz: "2",
    };

    const event = new Event(
      { id: "123", data },
      {
        entity: "Entity",
        ledgerVersion: 1,
        timestamp: 1,
        type: EventType.CREATE,
      },
    );

    const serializedEvent = event.serialize();

    const out = {};
    Event._loadFrom(serializedEvent).apply(out);

    expect(out).toMatchObject({
      foo: 1,
      bar: {},
      baz: "2",
    });
  });

  it("correctly updates arrays - modify element", () => {
    const initData = {
      arr: [{ foo: 1 }, { bar: 2 }, { baz: 3 }],
    };

    const initEvent = new Event(
      { id: "123", data: initData },
      {
        entity: "Entity",
        ledgerVersion: 1,
        timestamp: 1,
        type: EventType.CREATE,
      },
    );

    const updateData1 = {
      arr: [{ foo: 1 }, { bar: 20 }, { baz: 3 }],
    };

    const updateEvent = new Event(
      { id: "123", data: updateData1 },
      {
        entity: "Entity",
        ledgerVersion: 1,
        timestamp: 2,
        type: EventType.CHANGE,
      },
    );

    const out = {};
    Event._loadFrom(initEvent.serialize()).apply(out);
    Event._loadFrom(updateEvent.serialize()).apply(out);

    expect(out).toMatchObject({
      arr: [{ foo: 1 }, { bar: 20 }, { baz: 3 }],
    });
  });

  it("correctly updates arrays - modify key of element", () => {
    const initData = {
      arr: [{ foo: 1 }, { bar: 2 }, { baz: 3 }],
    };

    const initEvent = new Event(
      { id: "123", data: initData },
      {
        entity: "Entity",
        ledgerVersion: 1,
        timestamp: 1,
        type: EventType.CREATE,
      },
    );

    const updateData1 = {
      arr: [{ foo: 1 }, { qux: "w" }, { baz: 3 }],
    };

    const updateEvent = new Event(
      { id: "123", data: updateData1 },
      {
        entity: "Entity",
        ledgerVersion: 1,
        timestamp: 2,
        type: EventType.CHANGE,
      },
    );

    const out = {};
    Event._loadFrom(initEvent.serialize()).apply(out);
    Event._loadFrom(updateEvent.serialize()).apply(out);

    expect(out).toMatchObject({
      arr: [{ foo: 1 }, { qux: "w" }, { baz: 3 }],
    });
  });

  it("correctly updates arrays - remove element", () => {
    const initData = {
      arr: [{ foo: 1 }, { bar: 2 }, { baz: 3 }],
    };

    const initEvent = new Event(
      { id: "123", data: initData },
      {
        entity: "Entity",
        ledgerVersion: 1,
        timestamp: 1,
        type: EventType.CREATE,
      },
    );

    const updateData1 = {
      arr: [{ foo: 1 }, { baz: 3 }],
    };

    const updateEvent = new Event(
      { id: "123", data: updateData1 },
      {
        entity: "Entity",
        ledgerVersion: 1,
        timestamp: 2,
        type: EventType.CHANGE,
      },
    );

    const out = {};
    Event._loadFrom(initEvent.serialize()).apply(out);
    Event._loadFrom(updateEvent.serialize()).apply(out);

    expect(out).toMatchObject({
      arr: [{ foo: 1 }, { baz: 3 }],
    });
  });
});
