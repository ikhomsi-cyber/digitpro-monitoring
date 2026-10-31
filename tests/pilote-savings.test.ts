import {expect,it} from 'vitest';
import {buildBankinPiloteSnapshot,filterPiloteExpenses,filterPiloteReportRows,piloteExpenseView} from '@/lib/pilote';
import {buildPiloteDaily,cumulativePiloteDays} from '@/lib/bankin/pilote-daily';
const row=(sourceRow:number,date:string,amount:number,subCategory:string,parentCategory='Banque')=>({sourceRow,date,amount,subCategory,parentCategory,hidden:false});
it('isolates the two confirmed PER payments and property purchases from taxes and essential spending',()=>{
 const source=[row(2,'2024-11-12',-30000,'Epargne'),row(3,'2026-09-07',-30000,'Epargne'),row(4,'2026-09-07',-20,'Frais bancaires')];
 const snapshot=buildBankinPiloteSnapshot(source,'synthetic.xlsx','fixture');
 expect(snapshot.months.reduce((sum,m)=>sum+filterPiloteExpenses(m,'savings').expenses,0)).toBe(60000);
 expect(snapshot.months[0].categories[0].children[0].name).toBe('PER');
 for(const sub of ['PER individuel','Appart Argenteuil','Maison Casa'])expect(piloteExpenseView('Logement',sub)).toBe('savings');
 expect(piloteExpenseView('Charges LMNP','Charges copro LMNP')).toBe('essential');
 expect(piloteExpenseView('Impôts & Taxes','Impôts sur le revenu')).toBe('taxes');
 const daily=buildPiloteDaily(snapshot)!;expect(cumulativePiloteDays(daily['2024-11'],['savings']).at(-1)?.expenses).toBe(30000);
});
it('excludes only a unique confirmed May MacBook reimbursement, preserving expenses and ambiguous candidates',()=>{
 const receipt=row(2,'2023-05-10',2950.25,'DigitPro NDF','Entrées');
 const cost=row(3,'2023-05-10',-2950.25,'NDF DigitPro','Loisirs');
 expect(filterPiloteReportRows([receipt,cost])).toEqual([cost]);
 expect(buildBankinPiloteSnapshot([receipt,cost],'synthetic.xlsx','fixture').months[0].income).toBe(0);
 expect(filterPiloteReportRows([receipt,{...receipt,sourceRow:4}])).toHaveLength(2);
 expect(filterPiloteReportRows([{...receipt,date:'2023-06-10'}])).toHaveLength(1);
});
