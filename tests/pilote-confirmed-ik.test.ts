import {expect,it} from 'vitest';
import {buildPiloteMonths,filterPiloteReportRows,type BankinPiloteRow} from '@/lib/pilote';
const row=(sourceRow:number,date='2026-11-03',amount=493):BankinPiloteRow=>({sourceRow,date,amount,parentCategory:'Revenus',subCategory:'DigitPro IK',hidden:false});
it('counts the owner-confirmed November IK pair once without changing the source',()=>{
 const rows=[row(2),row(3,'2026-11-04')];
 expect(buildPiloteMonths(rows)[0].income).toBe(493);
 expect(filterPiloteReportRows(rows)).toHaveLength(1);
 expect(rows).toHaveLength(2);
 expect(buildPiloteMonths(filterPiloteReportRows(rows))[0].income).toBe(493);
});
it('keeps other amounts, months, categories and ambiguous occurrences',()=>{
 expect(filterPiloteReportRows([row(2),row(3),row(4)])).toHaveLength(3);
 expect(filterPiloteReportRows([row(2,'2026-10-03'),row(3,'2026-10-04')])).toHaveLength(2);
 expect(filterPiloteReportRows([row(2,undefined,494),row(3,undefined,494)])).toHaveLength(2);
 expect(filterPiloteReportRows([row(2),{...row(3),subCategory:'DigitPro NDF'}])).toHaveLength(2);
});

it('counts the confirmed November NDF pair once alongside the IK correction',()=>{
 const ndf=(sourceRow:number,date:string):BankinPiloteRow=>({...row(sourceRow,date,410.03),subCategory:'DigitPro NDF'});
 const rows=[row(2),row(3,'2026-11-04'),ndf(4,'2026-11-03'),ndf(5,'2026-11-04')];
 expect(buildPiloteMonths(rows)[0].income).toBe(903.03);
 expect(filterPiloteReportRows(rows)).toHaveLength(2);
 expect(rows).toHaveLength(4);
 expect(filterPiloteReportRows([ndf(2,'2026-10-03'),ndf(3,'2026-10-04')])).toHaveLength(2);
 expect(filterPiloteReportRows([ndf(2,'2026-11-03'),ndf(3,'2026-11-04'),ndf(4,'2026-11-05')])).toHaveLength(3);
});
