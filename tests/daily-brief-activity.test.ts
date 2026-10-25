import { expect, it, vi } from "vitest";
vi.mock("@/lib/dashboard-hero-stats",()=>({computeDashboardHeroStats:()=>({csgComparaison172Eur:1000,detteTvaDepuisDebutEur:200,detteTotaleDepuisDebutEur:800,detteCsgDepuisDebutEur:600,soldeQontoEur:500})}));
import { buildBriefActivity, previousYearCutoff } from "@/lib/daily-brief-activity";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
const tx=(id:string,date:string,amount:number):DashboardTx=>({id,date,amount,category:"Chiffre d’affaires",label:"synthetic",company:"synthetic",scope:"pro"});
const invoice:HiwayInvoice={id:"fixture",date:"2026-10-01",dueDate:"2026-10-30",amountEur:1000,amountKind:"HT",client:"Synthetic",billedDays:1,tjmHtEur:1000,subject:"Synthetic"};
const settings={days:["2026-01-02","2026-10-01","2026-10-26","2026-10-26"],tjm:1000,rates:[]};
it("separates realized days from future planning and compares cash revenue at the same prior-year cutoff",()=>{
 const report=buildBriefActivity({date:"2026-10-24",transactions:[tx("1","2026-10-02",2400),tx("2","2025-10-02",1200),tx("3","2025-11-01",12000)],settings,invoices:[],cash:null});
 expect(report.workedMonth).toBe(1);expect(report.plannedMonth).toBe(1);expect(report.workedYear).toBe(2);
 expect(report.yearRevenueHt).toBe(2000);expect(report.previousYearRevenueHt).toBe(1000);expect(report.yearChangePercent).toBe(100);
 expect(report.nextInvoice).toBeNull();
 expect(report.generatedRevenueHt).toBe(2000);
});
it("does not double reserve CSG on an issued invoice and includes incremental VAT in cash projection",()=>{
 const report=buildBriefActivity({date:"2026-10-24",transactions:[],settings:null,invoices:[invoice],cash:500});
 expect(report.treasury).toMatchObject({debt172:1372,shortfall:872,projectedShortfall:0,projectedMargin:128});
 expect(report.nextInvoice).toMatchObject({kind:"issued",amountHt:1000,dueDate:"2026-10-30"});
});
it("does not count a settled invoice as a future cash receipt",()=>{
 const report=buildBriefActivity({date:"2026-10-24",transactions:[tx("receipt","2026-10-03",1200)],settings,invoices:[invoice],cash:500});
 expect(report.nextInvoice).toBeNull();expect(report.treasury?.projectedShortfall).toBeNull();
});
it("never claims that missing data secures cash and does not invent unknown invoice values",()=>{
 const report=buildBriefActivity({date:"2026-10-24",transactions:[],settings,invoices:null,cash:500});expect(report.treasury).toBeNull();expect(report.nextInvoice).toBeNull();
 expect(buildBriefActivity({date:"2026-10-24",transactions:[],settings,invoices:[{...invoice,amountKind:"inconnu"}],cash:500}).nextInvoice).toBeNull();
 expect(buildBriefActivity({date:"2026-10-24",transactions:[],settings,invoices:[{...invoice,amountKind:"inconnu"}],cash:500}).treasury).toBeNull();
 expect(previousYearCutoff("2024-02-29")).toBe("2023-02-28");
});
it("compares generated and cashed CA separately while excluding future work",()=>{
 const work={days:["2026-01-02","2026-10-20","2026-10-26","2025-01-02","2025-10-20","2025-11-01"],tjm:940,rates:[{clientName:"Synthetic",startDate:"2025-01-01",endDate:"2025-12-31",tjmHt:820},{clientName:"Synthetic",startDate:"2026-01-01",endDate:null,tjmHt:940}]};
 const report=buildBriefActivity({date:"2026-10-25",transactions:[tx("cash","2026-10-01",1200)],settings:work,invoices:[],cash:500});
 expect(report.generatedRevenueHt).toBe(1880);expect(report.yearRevenueHt).toBe(1000);expect(report.history[1]).toMatchObject({year:2025,generatedHt:1640,workedDays:2});expect(report.generatedChangePercent).toBeCloseTo(14.63);expect(report.nextInvoice).toBeNull();expect(report.treasury?.projectedMargin).toBeNull();
});
it("keeps generated historical CA unknown when no applicable historical rate exists",()=>{
 const report=buildBriefActivity({date:"2026-10-25",transactions:[],settings:{days:["2025-10-01"],tjm:940,rates:[]},invoices:[],cash:null});expect(report.history[1].generatedHt).toBeNull();expect(report.generatedChangePercent).toBeNull();
});
it("uses the remaining amount on the Gmail invoice after a partial receipt",()=>{
 expect(buildBriefActivity({date:"2026-10-25",transactions:[tx("partial","2026-10-03",600)],settings,invoices:[invoice],cash:500}).nextInvoice).toMatchObject({kind:"issued",amountHt:500,dueDate:"2026-10-30"});
});
it("selects the next Gmail due date ahead of an old unmatched balance",()=>{
 const old={...invoice,id:"old",date:"2026-08-01",dueDate:"2026-08-31",amountEur:19000,subject:"Facture F8001"};
 const upcoming={...invoice,id:"next",date:"2026-09-28",dueDate:"2026-10-31",amountEur:22000,subject:"Facture F8002"};
 const report=buildBriefActivity({date:"2026-10-25",transactions:[],settings:null,invoices:[old,upcoming],cash:500});
 expect(report.nextInvoice).toMatchObject({reference:"F8002",amountHt:22000,invoiceAmountHt:22000,dueDate:"2026-10-31"});
});
it("retains the original Gmail invoice amount while projecting only its unpaid balance",()=>{
 const report=buildBriefActivity({date:"2026-10-25",transactions:[tx("partial","2026-10-03",600)],settings:null,invoices:[invoice],cash:500});
 expect(report.nextInvoice).toMatchObject({amountHt:500,invoiceAmountHt:1000});
});
it("projects the entire Gmail invoice rather than a matching residual",()=>{
 const report=buildBriefActivity({date:"2026-10-25",transactions:[tx("partial","2026-10-03",600)],settings:null,invoices:[invoice],cash:500});
 // Debt: 1000 + 200 + 86 on the unmatched half. Receipt: 1200, extra VAT 200 and CSG 86 on the other half.
 expect(report.treasury?.projectedMargin).toBe(128);
});
it("calculates personal-transfer capacity after reserves and never advances an unpaid invoice",()=>{
 const report=buildBriefActivity({date:"2026-10-25",transactions:[],settings:null,invoices:[invoice],cash:500});
 expect(report.treasury?.availableTransferNow).toBe(0);expect(report.treasury?.availableTransferAfterInvoice).toBe(128);
 const covered=buildBriefActivity({date:"2026-10-25",transactions:[],settings:null,invoices:[],cash:2000});
 expect(covered.treasury?.availableTransferNow).toBe(800);expect(covered.treasury?.availableTransferAfterInvoice).toBeNull();
 expect(buildBriefActivity({date:"2026-10-25",transactions:[],settings:null,invoices:[],cash:null}).treasury).toBeNull();
});
it("compares professional expenses over identical year-to-date periods, excluding future and personal rows",()=>{
 const expense=(id:string,date:string,amount:number):DashboardTx=>({...tx(id,date,amount),category:"Logiciels"});
 const transactions=[expense("a","2026-01-03",-100),expense("b","2026-10-20",-50),expense("c","2025-10-20",-100),expense("future","2025-11-01",-1000),expense("later","2026-10-26",-1000),{...expense("private","2026-10-10",-900),scope:"personal" as const},{...expense("bnc","2026-10-11",-2000),category:"BNC",label:"BNC"},{...expense("vat","2026-10-11",-2000),category:"TVA",label:"DGFIP TVA"}];
 const report=buildBriefActivity({date:"2026-10-25",transactions,settings:null,invoices:[],cash:null});
 expect(report.yearExpensesHt).toBe(125);expect(report.previousYearExpensesHt).toBe(83.33);expect(report.expenseChangePercent).toBe(50.01);expect(report.history[1].expensesHt).toBe(83.33);
});
it("distinguishes missing previous-year expense history from zero expenses",()=>{
 const report=buildBriefActivity({date:"2026-10-25",transactions:[{...tx("expense","2026-10-10",-100),category:"Logiciels"}],settings:null,invoices:[],cash:null});
 expect(report.previousYearExpensesHt).toBeNull();expect(report.expenseChangePercent).toBeNull();
});
it("reconstructs historical days and HT revenue from Gmail invoices without duplicating calendar months",()=>{
 const historic={...invoice,id:"historic",date:"2025-09-30",amountEur:9840,billedDays:12,tjmHtEur:820};
 const report=buildBriefActivity({date:"2026-10-25",transactions:[],settings:{days:["2025-09-01","2025-10-01"],tjm:940,rates:[{clientName:"Synthetic",startDate:"2025-01-01",endDate:"2025-12-31",tjmHt:820}]},invoices:[historic,historic,{...historic,id:"future",date:"2025-10-26"}],cash:null});
 expect(report.history[1]).toMatchObject({generatedHt:10660,workedDays:13,invoiceDays:12,invoiceCount:1,historySource:"mixed"});
});
it("infers days only with a known invoice TJM, converts TTC and preserves unknown quantities",()=>{
 const historic={...invoice,id:"historic",date:"2025-09-30",amountEur:9840,amountKind:"TTC" as const,billedDays:null,tjmHtEur:820};
 const report=buildBriefActivity({date:"2026-10-25",transactions:[],settings:null,invoices:[historic],cash:null});
 expect(report.history[1]).toMatchObject({generatedHt:8200,workedDays:10,invoiceDays:10,invoiceEstimatedDays:10,historySource:"gmail"});
 const unknown=buildBriefActivity({date:"2026-10-25",transactions:[],settings:null,invoices:[{...historic,tjmHtEur:null}],cash:null});
 expect(unknown.history[1]).toMatchObject({generatedHt:8200,workedDays:null,invoiceDays:null});
});
it("does not invent historical activity from unknown invoice amounts",()=>{
 const report=buildBriefActivity({date:"2026-10-25",transactions:[],settings:null,invoices:[{...invoice,date:"2025-09-30",amountKind:"inconnu"}],cash:null});
 expect(report.history[1].generatedHt).toBeNull();expect(report.history[1].workedDays).toBeNull();
});
