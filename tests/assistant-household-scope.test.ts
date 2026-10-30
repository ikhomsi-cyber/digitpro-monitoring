import {expect,it} from "vitest";
import {ASSISTANT_HOUSEHOLD_VIEWS} from "@/lib/assistant-household-views";
import {buildBankinPiloteSnapshot} from "@/lib/pilote";
import {buildDailyBrief} from "@/lib/daily-financial-brief";
import {householdOutOfPocketHistory} from "@/lib/daily-brief-household";
it("includes essential and secondary expenses in assistant families and history while excluding travel",()=>{
 const source=buildBankinPiloteSnapshot([
  {sourceRow:2,date:"2026-10-01",amount:-500,parentCategory:"Alimentation",subCategory:"Courses",hidden:false},
  {sourceRow:3,date:"2026-10-01",amount:-200,parentCategory:"Achats & Shopping",subCategory:"High Tech",hidden:false},
  {sourceRow:4,date:"2026-10-01",amount:-1000,parentCategory:"Voyage",subCategory:"Hôtel",hidden:false},
 ],"synthetic.xlsx","synthetic");
 const brief=buildDailyBrief({date:"2026-10-25",transactions:[],snapshot:source,views:ASSISTANT_HOUSEHOLD_VIEWS});
 expect(brief.compensations.reduce((sum,f)=>sum+f.expenses,0)).toBe(700);
 expect(householdOutOfPocketHistory(source,"2026-10-25",ASSISTANT_HOUSEHOLD_VIEWS)[0].monthOutOfPocket).toBe(400);
});
