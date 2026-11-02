"use client";
import {PersonalPageSkeleton} from "./PersonalPageSkeleton";
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {InvestSection} from './InvestSection';
import {useDashboardSection} from './DashboardSectionContext';
/** Direct personal entry does not preload professional transaction history. */
export function InvestEntry({demoMode}:{demoMode:boolean}){
 const router=useRouter(),{section}=useDashboardSection();
 useEffect(()=>{if(section!=='invest')router.refresh();},[section,router]);
 useEffect(()=>{document.documentElement.dataset.digitproDashboardReady='1';window.dispatchEvent(new Event('digitpro:dashboard-ready'));},[]);
 return section==='invest'?<InvestSection demoMode={demoMode}/>:<PersonalPageSkeleton kind={section==='courses'?'courses':'pilote'}/>;
}
