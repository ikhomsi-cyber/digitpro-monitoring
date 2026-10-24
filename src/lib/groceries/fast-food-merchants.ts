/** Fixed merchant aliases and official logo hosts; never derive a URL from bank labels. */
export const fastFoodMerchants = [
  { name: "Uber Eats", pattern: /\buber[\s*._\-]*eats?\b/i, domain: "www.ubereats.com" },
  { name: "McDonald’s", pattern: /\b(?:mc[\s’']?donald[’']?s?|mcdo)\b/i, domain: "www.mcdonalds.fr" },
  { name: "Burger King", pattern: /\bburger\s*king\b/i, domain: "www.burgerking.fr" },
  { name: "KFC", pattern: /\b(?:kfc|kentucky fried chicken)\b/i, domain: "www.kfc.fr" },
  { name: "Quick", pattern: /\bquick\b/i, domain: "www.quick.fr" },
  { name: "Subway", pattern: /\bsubway\b/i, domain: "www.subway.com" },
  { name: "Domino’s Pizza", pattern: /\bdomino(?:[\s’'‘`´\-._]*s)?(?:[\s\-._]*pizza)?(?=\b|\d)/i, domain: "www.dominos.fr" },
  { name: "Pizza Hut", pattern: /\bpizza\s*hut\b/i, domain: "www.pizzahut.fr" },
  { name: "O’Tacos", pattern: /\bo[\s’'\-]?tacos\b/i, domain: "o-tacos.com" },
  { name: "Five Guys", pattern: /\bfive\s*guys\b/i, domain: "www.fiveguys.fr" },
  { name: "Pokawa", pattern: /\bpokawa\b/i, domain: "www.pokawa.com" },
  { name: "Bagelstein", pattern: /\bbagelstein\b/i, domain: "www.bagelstein.com" },
  { name: "Taco Bell", pattern: /\btaco\s*bell\b/i, domain: "www.tacobell.com" }
];
