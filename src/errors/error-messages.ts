import { ErrorCode } from "./error-codes";

const createErrorMessageMap = <
  S extends string,
  R extends Record<ErrorCode, S>
>(
  v: R
) => v;

export const ErrorMessage = createErrorMessageMap({
  [ErrorCode.CORRUPTED_EVENT_ORDER]:
    "First event of the entity was not a create event, event list is corrupted.",
  [ErrorCode.BREAKPOINT_ALREADY_EXISTS]:
    "Cannot add a breakpoint that already exists.",
  [ErrorCode.BREAKPOINT_DOES_NOT_EXIST]:
    "Specified breakpoint was never added to the ledger.",
  [ErrorCode.DESERIALIZING_ON_NON_EMPTY_LEDGER]:
    "The ledger cannot be deserialized to a ledger that already contains initiated entities.",
  [ErrorCode.DUPLICATE_ENTITY]:
    "Duplicate Entity. Entities of this type and name already exist in the ledger.",
  [ErrorCode.DUPLICATE_IDENTIFIER]:
    "Duplicate identifier. Entity with the provided ID already exists!",
  [ErrorCode.EMPTY_EVENTS_LIST]:
    "Entity you are trying to access has not yet been created.",
  [ErrorCode.ENTITY_ALREADY_CREATED]:
    "Entity already exists. Event-create cannot be dispatched for an entity that has already been created before.",
  [ErrorCode.ENTITY_NAME_NOT_SPECIFIED]:
    "Entity name has not been specified. Each entity must have a name!",
  [ErrorCode.ENTITY_NOT_FOUND]:
    "Entity not found. Specified entity was not found within this ledger.",
  [ErrorCode.ENTITY_NOT_YET_CREATED]:
    "Entity not yet created. An entity must receive an event-create before it can be read or modified with an event-change.",
  [ErrorCode.LEDGER_NAMES_DO_NOT_MATCH]:
    "Ledger name does not match. Name of the ledger and the ledger name provided do not match.",
  [ErrorCode.SERIALIZING_DURING_TRANSACTION]:
    "Ledger cannot be serialized when the transaction is pending. Commit or Rollback the Ledger transaction before serializing.",
  [ErrorCode.TRANSACTION_ALREADY_IN_PROGRESS]:
    "Transaction already in progress. A new transaction cannot be started until the previous one is completed.",
  [ErrorCode.UNKNOWN_ENTITY_NAME]:
    "Unknown Entity name. Entities of the provided name do not exist within this ledger.",
  [ErrorCode.UNKNOWN_IDENTIFIER]:
    "Unknown identifier. Entity with the provided ID does not exist.",
});
