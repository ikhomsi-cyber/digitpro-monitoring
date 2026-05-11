import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  Car,
  Cloud,
  Film,
  Gift,
  HeartPulse,
  Home,
  Landmark,
  MoreHorizontal,
  Percent,
  Receipt,
  Rocket,
  Shield,
  ShoppingBag,
  Smartphone,
  UtensilsCrossed,
  Zap
} from "lucide-react";

/** Icon + hints for donut / list rows (French keywords). */
export function categoryGlyph(category: string): LucideIcon {
  const n = category.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

  if (n === "bnc") return Briefcase;
  if (n === "tva") return Percent;
  if (n === "urssaf") return HeartPulse;
  if (n === "hiway") return Building2;
  if (n === "cesu") return Gift;
  if (n.includes("icloud ia store")) return Cloud;
  if (n === "qonto") return Landmark;
  if (n === "assurance") return Shield;
  if (n === "mutuelle") return HeartPulse;
  if (n.includes("mobile et internet")) return Smartphone;
  if ((n.includes("indemnit") && n.includes("kilomet")) || /\bik\b/.test(n)) return Car;
  if (n.includes("repas d'affaire") || n.includes("repas d affaire")) return UtensilsCrossed;
  if (n.includes("repas dirigeant")) return UtensilsCrossed;
  if (n === "autres") return MoreHorizontal;

  if (/loyer|logement|habitat|charges?\s+fix|electricite|eau|gaz/.test(n)) return Home;
  if (/restaurant|aliment|courses|supermarche|epicerie|nourriture/.test(n) || n.includes("food"))
    return UtensilsCrossed;
  if (/transports?|essence|parking|peage|train|uber|taxi|auto\b/.test(n)) return Car;
  if (/shopping|vetements|mode/.test(n)) return ShoppingBag;
  if (/abonnement|telecom|mobile|internet|saas|spotify|netflix/.test(n)) return Smartphone;
  if (/sport|fitness|loisir|sortie|vacances/.test(n)) return Film;
  if (/sante|mutuelle|pharmac|medecin|dentiste/.test(n)) return HeartPulse;
  if (/impot|taxe|urssaf|cfe/.test(n)) return Receipt;
  if (/logiciel|outil|cloud|hosting|heberg/.test(n)) return Zap;
  if (/invest|bourse|trade/.test(n)) return Rocket;
  if (/pro\b|client|facturation|honoraire/.test(n)) return Briefcase;

  return MoreHorizontal;
}
