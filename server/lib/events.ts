// Live updates: when someone changes a patient, everyone looking at that client's screens refreshes it.
// Events carry only IDs and a kind (never patient details) and stay inside one client.
import { EventEmitter } from "node:events";

export type LiveEvent = { kind: "patient" | "ledger" | "notes" | "alerts" | "documents" | "tasks" | "intake"; patientId?: number };

const bus = new EventEmitter();
bus.setMaxListeners(1000);

export function publish(clientId: number, e: LiveEvent) {
  bus.emit(`client:${clientId}`, e);
}

export function subscribe(clientId: number, fn: (e: LiveEvent) => void) {
  bus.on(`client:${clientId}`, fn);
  return () => bus.off(`client:${clientId}`, fn);
}
