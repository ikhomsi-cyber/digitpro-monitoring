import { expect, it } from "vitest";
import { buildBankinPiloteSnapshot, type BankinPiloteRow } from "@/lib/pilote";
import { mergeBankinPiloteSnapshots } from "@/lib/bankin/merge-pilote";
const row = (identity: string, date = "2026-10-01", amount = -10): BankinPiloteRow => ({ identity, date, amount, sourceRow: 2, parentCategory: "Logement", subCategory: "Charges", hidden: false });
const snapshot = (rows: BankinPiloteRow[], hash = "new") => buildBankinPiloteSnapshot(rows.map((r, i) => ({ ...r, sourceRow: i + 2 })), "synthetic.xlsx", hash);
it("preserves old months and absent transactions while adding new and backdated rows", () => {
  const old = snapshot([row("old", "2025-01-01"), row("shared"), row("absent")]);
  const merged = mergeBankinPiloteSnapshots(old, snapshot([row("shared"), row("new"), row("backdated", "2025-01-02")]));
  expect(merged.rows?.map(r => r.identity)).toEqual(["old", "shared", "absent", "new", "backdated"]);
  expect(merged.months.map(m => [m.month, m.count, m.expenses])).toEqual([["2025-01", 2, 20], ["2026-10", 3, 30]]);
  expect(old.rows).toHaveLength(3);
});
it("refreshes source categories on stable identities without adding a second expense", () => {
  const old = snapshot([row("a"), row("b")]);
  const next = snapshot([row("b"), { ...row("a"), subCategory: "Changed" }]);
  const merged = mergeBankinPiloteSnapshots(old, next);
  expect(merged.rows).toHaveLength(2);
  expect(merged.rows?.find(r => r.identity === "a")?.subCategory).toBe("Changed");
  expect(merged.months[0].expenses).toBe(20);
  expect(old.rows?.find(r => r.identity === "a")?.subCategory).toBe("Charges");
  expect(mergeBankinPiloteSnapshots(merged, next)).toBe(merged);
});

it("keeps genuine identical payments by comparing occurrence counts", () => {
  const old = snapshot([row("a"), row("a")]);
  const next = snapshot([row("a"), row("a"), row("a")]);
  const merged = mergeBankinPiloteSnapshots(old, next);
  expect(merged.rows).toHaveLength(3);
  expect(merged.months[0]).toMatchObject({ count: 3, expenses: 30 });
  expect(mergeBankinPiloteSnapshots(merged, next)).toBe(merged);
  expect(mergeBankinPiloteSnapshots(merged, snapshot([row("a")]))).toBe(merged);
});
it("keeps hidden/internal exclusions when accumulating files", () => {
  const merged = mergeBankinPiloteSnapshots(snapshot([row("a")]), snapshot([{ ...row("hidden"), hidden: true }, { ...row("internal"), subCategory: "Virements internes" }, row("visible")]));
  expect(merged.sourceRows).toBe(4);
  expect(merged.excludedHidden).toBe(1);
  expect(merged.excludedInternal).toBe(1);
  expect(merged.months[0].expenses).toBe(20);
});
it("uses the next export as the baseline once and archives the legacy report", () => {
  const old = { ...snapshot([row("old", "2025-01-01")], "original"), rows: undefined };
  const incoming = snapshot([row("new", "2026-10-01", -25)]);
  const initialized = mergeBankinPiloteSnapshots(old, incoming);
  expect(initialized.legacyBackup).toBe(old);
  expect(initialized.months).toEqual(incoming.months);
  expect(initialized.rows?.map(r => r.identity)).toEqual(["new"]);
  const next = mergeBankinPiloteSnapshots(initialized, snapshot([row("later", "2026-11-01")]));
  expect(next.rows?.map(r => r.identity)).toEqual(["new", "later"]);
  expect(next.legacyBackup).toBe(old);
  expect(next.months.map(m => m.expenses)).toEqual([25, 10]);
  expect(mergeBankinPiloteSnapshots(next, incoming)).toBe(next);
  expect(old.months[0].month).toBe("2025-01");
});

it("moves a recategorized NDF expense out of NDF using Bankin source fields only", () => {
 const ndf={...row("ndf"),parentCategory:"Loisirs",subCategory:"NDF DigitPro"};
 const old=snapshot([ndf,row("history","2025-01-01")]);
 const next=snapshot([{...ndf,parentCategory:"Alimentation",subCategory:"Courses"}]);
 const merged=mergeBankinPiloteSnapshots(old,next);
 expect(merged.rows).toHaveLength(2);
 expect(merged.months.find(m=>m.month==="2026-10")?.categories).toMatchObject([{name:"Alimentation",expenses:10}]);
 expect(merged.months.find(m=>m.month==="2025-01")).toEqual(old.months.find(m=>m.month==="2025-01"));
});
it("honors source visibility changes without reactivating explicitly excluded identities",()=>{
 const old={...snapshot([row("a"),{...row("protected"),hidden:true}]),excludedRowIdentities:["protected"]};
 const merged=mergeBankinPiloteSnapshots(old,snapshot([{...row("a"),hidden:true},row("protected")]));
 expect(merged.rows?.every(r=>r.hidden)).toBe(true);
 expect(merged.months).toEqual([]);
 expect(merged.excludedRowIdentities).toEqual(["protected"]);
});
