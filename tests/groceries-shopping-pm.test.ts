import { describe, expect, it } from 'vitest';
import { groceryShoppingSuggestions, parisGroceryDay } from '@/lib/groceries/shopping-suggestions';
import type { GroceryOrder } from '@/lib/groceries/parser';
const order=(date:string,ref=date,quantity=2,merchant='Carrefour'):GroceryOrder=>({merchant,orderRef:ref,date,totalCents:400,items:[{name:'Produit de test',productKey:'fixture-product',quantity,unitPriceCents:200,totalCents:quantity*200}]});
describe('PM — acceptance of Carrefour shopping suggestions',()=>{
 it('suggests recurring purchases due today with a reproducible historical price and quantity',()=>{
  const report=groceryShoppingSuggestions([order('2026-10-06'),order('2026-10-13'),order('2026-10-20')],'2026-10-27');
  expect(report.suggestions).toHaveLength(1);
  expect(report.suggestions[0]).toMatchObject({intervalDays:7,daysSincePurchase:7,quantity:2,historicalUnitPriceCents:200,confidence:'regular'});
 });
 it('does not suggest the same product just bought again',()=>{
  expect(groceryShoppingSuggestions([order('2026-10-06'),order('2026-10-13'),order('2026-10-26')],'2026-10-27').suggestions).toEqual([]);
 });
 it('does not invent a cadence from duplicate emails or same-day purchases',()=>{
  const report=groceryShoppingSuggestions([order('2026-10-13'),order('2026-10-13'),order('2026-10-13','second-order')],'2026-10-27');
  expect(report.recurringProducts).toBe(0);expect(report.suggestions).toEqual([]);
 });
 it('ignores other merchants, future dates, invalid dates and quantities',()=>{
  const report=groceryShoppingSuggestions([order('2026-10-06'),order('2026-10-13'),order('2026-10-28'),order('2026-02-30'),order('2026-10-25','invalid',NaN),order('2026-10-26','other',2,'Auchan')],'2026-10-27');
  expect(report.suggestions[0]).toMatchObject({lastPurchase:'2026-10-13',intervalDays:7,purchaseDates:2});
 });
 it('uses the Paris calendar date across midnight and the daylight-saving boundary',()=>{
  expect(parisGroceryDay(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25');
  expect(parisGroceryDay(new Date('2026-10-26T23:30:00Z'))).toBe('2026-10-27');
 });
});
