import type { Entity } from "./entity/entity";
import type { DeepPartial, ReadonlyKeys, Serial } from "./type-utils";

export type EntityData<T extends object> = Omit<
  Serial<T>,
  "name" | "createdAt" | "updatedAt" | ReadonlyKeys<T>
> & { id?: string };

export type EntityChangeData<T extends object> = DeepPartial<
  Omit<EntityData<T>, "id">
>;

export enum EventType {
  CREATE = "CREATE",
  CHANGE = "CHANGE",
  BREAKPOINT = "BREAKPOINT",
}

export class Copy {
  id!: string;
}

export type EventData<T extends object> = {
  id: string;
  timestamp: number;
  type: EventType;
  data?: EntityChangeData<T> | EntityData<T>;
  breakpoint?: string | number;
};

export type EventMetadata = {
  trigger?: string;
  extra?: Record<string, string | number | Array<string | number>>;
};

export type PrivateEventMetadata = EventMetadata & {
  entity: string;
};

export type SerializedEntityListEvents<T extends object> = [
  string,
  SerializedEvent[]
][];

export type SerializedBreakpoints = {
  ledgerBreakpoints: Array<string | number>;
};

export type SerializedEntities = {
  singletonEntities: Record<string, SerializedEvent[]>;
  listEntities: Record<string, SerializedEntityListEvents<any>>;
  copies: Record<string, Copy[]>;
};

export type SerializedLedger = SerializedEntities &
  SerializedBreakpoints & {
    name: string;
  };

export type SerializedEvent = {
  id: string;
  timestamp: number;
  type: EventType;
  breakpoint?: string | number;
  instructions: SerializedChangeInstruction[];
  metadata: PrivateEventMetadata;
};

export type SerializedChangeInstruction = {
  propertyPath: string[];
  value?: unknown;
};

export enum EntityReferenceType {
  SINGLETON = "SINGLETON",
  LIST = "LIST",
  COPY = "COPY",
}

export type Reference<E extends Entity | Copy> = {
  ledgerName: string;
  name: string;
  type: EntityReferenceType;
  id: E["id"];
};
