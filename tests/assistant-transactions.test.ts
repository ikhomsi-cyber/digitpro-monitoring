import { expect, it } from "vitest";
import { buildAssistantTransactions } from "@/lib/assistant-transactions";
import type { BankinPiloteSnapshot } from "@/lib/pilote";
it("projects categories from both sources without private identifiers or labels", () => {
 const snapshot = {rows:[{date:"2026-10-01",amount:-20,parentCategory:"Alimentation",subCategory:"Courses",hidden:true,sourceRow:1,identity:"private-bank-id"}]} as BankinPiloteSnapshot;
 const result=buildAssistantTransactions([{id:"private-id",label:"private-label",company:"private-account",date:"2026-10-02",amount:-50,category:"Transport",categoryManual:true}],snapshot,"2026-10-25");
 expect(result.digitpro.transactions[0]).toMatchObject({category:"Transport",categoryManual:true});
 expect(result.bankin.transactions[0]).toMatchObject({category:"Alimentation",subcategory:"Courses",hidden:true});
 expect(JSON.stringify(result)).not.toContain("private-");
});
it("bounds and sorts history, excludes future dates and reports missing details", () => {
 const rows=Array.from({length:501},(_,i)=>({id:String(i),label:"",company:"",date:i===500?"2026-10-02":"2026-10-01",amount:-1,category:"Courses"}));
 const result=buildAssistantTransactions([...rows,{...rows[0],date:"2027-01-01"}],null,"2026-10-25");
 expect(result.digitpro).toMatchObject({totalCount:501,includedCount:500,truncated:true,available:true});
 expect(result.digitpro.transactions[0].date).toBe("2026-10-02");expect(result.bankin.available).toBe(false);
 expect(buildAssistantTransactions([],null,"2026-10-25").digitpro.available).toBe(true);
});
