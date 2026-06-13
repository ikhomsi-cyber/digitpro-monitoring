import { resolveBillableTjmForClientMonth, type BillableRatePeriod } from "@/lib/billable-client-days";
import { countAgendaWorkDaysInMonth } from "@/lib/billable-calendar-metrics";

const VAT_RATE = 0.2;

export type UpcomingInvoiceSnapshot = {
  amountHtEur: number;
  amountTtcEur: number;
  dueInDays: number;
  statusLabel: string;
};

export function computeUpcomingInvoice(opts: {
  selectedWorkDayIsos: ReadonlySet<string>;
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  now?: Date;
}): UpcomingInvoiceSnapshot {
  const now = opts.now ?? new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonth =
    now.getMonth() === 0
      ? { year: now.getFullYear() - 1, month0: 11 }
      : { year: now.getFullYear(), month0: now.getMonth() - 1 };
  const invoiceIssueDate = new Date(lastMonth.year, lastMonth.month0 + 1, 1);
  const invoiceDueDate = new Date(invoiceIssueDate);
  invoiceDueDate.setDate(invoiceDueDate.getDate() + 30);
  const dueInDays = Math.ceil((invoiceDueDate.getTime() - now.getTime()) / 86_400_000);
  const chartTjmHt = resolveBillableTjmForClientMonth(
    opts.billableRatePeriods,
    opts.billableRatePeriods[0]?.clientName ?? "",
    currentMonthKey,
    opts.fallbackTjmHt
  );
  const daysAlreadyInvoiced = countAgendaWorkDaysInMonth(
    opts.selectedWorkDayIsos,
    lastMonth.year,
    lastMonth.month0,
    now
  );
  const amountHtEur = Math.round(daysAlreadyInvoiced * chartTjmHt * 100) / 100;
  const amountTtcEur = Math.round(amountHtEur * (1 + VAT_RATE) * 100) / 100;

  return {
    amountHtEur,
    amountTtcEur,
    dueInDays,
    statusLabel:
      dueInDays >= 0
        ? `À venir J-${Math.ceil(dueInDays)}`
        : `Retard de ${Math.abs(Math.floor(dueInDays))} j.`
  };
}
