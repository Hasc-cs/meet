"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudIcon, LockIcon, PanelLeftIcon, SquarePenIcon } from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/chat/app-sidebar";
import { Composer } from "@/components/chat/composer";
import { EmptyState, SuggestionGrid } from "@/components/chat/empty-state";
import { MessageList } from "@/components/chat/message-list";
import { ModelPicker } from "@/components/chat/model-picker";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChat } from "@/hooks/use-chat";
import { useModels } from "@/hooks/use-models";
import { useAttachments } from "@/hooks/use-attachments";
import { useVoiceConfig } from "@/hooks/use-voice-config";
import VoiceSession from "@/components/voice/voice-session";
import { PhotoDropZone } from "@/components/photos/drop-overlay";
import { VisionNotice } from "@/components/photos/vision-notice";
import { APP_CONFIG } from "@/lib/config";
import { DEFAULT_IMAGE_LIMITS, textWithPhotoNote } from "@/lib/images";
import { ChatMessage, ModelInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-background/70 px-1 font-mono text-[12px]">{children}</code>
);

export function ChatApp() {
  const models = useModels();
  const limits = models.data?.image_limits ?? DEFAULT_IMAGE_LIMITS;
  const attachments = useAttachments(limits);

  // ---- photos: which model will look at them ----
  const chosen: ModelInfo | null = models.selection ? models.effective : null; // null = Auto
  const visionDefault = models.data?.default_vision ?? null;
  const canSee = chosen ? !!chosen.vision : !!visionDefault;
  const imagePolicy = useMemo(
    () => ({
      send: models.data ? canSee : true,
      perRequest: limits.per_request,
      perMessage: limits.per_message,
      maxBytes: limits.max_bytes,
    }),
    [models.data, canSee, limits.per_request, limits.per_message, limits.max_bytes],
  );
  const chat = useChat(models.selection, imagePolicy);
  const { config, prefs, setPrefs } = useVoiceConfig();
  const [sidebarOpen, setSidebarOpen] = useState(true); // desktop
  const [mobileOpen, setMobileOpen] = useState(false); // mobile sheet
  const [voiceActive, setVoiceActive] = useState(false);

  const empty = !chat.active || chat.active.messages.length === 0;
  const noModels = !models.loading && !models.effective;

  const newChat = useCallback(() => {
    chat.newChat();
    setMobileOpen(false);
  }, [chat]);

  const openChat = (id: string) => {
    chat.openChat(id);
    setMobileOpen(false);
  };

  const deleteChat = (id: string) => {
    const undo = chat.deleteChat(id);
    toast("Chat deleted", { action: { label: "Undo", onClick: undo } });
  };

  const clearAll = () => {
    const undo = chat.clearAll();
    toast("All chats deleted", { action: { label: "Undo", onClick: undo } });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        newChat();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSidebarOpen(true);
        setMobileOpen(true);
        requestAnimationFrame(() => document.getElementById("chat-search")?.focus());
      } else if (e.key === "Escape" && chat.streaming) {
        chat.stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat, newChat]);

  const sidebarProps = {
    conversations: chat.conversations,
    activeId: chat.activeId,
    onNewChat: newChat,
    onOpen: openChat,
    onDelete: deleteChat,
    onClearAll: clearAll,
    apiOnline: !models.error,
  };

  // ---- photos: logic for notices and disclaimers ----
  const pendingPhotos = attachments.items.length > 0;
  const chatHasPhotos = !!chat.active?.messages.some((m) => m.images?.length);
  const providerLabel = (id: string) => models.data?.providers.find((p) => p.id === id)?.label ?? id;
  const cloudCanSee = !!models.data?.providers.some(
    (p) => !p.local && p.available && p.models.some((m) => m.vision),
  );

  const switchToVision = useCallback(() => {
    if (!visionDefault) return;
    models.select({ provider: visionDefault.provider, model: visionDefault.id });
    toast(`Switched to ${visionDefault.name}. It can see images.`);
  }, [models, visionDefault]);

  const switchAction = visionDefault
    ? { label: `Use ${visionDefault.name}`, onClick: switchToVision }
    : undefined;
  const pullHint = (
    <>
      Run <Code>ollama pull gemma3</Code> or add a cloud API key, then refresh the model list.
    </>
  );

  let notice: React.ReactNode = null;
  let blocked = false;
  if (pendingPhotos && models.data) {
    if (chosen && !chosen.vision) {
      blocked = true;
      notice = (
        <VisionNotice tone="warning" action={switchAction}>
          <b className="font-medium">{chosen.name}</b> can&apos;t see images.{" "}
          {visionDefault ? "Switch to a model that can, or remove the photos." : pullHint}
        </VisionNotice>
      );
    } else if (!chosen && !visionDefault) {
      blocked = true;
      notice = (
        <VisionNotice tone="warning">
          No model that can see images is available. {pullHint}
        </VisionNotice>
      );
    } else if (!chosen && visionDefault) {
      notice = (
        <VisionNotice tone="info">
          Auto will answer with <b className="font-medium">{visionDefault.name}</b>,{" "}
          {visionDefault.local ? "a local model" : `a ${providerLabel(visionDefault.provider)} model`}{" "}
          that can see images.
        </VisionNotice>
      );
    }
  } else if (chatHasPhotos && chosen && !chosen.vision) {
    notice = (
      <VisionNotice tone="info" action={switchAction}>
        <b className="font-medium">{chosen.name}</b> can&apos;t see images, so it only gets a note that
        this chat has photos.
      </VisionNotice>
    );
  }

  const photoTarget = chosen?.vision ? chosen : !chosen ? visionDefault : null;
  const disclaimer =
    (pendingPhotos || chatHasPhotos) && photoTarget ? (
      photoTarget.local ? (
        <>
          <LockIcon className="mr-1 inline size-3 align-[-1px]" />
          Photos stay on this computer: <b className="font-medium">{photoTarget.name}</b> runs
          locally.{cloudCanSee && " If it fails, a cloud model may answer instead."}
        </>
      ) : (
        <>
          <CloudIcon className="mr-1 inline size-3 align-[-1px]" />
          Photos are sent to <b className="font-medium">{providerLabel(photoTarget.provider)}</b> to
          answer.
        </>
      )
    ) : (
      "AI can make mistakes. Check important information."
    );

  const sendSuggestion = (text: string) => {
    if (blocked || attachments.processing || chat.streaming) return;
    chat.send(text, attachments.takeAll());
  };

  const composer = (
    <Composer
      onSend={(text, images) => chat.send(text, images)}
      onStop={chat.stop}
      streaming={chat.streaming}
      disabled={noModels}
      autoFocus
      placeholder={noModels ? "No AI model available — see the model menu" : undefined}
      onVoiceStart={() => setVoiceActive(true)}
      attachments={attachments}
      photoLimit={limits.per_message}
      notice={notice}
      blocked={blocked}
    />
  );

  if (voiceActive && config?.enabled) {
    return (
      <VoiceSession
        selection={models.selection}
        participantName={APP_CONFIG.user.name}
        history={(chat.active?.messages || []).map((m) =>
          m.images?.length ? { ...m, content: textWithPhotoNote(m) } : m,
        )}
        voices={config.voices}
        voice={prefs.voice}
        captions={prefs.captions}
        onPrefsChange={setPrefs}
        onTranscripts={(msgs) => chat.upsertMessages(msgs)}
        onEnd={() => setVoiceActive(false)}
        onRetry={() => {}}
        renderText={(text) => <div className="whitespace-pre-wrap">{text}</div>}
      />
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={cn(
          "hidden shrink-0 border-r transition-[margin] duration-200 md:block md:w-72",
          !sidebarOpen && "md:-ml-72",
        )}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <AppSidebar {...sidebarProps} onCollapse={() => setSidebarOpen(false)} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showClose={false} className="w-72 p-0 md:hidden">
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          <SheetDescription className="sr-only">Your chat history</SheetDescription>
          <AppSidebar {...sidebarProps} onCollapse={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open sidebar"
                className={cn(sidebarOpen && "md:hidden")}
                onClick={() => {
                  setSidebarOpen(true);
                  setMobileOpen(true);
                }}
              >
                <PanelLeftIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open sidebar</TooltipContent>
          </Tooltip>
          <ModelPicker models={models} forPhotos={pendingPhotos || chatHasPhotos} />
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="New chat"
                className={cn(sidebarOpen && "md:hidden")}
                onClick={newChat}
              >
                <SquarePenIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
        </header>

        {empty ? (
          <div className="flex flex-1 flex-col justify-center overflow-y-auto px-3 pb-[8vh] sm:px-6">
            <EmptyState />
            {composer}
            <SuggestionGrid onPick={sendSuggestion} />
          </div>
        ) : (
          <>
            <MessageList
              conversation={chat.active!}
              streaming={chat.streaming}
              onRegenerate={chat.regenerate}
              onFeedback={chat.setFeedback}
            />
            <div className="shrink-0 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6">
              {composer}
            </div>
          </>
        )}
        <p className="shrink-0 px-4 pb-2 text-center text-xs text-muted-foreground" aria-live="polite">
          {voiceActive ? "AI can make mistakes. Check important information." : disclaimer}
        </p>
      </main>
      <PhotoDropZone
        enabled={!voiceActive && !noModels}
        onFiles={attachments.add}
        limitText={`JPEG, PNG, WebP or GIF · up to ${limits.per_message} photos, ${Math.round(limits.max_bytes / 1048576)} MB each`}
      />
    </div>
  );
}
