import { LogOut, PanelLeftClose, PanelLeftOpen, Trash2 } from "lucide-react";
import type { ChatSession } from "../types/chat";
import { formatTime } from "../utils/chatUtils";

/*
The sidebar is used to show chat history and navigation options in the AI assistant application.

The component shows:

-A New chat button
-A button to collapse or expand the sidebar on large screens
-A list of previous chat sessions
-Chat groups, for example by date such as today, yesterday, or older
-Active chat highlighting
-Delete button for each chat
-Logout button
-A smaller collapsed version of the chat list

There is also a helper component called CollapsedChatList.
This component is used when the sidebar is collapsed and only shows small buttons 
with the first letter of each chat title.

In simple words, this file creates the left sidebar where the user can start a new chat, 
open old chats, delete chats, collapse the sidebar, or log out.
 */
export function Sidebar({
  chatSessions,
  activeChatId,
  groupedChats,
  sidebarOpen,
  sidebarCollapsed,
  onStartNewChat,
  onToggleCollapsed,
  onSelectChat,
  onDeleteChat,
  onLogout,
  isLoggingOut,
}: {
  chatSessions: ChatSession[];
  activeChatId: string | null;
  groupedChats: [string, ChatSession[]][];
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  onStartNewChat: () => void;
  onToggleCollapsed: () => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}) {
  return (
    <aside
      className={[
        "z-40 flex flex-col rounded-[28px] border border-[#E7D8C8] bg-white shadow-[0_10px_30px_rgba(15,23,61,0.04)] transition-all duration-300",
        "lg:sticky lg:top-[108px] lg:flex lg:max-h-[calc(100vh-132px)]",
        sidebarOpen ? "fixed inset-y-24 left-4 w-[88vw] max-w-[320px] overflow-hidden" : "hidden lg:flex",
        sidebarCollapsed ? "lg:w-[88px]" : "",
      ].join(" ")}
    >
      <div className="border-b border-[#F0E5D9] p-4">
        <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"} gap-2`}>
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={onStartNewChat}
              className="flex-1 rounded-2xl bg-[#FF6600] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e45b00]"
            >
              Ny chat
            </button>
          )}

          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-[#D7DDE8] bg-white text-[#000099] transition hover:bg-[#F5F8FF] lg:inline-flex"
            title={sidebarCollapsed ? "Åpne sidepanel" : "Lukk sidepanel"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </div>

        <div className={`flex-1 overflow-y-auto p-4 ${sidebarCollapsed ? "px-2" : ""} lg:max-h-[calc(100vh-220px)]`}>
        {sidebarCollapsed ? (
          <CollapsedChatList chatSessions={chatSessions} activeChatId={activeChatId} onSelectChat={onSelectChat} />
        ) : groupedChats.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E7D8C8] bg-[#FBF7F2] p-4 text-sm text-[#6B625A]">
            Ingen tidligere chatter ennå.
          </div>
        ) : (
          groupedChats.map(([label, chats]) => (
            <div key={label} className="mb-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#000099]">{label}</div>

              <div className="space-y-2">
                {chats.map((chat) => {
                  const isActive = chat.id === activeChatId;
                  const preview = [...chat.messages].reverse().find((m) => m.role === "assistant")?.content || chat.messages[0]?.content || "Tom samtale";

                  return (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => onSelectChat(chat.id)}
                      className={[
                        "w-full rounded-2xl border p-3 text-left transition",
                        isActive ? "border-[#BFD2E7] bg-[#EEF6FC]" : "border-[#EFE5DA] bg-white hover:bg-[#FBF7F2]",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className={["line-clamp-2 text-sm font-semibold leading-5", isActive ? "text-[#000099]" : "text-[#292220]"].join(" ")}>{chat.title}</div>

                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[11px] text-[#8A8077]">{formatTime(chat.updatedAt)}</span>

                          <span
                            role="button"
                            tabIndex={0}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[#8A8077] hover:bg-[#F1E6DB] hover:text-[#FF6600]"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteChat(chat.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onDeleteChat(chat.id);
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 line-clamp-2 text-xs leading-5 text-[#6B625A]">{preview}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
          <div className={`border-t border-[#F0E5D9] p-4 ${sidebarCollapsed ? "hidden px-2 lg:block" : ""}`}>
              <button
                  type="button"
                  onClick={onLogout}
                  disabled={isLoggingOut}
                  className={[
                      "flex items-center justify-center gap-2 rounded-2xl border border-[#D7DDE8] bg-white text-sm font-semibold text-[#000099] transition hover:border-[#000099] hover:bg-[#F5F8FF] disabled:cursor-not-allowed disabled:opacity-60",
                      sidebarCollapsed ? "h-11 w-full px-0" : "w-full px-4 py-3",
                  ].join(" ")}
                  title="Logg ut"
              >
                  <LogOut size={18} />
                  {!sidebarCollapsed && <span>{isLoggingOut ? "Logger ut" : "Logg ut"}</span>}
              </button>
          </div>
    </aside>
  );
}

function CollapsedChatList({
  chatSessions,
  activeChatId,
  onSelectChat,
}: {
  chatSessions: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {chatSessions.slice(0, 12).map((chat) => {
        const isActive = chat.id === activeChatId;
        const label = chat.title.trim().charAt(0).toUpperCase();

        return (
          <button
            key={chat.id}
            type="button"
            onClick={() => onSelectChat(chat.id)}
            className={[
              "flex h-12 w-full items-center justify-center rounded-2xl border text-sm font-semibold transition",
              isActive ? "border-[#BFD2E7] bg-[#EEF6FC] text-[#000099]" : "border-[#EFE5DA] bg-white text-[#6B625A] hover:bg-[#FBF7F2]",
            ].join(" ")}
            title={chat.title}
          >
            {label || "N"}
          </button>
        );
      })}
    </div>
  );
}
