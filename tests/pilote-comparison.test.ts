import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { buildBankinPiloteSnapshot, piloteSnapshotMonths, type BankinPiloteRow } from "@/lib/pilote";
import { buildPiloteComparisonAtDate, buildPiloteMonthlyComparison } from "@/lib/bankin/pilote-comparison";
import { PiloteMonthlyComparison } from "@/components/dashboard/PiloteMonthlyComparison";

const row=(sourceRow:number,date:string,amount:number,parentCategory="Alimentation",subCategory="Courses"):BankinPiloteRow=>({sourceRow,date,amount,parentCategory,subCategory,hidden:false});
const fixture=(rows:BankinPiloteRow[])=>buildBankinPiloteSnapshot(rows,"synthetic.xlsx","fixture");
it("uses the same day for the current and previous calendar month, including top category differences",()=>{
 const snapshot=fixture([row(1,"2026-09-10",-400),row(2,"2026-09-27",-999),row(3,"2026-10-10",-500),row(4,"2026-10-29",-5000)]);
 const dated=buildPiloteComparisonAtDate(snapshot,"2026-10-25")!;
 const result=buildPiloteMonthlyComparison(snapshot.months,"2026-10",["essential"],"2026-10-25",dated);
 expect(result).toMatchObject({status:"ready",atDate:true,delta:100,percent:25,current:{end:"2026-10-25",expenses:500},previous:{end:"2026-09-25",expenses:400},categories:[{name:"Alimentation",delta:100}]});
 expect(snapshot.months.find(month=>month.month==="2026-10")?.expenses).toBe(5500);
 expect(JSON.stringify(dated)).not.toContain('"sourceRow"');expect(dated.months).toHaveLength(2);
});
it("uses full adjacent months for a historical selection and applies expense views",()=>{
 const snapshot=fixture([row(1,"2026-09-30",-100),row(2,"2026-10-31",-150),row(3,"2026-10-10",-700,"Voyage","Hôtel")]);
 const result=buildPiloteMonthlyComparison(snapshot.months,"2026-10",["essential"],"2026-11-25");
 expect(result).toMatchObject({status:"ready",atDate:false,delta:50,current:{end:"2026-10-31",expenses:150},previous:{end:"2026-09-30",expenses:100}});
 expect(buildPiloteMonthlyComparison(snapshot.months,"2026-10",["travel"],"2026-11-25")).toMatchObject({status:"ready",delta:700,percent:null});
});
it("does not replace missing daily data or an absent prior month with zero",()=>{
 const snapshot=fixture([row(1,"2026-08-10",-100),row(2,"2026-10-10",-200)]);
 expect(buildPiloteMonthlyComparison(snapshot.months,"2026-10",["essential"],"2026-10-25")).toEqual({status:"unavailable",reason:"missing-daily"});
 expect(buildPiloteMonthlyComparison(snapshot.months,"2026-10",["essential"],"2026-11-25")).toEqual({status:"unavailable",reason:"missing-month"});
 expect(buildPiloteComparisonAtDate({...snapshot,rows:undefined},"2026-10-25")).toBeNull();
});
it("returns no percentage for an imported zero-expense baseline",()=>{
 const snapshot=fixture([row(1,"2026-09-10",300,"Entrées","Cashback"),row(2,"2026-10-10",-200)]);
 const result=buildPiloteMonthlyComparison(snapshot.months,"2026-10",["essential"],"2026-11-25");
 expect(result).toMatchObject({status:"ready",delta:200,percent:null,previous:{expenses:0}});
 const text=renderToStaticMarkup(createElement(PiloteMonthlyComparison,{comparison:result})).replace(/<[^>]*>/g,"");
 expect(text).toContain("référence précédente est de zéro");expect(text).not.toContain("Infinity");expect(text).not.toContain("NaN");
});
it("reconciles the top three category contributions and the remaining categories in cents",()=>{
 const snapshot=fixture([row(1,"2026-09-10",-10),...[["Alimentation",-80],["Logement",-60],["Transport",-40],["Santé",-20]].map(([category,amount],index)=>row(index+2,"2026-10-10",Number(amount),String(category)))]);
 const result=buildPiloteMonthlyComparison(piloteSnapshotMonths(snapshot),"2026-10",["essential"],"2026-11-25");
 expect(result.status).toBe("ready");if(result.status!=="ready")return;
 expect(result.categories).toHaveLength(3);expect(result.categories.reduce((sum,category)=>sum+Math.round(category.delta*100),Math.round(result.otherDelta*100))).toBe(Math.round(result.delta*100));
});
it("renders an explicit unavailable state and exact dates without guessing an exhaustive history",()=>{
 const snapshot=fixture([row(1,"2026-09-10",-100),row(2,"2026-10-10",-150)]);
 const result=buildPiloteMonthlyComparison(snapshot.months,"2026-10",["essential"],"2026-11-25");
 const text=renderToStaticMarkup(createElement(PiloteMonthlyComparison,{comparison:result})).replace(/<[^>]*>/g,"");
 expect(text).toContain("01/10/2026");expect(text).toContain("31/10/2026");expect(text).toContain("30/09/2026");expect(text).toContain("sans garantie d’exhaustivité");
 const unavailable=renderToStaticMarkup(createElement(PiloteMonthlyComparison,{comparison:{status:"unavailable",reason:"missing-month"}}));
 expect(unavailable).toContain("n’a pas de données importées");
});
