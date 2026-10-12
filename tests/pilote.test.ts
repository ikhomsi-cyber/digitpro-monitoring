import { describe, expect, it } from "vitest";
import { buildPiloteYear, buildPiloteCompensations, piloteCompensationFamily, buildPiloteMonths, buildBankinPiloteSnapshot, bankinPiloteExclusion, type BankinPiloteRow } from "@/lib/pilote";
const row = (sourceRow: number, amount: number, parentCategory = "Logement.", subCategory = "Loyer", date = "2026-10-01"): BankinPiloteRow => ({ sourceRow, amount, parentCategory, subCategory, date, hidden: false });
describe("Pilote — exact Bankin source", () => {
  it("preserves category and subcategory verbatim without changing credit dates or classifying labels", () => {
    const months = buildPiloteMonths([row(2, -20.1), row(3, -0.2, "Logement.", "Énergie"), row(4, 22, "Entrées d’argent.", "Salaire", "2026-10-31"), row(5, 5, "Divers.", "A catégoriser", "2026-11-01")]);
    expect(months.map(m => m.month)).toEqual(["2026-10", "2026-11"]);
    expect(months[0]).toMatchObject({ expenses: 20.3, income: 22, balance: 1.7, count: 3 });
    expect(months[0].categories[0]).toMatchObject({ name: "Logement.", count: 2 });
    expect(months[0].categories[0].children.map(c => c.name)).toEqual(["Loyer", "Énergie"]);
  });
  it("excludes only explicit Bankin internal transfers and hidden flags/categories on both debit and credit sides", () => {
    const rows = [row(2, -12), row(3, 20, "Entrées", "Remboursement"), row(4, -100, "Retraits, Chq. et Vir.", "Virements internes"), row(5, 100, "Retraits, Chq. et Vir.", "Virements internes"), row(6, -500, "Transactions masquées.", "Autres"), { ...row(7, 500), hidden: true }];
    expect(buildPiloteMonths(rows)[0]).toMatchObject({ expenses: 12, income: 20, balance: 8, count: 2 });
    const snapshot = buildBankinPiloteSnapshot(rows, "bankin.xls", "a".repeat(64));
    expect(snapshot).toMatchObject({ sourceRows: 6, excludedInternal: 2, excludedHidden: 2 });
    expect(bankinPiloteExclusion(row(8, -10, "Retraits, Chq. et Vir.", "Virement externe"))).toBeNull();
  });
  it("keeps distinct source lines even when identical; ignores repeated source row IDs and invalid dates", () => {
    const original = row(2, -12);
    const months = buildPiloteMonths([original, original, { ...original, sourceRow: 3 }, row(4, Infinity), row(5, -1, "Divers", "Autres", "2026-02-30")]);
    expect(months[0]).toMatchObject({ count: 2, expenses: 24 }); expect(buildPiloteMonths([])).toEqual([]);
  });
});


describe("Pilote — user-defined compensation families", () => {
  it("assigns every original Bankin amount once and retains category names", () => {
    const month = buildPiloteMonths([
      row(2, 950, "Entrées d’argent", "Loyers reçus"), row(3, 496, "Entrées d’argent", "DigitPro Consulting IK"),
      row(4, 589, "Entrées d’argent", "DigitPro Consulting NDF"), row(5, 100, "Entrées d’argent", "Meryeme"), row(6, 500, "Entrées d’argent", "Salaire"),
      row(7, -1450, "Logement", "Loyer"), row(8, -197, "Charges LMNP", "Charges copro LMNP"),
      row(9, -388, "Auto & Transports", "Carburant"), row(10, -79, "Loisirs & Sorties", "NDF DigitPro"),
      row(11, -496, "Alimentation & Restau.", "Carrefour"), row(12, -37, "Logement", "Electricité"),
    ])[0];
    const original = structuredClone(month);
    const families = buildPiloteCompensations(month);
    expect(families.find(f => f.id === "rent")).toMatchObject({ income: 950, expenses: 1684, covered: 950, balance: -734 });
    expect(families.find(f => f.id === "transport")).toMatchObject({ income: 496, expenses: 388, covered: 388, balance: 108 });
    expect(families.find(f => f.id === "ndf")).toMatchObject({ income: 589, expenses: 79, covered: 79, balance: 510 });
    expect(families.find(f => f.id === "food")).toMatchObject({ income: 100, expenses: 496, covered: 100, balance: -396 });
    expect(families.find(f => f.id === "other")).toMatchObject({ income: 500, expenses: 0, covered: 0, balance: 500 });
    expect(families.reduce((s, f) => s + Math.round(f.income * 100), 0)).toBe(Math.round(month.income * 100));
    expect(families.reduce((s, f) => s + Math.round(f.expenses * 100), 0)).toBe(Math.round(month.expenses * 100));
    expect(month).toEqual(original);
  });
  it("does not invent missing income or use substrings as IK/NDF categories", () => {
    expect(piloteCompensationFamily("Entrées", "Virement inconnu", true)).toBe("other");
    expect(piloteCompensationFamily("Entrées", "IKÉA", true)).toBe("other");
    expect(piloteCompensationFamily("Entrées", "NDF autre employeur", true)).toBe("other");
    const families = buildPiloteCompensations(buildPiloteMonths([row(2, -10, "Alimentation", "Courses")])[0]);
    expect(families.find(f => f.id === "food")).toMatchObject({income: 0, covered: 0, balance: -10});
  });
});


it("adds annual Bankin totals and original subcategories only for the selected year", () => {
  const months = buildPiloteMonths([row(2, -20.1), row(3, -0.2, "Logement.", "Loyer", "2026-11-01"), row(4, 100, "Entrées", "Salaire", "2026-11-03"), row(5, -999, "Divers", "Autres", "2025-10-01")]);
  const original = structuredClone(months);
  const year = buildPiloteYear(months, "2026")!;
  expect(year).toMatchObject({month: "2026", expenses: 20.3, income: 100, balance: 79.7, count: 3});
  expect(year.categories[0]).toMatchObject({name: "Logement.", expenses: 20.3, children: [{name: "Loyer", expenses: 20.3, count: 2}]});
  expect(buildPiloteYear(months, "2024")).toBeUndefined();
  expect(months).toEqual(original);
});


it("uses the confirmed Meryeme €500 once in October and in the annual total, without changing Bankin categories", () => {
  const months = buildPiloteMonths([row(2, 500, "Entrées", "Extra"), row(3, 19, "Entrées", "Autres"), row(4, -496, "Alimentation", "Courses"), row(5, 500, "Entrées", "Extra", "2026-11-01")]);
  const october = buildPiloteCompensations(months[0], months);
  expect(october.find(f => f.id === "food")).toMatchObject({income: 500, covered: 496, balance: 4, incomeNames: ["Extra"]});
  expect(october.find(f => f.id === "other")).toMatchObject({income: 19});
  const annual = buildPiloteCompensations(buildPiloteYear(months, "2026")!, months);
  expect(annual.find(f => f.id === "food")).toMatchObject({income: 500});
  expect(annual.find(f => f.id === "other")).toMatchObject({income: 519});
  expect(months[0].incomeCategories[0].children[0].name).toBe("Extra");
});


it("reports rent income from the last seven calendar days in the following month without changing source dates", () => {
  const rows = [row(2, 950, "Entrées", "Loyers reçus", "2026-10-24"), row(3, 950, "Entrées", "Loyers reçus", "2026-10-25"), row(4, -1450, "Logement", "Loyer", "2026-10-31"), row(5, 500, "Entrées", "Salaire", "2026-10-31"), row(6, 950, "Entrées", "Loyers reçus", "2026-12-31")];
  const original = structuredClone(rows);
  const snapshot = buildBankinPiloteSnapshot(rows, "bankin.xls", "hash");
  expect(snapshot.shiftedRentCount).toBe(2);
  expect(snapshot.months.map(m => [m.month, m.income, m.expenses])).toEqual([["2026-10", 1450, 1450], ["2026-11", 950, 0], ["2027-01", 950, 0]]);
  expect(buildPiloteYear(snapshot.months, "2026")!.income).toBe(2400);
  expect(rows).toEqual(original);
  expect(buildPiloteMonths([row(7, 1, "Entrées", "Loyers reçus", "2024-02-22"), row(8, 2, "Entrées", "Loyers reçus", "2024-02-23")]).map(m => [m.month, m.income])).toEqual([["2024-02", 1], ["2024-03", 2]]);
});


it("keeps electricity and home insurance in the Bankin housing compensation family", () => {
  const month = buildPiloteMonths([row(2, -37, "Logement", "Electricité"), row(3, -20, "Logement", "Assurance habitation"), row(4, 50, "Entrées", "Loyers reçus")])[0];
  expect(buildPiloteCompensations(month).find(f => f.id === "rent")).toMatchObject({expenses: 57, income: 50, covered: 50, balance: -7});
  expect(month.categories[0].name).toBe("Logement");
});

describe("Pilote expense views", () => {
  it("partitions every expense once, preserves source names and leaves income unchanged", async () => {
    const {filterPiloteExpenses, piloteExpenseView} = await import("@/lib/pilote");
    expect(piloteExpenseView("Charges LMNP", "Charges copro LMNP")).toBe("essential");
    expect(piloteExpenseView("Charges LMNP", "Taxe foncière")).toBe("secondary");
    const month = buildPiloteMonths([row(1,-100), row(2,-30,"Logement.","Taxe foncière"), row(3,-20,"Auto & Transports.","Entretien"), row(4,-50,"Voyages.","Transport"), row(5,-10,"Divers.","Autre"), row(6,300,"Entrées d’argent.","Salaire")])[0];
    const views = (["essential","secondary","travel"] as const).map(view => filterPiloteExpenses(month,view));
    expect(views.map(view => view.expenses)).toEqual([100,60,50]);
    expect(views.reduce((sum,view) => sum + view.expenses,0)).toBe(month.expenses);
    expect(views.every(view => view.incomeCategories === month.incomeCategories && view.income === 300)).toBe(true);
    expect(views[1].categories.find(category => category.name === "Logement.")?.children[0].name).toBe("Taxe foncière");
    expect(month.categories.flatMap(category => category.children).length).toBe(5);
  });
});


it("only counts cashback among other income without dropping named compensation income", async () => {
  const {filterPiloteIncome} = await import("@/lib/pilote");
  const source = buildPiloteMonths([row(1,10,"Entrées d’argent","Cashback"), row(2,400,"Entrées d’argent","Salaire"), row(3,950,"Entrées d’argent","Loyers reçus"), row(4,500,"Entrées d’argent","Extra"), row(5,-20)])[0];
  const filtered = filterPiloteIncome(source);
  expect(filtered.income).toBe(1460);
  expect(filtered.balance).toBe(1440);
  expect(buildPiloteCompensations(filtered).find(family => family.id === "other")?.income).toBe(10);
  expect(filtered.incomeCategories[0].children.map(sub => sub.name)).not.toContain("Salaire");
  expect(source.income).toBe(1860);
  expect(filterPiloteIncome(filtered)).toEqual(filtered);
  expect(buildPiloteYear([filtered],"2026")?.income).toBe(1460);
});


it("counts September Extra income as Meryeme after the cashback-only filter", async () => {
  const {filterPiloteIncome} = await import("@/lib/pilote");
  const months = buildPiloteMonths([row(1,500,"Entrées d’argent","Extra","2026-09-01"),row(2,20,"Entrées d’argent","Extra","2026-09-02"),row(3,30,"Entrées d’argent","Autre","2026-09-03")]);
  const filtered = months.map(filterPiloteIncome);
  expect(filtered[0].income).toBe(520);
  expect(buildPiloteCompensations(filtered[0]).find(f => f.id === "food")?.income).toBe(520);
  const annual = buildPiloteYear(filtered,"2026")!;
  expect(buildPiloteCompensations(annual,filtered).find(f => f.id === "food")?.income).toBe(520);
});


it("keeps DigitPro NDF expenses and reimbursements together in Essential", async () => {
  const {filterPiloteIncome, filterPiloteExpenses} = await import("@/lib/pilote");
  const month = filterPiloteIncome(buildPiloteMonths([row(1,-79,"Loisirs & Sorties","NDF DigitPro"),row(2,589,"Entrées d’argent","DigitPro Consulting NDF")])[0]);
  const essential = filterPiloteExpenses(month,"essential");
  expect(buildPiloteCompensations(essential).find(f => f.id === "ndf")).toMatchObject({income:589,expenses:79,covered:79,balance:510});
  expect(filterPiloteExpenses(month,"secondary").expenses).toBe(0);
  expect(essential.categories[0].name).toBe("Loisirs & Sorties");
});
