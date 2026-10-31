import {expect,it} from 'vitest';
import {bankinBalanceHistory} from '@/lib/gmail/bankin-balance-history';
it('sums bank accounts on complete dates before calculating the annual minimum',()=>{
 const rows=[{account:'Fortuneo · Courant',date:'2025-01-01',balance:100},{account:'Fortuneo · Livret',date:'2025-01-01',balance:900},{account:'Fortuneo · Courant',date:'2025-02-01',balance:800},{account:'Fortuneo · Livret',date:'2025-02-01',balance:100},{account:'Fortuneo · Courant',date:'2025-03-01',balance:1}];
 const bank=bankinBalanceHistory(rows)[0];expect(bank.history).toHaveLength(2);expect(bank.annual).toEqual([{year:'2025',minimum:900,zaka:22.5,observations:2}]);
});
it('keeps years separate and never produces negative ZAKA',()=>{
 expect(bankinBalanceHistory([{account:'Fortuneo',date:'2025-01-01',balance:-100},{account:'Fortuneo',date:'2026-01-01',balance:2000}])[0].annual.map(p=>p.zaka)).toEqual([0,50]);
});

it("excludes all other banks from history and ZAKA",()=>{expect(bankinBalanceHistory([{account:"Autre banque · Courant",date:"2026-01-01",balance:50000}])).toEqual([]);});
