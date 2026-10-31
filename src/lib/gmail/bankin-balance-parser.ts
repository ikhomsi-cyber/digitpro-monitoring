import {htmlToText} from './hiway-invoice-parser';
export type BankinBalancePoint={account:string;date:string;balance:number;observedAt?:number};
const money=/([+−-]?\s*\d[\d \u00a0\u202f.]*(?:,\d{2}|\.\d{2}))\s*(?:€|EUR)/gi;
export function parseBankinBalanceEmail({subject,body,date,html=false}:{subject:string;body:string;date:string;html?:boolean}):BankinBalancePoint[]{
 if(body.length>2000000)return [];
 if(!/balance quotidienne|solde|comptes/i.test(subject)||/cashback|soldes d.hiver|soldes d.ete|conversation|support/i.test(subject)||!/^\d{4}-\d{2}-\d{2}$/.test(date))return [];
 const lines=(html?htmlToText(body):body).split(/\n/).map(s=>s.replace(/\u00a0|\u202f|\|/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
 const result:BankinBalancePoint[]=[];
 for(let i=0;i<lines.length;i++){
  if(lines[i].length>2000)continue;
  const matches=[...lines[i].matchAll(money)];if(matches.length!==1)continue;
  const match=matches[0],before=lines[i].slice(0,match.index).replace(/[|:]+$/,'').trim();
  const accountName=(before||lines[i-1]||'').replace(/^solde (?:du compte|de)\s*/i,'').trim();
  const bank=!before&&i>=2&&!/[€]|https?:|@|consulter|balance|bonjour/i.test(lines[i-2])?lines[i-2]:'';
  const account=bank?`${bank} · ${accountName}`:accountName;
  if(!accountName||account.length>160||/total|ensemble|bonjour|retrouvez|cashback|solde de vos|vos comptes/i.test(account)||/[€]|https?:|@/.test(account))continue;
  let numeric=match[1].replace(/\s/g,'').replace('−','-');numeric=numeric.includes(',')?numeric.replace(/\./g,'').replace(',','.'):numeric;
  const balance=Number(numeric);if(!Number.isFinite(balance))continue;
  // Ambiguous duplicate account labels in one mail are not merged as one account.
  if(result.some(row=>row.account===account))return [];
  result.push({account,date,balance});
 }
 return result;
}
export function mergeBankinBalancePoints(points:BankinBalancePoint[]){
 const unique=new Map<string,BankinBalancePoint>();for(const point of points){const key=JSON.stringify([point.account,point.date]);if(!unique.has(key)||(point.observedAt??0)>(unique.get(key)?.observedAt??0))unique.set(key,point); }
 return [...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.account.localeCompare(b.account));
}
