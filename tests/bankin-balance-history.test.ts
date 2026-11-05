import {expect,it} from 'vitest';
import {bankinBalanceHistory,historicalFortuneoPoints} from '@/lib/gmail/bankin-balance-history';
it('sums bank accounts on complete dates before calculating the annual minimum',()=>{
 const rows=[{account:'Fortuneo · Courant',date:'2025-01-01',balance:100},{account:'Fortuneo · Livret',date:'2025-01-01',balance:900},{account:'Fortuneo · Courant',date:'2025-02-01',balance:800},{account:'Fortuneo · Livret',date:'2025-02-01',balance:100},{account:'Fortuneo · Courant',date:'2025-03-01',balance:1}];
 const bank=bankinBalanceHistory(rows)[0];expect(bank.history).toHaveLength(2);expect(bank.annual).toEqual([{year:'2025',minimum:900,zaka:22.5,observations:2}]);
});
it('keeps years separate and never produces negative ZAKA',()=>{
 expect(bankinBalanceHistory([{account:'Fortuneo',date:'2025-01-01',balance:-100},{account:'Fortuneo',date:'2026-01-01',balance:2000}])[0].annual.map(p=>p.zaka)).toEqual([0,50]);
});

it("excludes all other banks from history and ZAKA",()=>{expect(bankinBalanceHistory([{account:"Autre banque · Courant",date:"2026-01-01",balance:50000}])).toEqual([]);});

it('compares complete email snapshots without requiring accounts that opened in later years',()=>{
 const result=bankinBalanceHistory([{account:'Fortuneo · Ancien',date:'2025-01-01',balance:1000,observedAt:1},{account:'Fortuneo · Nouveau',date:'2026-01-01',balance:2000,observedAt:2}])[0];expect(result.history).toHaveLength(2);expect(result.annual.map(row=>row.minimum)).toEqual([1000,2000]);
});
it('does not mix balances from two different same-day email snapshots',()=>{
 const result=bankinBalanceHistory([{account:'Fortuneo · A',date:'2026-01-01',balance:100,observedAt:1},{account:'Fortuneo · B',date:'2026-01-01',balance:200,observedAt:2}])[0];expect(result.history[0].balance).toBe(200);
});

it('calculates zakat only on original Fortuneo accounts before filtering years',()=>{
 const points=[{account:'Fortuneo · Original',date:'2019-01-01',balance:1000,observedAt:1},{account:'Fortuneo · Original',date:'2026-02-01',balance:4000,observedAt:2},{account:'Fortuneo · Added',date:'2026-02-01',balance:60000,observedAt:2}];
 const selected=historicalFortuneoPoints(points).filter(p=>p.date.startsWith('2026'));
 expect(bankinBalanceHistory(selected)[0].annual).toEqual([{year:'2026',minimum:4000,zaka:100,observations:1}]);
 expect(bankinBalanceHistory(points)[0].history.at(-1)?.balance).toBe(64000);
 expect(historicalFortuneoPoints([])).toEqual([]);
});
