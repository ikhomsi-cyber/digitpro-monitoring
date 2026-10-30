import {expect,it} from "vitest";
import {buildBankinPiloteSnapshot,filterPiloteExpenses,piloteExpenseView} from "@/lib/pilote";
import {buildPiloteDaily,cumulativePiloteDays} from "@/lib/bankin/pilote-daily";
import {buildPiloteComparisonAtDate,buildPiloteMonthlyComparison,buildPiloteComparisonEvolution} from "@/lib/bankin/pilote-comparison";
const rows=[['Impôts & Taxes','Impôts sur le revenu',100],['Epargne','PER individuel',50],['Charges LMNP','Taxe foncière',25],['Alimentation','Courses',30],['Achats','Permis de conduire',40],['Voyage','Hôtel',60]].map(([parent,sub,amount],i)=>({sourceRow:i+2,date:'2026-10-05',amount:-Number(amount),parentCategory:String(parent),subCategory:String(sub),hidden:false}));
it("isolates taxes and PER without matching unrelated words or changing Bankin category names",()=>{
 const snapshot=buildBankinPiloteSnapshot(rows,'synthetic.xlsx','fixture');const month=snapshot.months[0];
 expect(filterPiloteExpenses(month,'taxes').expenses).toBe(175);expect(piloteExpenseView('Achats','Permis de conduire')).toBe('secondary');
 const views=['essential','secondary','taxes','travel'] as const;
 expect(views.reduce((sum,v)=>sum+filterPiloteExpenses(month,v).expenses,0)).toBe(month.expenses);
 expect(filterPiloteExpenses(month,['secondary','taxes','taxes']).expenses).toBe(215);
 const days=buildPiloteDaily(snapshot)!;expect(cumulativePiloteDays(days['2026-10'],['taxes']).at(-1)?.expenses).toBe(175);
 expect(month.categories.find(c=>c.name==='Epargne')?.children[0].name).toBe('PER individuel');
});
it("draws two consistent daily series on the same comparison window and respects filters",()=>{
 const source=buildBankinPiloteSnapshot([...rows,...rows.map(r=>({...r,sourceRow:r.sourceRow+100,date:'2026-09-05',amount:r.amount/2}))],'synthetic.xlsx','fixture');
 const atDate=buildPiloteComparisonAtDate(source,'2026-10-30');const comparison=buildPiloteMonthlyComparison(source.months,'2026-10',['taxes'],'2026-10-30',atDate);
 const daily=buildPiloteDaily(source)!;const points=buildPiloteComparisonEvolution(comparison,daily,['taxes'])!;
 expect(points).toHaveLength(30);expect(points[3]).toMatchObject({current:0,previous:0});expect(points.at(-1)).toMatchObject({current:175,previous:87.5});
 expect(buildPiloteComparisonEvolution(comparison,null,['taxes'])).toBeNull();
 expect(buildPiloteComparisonEvolution(comparison,daily,['essential'])).toBeNull();
});
it("does not invent a 31st day for a shorter month",()=>{
 const source=buildBankinPiloteSnapshot([
  {sourceRow:2,date:'2026-01-31',amount:-10,parentCategory:'Impôts',subCategory:'Impôt revenu',hidden:false},
  {sourceRow:3,date:'2026-02-28',amount:-20,parentCategory:'Impôts',subCategory:'Impôt revenu',hidden:false},
 ],'synthetic.xlsx','fixture');
 const comparison=buildPiloteMonthlyComparison(source.months,'2026-02',['taxes'],'2026-10-30');
 const series=buildPiloteComparisonEvolution(comparison,buildPiloteDaily(source),['taxes'])!;
 expect(series).toHaveLength(31);expect(series[27].current).toBe(20);expect(series[28].current).toBeNull();expect(series[30].previous).toBe(10);
});

it("moves only the explicitly confirmed savings payment to PER, preserving source rows and daily totals",()=>{
 const source=[{sourceRow:2,date:'2026-09-07',amount:-30000,parentCategory:'Banque',subCategory:'Epargne',hidden:false},{sourceRow:3,date:'2026-09-07',amount:-10,parentCategory:'Banque',subCategory:'Frais bancaires',hidden:false},{sourceRow:4,date:'2026-09-08',amount:-500,parentCategory:'Banque',subCategory:'Epargne',hidden:false}];
 const snapshot=buildBankinPiloteSnapshot(source,'synthetic.xlsx','fixture');
 expect(filterPiloteExpenses(snapshot.months[0],'taxes').expenses).toBe(30000);
 expect(filterPiloteExpenses(snapshot.months[0],'secondary').expenses).toBe(510);
 expect(source[0].subCategory).toBe('Epargne');
 const daily=buildPiloteDaily(snapshot)!;
 expect(cumulativePiloteDays(daily['2026-09'],['taxes']).at(-1)?.expenses).toBe(30000);
 expect(cumulativePiloteDays(daily['2026-09'],['secondary']).at(-1)?.expenses).toBe(510);
});
