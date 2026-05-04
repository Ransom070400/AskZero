"use client";

import { useRef, useEffect, useState } from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  attachments?: File[];
  onAttach?: (files: File[]) => void;
  onRemoveAttachment?: (index: number) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  attachments = [],
  onAttach,
  onRemoveAttachment,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const canSend = (value.trim() || attachments.length > 0) && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  const addFiles = (files: FileList | File[]) => {
    if (!onAttach) return;
    const valid = Array.from(files).filter(
      (f) => f.size <= MAX_FILE_SIZE && ALLOWED_TYPES.includes(f.type)
    );
    if (valid.length > 0) onAttach(valid);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (imageFiles.length > 0) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-3xl border bg-elevated/80 backdrop-blur-sm",
        "transition-[border-color,box-shadow,background-color] duration-base ease-out",
        focused
          ? "border-accent/60 shadow-ring bg-elevated"
          : "border-border/70",
        dragOver && "border-accent bg-accent-muted"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3.5 pb-1">
          {attachments.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="relative flex-shrink-0 group/att"
            >
              {file.type.startsWith("image/") ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-16 w-16 rounded-xl object-cover border border-border/80"
                />
              ) : (
                <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-border/80 bg-surface text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  {file.name.split(".").pop()?.toUpperCase().slice(0, 4)}
                </div>
              )}
              {onRemoveAttachment && (
                <button
                  onClick={() => onRemoveAttachment(i)}
                  aria-label="Remove attachment"
                  className="press absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow-md opacity-0 group-hover/att:opacity-100 transition-opacity duration-fast"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1 px-2 py-2">
        {onAttach && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            className="press shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-text-tertiary hover:bg-surface hover:text-foreground transition-colors duration-fast"
            disabled={disabled}
          >
            <Paperclip className="h-[18px] w-[18px]" />
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Message AskZero…"
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-[1.5] text-foreground caret-accent outline-none placeholder:text-text-tertiary disabled:opacity-50 max-h-[200px]"
        />

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          multiple
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <button
          aria-label="Send message"
          onClick={onSend}
          disabled={!canSend}
          className={cn(
            "press shrink-0 flex h-9 w-9 items-center justify-center rounded-full transition-[background-color,opacity,transform,box-shadow] duration-fast ease-out",
            canSend
              ? "bg-accent text-white shadow-sm hover:bg-accent-hover hover:shadow-md"
              : "bg-surface text-text-tertiary opacity-60"
          )}
        >
          <ArrowUp className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}
