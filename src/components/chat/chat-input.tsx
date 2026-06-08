"use client";

import { useRef, useEffect, useState } from "react";
import { ArrowUp, ChevronDown, ImageIcon, Loader2, Mic, Paperclip, Sparkles, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAT_STYLES, type ChatStyle } from "@/lib/system-prompt";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ImageSize = "1024x1024" | "1024x1792" | "1792x1024";

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
  style?: ChatStyle;
  onStyleChange?: (style: ChatStyle) => void;
  imageSize?: ImageSize;
  onImageSizeChange?: (size: ImageSize) => void;
  // When false, images are filtered from attempted attachments and the
  // UI hints that the active model is text-only.
  allowImages?: boolean;
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
  style = "default",
  onStyleChange,
  imageSize = "1024x1024",
  onImageSizeChange,
  allowImages = true,
}: ChatInputProps) {
  const currentStyle = CHAT_STYLES.find((s) => s.id === style) ?? CHAT_STYLES[0];
  const currentImageSize =
    IMAGE_SIZES.find((s) => s.id === imageSize) ?? IMAGE_SIZES[0];
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

  // A light haptic on send — Android honors navigator.vibrate; iOS ignores it.
  const triggerSend = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
    }
    onSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  const transcribe = async (blob: Blob, mime: string) => {
    setTranscribing(true);
    setRecordError(null);
    try {
      const ext = mime.includes("mp4")
        ? "mp4"
        : mime.includes("ogg")
          ? "ogg"
          : "webm";
      const fd = new FormData();
      fd.append("file", blob, `recording.${ext}`);
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
        if (blob.size > 0) void transcribe(blob, type);
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
          className="flex-1 resize-none bg-transparent px-2 py-2 text-[16px] leading-[1.5] text-foreground caret-accent outline-none placeholder:text-text-tertiary disabled:opacity-50 max-h-[200px]"
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

      {(onStyleChange || onImageSizeChange) && (
        <div className="flex items-center gap-1 px-3 pb-2">
          {onStyleChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="press inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-text-tertiary hover:bg-surface hover:text-foreground transition-colors duration-fast ease-out"
                  aria-label="Choose response style"
                >
                  <Sparkles className="h-3 w-3" />
                  {currentStyle.label}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
                {CHAT_STYLES.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => onStyleChange(s.id)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="text-[13px] font-medium text-foreground">
                      {s.label}
                    </span>
                    <span className="text-[11px] text-text-tertiary">
                      {s.description}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onImageSizeChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="press inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-text-tertiary hover:bg-surface hover:text-foreground transition-colors duration-fast ease-out"
                  aria-label="Choose image aspect ratio"
                  title="Aspect ratio for /image"
                >
                  <ImageIcon className="h-3 w-3" />
                  {currentImageSize.hint}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-44">
                {IMAGE_SIZES.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => onImageSizeChange(s.id)}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span className="text-[13px] font-medium text-foreground">
                      {s.label}
                    </span>
                    <span className="text-[11px] text-text-tertiary">
                      {s.hint}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}
