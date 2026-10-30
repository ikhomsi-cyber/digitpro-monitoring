"use client";
import { useState } from "react";
function Correction({kind,title,description}:{kind:"tax"|"ndf";title:string;description:string}){
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[message,setMessage]=useState("");
 const repair=async()=>{if(busy||done)return;setBusy(true);try{
  const response=await fetch(`/api/dashboard/pilote/repair-confirmed-${kind}`,{method:"POST",credentials:"same-origin"});
  const result=await response.json();if(!response.ok)throw new Error(result.error||"Correction impossible.");
  setDone(true);setMessage(result.corrected?`${result.removed} doublon(s) écarté(s). Total : ${result.amount.toLocaleString("fr-FR")} €. Totaux Pilote recalculés.`:`Le bilan est déjà aligné à ${result.amount.toLocaleString("fr-FR")} €.`);
 }catch(error){setMessage(error instanceof Error?error.message:"Correction impossible.");setDone(true);}finally{setBusy(false)}};
 return <section className="space-y-3 rounded-2xl border border-ink-200 p-5"><h2 className="font-semibold">{title}</h2><p>{description}</p><button type="button" disabled={busy||done} onClick={()=>void repair()} className="rounded-xl bg-brand-600 px-4 py-3 text-white disabled:opacity-50">{busy?"Correction…":`Corriger ${title}`}</button>{message?<p role="status">{message}</p>:null}</section>;
}
export default function Page(){return <main className="mx-auto max-w-lg space-y-5 p-8"><h1 className="text-xl font-semibold">Corrections Bankin confirmées</h1><p>Les lignes écartées sont conservées pour audit. Les autres opérations restent inchangées.</p><Correction kind="ndf" title="NDF octobre 2026" description="Écarter les anciennes occurrences de 72,40 €, 78,50 € et 14,99 € pour retrouver les 5 opérations Bankin, soit 353,79 €."/><Correction kind="tax" title="Impôt octobre 2026" description="Écarter le doublon d’impôt de 5 760 € du 26 octobre 2026."/><a className="block underline" href="/dashboard?section=pilote">Retour à Pilote</a></main>}
