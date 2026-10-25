"use client";

import { useRef, useEffect, useState } from "react";
import {
  ArrowUp,
  FileText,
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
  // The latest text, for the transcript to append to: recording and
  // transcription are async, and the user can keep typing meanwhile.
  const valueRef = useRef(value);
  valueRef.current = value;
  // The live mic stream, for the recording waveform.
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  // Highlighted row in the slash-command menu (arrow keys move it).
  const [slashIndex, setSlashIndex] = useState(0);
  // Files dragged anywhere over the window (see the drop overlay).
  const [windowDrag, setWindowDrag] = useState(false);

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
  const activeSlash = Math.min(slashIndex, Math.max(slashMatches.length - 1, 0));
  useEffect(() => setSlashIndex(0), [slashQuery]);

  // Full-window drop zone: dragging files anywhere over the page shows an
  // overlay, and dropping them anywhere attaches them. Counting enter/leave
  // pairs, since dragleave fires on every child element crossed.
  useEffect(() => {
    if (!onAttach) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setWindowDrag(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setWindowDrag(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setWindowDrag(false);
      if (e.dataTransfer?.files.length) addFilesRef.current(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [onAttach]);

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
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = slashMatches.length;
        setSlashIndex((i) => (i + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
        return;
      }
      if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
        e.preventDefault();
        runCommand(slashMatches[activeSlash]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onChange("");
        return;
      }
    }
    if (e.key === "Escape" && isStreaming && onStop) {
      e.preventDefault();
      onStop();
      return;
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
  // The window drop listener is registered once; it calls the latest addFiles.
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

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
        const current = valueRef.current;
        onChange(current.trim() ? `${current.trimEnd()} ${text}` : text);
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
      setMicStream(stream);
      setRecording(true);
    } catch {
      setRecordError("Microphone access denied");
    }
  };

  const stopRecording = () => {
    const r = mediaRecorderRef.current;
    if (r && r.state !== "inactive") r.stop();
    setRecording(false);
    setMicStream(null);
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
        "composer relative rounded-3xl border bg-elevated/80 backdrop-blur-md",
        "shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.18)]",
        "transition-[border-color,box-shadow,background-color] duration-base ease-out",
        focused
          ? "border-accent/60 shadow-ring bg-elevated"
          : "border-border/70 hover:border-border-strong",
        (dragOver || windowDrag) && "border-accent bg-accent-muted",
        isStreaming && "composer-working"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
    >
      {/* Full-window drop target (see the window drag listeners above). */}
      {windowDrag && (
        <div className="pointer-events-none fixed inset-0 z-overlay flex items-center justify-center bg-background/70 backdrop-blur-sm animate-in fade-in-0 duration-150">
          <div className="flex max-w-[calc(100vw-2rem)] flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-accent/70 bg-elevated/90 px-6 py-8 text-center shadow-2xl animate-in zoom-in-95 duration-200 sm:px-12 sm:py-10">
            <Paperclip className="h-8 w-8 text-accent" />
            <p className="text-base font-semibold text-foreground">Drop to attach</p>
            <p className="text-sm text-text-tertiary">
              {allowImages ? "Images and PDFs, up to 10 MB" : "PDFs, up to 10 MB"}
            </p>
          </div>
        </div>
      )}
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
              onMouseEnter={() => setSlashIndex(i)}
              className={cn(
                "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                i === activeSlash ? "bg-surface" : "hover:bg-surface"
              )}
            >
              <span className="font-mono text-sm font-semibold text-accent">
                /{cmd.id}
              </span>
              <span className="text-xs text-text-tertiary">
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
                <ImageThumb file={file} />
              ) : (
                <div className="flex h-16 w-52 items-center gap-2.5 rounded-xl border border-border/80 bg-surface px-3 animate-in fade-in-0 zoom-in-95 duration-200">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error/10 text-error">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {file.name}
                    </span>
                    <span className="block text-xs text-text-tertiary">
                      {file.name.split(".").pop()?.toUpperCase()} · {formatBytes(file.size)}
                    </span>
                  </span>
                </div>
              )}
              {onRemoveAttachment && (
                <button
                  onClick={() => onRemoveAttachment(i)}
                  aria-label="Remove attachment"
                  className="press absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow-md opacity-100 md:opacity-0 md:group-hover/att:opacity-100 focus-visible:opacity-100 transition-opacity duration-fast"
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
        // Stays typeable while an answer streams, so the next message can be
        // drafted (sending is still blocked via canSend).
        disabled={disabled && !isStreaming}
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

      {recording && micStream && <RecordingWave stream={micStream} />}

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
            <DropdownMenuContent align="start" side={menuSide} className="w-[min(19rem,calc(100vw-2rem))] p-1">
              {onAttach && (
                <DropdownMenuItem
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2.5 py-2"
                >
                  <Paperclip className="h-4 w-4 shrink-0 text-text-secondary" />
                  <span className="text-sm font-medium text-foreground">
                    {allowImages ? "Add files & images" : "Add PDFs"}
                  </span>
                  <span className="truncate text-xs font-normal text-text-tertiary">
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
                    <span className="text-sm font-medium text-foreground">
                      {cmd.label}
                    </span>
                    <span className="truncate text-xs font-normal text-text-tertiary">
                      {cmd.description}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {badge && (
          <span className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-accent-muted pl-2.5 pr-1 text-xs font-medium text-accent">
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

        <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
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
              title="Stop (Esc)"
              onClick={onStop}
              className="press relative shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background shadow-sm hover:opacity-90 transition-[opacity,box-shadow] duration-fast ease-out animate-in zoom-in-75 duration-200"
            >
              {/* Indeterminate progress ring while the answer streams. */}
              <svg
                aria-hidden="true"
                viewBox="0 0 36 36"
                className="absolute -inset-[3px] h-[42px] w-[42px] animate-spin [animation-duration:1.4s]"
              >
                <circle
                  cx="18"
                  cy="18"
                  r="16.5"
                  fill="none"
                  stroke="hsl(var(--accent))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="26 78"
                />
              </svg>
              <Square className="h-[12px] w-[12px] fill-current" />
            </button>
          ) : (
            <button
              aria-label="Send message"
              onClick={triggerSend}
              disabled={!canSend}
              className={cn(
                "press shrink-0 flex h-9 w-9 items-center justify-center rounded-full transition-[background-color,opacity,transform,box-shadow] duration-fast ease-out",
                canSend
                  ? "bg-accent text-white shadow-sm shadow-accent/30 hover:bg-accent-hover hover:shadow-md hover:shadow-accent/40 scale-100"
                  : "bg-surface text-text-tertiary opacity-60 scale-95"
              )}
            >
              <ArrowUp className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>

      {focused && value.trim() && !isStreaming && !recording && (
        <div className="pointer-events-none absolute -bottom-5 right-4 hidden text-2xs text-text-tertiary animate-in fade-in-0 duration-300 md:block">
          <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift + Enter</kbd> for a new line
        </div>
      )}

      {rejectedImage && (
        <div className="px-4 pb-2 text-2xs font-medium text-warning">
          This model doesn&apos;t support images — switch to a multimodal model to attach pictures.
        </div>
      )}

      {(recording || transcribing || recordError) && (
        <div className="px-4 pb-2 text-2xs font-medium">
          {recordError ? (
            <span className="text-warning">{recordError}</span>
          ) : transcribing ? (
            <span className="text-text-tertiary">Transcribing…</span>
          ) : (
            <span className="text-text-tertiary">Listening… tap the square when you&apos;re done</span>
          )}
        </div>
      )}

    </div>
  );
}

// Preview of a queued image. The object URL is created once per file and
// revoked when the preview goes away; creating it during render made a new
// blob URL on every keystroke and never released any of them.
function ImageThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return <div className="h-16 w-16 rounded-xl border border-border/80 bg-surface" />;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt={file.name}
      className="h-16 w-16 rounded-xl object-cover border border-border/80"
    />
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Live microphone level as a row of bars, plus elapsed time.
const WAVE_BARS = 40;
function RecordingWave({ stream }: { stream: MediaStream }) {
  const [levels, setLevels] = useState<number[]>(() => Array(WAVE_BARS).fill(0.05));
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let lastPush = 0;
    const tick = (t: number) => {
      // Sample ~16 times a second: each new level scrolls in from the right.
      if (t - lastPush > 60) {
        lastPush = t;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let k = 0; k < data.length; k++) sum += ((data[k] - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / data.length);
        const level = Math.min(1, Math.max(0.05, rms * 4));
        setLevels((prev) => [...prev.slice(1), level]);
        setNow(Date.now());
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      void ctx.close();
    };
  }, [stream]);

  const secs = Math.floor((now - startedAt) / 1000);
  return (
    <div className="flex items-center gap-3 px-4 pb-1 pt-1 animate-in fade-in-0 duration-200" aria-hidden="true">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-error" />
      <div className="flex h-8 flex-1 items-center gap-[3px] overflow-hidden">
        {levels.map((l, i) => (
          <span
            key={i}
            className="w-[3px] shrink-0 rounded-full bg-accent transition-[height] duration-75"
            style={{ height: `${Math.round(l * 100)}%`, opacity: 0.35 + l * 0.65 }}
          />
        ))}
      </div>
      <span className="shrink-0 tabular-nums text-xs text-text-tertiary">
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
      </span>
    </div>
  );
}
