export enum ErrorCode {
  BREAKPOINT_ALREADY_EXISTS = "BREAKPOINT_ALREADY_EXISTS",
  BREAKPOINT_DOES_NOT_EXIST = "BREAKPOINT_DOES_NOT_EXIST",
  DESERIALIZING_ON_NON_EMPTY_LEDGER = "DESERIALIZING_ON_NON_EMPTY_LEDGER",
  DUPLICATE_ENTITY = "DUPLICATE_ENTITY",
  DUPLICATE_IDENTIFIER = "DUPLICATE_IDENTIFIER",
  EMPTY_EVENTS_LIST = "EMPTY_EVENTS_LIST",
  ENTITY_ALREADY_CREATED = "ENTITY_ALREADY_CREATED",
  ENTITY_NAME_NOT_SPECIFIED = "ENTITY_NAME_NOT_SPECIFIED",
  ENTITY_NOT_FOUND = "ENTITY_NOT_FOUND",
  ENTITY_NOT_YET_CREATED = "ENTITY_NOT_YET_CREATED",
  LEDGER_NAMES_DO_NOT_MATCH = "LEDGER_NAMES_DO_NOT_MATCH",
  SERIALIZING_DURING_TRANSACTION = "SERIALIZING_DURING_TRANSACTION",
  TRANSACTION_ALREADY_IN_PROGRESS = "TRANSACTION_ALREADY_IN_PROGRESS",
  UNKNOWN_ENTITY_NAME = "UNKNOWN_ENTITY_NAME",
  UNKNOWN_IDENTIFIER = "UNKNOWN_IDENTIFIER",
}
