// Ledger colors: the spec's defaults, overridden by whatever this client saved in Settings.
import { useQuery } from "@tanstack/react-query";
import { get } from "./api";
import { LEDGER_KINDS, type LedgerKind } from "@shared/picklists";

export function useLedgerColors() {
  const q = useQuery({ queryKey: ["company"], queryFn: () => get<{ ledgerColors?: Record<string, string> }>("/api/client-settings/company"), staleTime: 300_000 });
  const saved = q.data?.ledgerColors ?? {};
  return (k: string) => saved[k] ?? LEDGER_KINDS[k as LedgerKind]?.color ?? "#ffffff";
}
