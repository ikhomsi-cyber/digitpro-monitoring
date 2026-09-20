import {
  resolveBillableTjmForClientMonth,
  resolveBillableTjmForMonth,
  type BillableRatePeriod
} from "@/lib/billable-client-days";
import {
  countAgendaWorkDaysInMonth,
  countSelectedDaysInMonth
} from "@/lib/billable-calendar-metrics";

const VAT_RATE = 0.2;

export type UpcomingInvoiceSnapshot = {
  amountHtEur: number;
  amountTtcEur: number;
  dueInDays: number;
  statusLabel: string;
};

export type CurrentMonthInvoiceSnapshot = {
  amountHtEur: number;
  amountTtcEur: number;
  billableDays: number;
};

function invoiceAmounts(days: number, tjmHt: number) {
  const amountHtEur = Math.round(days * tjmHt * 100) / 100;
  return {
    amountHtEur,
    amountTtcEur: Math.round(amountHtEur * (1 + VAT_RATE) * 100) / 100
  };
}

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
  const { amountHtEur, amountTtcEur } = invoiceAmounts(daysAlreadyInvoiced, chartTjmHt);

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

/** Montant à facturer pour tous les jours cochés du mois civil en cours. */
export function computeCurrentMonthInvoice(opts: {
  selectedWorkDayIsos: ReadonlySet<string>;
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  now?: Date;
}): CurrentMonthInvoiceSnapshot {
  const now = opts.now ?? new Date();
  const year = now.getFullYear();
  const month0 = now.getMonth();
  const currentMonthKey = `${year}-${String(month0 + 1).padStart(2, "0")}`;
  const billableDays = countSelectedDaysInMonth(opts.selectedWorkDayIsos, year, month0);
  const tjmHt = resolveBillableTjmForMonth(
    opts.billableRatePeriods,
    currentMonthKey,
    opts.fallbackTjmHt
  );

  return {
    ...invoiceAmounts(billableDays, tjmHt),
    billableDays
  };
}
