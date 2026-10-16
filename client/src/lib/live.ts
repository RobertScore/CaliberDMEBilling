// Live updates: when a teammate changes something in this client, the affected screens refresh by themselves.
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type LiveEvent = { kind: string; patientId?: number };

export function useLiveUpdates(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      es = new EventSource("/api/events");
      es.onmessage = (m) => {
        const e = JSON.parse(m.data) as LiveEvent;
        const pid = e.patientId;
        if (pid) {
          qc.invalidateQueries({ queryKey: ["overview", pid] });
          qc.invalidateQueries({ queryKey: ["ledger", pid] });
          if (e.kind === "notes") qc.invalidateQueries({ queryKey: ["notes", pid] });
          if (e.kind === "alerts") qc.invalidateQueries({ queryKey: ["alerts", pid] });
          if (e.kind === "documents") qc.invalidateQueries({ queryKey: ["documents", pid] });
          if (e.kind === "patient") qc.invalidateQueries({ queryKey: ["patient", pid] });
        }
        if (e.kind === "intake") qc.invalidateQueries({ queryKey: ["intake"] });
        if (e.kind === "tasks") qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["patients"] });
      };
      es.onerror = () => {
        es?.close();
        retry = setTimeout(connect, 5000);
      };
    };
    connect();
    return () => {
      clearTimeout(retry);
      es?.close();
    };
  }, [enabled, qc]);
}
