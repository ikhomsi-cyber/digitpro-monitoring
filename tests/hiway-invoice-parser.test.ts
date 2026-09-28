import {expect,it} from 'vitest';
import {parseHiwayInvoice} from '@/lib/gmail/hiway-invoice-parser';
it('parses the actual Hiway format with its explicit payment deadline',()=>{
  const invoice=parseHiwayInvoice({id:'latest',subject:'DigitPro Consulting - Facture F1047',dateIso:'2026-09-28',body:"Date d’échéance :\n31/10/2026\n22 x 940.00€\nTOTAL HT : 20 680.00€\nTOTAL TVA : 4 136.00€\nTOTAL TTC : 24 816.00€"});
  expect(invoice).toMatchObject({amountEur:20680,amountKind:'HT',billedDays:22,tjmHtEur:940,dueDate:'2026-10-31'});
});
it('rejects impossible deadlines',()=>{
  expect(parseHiwayInvoice({id:'x',subject:'Facture',dateIso:'2026-09-28',body:'Échéance : 31/02/2026'}).dueDate).toBeNull();
});
