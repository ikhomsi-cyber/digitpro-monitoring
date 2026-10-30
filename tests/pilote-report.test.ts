import { gzipSync } from 'node:zlib';
import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { decodePiloteReport } from '@/lib/bankin/pilote-report';
const report = { version: 2, months: [], sourceFilename: 'synthetic.xlsx', fileHash: 'fixture', sourceRows: 0, excludedInternal: 0, excludedHidden: 0, importedAt: '2026-10-21T00:00:00Z' };
it('reads historical and compressed reports without returning transaction rows or backups', () => {
 const stored = { ...report, rows: [], rowsCompressed: 'unused', legacyBackup: { months: [] } };
 expect(decodePiloteReport(stored)).toEqual(report);
 expect(decodePiloteReport({ storageVersion: 1, payloadCompressed: gzipSync(JSON.stringify(stored)).toString('base64') })).toEqual(report);
});
it('rejects corrupt reports before the UI receives an object without months', () => {
 for (const value of [null, {}, { storageVersion: 2, payloadCompressed: 'bad' }, { storageVersion: 1, payloadCompressed: 'bad' }]) expect(() => decodePiloteReport(value)).toThrow();
});

it('recomputes a saved aggregate from the confirmed PER row without exposing the source',()=>{
 const decoded=decodePiloteReport({...report,rows:[{sourceRow:2,date:'2026-09-07',amount:-30000,parentCategory:'Banque',subCategory:'Epargne',hidden:false}]});
 expect(decoded.months[0].categories[0].children[0]).toMatchObject({name:'PER',expenses:30000});
 expect(decoded).not.toHaveProperty('rows');
});
