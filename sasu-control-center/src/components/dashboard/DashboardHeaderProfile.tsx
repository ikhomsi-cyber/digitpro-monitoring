"use client";

import Image from "next/image";
import { useState } from "react";

/** Portrait dans `public/images/` — remplacez ce fichier par votre photo si besoin. */
const PROFILE_SRC = "/images/iliass-khomsi.png";

const sizeClass = {
  /** À côté du logo (barre du haut). */
  nav: "h-9 w-9 sm:h-10 sm:w-10",
  /** Grand format sous le bandeau d’état, à côté du titre. */
  hero: "h-20 w-20 sm:h-28 sm:w-28"
} as const;

const fallbackTextClass = {
  nav: "text-xs sm:text-sm",
  hero: "text-xl sm:text-2xl"
} as const;

const sizesAttr = {
  nav: "(max-width: 640px) 36px, 40px",
  hero: "(max-width: 640px) 80px, 112px"
} as const;

export function DashboardHeaderProfile({ variant = "hero" }: { variant?: "hero" | "nav" }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full border-2 border-ink-200 bg-gradient-to-br from-brand-500 to-brand-700 font-semibold text-white shadow-md ring-2 ring-white ${sizeClass[variant]} ${fallbackTextClass[variant]}`}
        aria-hidden
      >
        IK
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border-2 border-white shadow-md ring-2 ring-ink-200/90 ${sizeClass[variant]}`}
    >
      <Image
        src={PROFILE_SRC}
        alt="Iliass KHOMSI — DigitPro Consulting Monitoring"
        fill
        className="object-cover object-top"
        sizes={sizesAttr[variant]}
        priority={variant === "hero"}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
