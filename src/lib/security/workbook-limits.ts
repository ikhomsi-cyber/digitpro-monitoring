/** Inspect ZIP central-directory sizes before SheetJS can allocate/decompress XLSX entries. */
export function checkWorkbookArchive(buffer: ArrayBuffer): void {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint32(0, true) !== 0x04034b50) return; // XLS/other non-ZIP formats.
  const reject = () => { throw new Error("Archive Excel invalide ou trop volumineuse."); };
  let end = -1;
  for (let at = view.byteLength - 22; at >= Math.max(0, view.byteLength - 65_557); at--) {
    if (view.getUint32(at, true) === 0x06054b50 && at + 22 + view.getUint16(at + 20, true) === view.byteLength) {
      end = at; break;
    }
  }
  if (end < 0) return reject();
  const entries = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0 ||
    entries !== view.getUint16(end + 8, true) || entries > 200 || offset + size !== end) return reject();
  let at = offset, total = 0;
  for (let i = 0; i < entries; i++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) return reject();
    const flags = view.getUint16(at + 8, true);
    const compressed = view.getUint32(at + 20, true), expanded = view.getUint32(at + 24, true);
    total += expanded;
    if ((flags & 1) !== 0 || expanded > 16 * 1024 * 1024 || total > 32 * 1024 * 1024 ||
      expanded > Math.max(compressed, 1) * 200 || view.getUint32(at + 42, true) >= offset) return reject();
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (at > end) return reject();
  }
  if (at !== end) return reject();
}
