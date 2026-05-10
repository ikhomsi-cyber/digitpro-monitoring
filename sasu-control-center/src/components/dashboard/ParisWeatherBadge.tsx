"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

/** WMO Weather interpretation codes (Open-Meteo) → emoji court */
function wmoEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

export function ParisWeatherBadge({ className }: { className?: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ok"; temp: number; code: number }
    | { status: "error" }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url =
          "https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code&timezone=Europe%2FParis";
        const res = await fetch(url);
        const json = (await res.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
        };
        const t = json?.current?.temperature_2m;
        const c = json?.current?.weather_code;
        if (cancelled) return;
        if (typeof t === "number") {
          setState({
            status: "ok",
            temp: Math.round(t * 10) / 10,
            code: typeof c === "number" ? c : 0
          });
        } else {
          setState({ status: "error" });
        }
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div
        className={clsx(
          "inline-flex h-10 min-w-[7.5rem] items-center justify-center rounded-2xl border border-ink-200 bg-white px-3 text-xs text-ink-400 shadow-sm",
          className
        )}
        aria-busy
        aria-label="Chargement météo Paris"
      >
        Paris · …
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className={clsx(
          "inline-flex h-10 items-center gap-2 rounded-2xl border border-ink-200 bg-white px-3 text-xs text-ink-400 shadow-sm",
          className
        )}
        title="Météo indisponible"
      >
        Paris · —
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "inline-flex h-10 items-center gap-2 rounded-2xl border border-ink-200 bg-white px-3 shadow-sm",
        className
      )}
      title="Météo Paris aujourd’hui (Open-Meteo)"
    >
      <span className="text-lg leading-none" aria-hidden>
        {wmoEmoji(state.code)}
      </span>
      <span className="text-sm font-semibold tabular-nums text-ink-900">{state.temp}°C</span>
      <span className="text-xs font-medium text-ink-500">Paris</span>
    </div>
  );
}
