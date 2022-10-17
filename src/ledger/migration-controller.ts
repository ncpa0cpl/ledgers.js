import { cloneDeep } from "lodash";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import { Event } from "../events/event";
import type { MigrationInterface } from "../types";
import { EventType } from "../types";
import type { Ledger } from "./ledger";

export class MigrationController {
  private migrations = new Map<
    string,
    Map<number, MigrationInterface<object, object>>
  >();

  constructor(private ledger: typeof Ledger) {}

  private findMigrationsBetween(
    entity: string,
    versionA: number,
    versionB: number
  ): MigrationInterface<object, object>[] {
    const migrations = this.migrations.get(entity);

    if (!migrations) {
      return [];
    }

    const result = [];
    for (const [version, migration] of migrations) {
      if (version > versionA && version <= versionB) {
        result.push(migration);
      }
    }

    return result;
  }

  private applyMigrations<T extends object>(
    event: Event<T>,
    migrations: MigrationInterface<object, object>[]
  ): Event<T> {
    // Skip migrations if there are none
    if (migrations.length === 0) return event;

    // Skip migrations if there are none for this event type
    if (
      event.eventMetadata.type === EventType.CREATE &&
      migrations.every((m) => m.migrateCreateEvent === undefined)
    )
      return event;
    if (
      event.eventMetadata.type === EventType.CHANGE &&
      migrations.every((m) => m.migrateChangeEvent === undefined)
    )
      return event;

    // Clone the event metadata so the migration cannot mutate the original
    const metadataCopy = cloneDeep(event.eventMetadata);

    const runMigration =
      event.eventMetadata.type === EventType.CREATE
        ? (
            migration: MigrationInterface<object, object>,
            data: object
          ): object => {
            if (migration.migrateCreateEvent)
              return migration.migrateCreateEvent(
                event.apply(data),
                metadataCopy
              );
            return data;
          }
        : (
            migration: MigrationInterface<object, object>,
            data: object
          ): object => {
            if (migration.migrateChangeEvent)
              return migration.migrateChangeEvent(
                event.apply(data),
                metadataCopy
              );
            return data;
          };

    let data: any = {};
    let latestVersion = event.eventMetadata.ledgerVersion;
    const appliedMigrations: string[] = [];
    for (const migration of migrations) {
      data = runMigration(migration, data);
      appliedMigrations.push(`${latestVersion}:${migration.version}`);
      latestVersion = migration.version;
    }

    const migratedEvent = Event._cloneAndReplace(event, data);
    migratedEvent.eventMetadata.ledgerVersion = latestVersion;

    if (migratedEvent.eventMetadata.appliedMigrations)
      migratedEvent.eventMetadata.appliedMigrations.push(...appliedMigrations);
    else migratedEvent.eventMetadata.appliedMigrations = appliedMigrations;

    return migratedEvent;
  }

  registerMigration(migration: MigrationInterface<object, object>): void {
    if (!this.migrations.has(migration.entity)) {
      this.migrations.set(migration.entity, new Map());
    }

    const entityMigrations = this.migrations.get(migration.entity)!;

    if (entityMigrations.has(migration.version)) {
      throw new LedgerError(
        ErrorCode.DUPLICATE_MIGRATION,
        migration.entity,
        migration.version
      );
    }

    entityMigrations.set(migration.version, migration);
  }

  migrateEvent<T extends object>(event: Event<T>): Event<T> {
    if (
      event.eventMetadata.type === EventType.BREAKPOINT ||
      event.eventMetadata.ledgerVersion === this.ledger["version"]
    ) {
      return event;
    }

    const migrations = this.findMigrationsBetween(
      event.eventMetadata.entity,
      event.eventMetadata.ledgerVersion,
      this.ledger["version"]
    );

    return this.applyMigrations(event, migrations);
  }
}
