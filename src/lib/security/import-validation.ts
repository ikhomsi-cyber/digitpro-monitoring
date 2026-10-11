import { z } from "zod";

export const MAX_IMPORT_ROWS = 10_000;
/** Bankin exports can contain the full personal history, still bounded by the same file/archive limits. */
export const MAX_BANKIN_IMPORT_ROWS = 20_000;
export const MAX_IMPORT_BYTES = 3 * 1024 * 1024;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const row = z.object({
  date, label: z.string().max(1000), category: z.string().max(200),
  amount: z.number().finite().min(-1e12).max(1e12),
  balance: z.number().finite().min(-1e12).max(1e12).nullable().optional(),
  company: z.string().max(200), bankName: z.string().max(200).nullable().optional(),
  scope: z.enum(["pro", "personal"]).optional(), dedupeKey: z.string().max(300).optional()
});
const metadata = z.object({
  sourceFilename: z.string().max(300).nullable(), format: z.enum(["qonto", "generic", "bankin", "powens"]),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/i).nullable()
});

export function validateImport(transactions: unknown, meta: unknown) {
  const settings = metadata.safeParse(meta);
  if (!settings.success) throw new Error("Métadonnées d’import invalides.");
  const limit = settings.data.format === "bankin" ? MAX_BANKIN_IMPORT_ROWS : MAX_IMPORT_ROWS;
  const rows = z.array(row).max(limit).safeParse(transactions);
  if (!rows.success) throw new Error(`Import invalide ou trop volumineux (${limit.toLocaleString("fr-FR")} lignes maximum).`);
  return { rows: rows.data, meta: settings.data };
}
