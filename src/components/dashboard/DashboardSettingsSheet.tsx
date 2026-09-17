"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, ChevronRight, Settings, X } from "lucide-react";
import { clsx } from "clsx";
import { SettingsControls } from "@/components/dashboard/SettingsControls";
import type { SupabaseRuntimeMode } from "@/lib/supabase/config";

type Props = {
  envMode: SupabaseRuntimeMode;
  dataMode: "DEMO" | "SUPABASE";
  demoPreferenceOn: boolean;
  showDummyDataToggle: boolean;
  showDarkModeToggle: boolean;
  showLogout: boolean;
  userEmail: string | null | undefined;
  canWrite: boolean;
  powensCloudEnabled?: boolean;
  powensPersonalSyncEnabled?: boolean;
  powensPrimaryImportAxis?: "pro" | "personal";
};

const DRAG_CLOSE_THRESHOLD_PX = 86;
const DRAG_CLOSE_VELOCITY_PX_MS = 0.45;

/**
 * Bouton paramètres (haut-gauche, mobile) — visible uniquement sur le dashboard.
 * Ouvre un panneau glissant depuis le bas (bottom sheet) qui centralise les réglages.
 */
export function DashboardSettingsSheet(props: Props) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragLastY = useRef(0);
  const dragLastT = useRef(0);
  const dragVelocity = useRef(0);
  const suppressNextClick = useRef(false);

  const close = useCallback(() => {
    setDragging(false);
    setDragY(0);
    setShow(false);
    window.setTimeout(() => setOpen(false), 280);
  }, []);

  const handleDragStart = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartY.current = event.clientY;
    dragLastY.current = event.clientY;
    dragLastT.current = event.timeStamp;
    dragVelocity.current = 0;
    setDragging(true);
    setDragY(0);
  }, []);

  const handleDragMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !event.isPrimary) return;
    const nextDragY = Math.max(0, event.clientY - dragStartY.current);
    const elapsed = Math.max(1, event.timeStamp - dragLastT.current);
    dragVelocity.current = (event.clientY - dragLastY.current) / elapsed;
    dragLastY.current = event.clientY;
    dragLastT.current = event.timeStamp;
    setDragY(nextDragY);
  }, [dragging]);

  const handleDragEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
    suppressNextClick.current = dragY > 8;
    if (dragY > DRAG_CLOSE_THRESHOLD_PX || dragVelocity.current > DRAG_CLOSE_VELOCITY_PX_MS) {
      close();
      return;
    }
    setDragY(0);
  }, [close, dragY, dragging]);

  const handleClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!suppressNextClick.current) return;
    suppressNextClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShow(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  if (pathname !== "/dashboard") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Paramètres de l’application"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Paramètres"
        className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.6rem)] z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink-200/80 bg-white/85 text-ink-700 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white active:scale-95 dark:border-cyan-100/[0.16] dark:bg-[#06242b]/80 dark:text-white dark:shadow-[0_16px_50px_-20px_rgba(0,22,28,0.9)] md:hidden"
      >
        <Settings className="h-[20px] w-[20px]" strokeWidth={1.9} aria-hidden />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Paramètres"
        >
          <button
            type="button"
            aria-label="Fermer"
            onClick={close}
            className={clsx(
              "absolute inset-0 bg-ink-950/50 backdrop-blur-sm transition-opacity duration-300",
              show ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            className={clsx(
              "absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[2rem] border-t border-ink-200/80 bg-[#f4f7f8] shadow-[0_-24px_80px_-24px_rgba(0,0,0,0.55)] dark:border-cyan-100/[0.14] dark:bg-[#0a2b32]",
              dragging ? "transition-none" : "transition-transform duration-300 ease-out",
              show ? "translate-y-0" : "translate-y-full"
            )}
            style={show ? { transform: `translateY(${dragY}px)` } : undefined}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            onClickCapture={handleClickCapture}
          >
            <div
              className={clsx(
                "flex shrink-0 touch-none flex-col items-center pt-2.5",
                dragging ? "cursor-grabbing" : "cursor-grab"
              )}
            >
              <span className="h-1.5 w-11 rounded-full bg-ink-300/80 dark:bg-white/20" aria-hidden />
            </div>
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
                  DigitPro
                </p>
                <h2 className="mt-0.5 font-display text-xl font-bold tracking-tight text-ink-950 dark:text-white">
                  Paramètres
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fermer les paramètres"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-200/80 bg-white text-ink-600 transition hover:bg-ink-50 dark:border-cyan-100/[0.16] dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.12]"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <SettingsControls {...props} />

              <Link
                href="/parametres"
                onClick={close}
                className="mt-5 flex items-center gap-3 rounded-3xl border border-ink-200 bg-white p-5 text-left shadow-[0_14px_54px_-28px_rgba(0,0,0,0.2)] transition hover:bg-ink-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/15 dark:text-emerald-300">
                  <CalendarClock className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-bold text-ink-950 dark:text-white">
                    TJM par période
                  </span>
                  <span className="block text-xs text-ink-500 dark:text-white/45">
                    Gérer les taux journaliers par client
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-400 dark:text-white/40" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
