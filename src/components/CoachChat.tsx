"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  actionResults?: { type: string; success: boolean; detail?: string }[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    model: string;
  };
}

interface SessionUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  calls: number;
}

export default function CoachChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionUsage, setSessionUsage] = useState<SessionUsage>({
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    calls: 0,
  });
  const [showUsage, setShowUsage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const submit = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText("");
    setError(null);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    abortRef.current = new AbortController();

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      });

      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        actionResults?: { type: string; success: boolean; detail?: string }[];
        usage?: {
          inputTokens: number;
          outputTokens: number;
          costUsd: number;
          model: string;
        };
      };

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reply = data.reply ?? "";
      const actionResults = data.actionResults ?? [];
      const usage = data.usage;

      if (usage) {
        setSessionUsage((prev) => ({
          inputTokens: prev.inputTokens + usage.inputTokens,
          outputTokens: prev.outputTokens + usage.outputTokens,
          costUsd: prev.costUsd + usage.costUsd,
          calls: prev.calls + 1,
        }));
      }

      // Typewriter reveal
      const CHUNK = 4;
      const DELAY = 16;
      let i = 0;
      await new Promise<void>((resolve) => {
        const tick = () => {
          i = Math.min(i + CHUNK, reply.length);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: reply.slice(0, i) } : m,
            ),
          );
          if (i < reply.length) {
            setTimeout(tick, DELAY);
          } else {
            // All text rendered — attach action results, usage, and clear streaming flag
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: reply,
                      actionResults,
                      usage,
                      streaming: false,
                    }
                  : m,
              ),
            );
            resolve();
          }
        };
        tick();
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      if (msg.includes("PERPLEXITY_API_KEY")) {
        setMessages((prev) => prev.slice(0, -2));
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "(error — see below)" } : m,
          ),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const noKey = error?.includes("PERPLEXITY_API_KEY");

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close coach chat" : "Open coach chat"}
        className={`
          fixed bottom-5 right-5 z-50
          w-14 h-14 rounded-full shadow-xl
          flex items-center justify-center text-2xl
          transition-all duration-200 select-none
          ${
            open
              ? "bg-surface-hover border border-surface-border scale-95"
              : "bg-accent-blue/20 border border-accent-blue/40 hover:bg-accent-blue/30 hover:scale-105"
          }
        `}
      >
        {open ? "✕" : "🧠"}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={`
            fixed bottom-24 right-5 z-50
            w-[calc(100vw-2.5rem)] max-w-sm
            bg-surface-card border border-surface-border rounded-2xl shadow-2xl
            flex flex-col overflow-hidden
          `}
          style={{ height: "clamp(350px, 55vh, 520px)" }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2 shrink-0">
            <span className="text-lg">🧠</span>
            <div>
              <div className="text-sm font-semibold text-white">
                AI Fitness Coach
              </div>
              <div className="text-[10px] text-slate-500">
                Powered by Perplexity · full context loaded
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {isLoading && (
                <span className="text-[10px] text-accent-blue animate-pulse">
                  thinking…
                </span>
              )}
              {sessionUsage.calls > 0 && (
                <button
                  onClick={() => setShowUsage((x) => !x)}
                  title="Toggle session usage details"
                  className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors tabular-nums"
                >
                  ${sessionUsage.costUsd.toFixed(4)}
                </button>
              )}
            </div>
          </div>

          {/* Session usage panel */}
          {showUsage && sessionUsage.calls > 0 && (
            <div className="px-4 py-2 bg-surface-hover border-b border-surface-border text-[10px] text-slate-400 space-y-0.5 shrink-0">
              <div className="text-slate-300 font-medium mb-1">
                Session usage
              </div>
              <div className="flex justify-between">
                <span>Calls</span>
                <span className="tabular-nums text-slate-300">
                  {sessionUsage.calls}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Input tokens</span>
                <span className="tabular-nums text-slate-300">
                  {sessionUsage.inputTokens.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Output tokens</span>
                <span className="tabular-nums text-slate-300">
                  {sessionUsage.outputTokens.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t border-surface-border pt-1 mt-1">
                <span className="font-medium">Total cost</span>
                <span className="tabular-nums text-accent-green font-medium">
                  ${sessionUsage.costUsd.toFixed(5)}
                </span>
              </div>
              <div className="text-slate-600 pt-0.5">
                sonar-pro: $3/M in · $15/M out
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-sm">
            {noKey && (
              <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-3 text-accent-red text-xs">
                No API key found. Add{" "}
                <code className="bg-surface-hover px-1 rounded">
                  PERPLEXITY_API_KEY
                </code>{" "}
                to{" "}
                <code className="bg-surface-hover px-1 rounded">
                  .local/.env.local
                </code>{" "}
                and restart the dev server.
              </div>
            )}

            {messages.length === 0 && (
              <div className="text-slate-500 text-xs leading-relaxed">
                <p className="mb-2 font-medium text-slate-400">
                  Your coach knows:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your goals, stats &amp; history</li>
                  <li>Today&apos;s plan</li>
                  <li>Your recent training log</li>
                  <li>Your progression rules</li>
                </ul>
                <p className="mt-3 italic text-slate-600">
                  Try: &quot;My knees hurt, can I skip legs today?&quot;
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`
                    max-w-[85%] px-3 py-2 rounded-2xl leading-relaxed
                    ${
                      m.role === "user"
                        ? "bg-accent-blue/20 text-slate-100 rounded-br-sm"
                        : "bg-surface-hover text-slate-200 rounded-bl-sm"
                    }
                  `}
                >
                  {m.content ? (
                    m.role === "user" ? (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    ) : m.streaming ? (
                      // Plain text while typewriter is active — prevents partial markdown flicker
                      <span className="whitespace-pre-wrap text-slate-200">
                        {m.content}
                      </span>
                    ) : (
                      <div
                        className="prose prose-invert prose-sm max-w-none
                        prose-p:my-1 prose-p:leading-relaxed
                        prose-ul:my-1 prose-ul:pl-4
                        prose-ol:my-1 prose-ol:pl-4
                        prose-li:my-0.5
                        prose-strong:text-white
                        prose-headings:text-slate-200 prose-headings:font-semibold prose-headings:mt-2 prose-headings:mb-1
                        prose-hr:border-surface-border prose-hr:my-2
                        prose-code:text-accent-blue prose-code:bg-surface-card prose-code:px-1 prose-code:rounded prose-code:text-xs
                      "
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    )
                  ) : m.role === "assistant" && isLoading ? (
                    <span className="inline-block w-2 h-4 bg-slate-500 animate-pulse rounded" />
                  ) : null}
                </div>
                {/* Action result chips */}
                {m.role === "assistant" &&
                  m.actionResults &&
                  m.actionResults.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 max-w-[85%]">
                      {m.actionResults.map((ar, i) => (
                        <span
                          key={i}
                          title={ar.detail}
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            ar.success
                              ? ar.type === "save_note"
                                ? "bg-accent-green/10 border-accent-green/30 text-accent-green"
                                : "bg-accent-blue/10 border-accent-blue/30 text-accent-blue"
                              : "bg-accent-red/10 border-accent-red/30 text-accent-red"
                          }`}
                        >
                          {ar.type === "save_note" &&
                            ar.success &&
                            "📝 Note saved"}
                          {ar.type === "edit_plan_today" &&
                            ar.success &&
                            "📋 Plan updated"}
                          {!ar.success &&
                            `⚠ ${ar.type === "save_note" ? "Note" : "Plan"} failed`}
                        </span>
                      ))}
                    </div>
                  )}
                {/* Per-message usage badge */}
                {m.role === "assistant" &&
                  m.usage &&
                  m.usage.inputTokens > 0 && (
                    <div className="text-[9px] text-slate-600 mt-0.5 tabular-nums">
                      {m.usage.inputTokens.toLocaleString()} in ·{" "}
                      {m.usage.outputTokens.toLocaleString()} out · $
                      {m.usage.costUsd.toFixed(4)}
                    </div>
                  )}
              </div>
            ))}

            {error && !noKey && (
              <div className="text-accent-red text-xs px-2 bg-accent-red/5 rounded-xl py-2">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Prompt chips */}
          {messages.length === 0 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {[
                "I feel great today — can I go harder?",
                "I only slept 5 hours last night",
                "My knees are sore from football",
                "How am I tracking toward my goals?",
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => {
                    setInputText(chip);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="text-[10px] px-2 py-1 rounded-full bg-surface-hover border border-surface-border text-slate-400 hover:text-slate-200 hover:border-accent-blue/40 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 border-t border-surface-border shrink-0 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask your coach anything…"
              className="flex-1 resize-none bg-surface-hover border border-surface-border rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-blue/50 leading-snug"
            />
            <button
              onClick={submit}
              disabled={isLoading || !inputText.trim()}
              className="shrink-0 w-10 h-10 rounded-xl bg-accent-blue/20 border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
