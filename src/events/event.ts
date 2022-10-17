import { cloneDeep, omit } from "lodash";
import { Ledger } from "../ledger/ledger";
import type { DeepPartial } from "../type-utils";
import type {
  AdditionalEventData,
  EntityChangeData,
  EntityData,
  EventData,
  PrivateEventMetadata,
  SerializedEvent,
} from "../types";
import { EventType } from "../types";
import { PropertyChangeInstruction } from "./property-change-instruction";

export type GenerateEventData = AdditionalEventData & { entity: string };

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
    const event = new Event<U>({ id: serialized.id }, serialized.metadata);

    event.instructions = serialized.instructions.map((i) =>
      PropertyChangeInstruction._loadFrom(i)
    );

    return event;
  }

  /** @internal */
  static _generateCreateEvent<U extends object>(
    ledger: Ledger,
    initData: EntityData<U>,
    eventMetadata: GenerateEventData
  ): Event<U> {
    return new Event<U>(
      {
        id: ledger.generateNextID(),
        data: omit(initData, "name", "createdAt", "updatedAt") as DeepPartial<
          EntityData<U>
        >,
      },
      {
        ...eventMetadata,
        ledgerVersion: Ledger._getVersion(ledger),
        type: EventType.CREATE,
        timestamp: ledger.generateTimestamp(),
      }
    );
  }

  /** @internal */
  static _generateChangeEvent<U extends object>(
    ledger: Ledger,
    changes: EntityChangeData<U>,
    eventMetadata: GenerateEventData
  ): Event<U> {
    return new Event<U>(
      {
        id: ledger.generateNextID(),
        data: omit(
          changes,
          "id",
          "name",
          "createdAt",
          "updatedAt"
        ) as DeepPartial<EntityData<U>>,
      },
      {
        ...eventMetadata,
        ledgerVersion: Ledger._getVersion(ledger),
        timestamp: ledger.generateTimestamp(),
        type: EventType.CHANGE,
      }
    );
  }

  /** @internal */
  static _generateBreakpointEvent<U extends object>(
    ledger: Ledger,
    breakpoint: string | number,
    eventMetadata: GenerateEventData
  ): Event<U> {
    return new Event<U>(
      {
        id: ledger.generateNextID(),
        data: {} as any,
      },
      {
        ...eventMetadata,
        timestamp: ledger.generateTimestamp(),
        type: EventType.BREAKPOINT,
        breakpoint,
        ledgerVersion: Ledger._getVersion(ledger),
      }
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

  /**
   * Clones the given Event and replaces it's Property Change
   * Instructions with new ones based on the given data.
   *
   * @internal
   */
  static _cloneAndReplace<T extends object>(
    event: Event<T>,
    data: EntityData<T> | DeepPartial<Omit<EntityData<T>, "id">>
  ): Event<T> {
    return new Event<T>(
      {
        id: event.id,
        data,
      },
      cloneDeep(event.eventMetadata)
    );
  }

  id!: string;
  instructions: PropertyChangeInstruction[] = [];
  eventMetadata: PrivateEventMetadata;

  constructor(e: EventData<T>, eventMetadata: PrivateEventMetadata) {
    this.id = e.id;
    this.eventMetadata = eventMetadata;

    if (e.data)
      this.instructions = Event._generateChangeInstructions<T>(e.data);
  }

  apply(to: object): object {
    if (this.eventMetadata.type === EventType.BREAKPOINT) return to;

    for (const instruction of this.instructions) {
      instruction.apply(to);
    }

    return to;
  }

  serialize(): SerializedEvent {
    return {
      id: this.id,
      instructions: this.instructions.map((i) => i.serialize()),
      metadata: cloneDeep(this.eventMetadata),
    };
  }
}
