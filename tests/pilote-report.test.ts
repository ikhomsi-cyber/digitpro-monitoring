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
