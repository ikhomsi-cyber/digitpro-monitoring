import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { buildBankinPiloteSnapshot, type BankinPiloteRow } from "@/lib/pilote";
import { mergeBankinPiloteSnapshots } from "@/lib/bankin/merge-pilote";
const row = (label: string, date = "2027-01-04", account = "Compte synthétique", amount = -42): BankinPiloteRow => ({
  label, date, account, amount, sourceRow: 2, parentCategory: "Charges", subCategory: "Copropriété", hidden: false,
  identity: createHash("sha256").update(JSON.stringify([date, Math.round(amount * 100), label, account])).digest("hex"),
});
const snapshot = (rows: BankinPiloteRow[]) => buildBankinPiloteSnapshot(rows.map((r,i)=>({...r,sourceRow:i+2})), "synthetic.xlsx", "hash");
it("reconciles expanded bank descriptions and remembers both identities on repeated/backward imports", () => {
  const pending = snapshot([row("Prlv Sepa Sdc Residence Exemple")]);
  const booked = snapshot([row("Prelvt Sepa Recu D/o Confrere Prlv Sepa Sdc Residence Exemple")]);
  const merged = mergeBankinPiloteSnapshots(pending, booked);
  expect(merged.rows).toHaveLength(1);
  expect(merged.months[0].expenses).toBe(42);
  expect(mergeBankinPiloteSnapshots(merged, booked)).toBe(merged);
  expect(mergeBankinPiloteSnapshots(merged, pending)).toBe(merged);
});
it("reconciles weekend booking dates across months and preserves unrelated history", () => {
  const pending = snapshot([row("CB Commerce Exemple", "2027-01-31"),row("Autre", "2026-05-01")]);
  const booked = snapshot([row("CB Commerce Exemple", "2027-02-02")]);
  const merged = mergeBankinPiloteSnapshots(pending, booked);
  expect(merged.rows).toHaveLength(2);
  expect(merged.months.map(m=>m.month)).toEqual(["2026-05","2027-02"]);
  expect(mergeBankinPiloteSnapshots(merged, pending)).toBe(merged);
});
it("verifies legacy accounts from hashes without merging other accounts", () => {
  const old = row("CB Commerce Exemple"); delete old.account;
  expect(mergeBankinPiloteSnapshots(snapshot([old]),snapshot([row("CB Commerce Exemple","2027-01-05")])).rows).toHaveLength(1);
  expect(mergeBankinPiloteSnapshots(snapshot([old]),snapshot([row("CB Commerce Exemple","2027-01-05","Autre compte")])).rows).toHaveLength(2);
});
it("keeps genuine repeated payments present together, including identical occurrences", () => {
  const a=row("CB Commerce Exemple"),b=row("CB Commerce Exemple","2027-01-05");
  expect(mergeBankinPiloteSnapshots(snapshot([a]),snapshot([a,b])).rows).toHaveLength(2);
  expect(mergeBankinPiloteSnapshots(snapshot([a]),snapshot([a,a])).rows).toHaveLength(2);
});
it("does not guess from equal amounts, categories, generic card labels, missing accounts or dates outside the window", () => {
  for (const [a,b] of [
    [row("CB Commerce Exemple"),row("CB Autre Commerce")],
    [row("Virement"),row("Virement","2027-01-05")],
    [row("CB Bankin"),row("CB Bankin","2027-01-08")],
    [{...row("CB Commerce Exemple"),account:undefined,identity:"unknown"},row("CB Commerce Exemple","2027-01-05")],
  ]) expect(mergeBankinPiloteSnapshots(snapshot([a]),snapshot([b])).rows).toHaveLength(2);
});
it("stops ambiguous matches before saving extra transactions", () => {
  const a=row("CB Commerce Exemple","2027-01-04"),b=row("CB Commerce Exemple","2027-01-05");
  expect(()=>mergeBankinPiloteSnapshots(snapshot([a,b]),snapshot([row("CB Commerce Exemple","2027-01-06")]))).toThrow("Import suspendu");
  expect(()=>mergeBankinPiloteSnapshots(snapshot([a]),snapshot([b,row("CB Commerce Exemple","2027-01-06")]))).toThrow("Import suspendu");
});
it("matches a generic transfer only on its exact date, account, amount and categories", () => {
  const old=row("Virement Instantane",undefined,undefined,128.19),booked=row("Virement Instantane Vir Inst Exemple Frais",undefined,undefined,128.19);
  expect(mergeBankinPiloteSnapshots(snapshot([old]),snapshot([booked])).rows).toHaveLength(1);
});
it("preserves explicit exclusions and missingOnly source fields", () => {
  const old=row("CB Commerce Exemple"),booked=row("CB Commerce Exemple","2027-01-05");
  const merged=mergeBankinPiloteSnapshots(snapshot([old]),snapshot([booked]),{missingOnly:true});
  expect(merged.rows?.[0].date).toBe(old.date);
  expect(mergeBankinPiloteSnapshots(merged,snapshot([booked]))).toBe(merged);
  const hidden={...old,hidden:true};
  expect(mergeBankinPiloteSnapshots({...snapshot([hidden]),excludedRowIdentities:[old.identity!]},snapshot([old])).rows?.[0].hidden).toBe(true);
});

it("recognizes a removed one-letter bank suffix without confusing beneficiaries", () => {
  const old=row("Prlv Sepa Sdc Residence Exemple A");
  const next=row("Prelvt Sepa Recu D/o Confrere Prlv Sepa Sdc Residence Exemple");
  expect(mergeBankinPiloteSnapshots(snapshot([old]),snapshot([next])).rows).toHaveLength(1);
  expect(mergeBankinPiloteSnapshots(snapshot([old]),snapshot([row("Prlv Sepa Sdc Residence Differente")])).rows).toHaveLength(2);
});
