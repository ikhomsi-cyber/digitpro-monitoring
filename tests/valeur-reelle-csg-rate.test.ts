import { expect, it } from 'vitest';
import { analyzeValeurReelle, computeCsgEurForCaFacture } from '@/lib/valeur-reelle-analyze';
import { computeValeurReelleDailyBreakdown } from '@/lib/valeur-reelle-daily-value';
import { buildTrailingGainPerWorkDayPoints } from '@/lib/valeur-reelle-gain-per-day';
import type { DashboardTx } from '@/lib/dashboard-metrics';
const transactions: DashboardTx[] = [{ id:'synthetic-revenue',date:'2026-09-10',label:'Client',category:'Chiffre d’affaires',amount:12000,company:'Qonto',scope:'pro' }];
it('recalculates CSG, daily retained value and historical chart for both scenarios', () => {
 const now = new Date(2026,9,21);
 const results = ([0.097,0.172] as const).map(csgRate => {
  const tree = analyzeValeurReelle(transactions,{month:'2026-09',years:null,now,csgRate}).cashTree;
  expect(tree.csgEur).toBe(Math.round(10000*csgRate*100)/100);
  expect(computeCsgEurForCaFacture(20000,0,0,tree)).toBe(Math.round(20000*csgRate*100)/100);
  const daily=computeValeurReelleDailyBreakdown({tree,tjmHt:1000,billableDays:10});
  expect(daily.csgPerDay).toBe(1000*csgRate);
  return {daily,points:buildTrailingGainPerWorkDayPoints(transactions,new Set(),'2026-09',1,now,[],1000,csgRate)};
 });
 expect(results[0].daily.netPerDay-results[1].daily.netPerDay).toBe(75);
 expect(results[0].points[0].gainPerDayEur).toBeGreaterThan(results[1].points[0].gainPerDayEur);
});
