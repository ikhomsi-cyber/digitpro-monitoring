"use client";
import type {ProductPriceChange} from '@/lib/groceries/product-price-changes';
import {useDashboardDisplayFormat} from './DashboardDisplayFormatContext';
const money=(n:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n/100),date=(s:string)=>s.split('-').reverse().join('/');
export function ProductPriceEvolution({change,loading}:{change?:ProductPriceChange;loading:boolean}){
 const fmt=useDashboardDisplayFormat();if(fmt.dummy)return null;
 if(loading)return <p className="mt-2 text-[10px] text-ink-400" role="status">Comparaison des prix…</p>;
 if(!change)return null;
 if(change.deltaCents===null)return <p className="mt-2 text-[10px] text-ink-400">{money(change.latestCents)} / unité · premier prix connu</p>;
 if(change.formatUncertain)return <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-300">Écart important · format ou promotion à vérifier</p>;
 return <details className="mt-2"><summary className={`cursor-pointer list-none text-[10px] font-medium tabular-nums ${change.deltaCents>0?'text-rose-600 dark:text-rose-300':change.deltaCents<0?'text-emerald-600 dark:text-emerald-300':'text-ink-400'}`}>{change.deltaCents===0?'→ Prix stable':`${change.deltaCents>0?'↑ +':'↓ −'}${money(Math.abs(change.deltaCents))} / unité`}{change.deltaCents!==0&&change.percent!==null?` (${change.percent>0?'+':''}${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(change.percent)} %)`:''}</summary><p className="mt-1 text-[10px] leading-relaxed text-ink-400">{money(change.previousCents!)} le {date(change.previousDate!)} → {money(change.latestCents)} le {date(change.latestDate)}. Prix unitaire moyen par date, avant remises globales.</p></details>;
}
