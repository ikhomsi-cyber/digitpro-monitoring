import { expect, it } from "vitest";
import { buildMobilePilote } from "@/lib/mobile/pilote";
import { buildBankinPiloteSnapshot, type BankinPiloteRow } from "@/lib/pilote";
const row=(id:number,date:string,amount:number,parentCategory:string,subCategory:string,hidden=false):BankinPiloteRow=>({sourceRow:id,date,amount,parentCategory,subCategory,hidden});
const options={views:["essential"] as const,travelScope:"year" as const};
const snapshot=buildBankinPiloteSnapshot([
 row(1,"2026-10-01",-1704,"Logement","Loyer"),row(2,"2026-10-01",950,"Entrées d’argent","Loyers reçus"),
 row(3,"2026-07-09",-1315.2,"Voyage Minorque 26","Hôtel - 14j"),row(4,"2026-07-10",-500,"Voyage Minorque 26","Hôtel - 14j"),
 row(5,"2026-10-01",-100,"Voyage Bodrum Kos 26","Hôtel"),row(6,"2026-10-01",-50,"Voyage Bodrum","Hôtel"),
 row(7,"2026-10-01",900,"Virements internes","Virement interne"),row(8,"2026-10-01",800,"Entrées d’argent","Cashback",true),
 row(9,"2026-10-01",-40,"Logement","Taxe foncière")
],"synthetic.xls","test");
it("uses the web rules for hidden/internal transfers, manual income and rent comparisons",()=>{
 const result=buildMobilePilote(snapshot,{...options,views:[...options.views]},new Date("2026-10-13"));
 expect(result.summary).toMatchObject({income:1250,expenses:1704,balance:-454});
 expect(result.families.find(f=>f.id==='rent')).toMatchObject({moroccoIncome:300,withoutMoroccoBalance:-754});
 expect(result.families.find(f=>f.id==='rent')!.incomeRows.some(r=>r.name==='Loyer Maroc')).toBe(true);
 expect(result.travel).toMatchObject({scope:'year',year:'2026',total:650});
 expect(result.travel.entries.find(e=>e.id==='TR')?.amount).toBe(50);
 expect(result.travel.entries.find(e=>e.id==='TR')?.posts).toEqual([{name:'Hôtel',amount:50}]);
});
it("supports combined views and annual totals without duplicate expenses",()=>{
 const result=buildMobilePilote(snapshot,{...options,views:['essential','secondary'],period:'2026'},new Date("2026-10-13"));
 expect(result.summary).toMatchObject({income:1550,expenses:1744,balance:-194});
 expect(result.families.find(f=>f.id==='rent')?.moroccoIncome).toBe(600);
});
it("returns an honest empty response when no export or requested period exists",()=>{
 const result=buildMobilePilote(null,{...options,views:[]},new Date("2026-10-13"));
 expect(result.summary).toBeNull();expect(result.months).toEqual([]);expect(result.travel.total).toBe(0);
 expect(buildMobilePilote(snapshot,{...options,views:[],period:'2024-01'}).summary).toBeNull();
});
it("exposes matching daily coverage for selected views and stops at today in Paris",()=>{
 const result=buildMobilePilote(snapshot,{...options,views:['essential'],period:'2026-10'},new Date('2026-10-13T12:00:00Z'));
 expect(result.dailyCoverage).toMatchObject({month:'2026-10',daysInMonth:31,firstDeficit:{day:1,balance:-454}});
 expect(result.dailyCoverage?.points).toHaveLength(13);
 expect(result.dailyCoverage?.points.at(-1)).toMatchObject({income:1250,expenses:1704,balance:-454});
 const combined=buildMobilePilote(snapshot,{...options,views:['essential','travel'],period:'2026-10'},new Date('2026-10-13T12:00:00Z'));
 expect(combined.dailyCoverage?.points.at(-1)?.expenses).toBe(1854);
 expect(buildMobilePilote(snapshot,{...options,views:['essential'],period:'2026'},new Date('2026-10-13')).dailyCoverage).toBeNull();
 expect(buildMobilePilote({...snapshot,rows:undefined},{...options,views:['essential']},new Date('2026-10-13')).dailyCoverage).toBeNull();
});
