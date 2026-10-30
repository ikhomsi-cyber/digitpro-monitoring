import { expect, it } from "vitest";
import { buildBankinPiloteSnapshot, type BankinPiloteRow } from "@/lib/pilote";
import { repairConfirmedTaxDuplicate } from "@/lib/bankin/repair-confirmed-tax";
import { mergeBankinPiloteSnapshots } from "@/lib/bankin/merge-pilote";
const row=(identity:string,date="2026-10-26",amount=-5760):BankinPiloteRow=>({identity,date,amount,sourceRow:2,hidden:false,parentCategory:"Impôts & Taxes",subCategory:"Impôts sur le revenu"});
const snapshot=(rows:BankinPiloteRow[])=>buildBankinPiloteSnapshot(rows.map((r,i)=>({...r,sourceRow:i+2})),"synthetic.xlsx","synthetic");
it("removes only the confirmed duplicate, preserves history and recomputes October",()=>{
 const original=snapshot([row("keep"),row("remove"),row("history","2026-09-25"),row("other","2026-10-20",-42)]);
 const before=structuredClone(original);const fixed=repairConfirmedTaxDuplicate(original)!;
 expect(fixed.rows?.filter(r=>!r.hidden).map(r=>r.identity)).toEqual(["keep","history","other"]);
 expect(fixed.rows).toHaveLength(original.rows!.length);
 expect(fixed.rows?.find(r=>r.identity==="remove")?.hidden).toBe(true);
 expect(fixed.months.find(m=>m.month==="2026-10")).toMatchObject({expenses:5802,count:2});
 expect(fixed.months.find(m=>m.month==="2026-09")).toEqual(original.months.find(m=>m.month==="2026-09"));
 expect(original).toEqual(before);expect(fixed.excludedRowIdentities).toEqual(["remove"]);
 expect(repairConfirmedTaxDuplicate(fixed)).toBeNull();
 expect(mergeBankinPiloteSnapshots(fixed,original)).toBe(fixed);
 const next=mergeBankinPiloteSnapshots(fixed,snapshot([row("remove"),row("new","2026-11-26")]));
 expect(next.rows?.filter(r=>r.identity==="remove")).toHaveLength(1);expect(next.rows?.find(r=>r.identity==="remove")?.hidden).toBe(true);expect(next.excludedRowIdentities).toEqual(["remove"]);
});
it("does not guess when there are three candidates or no stable identity",()=>{
 expect(()=>repairConfirmedTaxDuplicate(snapshot([row("a"),row("b"),row("c")]))).toThrow();
 expect(()=>repairConfirmedTaxDuplicate(snapshot([{...row("a"),identity:undefined},row("b")]))).toThrow();
});
it("does not repair another date, category or amount",()=>{
 for(const change of [{date:"2026-10-25"},{amount:-5000},{subCategory:"Autre impôt"}]){
 expect(()=>repairConfirmedTaxDuplicate(snapshot([{...row("a"),...change},{...row("b"),...change}]))).toThrow();
 }
});
