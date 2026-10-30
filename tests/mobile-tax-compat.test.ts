import {expect,it} from 'vitest';
import {buildBankinPiloteSnapshot,filterPiloteExpenses} from '@/lib/pilote';
import {buildMobilePilote} from '@/lib/mobile/pilote';
it('preserves the native v1 secondary view while supporting an explicit tax view',()=>{
 const source=buildBankinPiloteSnapshot([
  {sourceRow:2,date:'2026-10-01',amount:-100,parentCategory:'Impôts',subCategory:'IR',hidden:false},
  {sourceRow:3,date:'2026-10-01',amount:-40,parentCategory:'Achats',subCategory:'Autres',hidden:false},
 ],'synthetic.xlsx','fixture');
 expect(filterPiloteExpenses(source.months[0],['secondary']).expenses).toBe(40);
 const legacy=buildMobilePilote(source,{views:['secondary'],travelScope:'year'},new Date('2026-10-30T12:00:00Z'));
 expect(legacy.summary?.expenses).toBe(140);expect(legacy.views).toEqual(['secondary']);
 expect(buildMobilePilote(source,{views:['taxes'],travelScope:'year'},new Date('2026-10-30T12:00:00Z')).summary?.expenses).toBe(100);
});
