"use client";

import * as React from "react";
import { ArrowUp, Loader2, Paperclip, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelPicker } from "@/components/chat/model-picker";
import { useChatStore } from "@/lib/store/chat-store";
import { cn, formatBytes } from "@/lib/utils";
import type { Attachment } from "@/lib/types";

const MAX_ROWS = 8;

export function Composer() {
  const { sendMessage, isStreaming, stop, model, setModel, error, setError } = useChatStore();
  const [value, setValue] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-grow the textarea.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value]);

  const submit = () => {
    if (isStreaming || uploading) return;
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    setValue("");
    setAttachments([]);
    setError(null);
    void sendMessage(text || "(see attached files)", attachments);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 5)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          setError(detail?.error ?? `Could not upload ${file.name}`);
          continue;
        }
        const json = (await res.json()) as { attachment: Attachment };
        setAttachments((prev) => [...prev, json.attachment]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !uploading;

  return (
    <div className="border-t border-border bg-background/80 px-4 pb-3 pt-3 backdrop-blur sm:px-6 pb-safe">
      <div className="mx-auto w-full max-w-3xl">
        {error && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2">
            <p className="flex-1 text-xs text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-destructive/70 hover:text-destructive"
              aria-label="Dismiss error"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-2xs"
              >
                <span className="max-w-[160px] truncate font-medium">{a.name}</span>
                <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${a.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition-shadow focus-within:border-brand/40 focus-within:shadow-md",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept="image/*,.txt,.md,.csv,.json,.pdf,.ts,.tsx,.js,.jsx,.py,.sql,.yml,.yaml,.toml"
            onChange={(e) => void uploadFiles(e.target.files)}
          />

          <Button
            variant="ghost"
            size="icon-sm"
            className="mb-0.5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Attach files"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          </Button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Message Agent Mobile…"
            className="scrollbar-thin max-h-48 min-h-9 flex-1 resize-none bg-transparent py-2 text-[0.9375rem] leading-6 outline-none placeholder:text-muted-foreground"
          />

          {isStreaming ? (
            <Button
              variant="secondary"
              size="icon"
              className="mb-0.5 shrink-0 rounded-xl"
              onClick={stop}
              aria-label="Stop generating"
            >
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              variant="brand"
              size="icon"
              className="mb-0.5 shrink-0 rounded-xl"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send message"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <ModelPicker value={model} onChange={setModel} />
          <p className="hidden text-2xs text-muted-foreground sm:block">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
