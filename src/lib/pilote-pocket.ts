import type { PiloteCompensation } from "./pilote";
/** Shared by Pilote and the assistant: all compensations offset the selected expenses across families. */
export function pilotePocketTotals(families:readonly PiloteCompensation[]){
 const expenseCents=families.reduce((sum,f)=>sum+Math.round(f.expenses*100),0);
 const incomeCents=families.reduce((sum,f)=>sum+Math.round(f.income*100),0);
 const coveredCents=Math.min(expenseCents,incomeCents);
 return {expenseCents,coveredCents,remainingCents:Math.max(0,expenseCents-coveredCents)};
}
