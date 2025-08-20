import { cloneDeep } from "lodash";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import { Event } from "../events/event";
import type {
  EventMigrator,
  MigrationInterface,
  SerializedLedger,
} from "../types";
import { EventType } from "../types";
import { Ledger } from "./ledger";

export class MigrationController {
  private migrations = new Map<number, MigrationInterface<Ledger>>();

  constructor(private ledger: typeof Ledger) {}

  private findMigrationsBetween(
    entity: string,
    versionA: number,
    versionB: number,
  ): MigrationInterface<Ledger>[] {
    const result = [];
    for (const [version, migration] of this.migrations) {
      if (version > versionA && version <= versionB) {
        result.push(migration);
      }
    }

    return result;
  }

  private applyEventMigrations<T extends object>(
    event: Event<T>,
    migrations: MigrationInterface<Ledger>[],
  ): Event<T> {
    // Clone the event metadata so the migration cannot mutate the original
    const metadataCopy = cloneDeep(event.eventMetadata);

    let data: any = {};
    let latestVersion = event.eventMetadata.ledgerVersion;
    const appliedMigrations: string[] = [];

    for (const migration of migrations) {
      const evMigrator = (
        migration.migrateEvent as any as Record<string, EventMigrator<any>>
      )[event.eventMetadata.entity];

      if (event.eventMetadata.type === EventType.CREATE && evMigrator?.create) {
        data = evMigrator.create(event.apply(data) as any, metadataCopy);
      } else if (
        event.eventMetadata.type === EventType.CHANGE &&
        evMigrator?.change
      ) {
        data = evMigrator.change(event.apply(data) as any, metadataCopy);
      }

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

  registerMigration(migration: MigrationInterface<Ledger>): void {
    if (!this.migrations.has(migration.version)) {
      this.migrations.set(migration.version, migration);
    } else {
      throw new LedgerError(ErrorCode.DUPLICATE_MIGRATION, migration.version);
    }
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
      this.ledger["version"],
    );

    return this.applyEventMigrations(event, migrations);
  }

  migrateLedger(ledger: Ledger, data: SerializedLedger) {
    const migrations = this.findMigrationsBetween(
      data.name,
      data.version,
      Ledger._getVersion(ledger),
    );

    for (const migration of migrations) {
      if (migration.migrate != null) {
        migration.migrate(ledger, data);
      }
    }
  }
}
