import { ErrorCode } from "../errors/error-codes";
import { LedgerError } from "../errors/ledger-error";
import type { Event } from "../events/event";
import { EventType } from "../types";

export const extractEntityIdFromEvent = (event: Event<any>): string => {
  if (event.eventMetadata.type !== EventType.CREATE) {
    throw new LedgerError(ErrorCode.CORRUPTED_EVENT_ORDER);
  }

  const tmp: { id: string } = { id: "" };
  event.apply(tmp);

  return tmp.id;
};
