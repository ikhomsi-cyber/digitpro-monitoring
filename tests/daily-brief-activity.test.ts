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
 expect(report.nextInvoice).toMatchObject({kind:"estimate",days:2,amountHt:2000,dueDate:null});
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
