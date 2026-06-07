"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FoodCategory } from "@/lib/foods";
import { EmojiPicker } from "@/components/emoji-picker";
import {
  FoodIconProcessingError,
  processFoodIconImage,
} from "@/lib/image-icon";

// Renders a custom-food icon: a small rounded photo when one is set, else the
// emoji (or the generic 🍽 fallback). Sizing is passed in so each call site
// can match the emoji size it is replacing.
export function FoodIcon({
  emoji,
  src,
  sizeClass = "h-6 w-6",
  textClass = "text-lg",
  rounded = "rounded-md",
  alt = "",
}: {
  emoji?: string;
  src?: string;
  sizeClass?: string;
  textClass?: string;
  rounded?: string;
  alt?: string;
}) {
  if (src) {
    return (
      // Local data-URL icon — no remote fetch, so next/image optimization
      // doesn't apply. Kept as a plain <img>.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        aria-hidden={alt === "" ? true : undefined}
        className={cn(
          "shrink-0 border border-border/50 object-cover",
          sizeClass,
          rounded
        )}
      />
    );
  }
  return (
    <span className={cn("shrink-0 leading-none", textClass)}>
      {emoji || "🍽"}
    </span>
  );
}

const ERROR_COPY: Record<string, string> = {
  "not-an-image": "That file isn't an image.",
  "too-large": "Image is too large — pick a smaller photo.",
  "decode-failed": "Couldn't read that image. Try another.",
  "no-canvas": "Image processing unavailable on this device.",
};

// Combined picker used in the custom-food create/edit dialogs: choose an emoji
// OR a locally-processed photo icon. The photo never leaves the browser.
export function FoodIconField({
  emoji,
  onEmojiChange,
  imageDataUrl,
  onImageChange,
  category,
}: {
  emoji: string;
  onEmojiChange: (emoji: string) => void;
  imageDataUrl?: string;
  onImageChange: (dataUrl: string | undefined) => void;
  category?: FoodCategory;
}) {
  const [mode, setMode] = useState<"emoji" | "photo">(
    imageDataUrl ? "photo" : "emoji"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await processFoodIconImage(file);
      onImageChange(dataUrl);
      setMode("photo");
    } catch (e) {
      const code =
        e instanceof FoodIconProcessingError ? e.code : "decode-failed";
      setError(ERROR_COPY[code] ?? "Couldn't use that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <ModeTab
          active={mode === "emoji"}
          onClick={() => setMode("emoji")}
          label="Emoji"
        />
        <ModeTab
          active={mode === "photo"}
          onClick={() => setMode("photo")}
          label="Photo"
        />
      </div>

      {mode === "emoji" ? (
        <EmojiPicker
          value={emoji}
          onChange={onEmojiChange}
          category={category}
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-card/40">
              {imageDataUrl ? (
                <FoodIcon
                  src={imageDataUrl}
                  sizeClass="h-16 w-16"
                  rounded="rounded-lg"
                  alt="Custom food icon preview"
                />
              ) : (
                <span className="text-2xl">{emoji || "🍽"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => uploadRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-foreground disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-foreground disabled:opacity-60"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Camera
                </button>
                {imageDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      onImageChange(undefined);
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>
              <p className="font-mono text-[10px] leading-snug text-muted-foreground">
                Stored on-device, cropped to a small square. Falls back to the
                emoji if removed.
              </p>
            </div>
          </div>
          {error && <p className="font-mono text-xs text-rose-400">{error}</p>}
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/60 text-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}
