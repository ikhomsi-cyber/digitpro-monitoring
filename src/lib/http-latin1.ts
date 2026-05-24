/**
 * Les en-têtes HTTP et certaines APIs navigateur (ex. Firefox WebIDL « ByteString »)
 * n’acceptent que Latin-1. Une ellipse typographique « … » (U+2026, décimal 8230)
 * copiée depuis une doc provoque souvent : Cannot convert argument to a ByteString.
 */
export function sanitizeLatin1HttpValue(raw: string, label: string): string {
  let s = raw.replace(/\uFEFF/g, "").trim();
  s = s
    .replace(/\u2026/g, "...")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');

  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 255) {
      throw new Error(
        `${label} : caractère non ASCII à la position ${i} (code Unicode ${c}). ` +
          "Souvent une ellipse « … » ou des guillemets « » issus d’un copier-coller — utilisez uniquement des caractères ASCII dans les URLs et secrets (.env.local)."
      );
    }
  }
  return s;
}
