export const RESIDENCE_GOAL=400000;
/** Savings indicator only: PER uses identified net contributions, not market value. */
export function residenceGoal(fortuneo:number|null,per:number|null){
 const complete=fortuneo!==null&&per!==null&&Number.isFinite(fortuneo)&&Number.isFinite(per);
 const total=complete?Math.round((fortuneo+per)*100)/100:null;
 return {target:RESIDENCE_GOAL,total,remaining:total===null?null:Math.max(0,Math.round((RESIDENCE_GOAL-total)*100)/100),percent:total===null?null:total/RESIDENCE_GOAL*100};
}
