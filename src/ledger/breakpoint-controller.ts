import { EntityList } from "../entity-containers/entity-list";
import { EntitySingleton } from "../entity-containers/entity-singleton";
import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import type { Event } from "../events/event";
import type { SerializedBreakpoints, SerializedLedger } from "../types";
import { EntitiesController } from "./entities-controller";
import { Ledger } from "./ledger";

export class BreakpointController {
  private breakpoints: Array<{
    breakpointID: string | number;
    createdAt: number;
  }> = [];

  constructor(private ledger: Ledger) {}

  private ensureBreakpointDoesNotExist(breakpoint: string | number): void {
    if (!this.breakpoints.some((b) => b.breakpointID === breakpoint)) {
      throw new LedgerError(ErrorCode.BREAKPOINT_ALREADY_EXISTS);
    }
  }

  private ensureBreakpointExist(breakpoint: string | number): void {
    if (!this.breakpoints.some((b) => b.breakpointID === breakpoint)) {
      throw new LedgerError(ErrorCode.BREAKPOINT_DOES_NOT_EXIST);
    }
  }

  addBreakpoint(breakpoint: string | number): void {
    this.ensureBreakpointDoesNotExist(breakpoint);

    this.breakpoints.push({
      breakpointID: breakpoint,
      createdAt: this.ledger.generateTimestamp(),
    });

    const controller = Ledger._getEntityController(this.ledger);

    const singletons = EntitiesController._getAllEntities(controller);
    const entityLists = EntitiesController._getAllEntityLists(controller);

    for (const singleton of singletons) {
      EntitySingleton._addBreakpointEvent(singleton, breakpoint);
    }

    for (const list of entityLists) {
      EntityList._addBreakpointEvent(list, breakpoint);
    }
  }

  hasBreakpoint(breakpoint: string | number): boolean {
    return this.breakpoints.some((b) => b.breakpointID === breakpoint);
  }

  getBreakpoints(): Array<string | number> {
    return this.breakpoints.map((b) => b.breakpointID);
  }

  getBreakpointsWithTimestamps(): Array<{
    breakpointID: string | number;
    createdAt: number;
  }> {
    return [...this.breakpoints];
  }

  getEventsUntilBreakpoint<E extends object>(
    breakpoint: string | number,
    events: Array<Event<E>>
  ): Array<Event<E>> {
    this.ensureBreakpointExist(breakpoint);

    const result: Array<Event<E>> = [];

    for (const event of events) {
      if (event.eventMetadata.breakpoint === breakpoint) {
        break;
      }

      result.push(event);
    }

    return result;
  }

  loadFrom(data: SerializedLedger): void {
    if (this.breakpoints.length > 0) {
      throw new LedgerError(ErrorCode.BREAKPOINT_ALREADY_EXISTS);
    }

    this.breakpoints = [...data.ledgerBreakpoints];
    this.breakpoints.sort((a, b) => a.createdAt - b.createdAt);
  }

  serialize(): SerializedBreakpoints {
    return {
      ledgerBreakpoints: this.breakpoints,
    };
  }
}
