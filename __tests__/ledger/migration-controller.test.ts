import { Entity } from "../../src/entity-containers/entity";
import { BaseEntity } from "../../src/entity/base-entity";
import { Ledger } from "../../src/ledger/ledger";
import { NameOf } from "../../src/type-utils";
import { EventType, MigrationInterface } from "../../src/types";

describe("migrations", () => {
  it("should apply migrations", () => {
    class FooEntityV1 extends BaseEntity {
      readonly name = "FooEntity";

      a: number;

      constructor() {
        super();
      }
    }

    class LedgerV1 extends Ledger {
      static version = 1;
      readonly name = "Ledger";

      foo = new Entity(this, FooEntityV1);

      constructor() {
        super();
        this.foo.create({ a: 12 });
      }
    }

    class FooEntityV2 extends BaseEntity {
      readonly name = "FooEntity";

      a: number;
      b: string;
    }

    class LedgerV2 extends Ledger {
      static version = 2;
      readonly name = "Ledger";

      foo = new Entity(this, FooEntityV2);
    }

    class FooEntityV3 extends BaseEntity {
      readonly name = "FooEntity";

      a: string;
      b: string;
    }

    class NewEntity extends BaseEntity {
      readonly name = "NewEntity";

      allfoos: string[] = [];
    }

    class LedgerV3 extends Ledger {
      static version = 3;
      readonly name = "Ledger";

      foo = new Entity(this, FooEntityV3);
      newEntity = new Entity(this, NewEntity);
    }

    const migration1to2: MigrationInterface<LedgerV2> = {
      version: 2,
      migrateEvent: {
        FooEntity: {
          create(data, meta) {
            return {
              ...data,
              a: data.a!,
              b: data.a!.toString(),
            };
          },
        },
      },
    };

    const migration2to3: MigrationInterface<LedgerV3> = {
      version: 3,
      migrateEvent: {
        FooEntity: {
          create(data, meta) {
            return {
              ...data,
              a: `Num(${data.b})`,
              b: data.b!,
            };
          },
        },
      },
      migrate(ledger, data) {
        const foo = ledger.foo.get();
        ledger.newEntity.create({
          allfoos: [foo.a, foo.b],
        });
      },
    };

    LedgerV2.registerMigrations(migration1to2);
    LedgerV3.registerMigrations(migration1to2, migration2to3);

    const ledger1 = new LedgerV1();
    const ledger1Serialized = ledger1.serialize();

    expect(ledger1Serialized).toMatchObject({
      entities: expect.objectContaining({
        FooEntity: [
          expect.objectContaining({
            metadata: expect.objectContaining({
              ledgerVersion: 1,
              type: EventType.CREATE,
              entity: "FooEntity",
            }),
            instructions: expect.arrayContaining([
              expect.objectContaining({
                propertyPath: ["id"],
              }),
              expect.objectContaining({
                propertyPath: ["a"],
                value: 12,
              }),
            ]),
          }),
        ],
      }),
    });

    const ledger2 = LedgerV2.loadFrom(ledger1Serialized);
    const ledger2Serialized = ledger2.serialize();

    expect(ledger2Serialized).toMatchObject({
      entities: expect.objectContaining({
        FooEntity: [
          expect.objectContaining({
            metadata: expect.objectContaining({
              ledgerVersion: 2,
              type: EventType.CREATE,
              entity: "FooEntity",
              appliedMigrations: ["1:2"],
            }),
            instructions: expect.arrayContaining([
              expect.objectContaining({
                propertyPath: ["id"],
              }),
              expect.objectContaining({
                propertyPath: ["a"],
                value: 12,
              }),
              expect.objectContaining({
                propertyPath: ["b"],
                value: "12",
              }),
            ]),
          }),
        ],
      }),
    });

    const ledger3from1 = LedgerV3.loadFrom(ledger1Serialized);
    const ledger3from1Serialized = ledger3from1.serialize();

    const ledger3from2 = LedgerV3.loadFrom(ledger2Serialized);
    const ledger3from2Serialized = ledger3from2.serialize();

    const expected = {
      entities: expect.objectContaining({
        FooEntity: [
          expect.objectContaining({
            metadata: expect.objectContaining({
              ledgerVersion: 3,
              type: EventType.CREATE,
              entity: "FooEntity",
              appliedMigrations: ["1:2", "2:3"],
            }),
            instructions: expect.arrayContaining([
              expect.objectContaining({
                propertyPath: ["id"],
              }),
              expect.objectContaining({
                propertyPath: ["a"],
                value: "Num(12)",
              }),
              expect.objectContaining({
                propertyPath: ["b"],
                value: "12",
              }),
            ]),
          }),
        ],
        NewEntity: [
          expect.objectContaining({
            metadata: expect.objectContaining({
              ledgerVersion: 3,
              type: EventType.CREATE,
              entity: "NewEntity",
            }),
            instructions: expect.arrayContaining([
              expect.objectContaining({
                propertyPath: ["id"],
              }),
              expect.objectContaining({
                propertyPath: ["allfoos", "0"],
                value: "Num(12)",
              }),
              expect.objectContaining({
                propertyPath: ["allfoos", "1"],
                value: "12",
              }),
            ]),
          }),
        ],
      }),
    };

    expect(ledger3from1Serialized).toMatchObject(expected);
    expect(ledger3from2Serialized).toMatchObject(expected);

    expect(ledger3from1.getSnapshot()).toMatchObject({
      copies: {},
      listEntities: {},
      entities: {
        FooEntity: {
          a: "Num(12)",
          b: "12",
          name: "FooEntity",
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
          id: expect.any(String),
        },
        NewEntity: {
          allfoos: ["Num(12)", "12"],
          name: "NewEntity",
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
          id: expect.any(String),
        },
      },
    });
  });
});
