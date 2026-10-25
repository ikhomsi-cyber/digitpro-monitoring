import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PilotePocketSummary } from "@/components/dashboard/PilotePocketSummary";
import type { PiloteCompensation } from "@/lib/pilote";
const family=(id:"food"|"ndf",expenses:number,income:number):PiloteCompensation=>({id,name:id,source:"Synthetic",target:"Synthetic",expenses,income,balance:income-expenses,covered:Math.min(expenses,income),incomeNames:[],expenseNames:[]});
it("shows the uncovered amount without transferring an NDF surplus to food",()=>{
 const text=renderToStaticMarkup(createElement(PilotePocketSummary,{families:[family("food",1000,600),family("ndf",100,1000)]})).replace(/<[^>]*>/g,"");
 expect(text).toContain("De votre poche");expect(text).toMatch(/400(?:,00)?\s*€/);expect(text).toMatch(/700(?:,00)?\s*€ compensés/);expect(text).not.toContain("Solde négatif");
});
it("keeps the remaining expense at zero when all families are covered",()=>{
 const text=renderToStaticMarkup(createElement(PilotePocketSummary,{families:[family("food",100,150)]})).replace(/<[^>]*>/g,"");expect(text).toMatch(/0(?:,00)?\s*€/);expect(text).not.toContain("Ce qui reste à financer");
});

it("shows the household deficit as a negative red amount in the page header",()=>{
 const html=renderToStaticMarkup(createElement(PilotePocketSummary,{hero:true,families:[family("food",1000,600)]}));
 expect(html).toContain("text-red-600");expect(html.replace(/<[^>]*>/g,"")).toMatch(/-400(?:,00)?\s*€/);expect(html).not.toContain("de dépenses −");
});
