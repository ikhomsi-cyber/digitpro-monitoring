import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PilotePocketSummary } from "@/components/dashboard/PilotePocketSummary";
import type { PiloteCompensation } from "@/lib/pilote";
const family=(id:"food"|"ndf",expenses:number,income:number):PiloteCompensation=>({id,name:id,source:"Synthetic",target:"Synthetic",expenses,income,balance:income-expenses,covered:Math.min(expenses,income),incomeNames:[],expenseNames:[]});
it("uses an NDF surplus to cover food",()=>{
 const text=renderToStaticMarkup(createElement(PilotePocketSummary,{families:[family("food",1000,600),family("ndf",100,1000)]})).replace(/<[^>]*>/g,"");
 expect(text).toContain("De votre poche");expect(text).toMatch(/0(?:,00)?\s*€/);expect(text).toMatch(/1[\s\u202f]100(?:,00)?\s*€ compensés/);expect(text).not.toContain("Solde négatif");
});
it("keeps the remaining expense at zero when all families are covered",()=>{
 const text=renderToStaticMarkup(createElement(PilotePocketSummary,{families:[family("food",100,150)]})).replace(/<[^>]*>/g,"");expect(text).toMatch(/0(?:,00)?\s*€/);expect(text).not.toContain("Ce qui reste à financer");
});

it("shows the household deficit as a negative red amount in the page header",()=>{
 const html=renderToStaticMarkup(createElement(PilotePocketSummary,{hero:true,families:[family("food",1000,600)]}));
 expect(html).toContain("text-red-600");expect(html.replace(/<[^>]*>/g,"")).toMatch(/-400(?:,00)?\s*€/);expect(html).toContain("De votre poche");
});
it("keeps the header concise while preserving the period and compensated balance",()=>{
 const text=renderToStaticMarkup(createElement(PilotePocketSummary,{hero:true,asOf:"2026-10-25",periodLabel:"Octobre 2026",families:[family("food",1000,600)]})).replace(/<[^>]*>/g,"");
 expect(text).toContain("De votre poche");expect(text).toContain("Octobre 2026");expect(text).toMatch(/-400(?:,00)?\s*€/);expect(text).not.toContain("de rentrées");expect(text).not.toContain("25/10/2026");expect(text).not.toContain("Toutes les compensations sont réunies");
});

it("does not display zero as a funded amount when dated history is unavailable",()=>{
 const text=renderToStaticMarkup(createElement(PilotePocketSummary,{hero:true,unavailable:true,families:[]})).replace(/<[^>]*>/g,"");
 expect(text).toContain("Indisponible");expect(text).not.toMatch(/0(?:,00)?\s*€/);
});

it("aligns the header with the global balance using every compensation",()=>{
 const html=renderToStaticMarkup(createElement(PilotePocketSummary,{hero:true,globalBalance:-279,families:[family("food",1000,269),family("ndf",100,552)]}));
 const text=html.replace(/<[^>]*>/g,"");
 expect(text).toMatch(/-279(?:,00)?\s*€/);expect(text).not.toMatch(/-731(?:,00)?\s*€/);
});
it("shows a positive global surplus instead of a fictitious personal deficit",()=>{
 const text=renderToStaticMarkup(createElement(PilotePocketSummary,{hero:true,families:[family("food",1000,600),family("ndf",100,1000)]})).replace(/<[^>]*>/g,"");
 expect(text).toContain("Excédent");expect(text).toMatch(/500(?:,00)?\s*€/);
});
