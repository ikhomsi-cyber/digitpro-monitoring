import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";

vi.mock("@/app/dashboard/gmail-actions", () => ({ loadHiwayInvoices: vi.fn() }));
import { useHiwayInvoicesState } from "@/components/dashboard/HiwayInvoicesContext";

function initialState(invoices?: HiwayInvoice[]) {
  let result: { count: number | null; loading: boolean } | undefined;
  function Probe() {
    const state = useHiwayInvoicesState(true, invoices);
    result = { count: state.invoices?.length ?? null, loading: state.loading };
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return result;
}

describe("factures disponibles dès le rendu serveur", () => {
  it("expose les factures préchargées sans attendre un effet client", () => {
    const invoice: HiwayInvoice = { id: "invoice", date: "2026-09-01", subject: "Facture", client: "Client", amountEur: 1000, amountKind: "HT", billedDays: 1, tjmHtEur: 1000 };
    expect(initialState([invoice])).toEqual({ count: 1, loading: false });
  });
  it("distingue aucune facture d'un chargement non terminé", () => {
    expect(initialState([])).toEqual({ count: 0, loading: false });
    expect(initialState()).toEqual({ count: null, loading: true });
  });
});
