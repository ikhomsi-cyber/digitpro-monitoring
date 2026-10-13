import {expect,it} from "vitest";
import {buildPiloteTravel} from "@/lib/pilote-travel";
import {buildPiloteMonths,type BankinPiloteRow} from "@/lib/pilote";
const row=(sourceRow:number,parentCategory:string,subCategory:string,amount:number):BankinPiloteRow=>({sourceRow,date:"2026-10-01",parentCategory,subCategory,amount,hidden:false});
it("allocates known destinations and splits shared destination costs without double counting",()=>{
 const data=buildPiloteTravel(buildPiloteMonths([row(1,"Voyage Minorque 26","Hôtel",-100),row(2,"Voyage Maroc Espagne 25","Villa Marrakech",-200),row(3,"Voyage Bodrum Kos 26","Transport Bodrum Kos",-300),row(4,"Loisirs & Sorties","Voyages / Vacances",-20),row(5,"Logement","Loyer",-500),{...row(6,"Voyage Tenerife 24","Hôtel",-999),hidden:true}]));
 expect(data.total).toBe(620);expect(data.countries.find(c=>c.id==='ES')?.amount).toBe(100);expect(data.countries.find(c=>c.id==='MA')?.amount).toBe(200);expect(data.countries.find(c=>c.id==='TR')?.amount).toBe(150);expect(data.countries.find(c=>c.id==='GR')?.amount).toBe(150);
 expect(data.countries.reduce((s,c)=>s+c.amount,0)+data.shared.reduce((s,c)=>s+c.amount,0)).toBe(data.total);
});
it("handles empty history",()=>expect(buildPiloteTravel([])).toEqual({total:0,countries:[],shared:[]}));

it("breaks grouped destinations down by original expense names and merges repeated posts",()=>{
 const data=buildPiloteTravel(buildPiloteMonths([row(1,"Voyage Bodrum Kos 26","Transport Bodrum Kos",-30),row(2,"Voyage Bodrum Kos 26","Hôtel Bodrum Kos",-100),row(3,"Voyage Bodrum Kos 26","Transport Bodrum Kos",-20)]));
 expect(data.shared).toEqual([]);
 expect(data.countries.find(c=>c.id==='GR')?.places.map(({posts,...place})=>place)).toEqual([{name:'Kos',amount:75,estimated:75}]);
 expect(data.countries.reduce((s,c)=>s+c.amount,0)+data.shared.reduce((s,c)=>s+c.amount,0)).toBe(150);
});

it("splits multiple cities in one country and preserves odd cents",()=>{
 const data=buildPiloteTravel(buildPiloteMonths([row(1,"Voyage Bodrum Antalya Kos","Hôtel",-100)]));
 expect(data.countries.find(c=>c.id==='TR')?.places.map(({posts,...place})=>place)).toEqual([{name:'Bodrum',amount:33.34,estimated:33.34},{name:'Antalya',amount:33.33,estimated:33.33}]);
 expect(data.countries.find(c=>c.id==='GR')?.amount).toBe(33.33);
 expect(Math.round(data.countries.reduce((s,c)=>s+c.amount,0)*100)).toBe(10000);
});
it("prioritizes a named city over the multi-country trip and deduplicates aliases",()=>{
 const data=buildPiloteTravel(buildPiloteMonths([row(1,"Voyage Maroc Espagne","Hôtel Benalmadena Espagne",-100),row(2,"Voyage Londres London","Hôtel",-50)]));
 expect(data.countries.find(c=>c.id==='ES')?.places.map(({posts,...place})=>place)).toEqual([{name:'Benalmádena',amount:100,estimated:0}]);
 expect(data.countries.find(c=>c.id==='GB')?.places.map(({posts,...place})=>place)).toEqual([{name:'Londres',amount:50,estimated:0}]);
});

it("exposes the allocated subcategories for each city",()=>{
 const data=buildPiloteTravel(buildPiloteMonths([row(1,"Voyage Bodrum Kos","Hôtel",-100),row(2,"Voyage Bodrum Kos","Transport",-30),row(3,"Voyage Bodrum Kos","Hôtel",-20)]));
 const kos=data.countries.find(c=>c.id==='GR')!.places[0];
 expect(kos.posts).toEqual([{name:'Hôtel',amount:60,estimated:60},{name:'Transport',amount:15,estimated:15}]);
 expect(kos.posts.reduce((sum,post)=>sum+post.amount,0)).toBe(kos.amount);
});
