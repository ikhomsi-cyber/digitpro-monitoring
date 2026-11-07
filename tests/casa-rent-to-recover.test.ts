import {expect,it} from 'vitest';
import {rentalMonthlyNetGain,casaRentToRecover,type RentalInvestment} from '@/lib/investments';
it('counts Casa rents from April 2026 inclusive, independently of display year',()=>{
 const month=(month:string,bankRent:number,declaredRent:number)=>({month,bankRent,declaredRent,charges:50,gain:bankRent+declaredRent-50});
 const property:RentalInvestment={id:'casa',name:'Maison Casa',city:'Casablanca',purchaseAmount:54850,purchaseDate:null,purchaseCount:0,months:[month('2026-03',0,300),month('2026-04',0,300),month('2026-05',300,0),month('2027-01',0,300)]};
 expect(casaRentToRecover(property)).toBe(900);
 expect(casaRentToRecover({...property,id:'argenteuil'})).toBe(0);
 expect(casaRentToRecover({...property,months:[]})).toBe(0);
});

it('averages net rent after charges over calendar months, including gaps',()=>{
 const property:RentalInvestment={id:'argenteuil',name:'Argenteuil',city:'Argenteuil',purchaseAmount:138646,purchaseDate:null,purchaseCount:0,months:[{month:'2025-12',bankRent:950,declaredRent:0,charges:350,gain:600},{month:'2026-02',bankRent:950,declaredRent:0,charges:50,gain:900}]};
 expect(rentalMonthlyNetGain(property)).toBe(500);
 expect(rentalMonthlyNetGain(property,'2026')).toBe(900);
 expect(rentalMonthlyNetGain(property,'2024')).toBeNull();
});
