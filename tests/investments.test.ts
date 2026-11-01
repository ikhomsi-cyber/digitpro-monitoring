import {it,expect} from 'vitest';
import {buildBankinPiloteSnapshot,type BankinPiloteRow} from '@/lib/pilote';
import {buildInvestments,rentalInvestmentTotals,investmentAssistantSummary} from '@/lib/investments';
const row=(date:string,amount:number,parentCategory:string,subCategory:string,extra:Partial<BankinPiloteRow>={}):BankinPiloteRow=>({sourceRow:2,date,amount,parentCategory,subCategory,hidden:false,...extra});
const report=(rows:BankinPiloteRow[],asOf='2026-11-01')=>buildInvestments(buildBankinPiloteSnapshot(rows.map((r,i)=>({...r,sourceRow:i+2})),'synthetic.xls','synthetic'),asOf);
it('keeps purchases separate from rental charges and computes the rental gain in cents',()=>{
 const result=report([row('2023-01-15',-150000,'Immobilier','Appart Argenteuil'),row('2026-05-01',950.25,'Entrée locatif','Loyers Reçus'),row('2026-05-02',-85.10,'Charges LMNP','Charges copropriété')]);
 const arg=result.properties.find(p=>p.id==='argenteuil')!;expect(arg.purchaseAmount).toBe(138646);expect(rentalInvestmentTotals(arg)).toMatchObject({income:950.25,charges:85.10,gain:865.15});
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
 const result=report([row('2023-01-15',-100000,'Immobilier','Appart Argenteuil'),row('2025-01-10',500,'Entrée locatif','Loyers Reçus'),row('2026-01-10',600,'Entrée locatif','Loyers Reçus')]);expect(rentalInvestmentTotals(result.properties[1],'2025').gain).toBe(500);expect(result.properties[1].purchaseAmount).toBe(138646);expect(JSON.stringify(result)).not.toContain('label');expect(JSON.stringify(result)).not.toContain('sourceRow');
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
 const result=report([row('2026-05-01',950,'Entrée locatif','Loyer'),row('2026-05-02',-100,'Charges LMNP','Autres'),row('2026-05-03',-45,'Charges LMNP','Dépense'),row('2026-05-04',500,'Revenus','Loyers Reçus')]);expect(rentalInvestmentTotals(result.properties[1])).toMatchObject({income:1450,charges:145,gain:1305});
});
it('recognizes accented source savings categories for the confirmed PER dates',()=>{expect(report([row('2024-11-14',-30000,'BANQUE','Épargne')]).per.contributions).toBe(30000);});

it('uses only the corrected Appart Casa category for the acquisition amount',()=>{const result=report([row('2020-01-10',-80000,'Immobilier','Appart Casa'),row('2020-02-10',-60,'Immobilier','Maison Casa')]);expect(result.properties[0].purchaseAmount).toBe(80000);});

it('the assistant receives the same investment aggregates without raw bank data',()=>{
 const result=report([row('2026-05-01',950,'Entrée locatif','Loyer',{label:'Private bank label',identity:'opaque'})]);const summary=investmentAssistantSummary(result);expect(summary.properties[1].income).toBe(950);expect(JSON.stringify(summary)).not.toContain('Private bank label');expect(JSON.stringify(summary)).not.toContain('opaque');
});

it('recognizes Loyers reçus as parent or child, counts each receipt once and excludes unrelated income',()=>{
 const result=report([row('2026-05-01',950,'Revenus','Loyers reçus'),row('2026-06-01',960,'Loyers reçus','Loyers reçus'),row('2026-06-02',100,'Revenus','Autres'),row('2026-06-03',-120,'Charges LMNP','Autres')]);expect(rentalInvestmentTotals(result.properties[1])).toMatchObject({income:1910,charges:120,gain:1790});
});

it('separates identified notary and works within acquisition without counting them as rental charges',()=>{
 const result=report([row('2023-02-01',-120000,'Immobilier','Appart Argenteuil'),row('2023-02-02',-8000,'Immobilier','Appart Argenteuil',{label:'Frais notaire'}),row('2023-02-03',-5000,'Travaux LMNP','Rénovation'),row('2023-02-04',-1000,'Immobilier','Appart Argenteuil',{label:'Notaire et travaux'}),row('2023-02-05',-60,'Charges LMNP','Copropriété')]);
 const property=result.properties[1];expect(property.purchaseAmount).toBe(143646);expect(property.purchaseBreakdown).toEqual({price:126000,promise:450,notary:10700,prorata:1496,works:5000,other:0});expect(rentalInvestmentTotals(property).charges).toBe(60);
});

it('uses only Travaux LMNP for capital works and never subtracts them again as rental charges',()=>{
 const result=report([row('2023-02-01',-3000,'Travaux LMNP','Autres'),row('2023-02-02',-2000,'Immobilier','Travaux LMNP'),row('2023-02-03',-400,'Immobilier','Appart Argenteuil',{label:'Travaux'}),row('2023-02-04',-80,'Charges LMNP','Copropriété'),row('2023-02-05',900,'Revenus','Loyers reçus')]);
 const property=result.properties[1];expect(property.purchaseBreakdown?.works).toBe(5000);expect(property.purchaseAmount).toBe(143646);expect(rentalInvestmentTotals(property)).toMatchObject({income:900,charges:80,gain:820});
});

it('lists the exact PER operations newest first without banking labels or identifiers',()=>{
 const result=report([row('2024-11-14',-30000,'Banque','Epargne',{label:'Private text',identity:'secret-id'}),row('2026-05-01',500,'Banque','PER')]);expect(result.per.transactions).toEqual([{date:'2026-05-01',amount:500,kind:'withdrawal'},{date:'2024-11-14',amount:30000,kind:'contribution'}]);expect(JSON.stringify(result.per)).not.toContain('Private text');expect(JSON.stringify(investmentAssistantSummary(result).per)).not.toContain('transactions');
});

it('Argenteuil charges come strictly from Charges LMNP, never inferred from bank labels',()=>{
 const result=report([row('2026-05-01',-90,'Charges LMNP','Autres'),row('2026-05-02',-30,'Logement','Charges LMNP',{label:'casa'}),row('2026-05-03',-500,'Logement','Autres',{label:'Argenteuil copropriété LMNP'}),row('2026-05-04',-200,'Impôts & Taxes','Taxe foncière',{label:'Argenteuil'}),row('2026-05-05',-150,'Travaux LMNP','Autres'),row('2026-05-06',950,'Revenus','Loyers reçus')]);
 expect(rentalInvestmentTotals(result.properties[1])).toMatchObject({charges:120,income:950,gain:830});
});

it('sums original Charges LMNP over all imported years before the configured purchase date, excluding hidden and explicit removals',()=>{
 const rows=[row('2022-12-15',-101.23,'Charges LMNP','Autres'),row('2023-01-01',-20.10,'Logement','Charges LMNP'),row('2026-01-01',-100,'Charges LMNP','Autres',{hidden:true}),row('2026-02-01',50,'Charges LMNP','Autres'),row('2026-03-01',-40,'Charges LMNP','Autres',{identity:'removed'})];
 const snapshot=buildBankinPiloteSnapshot(rows.map((r,i)=>({...r,sourceRow:i+2})),'synthetic','hash');snapshot.excludedRowIdentities=['removed'];const property=buildInvestments(snapshot,'2026-11-01').properties[1];expect(rentalInvestmentTotals(property).charges).toBe(121.33);expect(property.chargeTransactions).toEqual([{date:'2022-12-15',amount:101.23},{date:'2023-01-01',amount:20.1}]);
});
