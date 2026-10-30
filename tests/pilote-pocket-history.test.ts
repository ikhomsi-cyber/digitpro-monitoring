import {expect,it} from 'vitest';
import {buildPilotePocketHistory,filterPilotePocketHistoryYears} from '@/lib/pilote-pocket-history';
import {buildBankinPiloteSnapshot,filterPiloteIncome,addPiloteMoroccoRent,filterPiloteExpenses} from '@/lib/pilote';
const rows=[['2025-11-05',-100,'Alimentation','Courses'],['2025-11-05',-50,'Divers','Dons'],['2025-11-05',200,'Loyers','Loyer'],['2026-01-05',-800,'Alimentation','Courses'],['2026-11-05',-999,'Alimentation','Courses']].map(([date,amount,parent,sub],i)=>({sourceRow:i+2,date:String(date),amount:Number(amount),parentCategory:String(parent),subCategory:String(sub),hidden:false}));
it('uses every imported month, all shared compensations and the same signed balance as the hero',()=>{
 const months=buildBankinPiloteSnapshot(rows,'synthetic.xlsx','fixture').months.map(filterPiloteIncome).map(addPiloteMoroccoRent);
 const points=buildPilotePocketHistory(months,['essential','secondary'],'2026-10-30');
 expect(points.map(p=>p.month)).toEqual(['2025-11','2025-12','2026-01']);
 expect(points[0].balance).toBe(filterPiloteExpenses(months[0],['essential','secondary']).balance);
 expect(points[0].balance).toBe(350);expect(points[1].balance).toBeNull();expect(points[2].balance).toBe(-500);
 expect(buildPilotePocketHistory(months,['essential'],'2026-10-30')[0].balance).toBe(400);
 expect(buildPilotePocketHistory([],['essential'],'2026-10-30')).toEqual([]);
});

it('selects inclusive year boundaries, supports one year and retains missing months',()=>{
 const points=[{month:'2023-12',balance:1},{month:'2024-01',balance:null},{month:'2024-12',balance:2},{month:'2025-01',balance:3}];
 expect(filterPilotePocketHistoryYears(points,'2024','2024')).toEqual(points.slice(1,3));
 expect(filterPilotePocketHistoryYears(points,'2025','2024')).toEqual(points.slice(1));
});
