import type { DashboardTx } from "./dashboard-metrics";
import type { BankinPiloteSnapshot } from "./pilote";

import {createHash} from "node:crypto";
import {filterPiloteReportRows} from "./pilote";
export type AssistantTransaction = {
  date: string; amount: number; description?: string|null; merchant?: string|null; category: string; subcategory: string | null;
  categoryManual: boolean | null; hidden: boolean;
};
export type AssistantTransactionSource = {
  available: boolean; totalCount: number; includedCount: number; truncated: boolean;
  transactions: AssistantTransaction[];
};
export type AssistantTransactions = { digitpro: AssistantTransactionSource; bankin: AssistantTransactionSource };
export const redactAssistantLabel = (value:string) => value.replace(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/gi,"[compte masqué]").replace(/\b\d{4}(?:[ -]\d{4}){3}\b/g,"[carte masquée]").replace(/\b\d{8,}\b/g,"[référence masquée]").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[email masqué]");
const category = (value: string) => redactAssistantLabel(value).slice(0, 160);
function source(rows: AssistantTransaction[] | null, asOf: string): AssistantTransactionSource {
  const eligible = (rows ?? []).filter(row => row.date <= asOf && Number.isFinite(row.amount));
  eligible.sort((a, b) => b.date.localeCompare(a.date));
  return { available: rows !== null, totalCount: eligible.length, includedCount: eligible.length,
    truncated: false, transactions: eligible };
}
/** Authorized projection: account names and identifiers never reach the model. */
export function buildAssistantTransactions(transactions: DashboardTx[] | null, snapshot: BankinPiloteSnapshot | null, asOf: string): AssistantTransactions {
 const imported=new Map((transactions??[]).map(row=>[createHash("sha256").update(JSON.stringify([row.date,Math.round(row.amount*100),row.label.normalize("NFC").trim(),row.company.normalize("NFC").trim()])).digest("hex"),row.label]));
 const reported=new Set(filterPiloteReportRows(snapshot?.rows??[]));
 return {
  digitpro:source(transactions?.filter(row=>row.scope!=="personal").map(row=>({date:row.date,amount:row.amount,description:redactAssistantLabel(row.label).slice(0,500),merchant:null,category:category(row.category),subcategory:null,categoryManual:row.categoryManual??false,hidden:false}))??null,asOf),
  bankin:source(snapshot?.rows?.map(row=>({date:row.date,amount:row.amount,description:row.label|| (row.identity?imported.get(row.identity):null)?redactAssistantLabel(row.label??imported.get(row.identity!)??"").slice(0,500):null,merchant:row.merchant?redactAssistantLabel(row.merchant).slice(0,160):null,category:category(row.parentCategory),subcategory:category(row.subCategory),categoryManual:null,hidden:!reported.has(row)}))??null,asOf)
 };
}
