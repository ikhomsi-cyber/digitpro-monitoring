"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { ArrowUp, Bot, Loader2, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";

const SUGGESTIONS = [
  "Quel est mon chiffre d’affaires ce mois ?",
  "Top 5 dépenses des 90 derniers jours",
  "Compare mon CA aux 3 derniers mois",
  "Combien de jours facturés à 820 € HT ce trimestre ?"
];

/**
 * Floating AI assistant. Click the pill in the bottom-right to open a
 * right-anchored panel. Reads transactions from the server (/api/chat)
 * — no transactions are sent over the wire from the client.
 */
export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const { messages, sendMessage, status, error, stop } = useChat();

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit(text?: string) {
    const value = (text ?? input).trim();
    if (!value || busy) return;
    sendMessage({ text: value });
    setInput("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-brand-600",
          open && "pointer-events-none opacity-0"
        )}
        aria-label="Ouvrir l’assistant IA"
      >
        <Sparkles className="h-4 w-4" />
        Assistant
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Fermer l’assistant"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
          />

          <aside className="relative flex h-full w-full max-w-md flex-col border-l border-ink-200 bg-white shadow-2xl animate-floatIn">
            <header className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-900 text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-display text-base font-semibold tracking-apple-tight text-ink-900">
                    Assistant DigitPro
                  </div>
                  <div className="text-xs text-ink-500">Analyse vos transactions en direct</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-ink-200 p-1.5 text-ink-700 transition hover:border-ink-300"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 scrollbar-clean">
              {!messages.length ? (
                <EmptyState onPick={(s) => submit(s)} />
              ) : (
                <ul className="space-y-4">
                  {messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      role={m.role}
                      text={m.parts
                        .map((p) => (p.type === "text" ? p.text : ""))
                        .join("")}
                    />
                  ))}
                  {busy ? (
                    <li className="flex items-center gap-2 text-xs text-ink-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      L’assistant analyse vos transactions…
                    </li>
                  ) : null}
                </ul>
              )}

              {error ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {error.message ||
                    "Erreur de l’assistant. Vérifiez OPENAI_API_KEY ou réessayez."}
                </div>
              ) : null}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="border-t border-ink-200 bg-white px-3 py-3"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-ink-300 bg-white px-3 py-2 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="Demandez n’importe quoi sur vos transactions…"
                  className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent text-sm leading-snug text-ink-900 outline-none placeholder:text-ink-400"
                  disabled={busy}
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={() => stop()}
                    className="grid h-9 w-9 place-items-center rounded-full bg-ink-200 text-ink-700 transition hover:bg-ink-300"
                    aria-label="Arrêter"
                  >
                    <span className="block h-2.5 w-2.5 rounded-sm bg-ink-700" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-40"
                    aria-label="Envoyer"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-2 px-1 text-[11px] text-ink-500">
                Appuyez sur <kbd className="rounded bg-ink-100 px-1">Entrée</kbd> pour envoyer ·{" "}
                <kbd className="rounded bg-ink-100 px-1">Maj</kbd>+
                <kbd className="rounded bg-ink-100 px-1">Entrée</kbd> pour une nouvelle ligne.
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function MessageBubble({ role, text }: { role: "user" | "assistant" | "system"; text: string }) {
  const isUser = role === "user";
  return (
    <li className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-brand-500 text-white"
            : "border border-ink-200 bg-white text-ink-900"
        )}
      >
        <FormattedText text={text} dim={isUser} />
      </div>
    </li>
  );
}

/**
 * Lightweight markdown-ish renderer (no extra dep): preserves line breaks,
 * renders **bold**, `code`, and bullet/number lists, plus pipe tables.
 */
function FormattedText({ text, dim }: { text: string; dim?: boolean }) {
  if (!text) return <span className="opacity-60">…</span>;

  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.length);
        // table heuristic
        if (lines.length >= 2 && lines.every((l) => l.includes("|"))) {
          const cells = lines.map((l) =>
            l.split("|").map((c) => c.trim()).filter((c) => c.length)
          );
          return (
            <table
              key={i}
              className={clsx(
                "w-full border-collapse text-xs",
                dim ? "border-white/30" : "border-ink-200"
              )}
            >
              <tbody>
                {cells.map((row, ri) => (
                  <tr key={ri} className={clsx(ri === 0 && "font-semibold")}>
                    {row.map((c, ci) => (
                      <td
                        key={ci}
                        className={clsx(
                          "border px-2 py-1",
                          dim ? "border-white/30" : "border-ink-200"
                        )}
                      >
                        <Inline text={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        // bullet/numbered list
        const isList = lines.every((l) => /^([-*]|\d+\.)\s+/.test(l));
        if (isList) {
          const numbered = /^\d+\.\s+/.test(lines[0]);
          const Tag = (numbered ? "ol" : "ul") as "ol" | "ul";
          return (
            <Tag key={i} className={clsx("ml-5", numbered ? "list-decimal" : "list-disc")}>
              {lines.map((l, li) => (
                <li key={li}>
                  <Inline text={l.replace(/^([-*]|\d+\.)\s+/, "")} />
                </li>
              ))}
            </Tag>
          );
        }
        // headings
        if (/^#{1,3}\s/.test(lines[0])) {
          const h = lines[0].match(/^(#{1,3})\s+(.*)$/);
          if (h) {
            const level = h[1].length;
            const Tag = (level === 1 ? "h3" : level === 2 ? "h4" : "h5") as
              | "h3"
              | "h4"
              | "h5";
            return (
              <div key={i}>
                <Tag className="font-semibold tracking-apple-tight">
                  <Inline text={h[2]} />
                </Tag>
                {lines.slice(1).map((l, li) => (
                  <p key={li}>
                    <Inline text={l} />
                  </p>
                ))}
              </div>
            );
          }
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {lines.map((l, li) => (
              <span key={li}>
                {li ? <br /> : null}
                <Inline text={l} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Inline parser for **bold**, `code`, and plain text. */
function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {tok.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <code
          key={key++}
          className="rounded bg-black/5 px-1 py-0.5 text-[0.85em] font-mono"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    lastIdx = m.index + tok.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return <>{parts}</>;
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-50">
        <Sparkles className="h-6 w-6 text-brand-500" />
      </div>
      <div>
        <div className="font-display text-xl font-semibold tracking-apple-tight text-ink-900">
          Posez vos questions
        </div>
        <p className="mt-1 max-w-xs text-sm text-ink-500">
          L’assistant a accès à vos transactions, agrégats mensuels, top contreparties et
          dernier solde.
        </p>
      </div>
      <ul className="w-full space-y-2 px-2">
        {SUGGESTIONS.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-left text-sm text-ink-800 transition hover:border-ink-300"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
