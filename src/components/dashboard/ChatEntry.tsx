"use client";
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {AssistantChatSection} from './AssistantChatSection';
import {useDashboardSection} from './DashboardSectionContext';
export function ChatEntry({demoMode}:{demoMode:boolean}){
 const router=useRouter(),{section}=useDashboardSection();
 useEffect(()=>{if(section!=='chat')router.refresh();},[section,router]);
 useEffect(()=>{document.documentElement.dataset.digitproDashboardReady='1';window.dispatchEvent(new Event('digitpro:dashboard-ready'));},[]);
 return section==='chat'?<AssistantChatSection demoMode={demoMode}/>:<p role="status" className="min-h-64 text-sm text-ink-500">Chargement du tableau de bord…</p>;
}
