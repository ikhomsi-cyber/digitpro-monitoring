"use client";
import { useState } from "react";
export default function Page(){
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[message,setMessage]=useState("");
 const repair=async()=>{if(busy||done)return;setBusy(true);try{
  const response=await fetch("/api/dashboard/pilote/repair-confirmed-tax",{method:"POST",credentials:"same-origin"});
  const result=await response.json();if(!response.ok)throw new Error(result.error||"Correction impossible.");
  setDone(true);setMessage(result.corrected?"Doublon écarté du calcul. Impôts sur le revenu : 5 760 €. Totaux Pilote recalculés.":"Le bilan contient déjà une seule ligne de 5 760 €.");
 }catch(error){setMessage(error instanceof Error?error.message:"Correction impossible.");setDone(true);}finally{setBusy(false)}};
 return <main className="mx-auto max-w-lg space-y-5 p-8"><h1 className="text-xl font-semibold">Correction Pilote confirmée</h1><p>Écarter du calcul une des deux lignes d’impôt de 5 760 € du 26 octobre 2026. Les autres opérations sont conservées.</p><button type="button" disabled={busy||done} onClick={()=>void repair()} className="rounded-xl bg-brand-600 px-4 py-3 text-white disabled:opacity-50">{busy?"Correction…":"Corriger le doublon confirmé"}</button>{message?<p role="status">{message}</p>:null}<a className="block underline" href="/dashboard?section=pilote">Retour à Pilote</a></main>;
}
