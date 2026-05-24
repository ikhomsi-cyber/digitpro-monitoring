"use client";

import { sanitizeLatin1HttpValue } from "@/lib/http-latin1";

declare global {
  interface Window {
    PowensConnect?: { open: (p: { userId: string; token: string }) => void };
  }
}

function scriptUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_POWENS_CONNECT_SCRIPT_URL?.trim();
  if (!raw) return undefined;
  return sanitizeLatin1HttpValue(raw, "NEXT_PUBLIC_POWENS_CONNECT_SCRIPT_URL");
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      resolve();
      return;
    }
    const abs = new URL(src, window.location.href).href;
    const scripts = document.querySelectorAll<HTMLScriptElement>("script[data-powens-connect='1']");
    for (const el of scripts) {
      if (el.src === abs) {
        if (window.PowensConnect?.open) {
          resolve();
          return;
        }
        el.addEventListener("load", () => resolve(), { once: true });
        el.addEventListener("error", () => reject(new Error("Chargement du script Powens interrompu.")), {
          once: true
        });
        return;
      }
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.powensConnect = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Impossible de charger le script Powens (URL ou réseau)."));
    document.body.appendChild(s);
  });
}

/**
 * Ouvre le widget Powens Connect si le SDK expose `window.PowensConnect.open`.
 * Optionnel : `NEXT_PUBLIC_POWENS_CONNECT_SCRIPT_URL` pour charger le script avant l’appel
 * (le paquet npm `@powens/webview` n’est pas publié sur le registre public au 2026-05).
 */
export async function openPowensConnectWidget(opts: {
  userId: string;
  token: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof window === "undefined") {
    return { ok: false, message: "PowensConnect n’est disponible que dans le navigateur." };
  }
  let safeUserId: string;
  let safeToken: string;
  try {
    safeUserId = sanitizeLatin1HttpValue(opts.userId, "Powens userId");
    safeToken = sanitizeLatin1HttpValue(opts.token, "Powens token");
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Caractères invalides dans les identifiants Powens."
    };
  }
  let url: string | undefined;
  try {
    url = scriptUrl();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "NEXT_PUBLIC_POWENS_CONNECT_SCRIPT_URL invalide."
    };
  }
  if (url) {
    try {
      await loadScriptOnce(url);
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Script Powens" };
    }
  }
  const PC = window.PowensConnect;
  if (PC?.open) {
    PC.open({ userId: safeUserId, token: safeToken });
    return { ok: true };
  }
  return {
    ok: false,
    message:
      "PowensConnect.open indisponible : ajoutez l’URL du script Powens dans NEXT_PUBLIC_POWENS_CONNECT_SCRIPT_URL (ou chargez leur SDK dans le layout), puis réessayez."
  };
}
