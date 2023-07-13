import {
  BaseEntity,
  CopiesList,
  Entity,
  EntityList,
  Ledger,
} from "../../src/index";

class MainEntity extends BaseEntity {
  readonly name = "MainEntity";

  foo!: string;
}

class Item extends BaseEntity {
  readonly name = "Item";

  bar!: string;
}

class ExternalEntity {
  id: string;
  baz: string;
}

class TestLedger extends Ledger {
  name = "TestLedger";

  main = new Entity(this, MainEntity);
  items = new EntityList(this, Item);
  someExternals = new CopiesList<ExternalEntity, "external">(this, "external");
}

describe("Ledger", () => {
  describe("getSnapshot", () => {
    it("should return a snapshot of the ledger with empty arrays", () => {
      const ledger = new TestLedger();
      ledger.main.create({
        foo: "foo",
      });

      const snapshot = ledger.getSnapshot();

      expect(snapshot).toEqual({
        copies: {
          external: [],
        },
        listEntities: {
          Item: [],
        },
        entities: {
          MainEntity: expect.objectContaining({
            id: expect.any(String),
            foo: "foo",
            name: "MainEntity",
            updatedAt: expect.any(Number),
            createdAt: expect.any(Number),
          }),
        },
      });
    });
  });
});
