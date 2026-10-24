export type GroceryItem = { name: string; productKey: string; quantity: number; unitPriceCents: number; totalCents: number };
export type GroceryOrder = { merchant: string; orderRef: string; date: string; totalCents: number | null; items: GroceryItem[] };
export const GROCERY_DOMAINS: Record<string, string[]> = { Carrefour: ["carrefour.fr", "carrefour.com"], Auchan: ["auchan.fr", "auchan.com"], "E.Leclerc": ["e-leclerc.com", "leclercdrive.fr"], "Intermarché": ["intermarche.com"], "Courses U": ["coursesu.com", "magasins-u.com"] };
const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g," ").trim();
export function groceryProductKey(name: string) { return fold(name).replace(/[^a-z0-9]/g," ").replace(/\s+/g," ").trim(); }
function text(html: string): string {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;|&#xA0;/gi," ").replace(/&amp;/gi,"&").replace(/&euro;|&#8364;/gi,"€").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&#x([a-f0-9]+);/gi,(_,n)=>String.fromCodePoint(Math.min(parseInt(n,16),0x10ffff))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff))).replace(/\s+/g," ").trim();
}
function money(value: string): number | null {
  const match = value.trim().match(/^(?:€\s*)?(\d[\d\s\u00a0\u202f]*(?:[,.]\d{2}))(?:\s*(?:€|EUR))?$/i);
  if (!match) return null;
  const amount = Math.round(Number(match[1].replace(/[\s\u00a0\u202f]/g,"").replace(",","."))*100);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}
export function groceryMerchant(sender: string): string | null {
  const addresses = sender.match(/[a-z0-9._%+-]+@[a-z0-9.-]+/gi) ?? [];
  if (addresses.length !== 1) return null;
  const domain = addresses[0].split("@")[1].toLowerCase();
  return Object.entries(GROCERY_DOMAINS).find(([,domains])=>domains.some(allowed=>domain===allowed||domain.endsWith(`.${allowed}`)))?.[0] ?? null;
}
export function parseGroceryOrder(input: { sender: string; subject: string; html?: string; plain?: string; receivedDate: string }): GroceryOrder | null {
  const merchant = groceryMerchant(input.sender), subject = fold(input.subject);
  if (!merchant || !/commande/.test(subject) || !/(confirm|valid|enregistr|preparee|preparation|retrait|livree|livraison.*effectuee)/.test(subject) || /(annul|rembours|promotion|offert|reduction|abandon|finalis|valider votre)/.test(subject)) return null;
  const html = input.html ?? "", plain = input.plain ?? "";
  if (html.length + plain.length > 1_000_000) throw new Error("Confirmation de commande trop volumineuse.");
  const body = `${input.subject}\n${plain}\n${text(html)}`;
  const ref = [...body.matchAll(/commande\s*(?:n[°ºo.]?|num[eé]ro|#|r[eé]f[eé]rence)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{3,49})/gi)].map(match=>match[1]).find(value=>/\d/.test(value));
  if (!ref || !/\d/.test(ref)) return null;
  const dateText = body.match(/(?:commande|command[eé]e?)\s+(?:du|le|pass[eé]e le)\s+(\d{2})[/.](\d{2})[/.](\d{4})/i);
  const date = dateText ? `${dateText[3]}-${dateText[2]}-${dateText[1]}` : input.receivedDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date) return null;
  const totalMatch = body.match(/(?:total\s+(?:de\s+(?:la\s+)?)?commande|total\s+(?:pay[eé]|r[eé]gl[eé]|ttc)|montant\s+(?:total|pay[eé]))\s*[:\s]*([\d\s\u00a0\u202f]+[,.]\d{2})\s*(?:€|EUR)/i);
  const totalCents = totalMatch ? money(totalMatch[1]) : null;
  const rawTableRows = [...html.matchAll(/<tr\b[^>]*>((?:(?!<tr\b)[\s\S])*?)<\/tr>/gi)].map(match=>({html:match[1],cells:[...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell=>text(cell[1]))})).filter(row=>row.cells.length>=3);
  const tableRows=rawTableRows.map(row=>row.cells);
  const pipeRows = plain.split(/\r?\n/).filter(line=>line.includes("|")||line.includes("\t")).map(line=>line.split(/[|\t]/).map(cell=>cell.trim()).filter(Boolean));
  const rows = tableRows.length ? tableRows : pipeRows;
  const carrefourDrive = merchant === "Carrefour" && /confirmation.*commande.*drive/.test(subject);
  let header: {name:number;qty:number;unit:number;total:number} | null = null;
  const items: GroceryItem[] = [];
  for (const [rowIndex,cells] of rows.entries()) {
    const normalized = cells.map(fold);
    const name = normalized.findIndex(cell=>/^(produit|article|designation|libelle)(s)?$/.test(cell));
    const qty = normalized.findIndex(cell=>/^(qte|qt[eé]\.?|quantite)(s)?$/.test(cell));
    if (name>=0 && qty>=0) { header={name,qty,unit:normalized.findIndex(cell=>/prix.*unit|^p\.?u\.?$/.test(cell)),total:normalized.findIndex(cell=>/total|montant/.test(cell))}; continue; }
    // Carrefour Drive confirmations contain headerless product rows inside nested layout tables.
    // Recognize only their exact four-column layout; summary/payment rows must never become products.
    const driveRow = carrefourDrive && cells.length === 4 && /[a-z]/i.test(fold(cells[0]))
      && /^\d+(?:[,.]\d+)?$/.test(cells[1]) && money(cells[2]) !== null && money(cells[3]) !== null;
    const columns = driveRow ? {name:0,qty:1,unit:2,total:3} : header;
    if (!columns || cells.length<=Math.max(columns.name,columns.qty)) continue;
    const label=cells[columns.name]?.trim(), quantity=Number(cells[columns.qty]?.replace(",",".").replace(/\s*(?:x|unites?|pieces?)$/i,""));
    if (!label || label.length>300 || !Number.isFinite(quantity)||quantity<=0||quantity>1000 || /^(total|sous.total|livraison|remise|reduction|frais)/i.test(fold(label))) continue;
    const explicitTotal=columns.total>=0 ? money(cells[columns.total]??"") : null;
    const explicitUnit=columns.unit>=0 ? money(cells[columns.unit]??"") : null;
    if (driveRow && explicitUnit!==null && explicitTotal!==null && Math.abs(Math.round(explicitUnit*quantity)-explicitTotal)>1) continue;
    const total=explicitTotal ?? (explicitUnit!==null ? Math.round(explicitUnit*quantity) : null);
    if (total===null || total>10_000_000) continue;
    const productKey=groceryProductKey(label), unitPriceCents=Math.round(total/quantity);
    if(!productKey || unitPriceCents>10_000_000)continue;
    items.push({name:label,productKey,quantity,unitPriceCents,totalCents:total});
    if(items.length>500) throw new Error("La confirmation contient trop de lignes produits.");
  }
  return {merchant,orderRef:ref.toUpperCase(),date,totalCents,items};
}
