import { cloneDeep } from "lodash";
import { Event } from "../src/events/event";
import { PropertyChangeInstruction } from "../src/events/property-change-instruction";
import { EventType, PrivateEventMetadata } from "../src/types";

let startID = 10000;
export const generateNextTestID = () => {
  return `${startID++}`;
};

let startTimestamp = 1648723146144;
export const generateNextTestTimestamp = () => {
  startTimestamp += 100;
  return startTimestamp;
};

export const eventMock = (e: {
  apply?: (to: object) => object;
  id?: string;
  serialize?: () => any;
  timestamp?: number;
  type?: EventType;
  instructions?: PropertyChangeInstruction[];
  eventMetadata?: PrivateEventMetadata;
  entityName?: string;
  ledgerVersion?: number;
  data?: object;
}): Event<any> => {
  const ev = {
    id: e.id ?? generateNextTestID(),
    instructions:
      e.instructions ?? Event._generateChangeInstructions(e.data ?? {}),
    eventMetadata: e.eventMetadata ?? {
      timestamp: e.timestamp ?? generateNextTestTimestamp(),
      type: e.type ?? EventType.CREATE,
      entity: e.entityName ?? "test-entity",
      ledgerVersion: e.ledgerVersion ?? 1,
    },
    apply:
      e.apply ??
      ((to) => {
        for (const instruction of ev.instructions) {
          instruction.apply(to);
        }
        return to;
      }),
    serialize:
      e.serialize ??
      ((() => {
        return {
          id: ev.id,
          instructions: ev.instructions.map((i) => i.serialize()),
          metadata: cloneDeep(ev.eventMetadata),
        };
      }) as any),
  };

  return ev;
};
