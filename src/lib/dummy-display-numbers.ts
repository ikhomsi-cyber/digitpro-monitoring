/**
 * Transformations déterministes pour l’affichage « données fictives » (screenshots, démos devant tiers).
 * Les vraies valeurs restent en mémoire / base ; seul le rendu change.
 */

export function djb2Hash32(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h, 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

/**
 * Montant en € : conserve le signe, valeur différente mais **toujours plus basse** que le réel
 * (18 %–58 % du montant), pour ne jamais sur-représenter l'activité lors d'une démo/capture.
 */
export function maskMoneyAmount(real: number): number {
  if (!Number.isFinite(real) || real === 0) return real;
  const h = djb2Hash32(`eur|${real.toExponential(12)}`);
  const sign = real < 0 ? -1 : 1;
  const abs = Math.abs(real);
  const factor = 0.18 + (h % 10_000) / 10_000 * 0.4;
  const flat = (((h >>> 12) % 2001) - 1000) / 100;
  const scaled = abs * factor + flat * (abs >= 800 ? 1 : abs >= 80 ? 0.1 : 0.01);
  const out = Math.round(Math.max(Math.abs(scaled), 0.01) * 100) / 100;
  return sign * out;
}

/** Entier ≥ 0 (jours, nombre de mois, etc.). */
export function maskPositiveInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const r = Math.round(n);
  if (r <= 0) return r;
  const h = djb2Hash32(`int|${r}`);
  // Toujours en dessous du réel : 30 %–85 % de la valeur.
  const lo = Math.max(1, Math.floor(r * 0.3));
  const hi = Math.max(lo + 1, Math.ceil(r * 0.85));
  const span = hi - lo;
  return lo + (h % (span + 1));
}

/** Pourcentage affiché sur l’échelle 0–100 (ex. 67 pour 67 %). */
export function maskPercent0to100(p: number): number {
  if (!Number.isFinite(p)) return 0;
  const clamped = Math.max(0, Math.min(100, Math.round(p)));
  if (clamped === 0) return 0;
  const h = djb2Hash32(`p100|${clamped}`);
  return Math.min(100, Math.max(3, 4 + (h % 94)));
}
