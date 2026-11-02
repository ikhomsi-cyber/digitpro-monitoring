"use client";
import {PersonalPageSkeleton} from "./PersonalPageSkeleton";
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {AssistantChatSection} from './AssistantChatSection';
import {useDashboardSection} from './DashboardSectionContext';
export function ChatEntry({demoMode}:{demoMode:boolean}){
 const router=useRouter(),{section}=useDashboardSection();
 useEffect(()=>{if(section!=='chat')router.refresh();},[section,router]);
 useEffect(()=>{document.documentElement.dataset.digitproDashboardReady='1';window.dispatchEvent(new Event('digitpro:dashboard-ready'));},[]);
 return section==='chat'?<AssistantChatSection demoMode={demoMode}/>:<PersonalPageSkeleton kind={section==='courses'?'courses':section==='invest'?'invest':'pilote'}/>;
}
