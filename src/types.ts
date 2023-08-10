import type { BaseEntity } from "./entity/base-entity";
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
  data?: EntityChangeData<T> | EntityData<T>;
};

export type AdditionalEventData = {
  trigger?: string;
  extra?: Record<string, string | number | Array<string | number>>;
};

export type EventMetadata = AdditionalEventData & {
  timestamp: number;
  type: EventType;
  breakpoint?: string | number;
  entity: string;
  ledgerVersion: number;
};

export type PrivateEventMetadata = EventMetadata & {
  appliedMigrations?: string[];
};

export type SerializedEntityListEvents = [string, SerializedEvent[]][];

export type SerializedBreakpoints = {
  ledgerBreakpoints: Array<{
    breakpointID: string | number;
    createdAt: number;
  }>;
};

export type SerializedEntities = {
  entities: Record<string, SerializedEvent[]>;
  listEntities: Record<string, SerializedEntityListEvents>;
  copies: Record<string, Copy[]>;
};

export type SerializedLedger = SerializedEntities &
  SerializedBreakpoints & {
    name: string;
  };

export type SerializedEvent = {
  id: string;
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

class Reference<E extends BaseEntity | Copy> {
  protected _e!: E;
  ledgerName!: string;
  name!: string;
  type!: EntityReferenceType;
  id!: E["id"];
}

export type { Reference };

export interface MigrationInterface<B extends object, A extends object> {
  entity: string;
  version: number;

  migrateCreateEvent?: (eventData: B, meta: AdditionalEventData) => A;
  migrateChangeEvent?: (
    eventData: Partial<B>,
    meta: AdditionalEventData,
  ) => Partial<A>;
}
