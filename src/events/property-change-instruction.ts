import { get, set, unset } from "lodash";

export class PropertyChangeInstruction {
  propertyPath: string[] = [];
  value: unknown;

  constructor(path: string[], originalObject: object) {
    this.propertyPath = path;
    this.value = get(originalObject, path);
  }

  apply(obj: object) {
    if (this.value === undefined) unset(obj, this.propertyPath);
    else set(obj, this.propertyPath, this.value);
  }
}
