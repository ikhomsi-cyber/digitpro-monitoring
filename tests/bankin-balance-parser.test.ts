import {expect,it} from 'vitest';
import {parseBankinBalanceEmail,mergeBankinBalancePoints} from '@/lib/gmail/bankin-balance-parser';
it('recognizes the Balance quotidienne HTML structure without mixing totals, banks or promotions',()=>{
 const body='<table><tr><td>Banque A</td></tr><tr><td>Courant</td></tr><tr><td>&nbsp;</td></tr><tr><td>1 234,56 €</td></tr><tr><td>Consulter ce compte</td></tr><tr><td>Banque B</td></tr><tr><td>Courant</td></tr><tr><td>-20,50 €</td></tr></table>';
 const result=parseBankinBalanceEmail({subject:'Balance quotidienne',body,date:'2026-10-31',html:true});
 expect(result).toEqual([{account:'Banque A · Courant',date:'2026-10-31',balance:1234.56},{account:'Banque B · Courant',date:'2026-10-31',balance:-20.5}]);
 expect(parseBankinBalanceEmail({subject:'Cashback soldes d’hiver',body,date:'2026-10-31',html:true})).toEqual([]);
});
it('keeps the latest observation per account/day independent of pagination order',()=>{
 const point={account:'A',date:'2026-01-01',balance:10,observedAt:10};
 expect(mergeBankinBalancePoints([point,{...point,balance:20,observedAt:20},point])).toEqual([{...point,balance:20,observedAt:20}]);
});
