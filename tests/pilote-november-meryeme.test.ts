import {it,expect} from 'vitest';
import {buildBankinPiloteSnapshot,piloteSnapshotMonths,filterPiloteIncome,buildPiloteCompensations,buildPiloteYear,type BankinPiloteRow} from '@/lib/pilote';
it('includes the confirmed November 400 Extra as Meryeme once, even with other Extra income',()=>{
 const rows:BankinPiloteRow[]=[{sourceRow:2,date:'2026-11-02',amount:400,parentCategory:'Entrées',subCategory:'Extra',hidden:false},{sourceRow:3,date:'2026-11-03',amount:20,parentCategory:'Entrées',subCategory:'Extra',hidden:false},{sourceRow:4,date:'2026-11-03',amount:-100,parentCategory:'Alimentation',subCategory:'Courses',hidden:false}];
 const snapshot=buildBankinPiloteSnapshot(rows,'synthetic','hash'),months=piloteSnapshotMonths(snapshot).map(filterPiloteIncome),month=months[0];
 expect(month.income).toBe(400);expect(month.balance).toBe(300);expect(buildPiloteCompensations(month).find(f=>f.id==='food')).toMatchObject({income:400,expenses:100,balance:300});
 const annual=buildPiloteYear(months,'2026')!;expect(buildPiloteCompensations(annual,months).find(f=>f.id==='food')?.income).toBe(400);
 expect(filterPiloteIncome(month)).toEqual(month);expect(rows[0].subCategory).toBe('Extra');
});
it('does not include unrelated Extra amounts or the same amount in another month',()=>{
 const rows:BankinPiloteRow[]=[{sourceRow:2,date:'2026-12-02',amount:400,parentCategory:'Entrées',subCategory:'Extra',hidden:false},{sourceRow:3,date:'2026-11-03',amount:401,parentCategory:'Entrées',subCategory:'Extra',hidden:false}];
 const months=piloteSnapshotMonths(buildBankinPiloteSnapshot(rows,'synthetic','hash')).map(filterPiloteIncome);expect(months.every(month=>month.income===0)).toBe(true);
});
