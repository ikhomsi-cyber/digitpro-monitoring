/**
 * Jours fériés France métropolitaine (Code du travail), sans jours ouvrés décalés.
 * Inclut Pâques + 1, Ascension, Pentecôte + 1 ; exclut le Vendredi saint (sauf Alsace-Moselle).
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Dimanche de Pâques (date locale). Algorithme d’Anonyme / Meeus, calendrier grégorien. */
function easterSundayUtcMidnight(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addCalendarDays(d: Date, days: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + days);
  return x;
}

function toIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** ISO YYYY-MM-DD → libellé court du jour férié (France métro). */
export function getFrenchPublicHolidaysForYear(year: number): ReadonlyMap<string, string> {
  const m = new Map<string, string>();
  const put = (iso: string, label: string) => m.set(iso, label);

  put(`${year}-01-01`, "Jour de l’an");
  put(`${year}-05-01`, "Fête du Travail");
  put(`${year}-05-08`, "Victoire 1945");
  put(`${year}-07-14`, "Fête nationale");
  put(`${year}-08-15`, "Assomption");
  put(`${year}-11-01`, "Toussaint");
  put(`${year}-11-11`, "Armistice 1918");
  put(`${year}-12-25`, "Noël");

  const easter = easterSundayUtcMidnight(year);
  put(toIsoLocal(addCalendarDays(easter, 1)), "Lundi de Pâques");
  put(toIsoLocal(addCalendarDays(easter, 39)), "Ascension");
  put(toIsoLocal(addCalendarDays(easter, 50)), "Lundi de Pentecôte");

  return m;
}
