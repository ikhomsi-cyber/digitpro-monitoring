import {expect,it} from 'vitest';
import {parseHiwayInvoice,hiwayInvoiceReference,uniqueHiwayInvoices} from '@/lib/gmail/hiway-invoice-parser';
it('parses the actual Hiway format with its explicit payment deadline',()=>{
  const invoice=parseHiwayInvoice({id:'latest',subject:'DigitPro Consulting - Facture F1047',dateIso:'2026-09-28',body:"Date d’échéance :\n31/10/2026\n22 x 940.00€\nTOTAL HT : 20 680.00€\nTOTAL TVA : 4 136.00€\nTOTAL TTC : 24 816.00€"});
  expect(invoice).toMatchObject({amountEur:20680,amountKind:'HT',billedDays:22,tjmHtEur:940,dueDate:'2026-10-31'});
});
it('rejects impossible deadlines',()=>{
  expect(parseHiwayInvoice({id:'x',subject:'Facture',dateIso:'2026-09-28',body:'Échéance : 31/02/2026'}).dueDate).toBeNull();
});

it('reads explicit QuickBooks HT totals without currency and keeps HT separate from the amount due',()=>{
 const parsed=parseHiwayInvoice({id:'synthetic-quickbooks',subject:'DIGITPRO CONSULTING - Facture F9999',dateIso:'2023-10-31',body:'Montant dû : 12 000,00 EUR\nTotal HT : 10Â\u00a0000,00\nTotal TVA : 2 000,00\nTotal: 12 000,00 EUR'});
 expect(parsed.amountEur).toBe(10000);expect(parsed.amountKind).toBe('HT');
});

it('extracts the invoice number from imported subjects',()=>{
 expect(hiwayInvoiceReference('DigitPro Consulting - Facture F1022')).toBe('F1022');
 expect(hiwayInvoiceReference('DIGITPRO CONSULTING - Facture F2026-001')).toBe('F2026-001');
 expect(hiwayInvoiceReference('Autre message')).toBeNull();
});

it('counts repeated emails once while retaining distinct invoice references',()=>{
 const invoice=parseHiwayInvoice({id:'first',subject:'DigitPro Consulting - Facture F9999',dateIso:'2023-10-31',body:'Total HT : 10 000,00 EUR'});
 expect(uniqueHiwayInvoices([invoice,{...invoice,id:'repeat'},{...invoice,id:'other',subject:'DigitPro Consulting - Facture F9998'}])).toHaveLength(2);
});
