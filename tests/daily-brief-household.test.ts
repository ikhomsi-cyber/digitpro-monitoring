import { expect, it } from "vitest";
import { householdOutOfPocketHistory } from "@/lib/daily-brief-household";
import type { BankinPiloteRow, BankinPiloteSnapshot } from "@/lib/pilote";
const row=(sourceRow:number,date:string,amount:number,parentCategory="Alimentation",subCategory="Courses"):BankinPiloteRow=>({sourceRow,date,amount,parentCategory,subCategory,hidden:false});
const snapshot=(rows:BankinPiloteRow[]):BankinPiloteSnapshot=>({version:2,months:[],rows,sourceFilename:"synthetic.xlsx",fileHash:"fixture",sourceRows:rows.length,excludedHidden:0,excludedInternal:0,importedAt:"2026-10-25T08:00:00Z"});
it("compares actual out-of-pocket at the same cutoff without future or hidden rows",()=>{
 const history=householdOutOfPocketHistory(snapshot([row(1,"2026-01-02",-1000),row(2,"2026-01-03",600,"Revenus","Meryeme"),row(3,"2026-10-03",-300),row(4,"2026-10-26",-10000),{...row(5,"2026-10-04",-500),hidden:true},row(6,"2025-01-02",-800),row(7,"2025-01-03",500,"Revenus","Meryeme"),row(8,"2025-11-01",-5000)]),"2026-10-25");
 expect(history[0]).toMatchObject({outOfPocket:100,monthOutOfPocket:0});expect(history[1]).toMatchObject({outOfPocket:0,cutoff:"2025-10-25"});expect(history[2].outOfPocket).toBeNull();
});
it("matches Pilote declared rent using an NDF surplus to offset food",()=>{
 expect(householdOutOfPocketHistory(snapshot([row(1,"2026-10-03",-200),row(2,"2026-10-04",1000,"DigitPro","NDF"),row(3,"2026-10-05",-100,"Logement","Loyer")]),"2026-10-25")[0].outOfPocket).toBe(0);
});
it("uses bank dates for actual late-month rent receipts",()=>{
 expect(householdOutOfPocketHistory(snapshot([row(1,"2026-10-02",-100,"Logement","Loyer"),row(2,"2026-10-25",100,"Revenus","Loyer")]),"2026-10-25")[0].monthOutOfPocket).toBe(0);
});
it("does not invent a partial-month comparison from a monthly-only archive",()=>{
 expect(householdOutOfPocketHistory({...snapshot([]),rows:undefined},"2026-10-25").every(row=>row.outOfPocket===null)).toBe(true);
});
it("uses the exact same views and compensation calculation as Pilote",async()=>{
 const {buildPiloteMonths,filterPiloteIncome,addPiloteMoroccoRent,filterPiloteExpenses,buildPiloteCompensations}=await import("@/lib/pilote");
 const {pilotePocketTotals}=await import("@/lib/pilote-pocket");
 const source=snapshot([row(1,"2026-10-02",-1000,"Logement","Loyer"),row(2,"2026-10-03",-200,"Alimentation","Courses"),row(3,"2026-10-04",-90,"Shopping","Divers"),row(4,"2026-10-05",300,"DigitPro","NDF")]);
 const months=buildPiloteMonths(source.rows!).map(filterPiloteIncome).map(addPiloteMoroccoRent);
 for(const views of [["essential"],["essential","secondary"],[]] as const){
  const expected=pilotePocketTotals(buildPiloteCompensations(filterPiloteExpenses(months[0],views),months)).remainingCents/100;
  expect(householdOutOfPocketHistory(source,"2026-10-25",views)[0].monthOutOfPocket).toBe(expected);
 }
});

it("matches the global Pilote deficit after cross-family compensations",()=>{
 const source=snapshot([row(1,"2026-10-01",-1000),row(2,"2026-10-02",269,"Revenus","Meryeme"),row(3,"2026-10-03",152,"DigitPro","NDF")]);
 // Food deficit 731; NDF 152 + declared rent 300 cover 452 across families.
 expect(householdOutOfPocketHistory(source,"2026-10-25")[0].monthOutOfPocket).toBe(279);
});
