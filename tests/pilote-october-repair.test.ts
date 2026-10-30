import {expect,it} from "vitest";
import {buildBankinPiloteSnapshot,type BankinPiloteRow} from "@/lib/pilote";
import {OCTOBER_RULES,OCTOBER_BANKIN_TARGETS,repairConfirmedOctober} from "@/lib/bankin/repair-confirmed-october";
import {mergeBankinPiloteSnapshots} from "@/lib/bankin/merge-pilote";
/** Synthetic balanced fixture; it does not contain the owner's source records or labels. */
function fixture(){
 const rows:BankinPiloteRow[]=[];
 for(const r of OCTOBER_RULES){rows.push({sourceRow:r.old,date:r.date,amount:-r.expense,parentCategory:r.parent,subCategory:r.category,hidden:false,identity:`synthetic-${r.old}`});if(r.current)rows.push({sourceRow:r.current,date:r.currentDate!,amount:-r.expense,parentCategory:r.parent,subCategory:r.category,hidden:false,identity:`synthetic-${r.current}`})}
 const oldIds=new Set(OCTOBER_RULES.map(r=>r.old));let nextId=50000;
 for(const target of OCTOBER_BANKIN_TARGETS){const current=rows.filter(r=>r.parentCategory===target.parent&&!oldIds.has(r.sourceRow));const count=target.count-current.length;const remaining=Math.round(target.expense*100)-current.reduce((s,r)=>s-Math.round(r.amount*100),0);for(let i=0;i<count;i++){const amount=Math.floor(remaining/count)+(i<remaining%count?1:0);rows.push({sourceRow:nextId++,date:"2026-10-01",amount:-amount/100,parentCategory:target.parent,subCategory:"Synthetic remaining expense",hidden:false,identity:`synthetic-fill-${nextId}`})}}
 rows.push({sourceRow:11907,date:"2026-10-29",amount:-5.78,parentCategory:"Alimentation & Restau",subCategory:"Supermarché / Epicerie",hidden:false,identity:"synthetic-jojo"});
 rows.push({sourceRow:99999,date:"2025-01-01",amount:-12,parentCategory:"Synthetic history",subCategory:"Synthetic expense",hidden:false,identity:"synthetic-history"});
 return {...buildBankinPiloteSnapshot(rows,"synthetic.xlsx","synthetic-hash"),excludedRowIdentities:["synthetic-tax-exclusion"]};
}
it("corrects 14 established excess occurrences without excluding the unconfirmed expense",()=>{
 const before=fixture(),copy=structuredClone(before);const fixed=repairConfirmedOctober(before)!;
 expect(fixed.months.find(m=>m.month==="2026-10")).toMatchObject({expenses:9487.4,count:57});
 expect(fixed.excludedHidden-before.excludedHidden).toBe(14);expect(fixed.rows).toHaveLength(before.rows!.length);
 expect(fixed.rows?.find(r=>r.sourceRow===11907)?.hidden).toBe(false);
 expect(fixed.excludedRowIdentities).toContain("synthetic-tax-exclusion");expect(before).toEqual(copy);
 expect(fixed.months.find(m=>m.month==="2025-01")).toEqual(before.months.find(m=>m.month==="2025-01"));
 expect(repairConfirmedOctober(fixed)).toBeNull();expect(mergeBankinPiloteSnapshots(fixed,before)).toBe(fixed);
});
it("excludes the remaining expense only on explicit confirmation and matches every Bankin category",()=>{
 const before=fixture();const partial=repairConfirmedOctober(before)!;const full=repairConfirmedOctober(partial,true)!;
 const october=full.months.find(m=>m.month==="2026-10")!;expect(october).toMatchObject({expenses:9481.62,count:56});
 for(const t of OCTOBER_BANKIN_TARGETS)expect(october.categories.find(c=>c.name===t.parent)).toMatchObject({expenses:t.expense,count:t.count});
 expect(full.excludedHidden-before.excludedHidden).toBe(15);expect(repairConfirmedOctober(full,true)).toBeNull();expect(repairConfirmedOctober(full,false)).toBeNull();
});
it("refuses changed source records, missing counterparts or an additional legitimate expense",()=>{
 const s=fixture();expect(()=>repairConfirmedOctober({...s,rows:s.rows!.map(r=>r.sourceRow===12?{...r,amount:-3.59}:r)})).toThrow();
 expect(()=>repairConfirmedOctober({...s,rows:s.rows!.filter(r=>r.sourceRow!==11879)})).toThrow();
 expect(()=>repairConfirmedOctober({...s,rows:[...s.rows!,{...s.rows![0],sourceRow:80000,identity:"synthetic-extra"}]})).toThrow();
});
