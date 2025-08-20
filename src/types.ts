import type { BaseEntity } from "./entity/base-entity";
import type { Ledger } from "./ledger/ledger";
import type {
  DeepPartial,
  EntityOfName,
  NameOf,
  ReadonlyKeys,
  Serial,
} from "./type-utils";

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
    version: number;
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

export type OldEvent<T> = {
  // @ts-expect-error
  name: T["name"];
  id: string;
  createdAt: number;
  updatedAt: number;
  [index: string]: any;
} & Partial<T>;

export interface EventMigrator<T> {
  create?(eventData: OldEvent<T>, meta: AdditionalEventData): T;
  change?(eventData: OldEvent<T>, meta: AdditionalEventData): T;
}

export type MigrateEventMap<L extends Ledger> = {
  [K in keyof L as [NameOf<L[K]>] extends [never]
    ? never
    : NameOf<L[K]>]?: EventMigrator<EntityOfName<L, NameOf<L[K]>>>;
};

export type MigrationInterface<L extends Ledger> = {
  version: number;

  /**
   * `migrate()` function will be called on a ledger after a serialized
   * ledger data was loaded into the Ledger class with a version that's lower
   * than the class Ledger version.
   */
  migrate?(ledger: L, data: SerializedLedger): void;
  /**
   * Here migration function for specific Entitiies events can be defined.
   * With a event migration you can change that entity history.
   */
  migrateEvent?: MigrateEventMap<L>;
};

export interface LedgerMigrationInterface {
  entity: string;
  version: number;
}
