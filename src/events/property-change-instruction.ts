import { get, set, unset } from "lodash";
import type { SerializedChangeInstruction } from "../types";

export class PropertyChangeInstruction {
  /** @internal */
  static _loadFrom(
    serialized: SerializedChangeInstruction
  ): PropertyChangeInstruction {
    const instruction = new PropertyChangeInstruction([], {});

    instruction.propertyPath = serialized.propertyPath;
    instruction.value = serialized.value;

    return instruction;
  }

  propertyPath: string[] = [];
  value?: unknown;

  constructor(path: string[], originalObject: object) {
    this.propertyPath = path;
    this.value = get(originalObject, path);
  }

  apply(obj: object) {
    if (this.value === undefined) unset(obj, this.propertyPath);
    else set(obj, this.propertyPath, this.value);
  }

  serialize(): SerializedChangeInstruction {
    return {
      propertyPath: this.propertyPath.slice(),
      value: this.value,
    };
  }
}
