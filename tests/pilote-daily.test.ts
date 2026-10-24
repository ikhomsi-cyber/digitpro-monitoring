import { expect, it } from "vitest";
import { buildBankinPiloteSnapshot, type BankinPiloteRow } from "@/lib/pilote";
import { buildPiloteDaily, cumulativePiloteDays } from "@/lib/bankin/pilote-daily";
const row = (sourceRow: number, date: string, amount: number, parentCategory = "Logement", subCategory = "Charges"): BankinPiloteRow => ({ sourceRow, date, amount, parentCategory, subCategory, hidden: false });
it("tracks the first deficit and a later recovery using actual daily income", () => {
  const snapshot = buildBankinPiloteSnapshot([row(2, "2026-10-02", -400), row(3, "2026-10-03", 200, "Autres", "Cashback")], "synthetic.xlsx", "test");
  const daily = buildPiloteDaily(snapshot)!;
  expect(daily["2026-10"]).toHaveLength(31);
  const cumulative = cumulativePiloteDays(daily["2026-10"], ["essential"], 3);
  expect(cumulative.map(r => r.balance)).toEqual([300, -100, 100]);
  expect(cumulative.find(r => r.balance < 0)).toMatchObject({ day: 2, balance: -100 });
});
it("applies income, hidden, internal and expense-view rules without counting unrelated credits", () => {
  const snapshot = buildBankinPiloteSnapshot([
    row(2, "2026-10-01", -50), row(3, "2026-10-02", -70, "Voyage", "Hôtel"),
    row(4, "2026-10-01", 900, "Autres", "Non affecté"),
    { ...row(5, "2026-10-01", -900), hidden: true }, row(6, "2026-10-01", -900, "Autres", "Virements internes")
  ], "synthetic.xlsx", "test");
  const days = buildPiloteDaily(snapshot)!["2026-10"];
  expect(cumulativePiloteDays(days, ["essential"], 2).at(-1)).toMatchObject({ income: 300, expenses: 50 });
  expect(cumulativePiloteDays(days, ["essential", "travel"], 2).at(-1)?.expenses).toBe(120);
});
it("places shifted rents on day one of the reporting month and respects leap years", () => {
  const snapshot = buildBankinPiloteSnapshot([row(2, "2024-02-28", 500, "Entrées", "Loyers reçus"), row(3, "2024-02-01", -1)], "synthetic.xlsx", "test");
  const days = buildPiloteDaily(snapshot)!;
  expect(days["2024-02"]).toHaveLength(29);
  expect(days["2024-03"][0].income).toBe(500);
});
it("does not invent daily history for aggregate-only legacy reports", () => {
  const snapshot = buildBankinPiloteSnapshot([], "synthetic.xlsx", "test");
  expect(buildPiloteDaily({ ...snapshot, rows: undefined })).toBeNull();
});
it("keeps daily totals aligned with aggregate eligibility and duplicate source rows",()=>{
 const rows=[row(2,"2026-10-02",-40),row(2,"2026-10-02",-40),row(3,"2026-02-30",-100),row(4,"2026-10-02",Number.NaN),row(5,"2026-07-09",-1315.2,"Voyage Minorque 26","Hôtel - 14j")];
 const snapshot=buildBankinPiloteSnapshot(rows,"synthetic.xlsx","test");
 const days=buildPiloteDaily(snapshot)!;
 expect(cumulativePiloteDays(days['2026-10'],['essential']).at(-1)?.expenses).toBe(40);
 expect(days['2026-02']).toBeUndefined();expect(days['2026-07']).toBeUndefined();
});
