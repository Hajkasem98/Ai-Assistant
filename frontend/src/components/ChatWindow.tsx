import { Plus } from "lucide-react";
import type { Message } from "../types/chat";
import { Bubble } from "./Bubble";
import { EmptyState } from "./EmptyState";

export function ChatWindow({
  messages,
  isEmpty,
  isDesktop,
  isSending,
  firstName,
  listRef,
  scrollPaddingBottom,
  floatingNewChatBottom,
  audioMapRef,
  generatingMapRef,
  onPickSuggestion,
  onStartNewChat,
  children,
}: {
  messages: Message[];
  isEmpty: boolean;
  isDesktop: boolean;
  isSending: boolean;
  firstName: string;
  listRef: React.RefObject<HTMLDivElement | null>;
  scrollPaddingBottom: number;
  floatingNewChatBottom: number;
  audioMapRef: React.MutableRefObject<Map<string, HTMLAudioElement>>;
  generatingMapRef: React.MutableRefObject<Map<string, boolean>>;
  onPickSuggestion: (text: string) => void;
  onStartNewChat: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-w-0 flex-col">
      <section className="relative flex min-h-[calc(100vh-220px)] flex-1 flex-col overflow-visible rounded-[32px] border border-[#E7D8C8] bg-white shadow-[0_10px_30px_rgba(15,23,61,0.04)]">
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
          style={{ paddingBottom: scrollPaddingBottom }}
        >
          {isEmpty ? (
            <EmptyState firstName={firstName} onPick={onPickSuggestion} />
          ) : (
            <div className="mx-auto flex max-w-4xl flex-col gap-6">
              {messages.map((message) => (
                <Bubble
                  key={message.id}
                  id={message.id}
                  role={message.role}
                  content={message.content}
                  sources={message.sources}
                  audioMapRef={audioMapRef}
                  generatingMapRef={generatingMapRef}
                  isLoading={isSending && message.role === "assistant" && message.content.trim() === ""}
                />
              ))}
            </div>
          )}
        </div>

        {!isEmpty && !isDesktop && (
          <button
            type="button"
            onClick={onStartNewChat}
            className="fixed right-4 z-20 inline-flex items-center gap-2 rounded-full border border-[#D7DDE8] bg-white px-4 py-3 text-sm font-semibold text-[#000099] shadow-[0_10px_24px_rgba(15,23,61,0.12)] transition hover:bg-[#F5F8FF]"
            style={{ bottom: floatingNewChatBottom }}
          >
            <Plus size={16} />
            Ny chat
          </button>
        )}

        {children}
      </section>
    </main>
  );
}
