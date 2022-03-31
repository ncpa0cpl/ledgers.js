import type { ErrorCode } from "./error-codes";
import { ErrorMessage } from "./error-messages";

export class LedgerError extends Error {
  constructor(errorCode: ErrorCode) {
    super(ErrorMessage[errorCode]);
  }
}
