import { omit } from "lodash";
import type { Ledger } from "../ledger/ledger";
import type { DeepPartial } from "../type-utils";
import type {
  EntityChangeData,
  EntityData,
  EventData,
  SerializedEvent,
} from "../types";
import { EventType } from "../types";
import { PropertyChangeInstruction } from "./property-change-instruction";

export function getObjectPaths(obj: object) {
  const paths = new Set<string[]>();

  const traverse = (o: object, parentPath: string[]) => {
    for (const [key, value] of Object.entries(o)) {
      const vPath = [...parentPath, key];

      if (["string", "number", "bigint", "boolean"].includes(typeof value)) {
        paths.add(vPath);
      } else if (typeof value === "object" && value !== null) {
        traverse(value, vPath);
      }
    }
  };

  traverse(obj, []);

  return paths;
}

export class Event<T extends object> {
  static _loadFrom<U extends object>(serialized: SerializedEvent): Event<U> {
    const event = new Event<U>({
      id: serialized.id,
      timestamp: serialized.timestamp,
      type: serialized.type,
      breakpoint: serialized.breakpoint,
    });

    event.instructions = serialized.instructions.map((i) =>
      PropertyChangeInstruction._loadFrom(i)
    );

    return event;
  }

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

  static generateBreakpointEvent<U extends object>(
    ledger: Ledger,
    breakpoint: string | number
  ): Event<U> {
    return new Event<U>({
      id: ledger.generateNextID(),
      timestamp: ledger.generateTimestamp(),
      type: EventType.BREAKPOINT,
      data: {} as any,
      breakpoint,
    });
  }

  id!: string;
  timestamp!: number;
  type!: EventType;
  breakpoint?: string | number;
  instructions: PropertyChangeInstruction[] = [];

  constructor(e: EventData<T>) {
    this.id = e.id;
    this.timestamp = e.timestamp;
    this.type = e.type;
    this.breakpoint = e.breakpoint;

    if (e.data) this.instructions = this.generateChangeInstructions(e.data);
  }

  private generateChangeInstructions(
    data: EntityChangeData<T> | EntityData<T>
  ) {
    const bodyPaths = getObjectPaths(data);
    const result: PropertyChangeInstruction[] = [];

    for (const path of bodyPaths) {
      const changeInstruction = new PropertyChangeInstruction(path, data);
      result.push(changeInstruction);
    }

    return result;
  }

  apply(to: object): void {
    if (this.type === EventType.BREAKPOINT) return;

    for (const instruction of this.instructions) {
      instruction.apply(to);
    }
  }

  serialize(): SerializedEvent {
    return {
      id: this.id,
      timestamp: this.timestamp,
      type: this.type,
      breakpoint: this.breakpoint,
      instructions: this.instructions.map((i) => i.serialize()),
    };
  }
}
