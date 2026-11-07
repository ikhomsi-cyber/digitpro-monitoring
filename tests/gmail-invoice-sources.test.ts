import {expect,it} from 'vitest';
import {hiwayInvoiceGmailQuery,isDigitProInvoiceEmail} from '@/lib/gmail/config';
it('searches Hiway and QuickBooks while validating the requested prefix',()=>{
 expect(hiwayInvoiceGmailQuery()).toContain('from:quickbooks@notification.intuit.com');
 expect(hiwayInvoiceGmailQuery()).toContain('from:noreply@hiway.fr');
 expect(isDigitProInvoiceEmail('QuickBooks <quickbooks@notification.intuit.com>','DIGITPRO CONSULTING - Facture F1048')).toBe(true);
 expect(isDigitProInvoiceEmail('noreply@hiway.fr','DigitPro Consulting - Facture F1048')).toBe(true);
 expect(isDigitProInvoiceEmail('quickbooks@notification.intuit.com','Autre - Facture F1048')).toBe(false);
 expect(isDigitProInvoiceEmail('quickbooks@notification.intuit.com','DIGITPRO CONSULTING - Facture quelconque')).toBe(false);
 expect(isDigitProInvoiceEmail('quickbooks@notification.intuit.com.evil.test','DIGITPRO CONSULTING - Facture F1048')).toBe(false);
});

it('includes the Hiway Freelance sender and rejects lookalike senders',()=>{
 expect(hiwayInvoiceGmailQuery()).toContain('from:noreply.hiway@hiway-freelance.com');
 expect(isDigitProInvoiceEmail('Hiway <noreply.hiway@hiway-freelance.com>','DigitPro Consulting - Facture F1022')).toBe(true);
 expect(isDigitProInvoiceEmail('noreply.hiway@hiway-freelance.com','Autre facture')).toBe(false);
 expect(isDigitProInvoiceEmail('noreply.hiway@hiway-freelance.com.evil.test','DigitPro Consulting - Facture F1022')).toBe(false);
});
