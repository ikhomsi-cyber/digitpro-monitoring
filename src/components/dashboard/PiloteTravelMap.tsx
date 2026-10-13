"use client";
import {useState} from "react";
import shapes from "@/lib/maps/world-shapes.json";
import {buildPiloteTravel} from "@/lib/pilote-travel";
import {type PiloteMonth} from "@/lib/pilote";
import {dashboardInsightCard,dashboardPanelTitle} from "@/lib/dashboard-surfaces";
import {useDashboardDisplayFormat} from "./DashboardDisplayFormatContext";
// Focus on the main region of each country, excluding remote territories
// (e.g. French Guiana) that would pull a European trip back to a world view.
const countryBounds = new Map(shapes.map(shape => {
  const polygons = shape.path.split("M").filter(Boolean).map(path => {
    const points = [...path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(match => [Number(match[1]), Number(match[2])]);
    return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
  });
  const main = [...polygons].sort((a,b)=>(b[2]-b[0])*(b[3]-b[1])-(a[2]-a[0])*(a[3]-a[1]))[0];
  const nearby = polygons.filter(p=>Math.abs((p[0]+p[2]-main[0]-main[2])/2)<50 && Math.abs((p[1]+p[3]-main[1]-main[3])/2)<50);
  return [shape.id,[Math.min(...nearby.map(p=>p[0])),Math.min(...nearby.map(p=>p[1])),Math.max(...nearby.map(p=>p[2])),Math.max(...nearby.map(p=>p[3]))]] as const;
}));
countryBounds.set("MV",[503,169,509,175]);
const islandBounds:Record<string,number[]>={Minorque:[367.606304,99.841174,368.674174,100.367052],Tenerife:[326.167884,122.833118,327.764506,124.005808]};
function travelViewBox(ids:string[],focus?:number[]) {
  const bounds=focus?[focus]:ids.flatMap(id=>{const b=countryBounds.get(id);return b?[b]:[];});
  if(!bounds.length)return "330 55 130 75";
  const left=Math.min(...bounds.map(b=>b[0])),top=Math.min(...bounds.map(b=>b[1]));
  const right=Math.max(...bounds.map(b=>b[2])),bottom=Math.max(...bounds.map(b=>b[3]));
  const height=Math.max(focus?1.5:24,(bottom-top)*1.25,(right-left)*1.25/2);
  const width=height*2;
  return `${(left+right-width)/2} ${(top+bottom-height)/2} ${width} ${height}`;
}
export function PiloteTravelMap({months,period}:{months:PiloteMonth[];period:string}) {
  const fmt=useDashboardDisplayFormat();const [scope,setScope]=useState<"history"|"period"|"year">("history");const [selected,setSelected]=useState<string|null>(null);
  const years=[...new Set(months.map(m=>m.month.slice(0,4)))].sort().reverse();
  const [selectedYear,setSelectedYear]=useState("");
  const year=years.includes(selectedYear)?selectedYear:years[0]??period.slice(0,4);
  const data=buildPiloteTravel(scope==="history"?months:scope==="year"?months.filter(m=>m.month.startsWith(`${year}-`)):months.filter(m=>period.length===4?m.month.startsWith(`${period}-`):m.month===period));
  const visited=new Map(data.countries.map(c=>[c.id,c]));const active=data.countries.find(c=>c.id===selected);
  const activeEnvelope=data.envelopes.find(e=>e.id===selected);
  const mapEntries=[...data.envelopes.map(e=>({id:e.id,name:e.countryIds.map(id=>visited.get(id)?.name).join(" + "),amount:e.amount,countryIds:e.countryIds,subtitle:e.name})),...data.countries.map(c=>({...c,amount:Math.round((c.amount-data.envelopes.reduce((sum,e)=>sum+(e.allocations.find(a=>a.id===c.id)?.amount??0),0))*100)/100,countryIds:[c.id],subtitle:c.places.map(p=>p.name).join(" · ")})).filter(c=>c.amount>0)];
  const selectCountry=(id:string)=>setSelected(mapEntries.find(e=>e.id===id)?.id??mapEntries.find(e=>e.countryIds.includes(id))?.id??id);
  const placeBounds=(id:string)=>{const country=visited.get(id);return country?.places.length===1?islandBounds[country.places[0].name]:undefined;};
  const focus=active?placeBounds(active.id):undefined;
  const viewBox=travelViewBox(activeEnvelope?activeEnvelope.countryIds:active?[active.id]:data.countries.map(c=>c.id),focus);
  const mapWidth=Number(viewBox.split(" ")[2]);
  const amountLabel=(amount:number)=>amount>0?fmt.euro(amount):"Par destination";
  const labels: {id:string;name:string;x:number;y:number;anchorY:number;width:number;label:string}[]=[];
  const labelFontSize=mapWidth/48;
  for(const country of mapEntries.filter(country=>!selected||country.id===selected)){
    const bounds=country.countryIds.flatMap(id=>{const b=placeBounds(id)??countryBounds.get(id);return b?[b]:[];});if(!bounds.length)continue;
    const x=bounds.reduce((sum,b)=>sum+(b[0]+b[2])/2,0)/bounds.length,anchorY=bounds.reduce((sum,b)=>sum+(b[1]+b[3])/2,0)/bounds.length;
    const label=fmt.euro(country.amount),width=Math.max(5,label.length)*labelFontSize*0.66+labelFontSize;
    let y=anchorY;
    while(labels.some(other=>Math.abs(x-other.x)<(width+other.width)/2+labelFontSize/3 && Math.abs(y-other.y)<labelFontSize*2))y+=labelFontSize*2.1;
    labels.push({id:country.id,name:country.name,x,y,anchorY,width,label});
  }
  return <section aria-label="Carte des voyages" className={dashboardInsightCard}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className={dashboardPanelTitle}>Vos voyages</h3><p className="mt-1 text-xs text-ink-500 dark:text-white/60">{fmt.int(data.countries.length)} pays · {fmt.euro(data.total)}</p></div><div className="flex rounded-full bg-ink-100/70 p-1 dark:bg-white/5" role="group" aria-label="Période de la carte">{([['history','Historique'],['year','Année'],['period','Période sélectionnée']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={scope===value} onClick={()=>{setScope(value);setSelected(null);}} className={`rounded-full px-3 py-2 text-[11px] font-semibold ${scope===value?'bg-white text-ink-900 shadow-sm dark:bg-white/15 dark:text-white':'text-ink-500 dark:text-white/60'}`}>{label}</button>)}</div></div>
    {scope==="year"?<div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Année des voyages">{years.map(value=><button type="button" key={value} aria-pressed={value===year} onClick={()=>{setSelectedYear(value);setSelected(null);}} className={`rounded-full border px-3 py-2 text-xs font-semibold tabular-nums ${value===year?'border-emerald-400/50 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200':'border-ink-200/60 text-ink-500 dark:border-white/10 dark:text-white/60'}`}>{value}</button>)}</div>:null}
    <div className="relative mt-4 overflow-hidden rounded-2xl bg-ink-50 dark:bg-white/[.025]"><svg viewBox={viewBox} className="aspect-[2/1] w-full" aria-label="Pays visités selon les catégories Bankin"><g strokeWidth="0.6" strokeLinejoin="round">{shapes.map((shape,index)=>{const country=visited.get(shape.id);return <path key={`${shape.id}-${index}`} d={shape.path} vectorEffect="non-scaling-stroke" className={country?'fill-emerald-400/80 stroke-emerald-100/70 cursor-pointer transition hover:fill-emerald-300':'fill-ink-200/60 stroke-white dark:fill-white/10 dark:stroke-white/10'} {...(country?{role:'button',tabIndex:0,'aria-label':`${country.name} : ${amountLabel(country.amount)}`,onClick:()=>selectCountry(country.id),onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectCountry(country.id);}}}: {})}><title>{country?`${country.name} · ${amountLabel(country.amount)}`:shape.name}</title></path>;})}{visited.has("MV")?<circle cx="506" cy="172" r={Math.min(3,Number(viewBox.split(" ")[2])/180)} role="button" tabIndex={0} aria-label={`Maldives : ${amountLabel(visited.get("MV")!.amount)}`} className="cursor-pointer fill-emerald-300 stroke-white" onClick={()=>setSelected("MV")} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected('MV');}}}><title>Maldives</title></circle>:null}</g><g>{labels.map(country=>{const {x,y,label}=country;const fontSize=labelFontSize;const labelWidth=country.width;return <g key={country.id} role="button" tabIndex={0} aria-label={`${country.name} : ${label}`} className="cursor-pointer" onClick={()=>setSelected(country.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(country.id);}}}>{y!==country.anchorY?<line x1={x} y1={country.anchorY} x2={x} y2={y} stroke="#6ee7b7" strokeWidth="1" vectorEffect="non-scaling-stroke"/>:null}<rect x={x-labelWidth/2} y={y-fontSize} width={labelWidth} height={fontSize*1.8} rx={fontSize*0.55} fill="#102c36" fillOpacity="0.94" stroke="#6ee7b7" strokeWidth="0.6" vectorEffect="non-scaling-stroke"/><text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize={fontSize} fontWeight="600" className="tabular-nums" pointerEvents="none">{label}</text><title>{country.name} · {label}</title></g>;})}</g></svg>{active||activeEnvelope?<button type="button" onClick={()=>setSelected(null)} className="absolute right-3 top-3 rounded-full border border-ink-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-ink-700 shadow-sm dark:border-white/15 dark:bg-slate-900/90 dark:text-white">Tous les pays visités</button>:null}</div>
    {active?<div role="status" className="mt-3 text-sm font-medium text-ink-900 dark:text-white">{active.name} · {amountLabel(active.amount)}{data.envelopes.some(e=>e.countryIds.includes(active.id))?<p className="mt-1 text-xs font-normal text-ink-500 dark:text-white/60">Total du pays, enveloppes communes incluses.</p>:null}<ul className="mt-2 space-y-2">{active.places.map(place=><li key={place.name} className="border-b border-ink-200/50 py-2 text-xs last:border-0 dark:border-white/10"><div className="flex justify-between gap-3"><span>{place.name}{place.estimated>0?<span className="block text-[10px] font-normal text-ink-500 dark:text-white/60">Dont {fmt.euro(place.estimated)} répartis à parts égales</span>:null}</span><strong className="tabular-nums">{fmt.euro(place.amount)}</strong></div><ul className="mt-2 space-y-1.5">{place.posts.map(post=><li key={post.name} className="flex justify-between gap-3 font-normal text-ink-500 dark:text-white/65"><span>{post.name}{post.estimated>0?<span className="ml-1 text-[10px]">· estimé</span>:null}</span><span className="shrink-0 tabular-nums">{fmt.euro(post.amount)}</span></li>)}</ul></li>)}</ul></div>:null}
    {activeEnvelope?<div role="status" className="mt-3 text-sm text-ink-900 dark:text-white"><div className="flex justify-between gap-3 font-semibold"><span>{activeEnvelope.name}</span><span>{fmt.euro(activeEnvelope.amount)}</span></div><p className="mt-1 text-xs text-ink-500 dark:text-white/60">{activeEnvelope.countryIds.map(id=>visited.get(id)?.name).join(" + ")} · enveloppe commune</p><ul className="mt-2 space-y-2">{activeEnvelope.posts.map(post=><li key={post.name} className="flex justify-between gap-3 text-xs"><span>{post.name}</span><span className="tabular-nums">{fmt.euro(post.amount)}</span></li>)}</ul></div>:null}
    <div className="mt-4 grid grid-cols-2 gap-x-5 sm:grid-cols-3">{mapEntries.map(entry=><button key={entry.id} type="button" aria-pressed={selected===entry.id} onClick={()=>setSelected(entry.id)} className={`flex items-center justify-between gap-2 border-b py-3 text-left text-xs ${selected===entry.id?'border-emerald-400 text-emerald-600 dark:text-emerald-300':'border-ink-200/50 text-ink-700 dark:border-white/10 dark:text-white/80'}`}><span>{entry.name}<span className="mt-1 block text-[10px] text-ink-500 dark:text-white/60">{entry.subtitle}</span></span><strong className="shrink-0 tabular-nums">{amountLabel(entry.amount)}</strong></button>)}</div>
    {data.countries.some(c=>c.places.some(p=>p.estimated>0))?<p className="mt-3 text-[11px] text-ink-500 dark:text-white/60">Pays voisins d’une même enveloppe regroupés. Sélectionnez un montant pour voir les sous-catégories.</p>:null}
    {data.shared.length?<div className="mt-5 border-t border-ink-200/50 pt-4 dark:border-white/10"><h4 className="text-xs font-semibold text-ink-900 dark:text-white">Destination non identifiée · détail des dépenses</h4><div className="mt-2 divide-y divide-ink-200/50 dark:divide-white/10">{data.shared.filter(row=>!active||active.trips.includes(row.name)||!row.name.toLowerCase().includes('voyage')).map(row=><details key={row.name} className="group/destination py-3"><summary className="flex cursor-pointer list-none justify-between gap-3 text-xs font-medium text-ink-800 dark:text-white/85"><span>{row.name}</span><span className="shrink-0 tabular-nums text-emerald-600 dark:text-emerald-300">{fmt.euro(row.amount)} <span className="ml-1 inline-block text-ink-400 transition group-open/destination:rotate-90">›</span></span></summary><ul className="mt-2 space-y-2 pl-2">{row.posts.map(post=><li key={post.name} className="flex justify-between gap-3 text-xs text-ink-500 dark:text-white/60"><span>{post.name}</span><span className="shrink-0 tabular-nums">{fmt.euro(post.amount)}</span></li>)}</ul></details>)}</div></div>:null}
    {!data.total?<p className="mt-3 text-xs text-ink-500 dark:text-white/60">Aucune dépense de voyage sur cette période.</p>:null}
    <p className="mt-3 text-[10px] text-ink-400 dark:text-white/40">Pays identifiés dans les catégories Bankin · dépenses communes comptées une fois. Fond de carte : Natural Earth, domaine public.</p>
  </section>;
}
