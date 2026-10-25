import { expect, it } from "vitest";
import { briefPeriod, buildDailyBrief, parisDay } from "@/lib/daily-financial-brief";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import type { BankinPiloteSnapshot, PiloteMonth } from "@/lib/pilote";
const tx=(id:string,date:string,amount:number,category="Logiciels"):DashboardTx=>({id,date,amount,category,label:"synthetic",company:"synthetic",scope:"pro"});
const month=(key:string,expense:number):PiloteMonth=>({month:key,expenses:expense,income:100,balance:100-expense,count:1,categories:[{name:"Alimentation",expenses:expense,income:0,count:1,children:[]}],incomeCategories:[]});
const snapshot=(months:PiloteMonth[]):BankinPiloteSnapshot=>({version:2,months,sourceFilename:"synthetic.xlsx",fileHash:"fixture",sourceRows:0,excludedInternal:0,excludedHidden:0,importedAt:"2026-10-24T08:00:00Z"});
it("uses the Paris date and handles January and shorter previous months",()=>{
 expect(parisDay(new Date("2026-10-23T22:30:00Z"))).toBe("2026-10-24");
 expect(briefPeriod("2026-01-05").previousMonth).toBe("2025-12");
 expect(briefPeriod("2026-03-31").previousEnd).toBe("2026-02-28");
});
it("compares pro spending to the same elapsed period and excludes future and personal rows",()=>{
 const transactions=[tx("a","2026-10-10",-200),tx("b","2026-09-10",-100),tx("c","2026-09-28",-900),tx("d","2026-10-28",-999),{...tx("e","2026-10-10",-999),scope:"personal" as const}];
 const result=buildDailyBrief({date:"2026-10-24",transactions,snapshot:null});
 expect(result.pro?.expenses).toBe(200);expect(result.pro?.previousExpenses).toBe(100);
 expect(result.items.some(i=>i.id.startsWith("pro-")&&i.priority==="attention")).toBe(true);
});
it("does not invent a healthy balance when imports are missing",()=>{
 const result=buildDailyBrief({date:"2026-10-24",transactions:null,snapshot:snapshot([month("2026-09",100)])});
 expect(result.pro).toBeNull();expect(result.household).toBeNull();expect(result.warnings.join(" ")).toContain("indisponible");
 expect(result.items.some(i=>i.priority==="info")).toBe(false);
});
it("signals household negative cash flow and rises relative to the previous full month",()=>{
 const result=buildDailyBrief({date:"2026-10-24",transactions:[],snapshot:snapshot([month("2026-09",100),month("2026-10",250)])});
 expect(result.household?.balance).toBe(-150);
 expect(result.items.map(i=>i.id)).toContain("household-cash");expect(result.items.map(i=>i.id)).toContain("foyer-Alimentation");
 expect(result.items.find(i=>i.id==="household-cash")?.detail).toContain("pas du solde bancaire");
});
it("does not encourage spending to match the previous month",()=>{
 const result=buildDailyBrief({date:"2026-10-24",transactions:[tx("a","2026-10-10",-50,"Repas"),tx("b","2026-09-10",-250,"Repas")],snapshot:null});
 const ndf=result.items.find(i=>i.id==="ndf");expect(ndf?.detail).toContain("justificatifs");expect(JSON.stringify(result)).not.toContain("aller au restaurant");
 expect(result.items.some(i=>i.priority==="attention")).toBe(false);
});
it("combines all compensations while retaining the family breakdown",()=>{
 const group=(name:string,expenses:number,income:number)=>({name,expenses,income,count:1,children:[{name,expenses,income,count:1,children:[]}]});
 const current={...month("2026-10",500),categories:[group("Alimentation",500,0)],incomeCategories:[group("Meryeme",0,200),group("DigitPro NDF",0,800)]};
 const result=buildDailyBrief({date:"2026-10-24",transactions:[],snapshot:snapshot([current])});
 expect(result.compensations.find(f=>f.id==="food")?.balance).toBe(-300);
 expect(result.summary.household).toContain("couvrent les dépenses sélectionnées");
 expect(result.items.find(i=>i.id==="compensation-food")?.detail).toContain("contributions reçues");
});
it("suggests documented business opportunities without inventing tax savings or a budget to spend",()=>{
 const result=buildDailyBrief({date:"2026-10-24",transactions:[],snapshot:null});
 expect(result.opportunities.map(i=>i.id)).toContain("client-gifts");expect(result.opportunities.find(i=>i.id==="client-gifts")?.detail).toContain("occasion commerciale réelle");
 expect(result.opportunities.find(i=>i.id==="recover-costs")?.detail).toContain("déjà remboursés");
});
