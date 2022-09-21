import type { ErrorCode } from "./error-codes";
import { ErrorMessage } from "./error-messages";

export class LedgerError extends Error {
  code: ErrorCode;
  constructor(errorCode: ErrorCode) {
    super(ErrorMessage[errorCode]);
    this.code = errorCode;
  }
}
