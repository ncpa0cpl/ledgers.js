import { Event } from "../src/events/event";
import { EventType } from "../src/types";

let startID = 10000;
export const generateNextTestID = () => {
  return `${startID++}`;
};

let startTimestamp = 1648723146144;
export const generateNextTestTimestamp = () => {
  startTimestamp += 100;
  return startTimestamp;
};

export const eventMock = (e: Partial<Event<any>>): Event<any> => {
  return {
    apply: e.apply ?? (() => {}),
    data: e.data ?? {},
    id: e.id ?? generateNextTestID(),
    serialize: e.serialize ?? ((() => ({})) as any),
    timestamp: e.timestamp ?? generateNextTestTimestamp(),
    type: e.type ?? EventType.CREATE,
  };
};
