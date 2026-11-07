import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyBriefSummary, DailyBriefActions } from '@/components/dashboard/DailyBriefSummary';
import { buildBriefActivity } from '@/lib/daily-brief-activity';
import type { BriefItem } from '@/lib/daily-financial-brief';
const date='2026-11-07';
const activity={...buildBriefActivity({date,transactions:[],settings:null,invoices:[],cash:1000}),workedMonth:5,plannedMonth:15,generatedRevenueHt:12000,yearRevenueHt:11000,yearExpensesHt:2000,
 nextInvoice:{kind:'issued' as const,amountHt:1000,invoiceAmountHt:1000,reference:'FIXTURE-01',issuedDate:'2026-11-01',dueDate:'2026-11-30',days:null},
 treasury:{availableTransferNow:0,availableTransferAfterInvoice:500,cash:1000,debt172:1700,shortfall:700,projectedShortfall:0,projectedMargin:500}};
describe('daily brief lot 1 presentation',()=>{
 it('separates monthly days from annual amounts and preserves all input calculations',()=>{
  const original=JSON.stringify(activity);
  const html=renderToStaticMarkup(createElement(DailyBriefSummary,{activity,date}));
  expect(html).toContain('Ce mois-ci · novembre 2026');expect(html).toContain('Depuis janvier · arrêté au 7 novembre 2026');
  expect(html).toContain('5 j réalisés · 15 j encore planifiés');
  expect(html).toContain('Disponible théorique à verser aujourd’hui');
  expect(html).toContain('700');expect(html).toContain('500');expect(html).toContain('FIXTURE-01');
  expect(html.match(/FIXTURE-01/g)).toHaveLength(1);
  expect(html).not.toContain('ce montant n’est pas disponible aujourd’hui');expect(JSON.stringify(activity)).toBe(original);
 });
 it('keeps missing treasury distinct from zero and does not invent an invoice',()=>{
  const html=renderToStaticMarkup(createElement(DailyBriefSummary,{activity:null,date}));
  expect(html).toContain('données de trésorerie incomplètes');expect(html).not.toContain('Scénario après');expect(html).not.toContain('Réserve couverte aujourd’hui');
 });
 it('uses actionable links while preserving their destination and explanation',()=>{
  const items:BriefItem[]=[{id:'invoice-followup',scope:'pro',priority:'action',title:'Suivre le prochain encaissement',detail:'Explication synthétique',href:'/dashboard?section=activite',when:'Aujourd’hui'}, {id:'foyer-Transport',scope:'foyer',priority:'attention',title:'Transport : un point à regarder',detail:'Autre explication',href:'/dashboard?section=pilote',when:'Cette semaine'}];
  const html=renderToStaticMarkup(createElement(DailyBriefActions,{items,onNavigate:()=>{}}));
  expect(html).toContain('Voir la facture attendue');expect(html).toContain('Examiner les dépenses : Transport');expect(html).toContain('/dashboard?section=activite');expect(html).toContain('Explication synthétique');
 });
});
