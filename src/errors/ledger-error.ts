import type { ErrorCode } from "./error-codes";
import { ErrorMessage } from "./error-messages";

const interpolateParams = (message: string, params: (string | number)[]) => {
  let result = message;
  for (const [index, param] of params.entries()) {
    result = result.replace(new RegExp(`$${index + 1}`, "g"), param.toString());
  }
  return result;
};

export class LedgerError extends Error {
  code: ErrorCode;
  constructor(errorCode: ErrorCode, ...args: (string | number)[]) {
    super(interpolateParams(ErrorMessage[errorCode], args));
    this.code = errorCode;
  }
}
