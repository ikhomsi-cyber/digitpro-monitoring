"use client";
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {InvestSection} from './InvestSection';
import {useDashboardSection} from './DashboardSectionContext';
/** Direct personal entry does not preload professional transaction history. */
export function InvestEntry({demoMode}:{demoMode:boolean}){
 const router=useRouter(),{section}=useDashboardSection();
 useEffect(()=>{if(section!=='invest')router.refresh();},[section,router]);
 useEffect(()=>{document.documentElement.dataset.digitproDashboardReady='1';window.dispatchEvent(new Event('digitpro:dashboard-ready'));},[]);
 return section==='invest'?<InvestSection demoMode={demoMode}/>:<p role="status" className="min-h-64 text-sm text-ink-500">Chargement du tableau de bord…</p>;
}
