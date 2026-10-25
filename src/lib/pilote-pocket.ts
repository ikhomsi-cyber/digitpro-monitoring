import type { PiloteCompensation } from "./pilote";
/** Shared by Pilote and the assistant: surpluses cannot offset another family's deficit. */
export function pilotePocketTotals(families:readonly PiloteCompensation[]){
 const expenseCents=families.reduce((sum,f)=>sum+Math.round(f.expenses*100),0);
 const coveredCents=families.reduce((sum,f)=>sum+Math.min(Math.round(f.expenses*100),Math.round(f.income*100)),0);
 return {expenseCents,coveredCents,remainingCents:Math.max(0,expenseCents-coveredCents)};
}
