import { cloneDeep, omit } from "lodash";
import type { Ledger } from "../ledger/ledger";
import type { DeepPartial } from "../type-utils";
import type { EntityChangeData, EntityData, EventData } from "../types";
import { EventType } from "../types";
import { PropertyChangeInstruction } from "./property-change-instruction";

export function getObjectPaths(obj: object) {
  const paths = new Set<string>();

  const traverse = (o: object, parentPath: string[]) => {
    for (const [key, value] of Object.entries(o)) {
      const vPath = [...parentPath, key];

      if (["string", "number", "bigint", "boolean"].includes(typeof value)) {
        paths.add(vPath.join("."));
      } else if (typeof value === "object" && value !== null) {
        traverse(value, vPath);
      }
    }
  };

  traverse(obj, []);

  return paths;
}

export class Event<T extends object> {
  static generateCreateEvent<U extends object>(
    ledger: Ledger,
    initData: EntityData<U>
  ): Event<U> {
    return new Event<U>({
      id: ledger.generateNextID(),
      timestamp: ledger.generateTimestamp(),
      type: EventType.CREATE,
      data: omit(initData, "name", "createdAt", "updatedAt") as DeepPartial<
        EntityData<U>
      >,
    });
  }

  static generateChangeEvent<U extends object>(
    ledger: Ledger,
    changes: EntityChangeData<U>
  ): Event<U> {
    return new Event<U>({
      id: ledger.generateNextID(),
      timestamp: ledger.generateTimestamp(),
      type: EventType.CHANGE,
      data: omit(
        changes,
        "id",
        "name",
        "createdAt",
        "updatedAt"
      ) as DeepPartial<EntityData<U>>,
    });
  }

  id!: string;
  timestamp!: number;
  type!: EventType;
  data!: Partial<EntityData<T>> | EntityData<T>;

  constructor(e: EventData<T>) {
    this.id = e.id;
    this.timestamp = e.timestamp;
    this.type = e.type;
    this.data = omit(e.data, "name") as Partial<EntityData<T>>;
  }

  apply(to: object): void {
    const bodyPaths = getObjectPaths(this.data);

    for (const path of bodyPaths) {
      const changeInstruction = new PropertyChangeInstruction(path, this.data);

      changeInstruction.apply(to);
    }
  }

  serialize(): EventData<T> {
    return {
      id: this.id,
      timestamp: this.timestamp,
      type: this.type,
      data: cloneDeep(this.data) as DeepPartial<EntityData<T>>,
    };
  }
}
