Ledgers are serializable and deserializable class structures build of entities. Entities are a sum of immutable events that contain arbitrary data. Thanks to this mechanism it's possible to inspect the Ledger history and see each action that was taken to create it.

## Basic Usage

### Define A Ledger

```tsx
class LedgerBody extends BaseEntity {
  readonly name = "LedgerBody";

  foo!: string;
  bar!: number;
}

class Item extends BaseEntity {
  readonly name = "Item";

  itemLabel!: string;
}

class ExternalEntity {
  id: string;
  baz: string;
}

class MyLedger extends Ledger {
  readonly name = "MyLedger";

  body = new Entity(this, LedgerBody);
  items = new EntityList(this, Item);
  someExternals = new CopiesList<ExternalEntity, "external">(this, "external");
}
```

### Initate, Change and access Entity values

```tsx
class MyLedger extends Ledger {
  readonly name = "MyLedger";

  body = new Entity(this, LedgerBody);
  items = new EntityList(this, Item);
  someExternals = new CopiesList<ExternalEntity, "external">(this, "external");

  initiateBody() {
    this.body.create({
      foo: "abc",
      bar: 1,
    });
  }

  updateBody() {
    this.body.change({
      bar: 2
    });
  }

  getFoo() {
    return this.body.get().foo;
  }
}
```

### Initate, Change and access Entity List values

```tsx
class MyLedger extends Ledger {
  readonly name = "MyLedger";

  body = new Entity(this, LedgerBody);
  items = new EntityList(this, Item);
  someExternals = new CopiesList<ExternalEntity, "external">(this, "external");

  addItem(itemLabel: string) {
    this.items.create({
      itemLabel: itemLabel,
    });
  }

  removeItem(itemID: string) {
    this.items.delete(itemID);
  }

  updateItem(itemID: string, newLabel: string) {
    this.items.change(itemID, {
      itemLabel: newLabel
    });
  }

  getItems() {
    return this.items.getAll();
  }
}
```

### Transactions

```tsx
class MyLedger extends Ledger {
  readonly name = "MyLedger";

  body = new Entity(this, LedgerBody);
  items = new EntityList(this, Item);
  someExternals = new CopiesList<ExternalEntity, "external">(this, "external");

  updateLedgerWithTransaction() {
    this.tx(() => {
      this.body.change({
        bar: 2,
      });
      this.items.create({
        itemLabel: "item 1",
      });
      throw new Error("undo any changes made wthin this transaction");
    });
  }
}
```

### Serializing and Deserializing

```tsx
// create a new ledger and populate it with data
const ledger = new MyLedger();
ledger.initiateBody();
ledger.addItem("my item");

// serialize the ledger`
const serial = ledger.serialize();
const serialJson = JSON.stringify(serial);

// deserialize it back into the ledger class
const ledger2 = MyLedger.loadFrom(JSON.parse(serialJson));

ledger2.getItems() // [{ id: "uuid", name: "Items", createdAt: <unix timestamp>, updatedAt: <unix timestamp>, itemLabel: "my item" }]
```

## Limitations

1. Each entity class must have a unique name
2. For typescript to properly work all entities must have a readonly name
3. Entities can only contain primitive values, arrays and simple objects. Maps, Sets, functions or classes are not allowed.
