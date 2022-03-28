import { get, set } from "lodash";

export class PropertyChangeInstruction {
  propertyPath: string[] = [];
  value: unknown;

  constructor(path: string, originalObject: object) {
    this.propertyPath = path.split(".");
    this.value = get(originalObject, path);
  }

  apply(obj: object) {
    set(obj, this.propertyPath, this.value);
  }
}
