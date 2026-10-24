import { expect,it } from "vitest";
import { parseGroceryOrder,groceryProductKey } from "@/lib/groceries/parser";
import { groceryStats } from "@/lib/groceries/stats";
const base={sender:'Carrefour <orders@email.carrefour.fr>',subject:'Votre commande est confirmée',receivedDate:'2026-10-16'};
const table='<p>Commande n° ABC1234</p><p>Total commande : 9,00 €</p><table><tr><th>Produit</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th></tr><tr><td>Pâtes marque test 500 g</td><td>2</td><td>1,50 €</td><td>3,00 €</td></tr><tr><td>Lait test 1 L</td><td>3</td><td>2,00 €</td><td>6,00 €</td></tr></table>';
it('extracts an explicit confirmed order and exact product prices from HTML',()=>{
 const order=parseGroceryOrder({...base,html:table})!;
 expect(order).toMatchObject({merchant:'Carrefour',orderRef:'ABC1234',totalCents:900,date:'2026-10-16'});
 expect(order.items).toHaveLength(2);expect(order.items[0]).toMatchObject({name:'Pâtes marque test 500 g',quantity:2,unitPriceCents:150,totalCents:300});
});
it('rejects advertising, cancellation emails and lookalike sender domains',()=>{
 for(const subject of ['20€ offerts sur votre commande','Votre commande est annulée','Finalisez votre commande'])expect(parseGroceryOrder({...base,subject,html:table})).toBeNull();
 expect(parseGroceryOrder({...base,sender:'orders@carrefour.fr.attacker.test',html:table})).toBeNull();
 expect(parseGroceryOrder({...base,sender:'orders@attacker.test',html:table})).toBeNull();
});
it('does not count text and HTML versions twice or invent missing product detail',()=>{
 const plain='Commande n° ABC1234\nProduit | Qté | Prix unitaire | Total\nPâtes marque test 500 g | 2 | 1,50 € | 3,00 €';
 expect(parseGroceryOrder({...base,html:table,plain})?.items).toHaveLength(2);
 expect(parseGroceryOrder({...base,plain})?.items[0].totalCents).toBe(300);
 expect(parseGroceryOrder({...base,plain:'Commande n° ABC1234. Consultez vos produits sur le site.'})?.items).toEqual([]);
});
it('preserves product formats and computes weighted prices without inventing missing basket totals',()=>{
 const order=parseGroceryOrder({...base,html:table})!;
 const second={...order,date:'2026-10-17',totalCents:null,items:[{...order.items[0],quantity:1,totalCents:200,unitPriceCents:200}]};
 const stats=groceryStats([order,second]);
 expect(stats).toMatchObject({orderCount:2,pricedOrderCount:1,totalCents:900});
 expect(stats.products.find(p=>p.key===order.items[0].productKey)).toMatchObject({quantity:3,totalCents:500,averagePriceCents:167,minPriceCents:150,maxPriceCents:200,lastPriceCents:200,previousPriceCents:150});
 expect(groceryProductKey('Lait 1 L')).not.toBe(groceryProductKey('Lait 50 cl'));
});
it('reads headerless Carrefour Drive products inside nested email layout tables',()=>{
 const html='<p>Commande n° TEST9001</p><table><tr><td><table><tr><td>Montant payé</td><td>11,40€</td></tr><tr><td>Total avant remises :</td><td>12,00€</td></tr></table></td></tr><tr><td><table><tr><td><span>Produit test d&#x27;épicerie 500 g</span></td><td>2</td><td>3,00€</td><td>6,00€</td></tr><tr><td>Autre produit test 1 L</td><td>3</td><td>2,00€</td><td>6,00€</td></tr></table></td></tr></table>';
 const order=parseGroceryOrder({...base,subject:'Confirmation de votre commande Drive',html})!;
 expect(order.totalCents).toBe(1140);
 expect(order.items).toHaveLength(2);
 expect(order.items[0]).toMatchObject({name:"Produit test d'épicerie 500 g",quantity:2,unitPriceCents:300,totalCents:600});
 expect(order.items[1]).toMatchObject({quantity:3,unitPriceCents:200,totalCents:600});
});
it('keeps the headerless layout restricted to Carrefour Drive confirmations and consistent prices',()=>{
 const html='<p>Commande n° TEST9002</p><table><tr><td>Produit test</td><td>2</td><td>3,00€</td><td>60,00€</td></tr></table>';
 expect(parseGroceryOrder({...base,subject:'Confirmation de votre commande Drive',html})?.items).toEqual([]);
 expect(parseGroceryOrder({...base,html})?.items).toEqual([]);
});
