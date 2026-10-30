import {expect,it} from "vitest";
import {buildBankinPiloteSnapshot,type BankinPiloteRow} from "@/lib/pilote";
import {repairConfirmedNdfDuplicates} from "@/lib/bankin/repair-confirmed-ndf";
import {mergeBankinPiloteSnapshots} from "@/lib/bankin/merge-pilote";
const rows:BankinPiloteRow[]=[["2026-10-06",-79.4],["2026-10-19",-108.5],["2026-10-21",-72.4],["2026-10-22",-72.4],["2026-10-24",-78.5],["2026-10-26",-78.5],["2026-10-24",-14.99],["2026-10-26",-14.99]].map(([date,amount],i)=>({date:String(date),amount:Number(amount),identity:`synthetic-${i}`,sourceRow:i+2,parentCategory:"Loisirs & Sorties",subCategory:"NDF DigitPro",hidden:false}));
const original=()=>({...buildBankinPiloteSnapshot([...rows,{...rows[0],identity:"history",sourceRow:20,date:"2025-10-01"}],"synthetic.xlsx","fixture"),excludedRowIdentities:["tax-exclusion"]});
it("aligns exactly five NDF rows and preserves source records, history and tax exclusion",()=>{
 const before=original();const copy=structuredClone(before);const fixed=repairConfirmedNdfDuplicates(before)!;
 expect(fixed.months.find(m=>m.month==="2026-10")).toMatchObject({expenses:353.79,count:5});
 expect(fixed.rows).toHaveLength(before.rows!.length);expect(fixed.rows?.filter(r=>r.hidden)).toHaveLength(3);
 expect(fixed.excludedRowIdentities).toEqual(["tax-exclusion","synthetic-2","synthetic-4","synthetic-6"]);
 expect(fixed.months.find(m=>m.month==="2025-10")).toEqual(before.months.find(m=>m.month==="2025-10"));
 expect(before).toEqual(copy);expect(repairConfirmedNdfDuplicates(fixed)).toBeNull();
 expect(mergeBankinPiloteSnapshots(fixed,before)).toBe(fixed);
});
it("refuses any mismatch instead of forcing a total or deleting genuine repetitions",()=>{
 const s=original();expect(()=>repairConfirmedNdfDuplicates({...s,rows:[...s.rows!,{...rows[0],identity:"extra",sourceRow:30}]})).toThrow();
 expect(()=>repairConfirmedNdfDuplicates({...s,rows:s.rows!.map(r=>r.identity==="synthetic-2"?{...r,date:"2026-10-20"}:r)})).toThrow();
 expect(()=>repairConfirmedNdfDuplicates({...s,rows:s.rows!.map(r=>r.identity==="synthetic-2"?{...r,identity:undefined}:r)})).toThrow();
});
