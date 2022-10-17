import { cloneDeep, omit } from "lodash";
import type { Ledger } from "../ledger/ledger";
import type { DeepPartial } from "../type-utils";
import type {
  EntityChangeData,
  EntityData,
  EventData,
  PrivateEventMetadata,
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
  /** @internal */
  static _loadFrom<U extends object>(serialized: SerializedEvent): Event<U> {
    const event = new Event<U>(
      {
        id: serialized.id,
        timestamp: serialized.timestamp,
        type: serialized.type,
        breakpoint: serialized.breakpoint,
      },
      serialized.metadata
    );

    event.instructions = serialized.instructions.map((i) =>
      PropertyChangeInstruction._loadFrom(i)
    );

    return event;
  }

  /** @internal */
  static _generateCreateEvent<U extends object>(
    ledger: Ledger,
    initData: EntityData<U>,
    eventMetadata: PrivateEventMetadata
  ): Event<U> {
    return new Event<U>(
      {
        id: ledger.generateNextID(),
        timestamp: ledger.generateTimestamp(),
        type: EventType.CREATE,
        data: omit(initData, "name", "createdAt", "updatedAt") as DeepPartial<
          EntityData<U>
        >,
      },
      eventMetadata
    );
  }

  /** @internal */
  static _generateChangeEvent<U extends object>(
    ledger: Ledger,
    changes: EntityChangeData<U>,
    eventMetadata: PrivateEventMetadata
  ): Event<U> {
    return new Event<U>(
      {
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
      },
      eventMetadata
    );
  }

  /** @internal */
  static _generateBreakpointEvent<U extends object>(
    ledger: Ledger,
    breakpoint: string | number,
    eventMetadata: PrivateEventMetadata
  ): Event<U> {
    return new Event<U>(
      {
        id: ledger.generateNextID(),
        timestamp: ledger.generateTimestamp(),
        type: EventType.BREAKPOINT,
        data: {} as any,
        breakpoint,
      },
      eventMetadata
    );
  }

  /** @internal */
  static _generateChangeInstructions<T extends object>(
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

  id!: string;
  timestamp!: number;
  type!: EventType;
  breakpoint?: string | number;
  instructions: PropertyChangeInstruction[] = [];
  eventMetadata: PrivateEventMetadata;

  constructor(e: EventData<T>, eventMetadata: PrivateEventMetadata) {
    this.id = e.id;
    this.timestamp = e.timestamp;
    this.type = e.type;
    this.breakpoint = e.breakpoint;
    this.eventMetadata = eventMetadata;

    if (e.data)
      this.instructions = Event._generateChangeInstructions<T>(e.data);
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
      metadata: cloneDeep(this.eventMetadata),
    };
  }
}
