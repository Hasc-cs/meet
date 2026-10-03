"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUpIcon, AudioLinesIcon, CameraIcon, ImageIcon, PlusIcon, SquareIcon } from "lucide-react";

import { AttachmentTray } from "@/components/photos/attachment-tray";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UseAttachments } from "@/hooks/use-attachments";
import { APP_CONFIG } from "@/lib/config";
import { ACCEPT_ATTR } from "@/lib/images";
import type { ChatImage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVoiceConfig } from "@/hooks/use-voice-config";

export function Composer({
  onSend,
  onStop,
  streaming,
  disabled,
  placeholder = `Message ${APP_CONFIG.appName}…`,
  autoFocus,
  onVoiceStart,
  attachments,
  photoLimit,
  notice,
  blocked,
}: {
  onSend: (text: string, images: ChatImage[]) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  onVoiceStart?: () => void;
  attachments?: UseAttachments;
  photoLimit?: number;
  notice?: ReactNode;
  blocked?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [coarse, setCoarse] = useState(false);
  const { config } = useVoiceConfig();

  useEffect(() => {
    if (autoFocus && window.matchMedia("(min-width: 768px)").matches) ref.current?.focus();
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, [autoFocus]);

  const photoCount = attachments?.items.length ?? 0;
  const processing = !!attachments?.processing;
  const hasContent = !!value.trim() || photoCount > 0;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (streaming) return onStop();
    if (!hasContent || disabled || processing || blocked) return;
    onSend(value, attachments?.takeAll() ?? []);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const touch = window.matchMedia("(hover: none)").matches;
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !touch) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = streaming || (hasContent && !disabled && !processing && !blocked);
  const showVoice = !!onVoiceStart && !streaming && !hasContent;
  const sendLabel = streaming
    ? "Stop generating"
    : processing
      ? "Waiting for photos to be ready"
      : "Send message";

  const pick = (input: HTMLInputElement | null) => {
    requestAnimationFrame(() => input?.click());
  };
  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) attachments?.add([...e.target.files]);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      {notice}
      {attachments && <AttachmentTray attachments={attachments} />}
      <form
        onSubmit={submit}
        className="mx-auto w-full max-w-3xl rounded-3xl border bg-card p-2.5 pl-4 shadow-sm transition-colors focus-within:border-ring"
      >
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <div className="flex items-end gap-1">
          {attachments && (
            <>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Add photos"
                        disabled={disabled}
                        className="-ml-2 rounded-full text-muted-foreground hover:text-foreground"
                      >
                        <PlusIcon />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Add photos</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" side="top" className="w-72">
                  <DropdownMenuItem onSelect={() => pick(fileInput.current)} className="items-start">
                    <ImageIcon className="mt-0.5" />
                    <span className="flex flex-col">
                      <span>Add photos</span>
                      <span className="text-xs text-muted-foreground">
                        JPEG, PNG, WebP or GIF · up to {photoLimit ?? 5}
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => pick(cameraInput.current)} className="items-start">
                    <CameraIcon className="mt-0.5" />
                    <span className="flex flex-col">
                      <span>Take a photo</span>
                      <span className="text-xs text-muted-foreground">
                        {coarse ? "Opens your camera" : "Uses your camera on phones and tablets"}
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
                    You can also paste or drop photos.
                  </p>
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT_ATTR}
                multiple
                hidden
                onChange={onFiles}
                data-testid="photo-input"
              />
              <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={onFiles}
              />
              {photoCount > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                  {photoCount} of {photoLimit ?? 5} photos
                </span>
              )}
            </>
          )}
          <textarea
            id="composer"
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            enterKeyHint="send"
            className="field-sizing-content max-h-52 min-h-7 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1" />
          {showVoice ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Start voice mode"
              className="rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => onVoiceStart?.()}
            >
              <AudioLinesIcon className="size-4" />
            </Button>
          ) : null}
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            aria-label={sendLabel}
            className={cn("rounded-full", !canSend && "opacity-30")}
          >
            {streaming ? <SquareIcon className="size-3.5 fill-current" /> : <ArrowUpIcon />}
          </Button>
        </div>
      </form>
    </div>
  );
}
