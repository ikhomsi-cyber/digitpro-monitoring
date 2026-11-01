import {it,expect} from 'vitest';
import {buildBankinPiloteSnapshot,type BankinPiloteRow} from '@/lib/pilote';
import {buildInvestments,rentalInvestmentTotals,investmentAssistantSummary} from '@/lib/investments';
const row=(date:string,amount:number,parentCategory:string,subCategory:string,extra:Partial<BankinPiloteRow>={}):BankinPiloteRow=>({sourceRow:2,date,amount,parentCategory,subCategory,hidden:false,...extra});
const report=(rows:BankinPiloteRow[],asOf='2026-11-01')=>buildInvestments(buildBankinPiloteSnapshot(rows.map((r,i)=>({...r,sourceRow:i+2})),'synthetic.xls','synthetic'),asOf);
it('keeps purchases separate from rental charges and computes the rental gain in cents',()=>{
 const result=report([row('2023-01-15',-150000,'Immobilier','Appart Argenteuil'),row('2026-05-01',950.25,'Entrée locatif','Loyers Reçus'),row('2026-05-02',-85.10,'Charges LMNP','Charges copropriété')]);
 const arg=result.properties.find(p=>p.id==='argenteuil')!;expect(arg.purchaseAmount).toBe(150000);expect(rentalInvestmentTotals(arg)).toMatchObject({income:950.25,charges:85.10,gain:865.15});
});
it('reuses the declared Casa rent and replaces it with an identified receipt in the same month',()=>{
 const result=report([row('2024-03-01',-90000,'Immobilier','Appart Casa'),row('2024-04-10',-10,'Divers','Divers'),row('2024-05-10',350,'Revenus','Loyer Maroc'),row('2024-05-11',-50,'Charges Casa','Gestion locative')]);
 const casa=result.properties[0];expect(casa.purchaseAmount).toBe(90000);expect(rentalInvestmentTotals(casa)).toMatchObject({income:650,bankRent:350,declaredRent:300,charges:50,gain:600});expect(casa.months).toHaveLength(2);
});
it('does not extrapolate rent into months missing from the imported report or before April 2024',()=>{
 const result=report([row('2024-03-01',-100,'Divers','Divers'),row('2024-04-01',-10,'Divers','Divers'),row('2024-06-01',-10,'Divers','Divers')]);expect(result.properties[0].months.map(m=>m.month)).toEqual(['2024-04','2024-06']);expect(rentalInvestmentTotals(result.properties[0]).declaredRent).toBe(600);
});
it('recognizes the two confirmed 30k PER transfers without reclassifying all savings as PER',()=>{
 const result=report([row('2024-11-14',-30000,'Banque','Epargne',{hidden:true}),row('2026-09-07',-30000,'Banque','Epargne'),row('2026-10-01',-500,'Banque','Epargne'),row('2026-10-03',1000,'Banque','PER')]);expect(result.per).toMatchObject({contributions:60000,withdrawals:1000,netContributions:59000,count:3});expect(result.per.years.map(y=>y.year)).toEqual(['2024','2026']);
});
it('ignores future and explicitly excluded source records without counting hidden rent transfers',()=>{
 const snapshot=buildBankinPiloteSnapshot([row('2026-10-01',-100,'Immobilier','Appart Casa',{identity:'excluded'}),row('2027-01-01',-200,'Banque','PER'),row('2026-10-01',1000,'Entrée locatif','Loyers Reçus',{hidden:true})],'synthetic','fixture');snapshot.excludedRowIdentities=['excluded'];const result=buildInvestments(snapshot,'2026-11-01');expect(result.properties[0].purchaseAmount).toBeNull();expect(result.per.contributions).toBeNull();expect(rentalInvestmentTotals(result.properties[1]).income).toBe(0);
});
it('filters rental periods but retains the acquisition price and never calls market value a gain',()=>{
 const result=report([row('2023-01-15',-100000,'Immobilier','Appart Argenteuil'),row('2025-01-10',500,'Entrée locatif','Loyers Reçus'),row('2026-01-10',600,'Entrée locatif','Loyers Reçus')]);expect(rentalInvestmentTotals(result.properties[1],'2025').gain).toBe(500);expect(result.properties[1].purchaseAmount).toBe(100000);expect(JSON.stringify(result)).not.toContain('label');expect(JSON.stringify(result)).not.toContain('sourceRow');
});
it('returns missing amounts instead of inventing capital when no source exists',()=>{const result=buildInvestments(null,'2026-11-01');expect(result.hasSource).toBe(false);expect(result.per.netContributions).toBeNull();expect(result.properties.every(p=>p.purchaseAmount===null)).toBe(true);});

it('uses Appart Casa as a parent category and sums its source purchase debits',()=>{
 const result=report([row('2020-01-10',-80000,'Appart Casa','Autres'),row('2020-02-10',-15000,'Appart Casa','Frais acquisition')]);expect(result.properties[0].purchaseAmount).toBe(95000);expect(result.properties[0].purchaseCount).toBe(2);
});
it('includes the confirmed November 2025 PER and September 2026 Meryeme transfer',()=>{
 const result=report([row('2025-11-12',-30000,'Virements','Virement interne'),row('2026-09-12',-17000,'Virements','Virement interne',{label:'Virement Meryeme'}),row('2026-09-14',-500,'Virements','Meryeme')]);expect(result.per).toMatchObject({contributions:47000,netContributions:47000,count:2});
});
it('does not guess which of two ambiguous 17k transfers is the confirmed PER',()=>{
 const result=report([row('2026-09-12',-17000,'Virements','Autres'),row('2026-09-14',-17000,'Virements','Autres')]);expect(result.per.contributions).toBeNull();
});
it('uses the recipient to distinguish a confirmed PER from another same-amount transfer',()=>{
 const result=report([row('2026-09-12',-17000,'Virements','Autres',{label:'Virement Meryeme'}),row('2026-09-14',-17000,'Virements','Autres',{label:'Autre beneficiaire'})]);expect(result.per.contributions).toBe(17000);
});

it('uses the confirmed rental income category and includes every Charges LMNP debit',()=>{
 const result=report([row('2026-05-01',950,'Entrée locatif','Loyer'),row('2026-05-02',-100,'Charges LMNP','Autres'),row('2026-05-03',-45,'Charges LMNP','Dépense'),row('2026-05-04',500,'Revenus','Loyers Reçus')]);expect(rentalInvestmentTotals(result.properties[1])).toMatchObject({income:950,charges:145,gain:805});
});
it('recognizes accented source savings categories for the confirmed PER dates',()=>{expect(report([row('2024-11-14',-30000,'BANQUE','Épargne')]).per.contributions).toBe(30000);});

it('uses only the corrected Appart Casa category for the acquisition amount',()=>{const result=report([row('2020-01-10',-80000,'Immobilier','Appart Casa'),row('2020-02-10',-60,'Immobilier','Maison Casa')]);expect(result.properties[0].purchaseAmount).toBe(80000);});

it('the assistant receives the same investment aggregates without raw bank data',()=>{
 const result=report([row('2026-05-01',950,'Entrée locatif','Loyer',{label:'Private bank label',identity:'opaque'})]);const summary=investmentAssistantSummary(result);expect(summary.properties[1].income).toBe(950);expect(JSON.stringify(summary)).not.toContain('Private bank label');expect(JSON.stringify(summary)).not.toContain('opaque');
});
