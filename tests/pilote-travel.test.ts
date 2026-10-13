import {expect,it} from "vitest";
import {buildPiloteTravel} from "@/lib/pilote-travel";
import {buildPiloteMonths,type BankinPiloteRow} from "@/lib/pilote";
const row=(sourceRow:number,parentCategory:string,subCategory:string,amount:number):BankinPiloteRow=>({sourceRow,date:"2026-10-01",parentCategory,subCategory,amount,hidden:false});
it("allocates known destinations and keeps ambiguous costs separate without double counting",()=>{
 const data=buildPiloteTravel(buildPiloteMonths([row(1,"Voyage Minorque 26","Hôtel",-100),row(2,"Voyage Maroc Espagne 25","Villa Marrakech",-200),row(3,"Voyage Bodrum Kos 26","Transport Bodrum Kos",-300),row(4,"Loisirs & Sorties","Voyages / Vacances",-20),row(5,"Logement","Loyer",-500),{...row(6,"Voyage Tenerife 24","Hôtel",-999),hidden:true}]));
 expect(data.total).toBe(620);expect(data.countries.find(c=>c.id==='ES')?.amount).toBe(100);expect(data.countries.find(c=>c.id==='MA')?.amount).toBe(200);expect(data.countries.find(c=>c.id==='TR')?.amount).toBe(0);expect(data.countries.find(c=>c.id==='GR')?.amount).toBe(0);
 expect(data.countries.reduce((s,c)=>s+c.amount,0)+data.shared.reduce((s,c)=>s+c.amount,0)).toBe(data.total);
});
it("handles empty history",()=>expect(buildPiloteTravel([])).toEqual({total:0,countries:[],shared:[]}));

it("breaks grouped destinations down by original expense names and merges repeated posts",()=>{
 const data=buildPiloteTravel(buildPiloteMonths([row(1,"Voyage Bodrum Kos 26","Transport Bodrum Kos",-30),row(2,"Voyage Bodrum Kos 26","Hôtel Bodrum Kos",-100),row(3,"Voyage Bodrum Kos 26","Transport Bodrum Kos",-20)]));
 expect(data.shared[0]).toEqual({name:"Voyage Bodrum Kos 26",amount:150,posts:[{name:"Hôtel Bodrum Kos",amount:100},{name:"Transport Bodrum Kos",amount:50}]});
 expect(data.countries.reduce((s,c)=>s+c.amount,0)+data.shared.reduce((s,c)=>s+c.amount,0)).toBe(150);
});
