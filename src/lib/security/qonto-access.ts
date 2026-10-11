import "server-only";

export class QontoAccessError extends Error {
  readonly status = 403;
  constructor() { super("Accès Qonto non autorisé pour ce compte."); }
}

/** Global banking credentials belong to one explicitly configured owner. Fail closed. */
export function assertQontoOwner(userId: string): void {
  const owner = process.env.QONTO_ALLOWED_USER_ID?.trim();
  if (!owner || !userId || userId !== owner) throw new QontoAccessError();
}

export function isQontoOwner(userId: string | undefined): boolean {
  try { assertQontoOwner(userId ?? ""); return true; } catch { return false; }
}
