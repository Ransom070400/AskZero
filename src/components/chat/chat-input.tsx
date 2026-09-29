"use client";

import { useRef, useEffect, useState } from "react";
import {
  ArrowUp,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Sparkles,
  Square,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { blobToWav } from "@/lib/audio-wav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ImageSize = "1024x1024" | "1024x1792" | "1792x1024";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  run: () => void;
  // Shown in the "+" menu; commands without one get a generic mark.
  icon?: LucideIcon;
}

export const IMAGE_SIZES: { id: ImageSize; label: string; hint: string }[] = [
  { id: "1024x1024", label: "Square", hint: "1:1" },
  { id: "1024x1792", label: "Portrait", hint: "9:16" },
  { id: "1792x1024", label: "Landscape", hint: "16:9" },
];

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  attachments?: File[];
  onAttach?: (files: File[]) => void;
  onRemoveAttachment?: (index: number) => void;
  // Right side of the toolbar, before mic/send — the model picker and cost
  // meter live here, inside the composer (so they can't fall off-screen).
  toolbarRight?: React.ReactNode;
  // A mode token after the "+" (e.g. Incognito), removable with its ×.
  badge?: { label: string; icon?: LucideIcon; onClear: () => void };
  placeholder?: string;
  // Which way the "+" menu opens — "bottom" for a mid-page composer (home).
  menuSide?: "top" | "bottom";
  // When false, images are filtered from attempted attachments and the
  // UI hints that the active model is text-only.
  allowImages?: boolean;
  // Slash commands — shown as a menu when the input starts with "/", and in
  // the "+" menu.
  commands?: SlashCommand[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const ALL_ALLOWED_TYPES = [...IMAGE_TYPES, "application/pdf"];

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  isStreaming,
  onStop,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  toolbarRight,
  badge,
  placeholder = "Message AskZero…",
  menuSide = "top",
  allowImages = true,
  commands,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const [rejectedImage, setRejectedImage] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const allowedTypes = allowImages
    ? ALL_ALLOWED_TYPES
    : ALL_ALLOWED_TYPES.filter((t) => !t.startsWith("image/"));
  const accept = allowImages
    ? "image/jpeg,image/png,image/gif,image/webp,application/pdf"
    : "application/pdf";

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const canSend = (value.trim() || attachments.length > 0) && !disabled;

  // Slash-command menu: shows while typing "/<name>" (before any space).
  const slashQuery =
    commands && value.startsWith("/") && !/[\s\n]/.test(value)
      ? value.slice(1).toLowerCase()
      : null;
  const slashMatches =
    slashQuery !== null
      ? commands!.filter(
          (c) =>
            c.id.toLowerCase().startsWith(slashQuery) ||
            c.label.toLowerCase().startsWith(slashQuery)
        )
      : [];
  const showSlash = focused && slashMatches.length > 0;

  const runCommand = (cmd: SlashCommand) => {
    cmd.run();
    // If the command set the input (rather than navigating), refocus + move
    // the cursor to the end so the user can keep typing.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const n = el.value.length;
        el.setSelectionRange(n, n);
      }
    });
  };

  // A light haptic on send — Android honors navigator.vibrate; iOS ignores it.
  const triggerSend = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
    }
    onSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlash) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        runCommand(slashMatches[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onChange("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) triggerSend();
    }
  };

  const addFiles = (files: FileList | File[]) => {
    if (!onAttach) return;
    const all = Array.from(files);
    const valid = all.filter(
      (f) => f.size <= MAX_FILE_SIZE && allowedTypes.includes(f.type)
    );
    const droppedImage =
      !allowImages && all.some((f) => f.type.startsWith("image/"));
    if (droppedImage) {
      setRejectedImage(true);
      setTimeout(() => setRejectedImage(false), 3200);
    }
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

  // --- Voice input (speech-to-text via whisper-large-v3 on 0G) ---

  const transcribe = async (blob: Blob) => {
    setTranscribing(true);
    setRecordError(null);
    try {
      // The provider only accepts WAV, so convert the recording (webm/mp4)
      // to 16 kHz mono WAV in the browser before uploading.
      const wav = await blobToWav(blob);
      const fd = new FormData();
      fd.append("file", wav, "recording.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setRecordError(data?.error || "Could not transcribe audio");
        return;
      }
      const text = (data?.text || "").trim();
      if (text) {
        onChange(value.trim() ? `${value.trimEnd()} ${text}` : text);
        textareaRef.current?.focus();
      } else {
        setRecordError("Didn't catch that — try again");
      }
    } catch {
      setRecordError("Could not transcribe audio");
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    if (disabled || transcribing || recording) return;
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });
        audioChunksRef.current = [];
        if (blob.size > 0) void transcribe(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecordError("Microphone access denied");
    }
  };

  const stopRecording = () => {
    const r = mediaRecorderRef.current;
    if (r && r.state !== "inactive") r.stop();
    setRecording(false);
  };

  // Stop any in-flight recording if the composer unmounts.
  useEffect(() => {
    return () => {
      const r = mediaRecorderRef.current;
      if (r && r.state !== "inactive") r.stop();
    };
  }, []);

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
      {/* Slash-command menu */}
      {showSlash && (
        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl border border-border bg-elevated shadow-xl">
          {slashMatches.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              // onMouseDown (not onClick) so selecting doesn't blur the textarea first
              onMouseDown={(e) => {
                e.preventDefault();
                runCommand(cmd);
              }}
              className={cn(
                "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                i === 0 ? "bg-surface" : "hover:bg-surface"
              )}
            >
              <span className="font-mono text-[13px] font-semibold text-accent">
                /{cmd.id}
              </span>
              <span className="text-[12px] text-text-tertiary">
                {cmd.description}
              </span>
            </button>
          ))}
        </div>
      )}

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

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        className="block w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[16px] leading-[1.5] text-foreground caret-accent outline-none placeholder:text-text-tertiary disabled:opacity-50 max-h-[200px]"
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Toolbar: actions on the left; model, cost, mic and send on the right */}
      <div className="flex items-center gap-1 px-2 pb-2">
        {(onAttach || (commands && commands.length > 0)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Add files and more"
                disabled={disabled}
                className="press shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-surface hover:text-foreground transition-colors duration-fast disabled:opacity-50"
              >
                <Plus className="h-[18px] w-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side={menuSide} className="w-[19rem] p-1">
              {onAttach && (
                <DropdownMenuItem
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2.5 py-2"
                >
                  <Paperclip className="h-4 w-4 shrink-0 text-text-secondary" />
                  <span className="text-[13px] font-medium text-foreground">
                    {allowImages ? "Add files & images" : "Add PDFs"}
                  </span>
                  <span className="truncate text-[12px] font-normal text-text-tertiary">
                    {allowImages ? "From this device" : "This model can't read images"}
                  </span>
                </DropdownMenuItem>
              )}
              {commands?.map((cmd) => {
                const Icon = cmd.icon ?? Sparkles;
                return (
                  <DropdownMenuItem
                    key={cmd.id}
                    onClick={() => runCommand(cmd)}
                    className="gap-2.5 py-2"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
                    <span className="text-[13px] font-medium text-foreground">
                      {cmd.label}
                    </span>
                    <span className="truncate text-[12px] font-normal text-text-tertiary">
                      {cmd.description}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {badge && (
          <span className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-accent-muted pl-2.5 pr-1 text-[12.5px] font-medium text-accent">
            {badge.icon && <badge.icon className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{badge.label}</span>
            <button
              type="button"
              onClick={badge.onClear}
              aria-label={`Turn off ${badge.label}`}
              className="press flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent/15"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}

        <div className="ml-auto flex min-w-0 items-center gap-1">
          {toolbarRight}

          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={disabled || transcribing}
            aria-label={recording ? "Stop recording" : "Record voice message"}
            title={recording ? "Stop recording" : "Voice input"}
            className={cn(
              "press shrink-0 flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-fast",
              recording
                ? "bg-error/15 text-error animate-pulse"
                : "text-text-tertiary hover:bg-surface hover:text-foreground",
              transcribing && "opacity-60"
            )}
          >
            {transcribing ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : recording ? (
              <Square className="h-[14px] w-[14px] fill-current" />
            ) : (
              <Mic className="h-[18px] w-[18px]" />
            )}
          </button>

          {isStreaming && onStop ? (
            <button
              aria-label="Stop generating"
              onClick={onStop}
              className="press shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background shadow-sm hover:opacity-90 transition-[opacity,box-shadow] duration-fast ease-out"
            >
              <Square className="h-[14px] w-[14px] fill-current" />
            </button>
          ) : (
            <button
              aria-label="Send message"
              onClick={triggerSend}
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
          )}
        </div>
      </div>

      {rejectedImage && (
        <div className="px-4 pb-2 text-[11.5px] font-medium text-warning">
          This model doesn&apos;t support images — switch to a multimodal model to attach pictures.
        </div>
      )}

      {(recording || transcribing || recordError) && (
        <div className="px-4 pb-2 text-[11.5px] font-medium">
          {recordError ? (
            <span className="text-warning">{recordError}</span>
          ) : transcribing ? (
            <span className="text-text-tertiary">Transcribing…</span>
          ) : (
            <span className="text-error">Recording… tap the square to stop</span>
          )}
        </div>
      )}

    </div>
  );
}
