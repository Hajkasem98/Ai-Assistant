import { useEffect, useMemo, useRef, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { speechToText } from "./services/speechService";
import type { ChatRequest, ChatSession, Message } from "./types/chat";
import { ChatWindow } from "./components/ChatWindow";
import { Composer } from "./components/Composer";
import { Header } from "./components/Header";
import { InfoModal } from "./components/InfoModal";
import { Sidebar } from "./components/Sidebar";
import { useIsDesktop } from "./hooks/useIsDesktop";
import { fetchSources, streamBackend } from "./services/chatApi";
import {
    buildRequestHistory,
    createChat,
    DEFAULT_CHAT_TITLE,
    generateChatTitle,
    groupChats,
    MAX_TEXTAREA_HEIGHT,
    nowIso,
    STORAGE_KEY,
    uid,
} from "./utils/chatUtils";

export default function App() {
    const { accounts } = useMsal();
    const user = accounts[0];
    const firstName = user?.name?.split(" ")[0] || "der";
    const isDesktop = useIsDesktop();

    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [composerHeight, setComposerHeight] = useState(132);
    const [infoOpen, setInfoOpen] = useState(false);

    const audioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());
    const generatingMapRef = useRef<Map<string, boolean>>(new Map());
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const composerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;

            const parsed = JSON.parse(raw) as ChatSession[];
            if (!Array.isArray(parsed)) return;

            const safeChats = parsed
                .filter((chat) => chat && chat.id && Array.isArray(chat.messages))
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

            setChatSessions(safeChats);
            if (safeChats.length > 0) setActiveChatId(safeChats[0].id);
        } catch (error) {
            console.error("Failed to load chat history:", error);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(chatSessions));
        } catch (error) {
            console.error("Failed to save chat history:", error);
        }
    }, [chatSessions]);

    useEffect(() => {
        const textarea = inputRef.current;
        if (!textarea) return;

        textarea.style.height = "auto";
        const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
    }, [input]);

    useEffect(() => {
        const node = composerRef.current;
        if (!node) return;

        const updateHeight = () => setComposerHeight(node.offsetHeight);
        updateHeight();

        const observer = new ResizeObserver(() => updateHeight());
        observer.observe(node);

        return () => observer.disconnect();
    }, [input, isSending, isDesktop]);

    useEffect(() => {
        if (!infoOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setInfoOpen(false);
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [infoOpen]);

    const activeChat = useMemo(
        () => chatSessions.find((chat) => chat.id === activeChatId) ?? null,
        [chatSessions, activeChatId]
    );

    const messages = activeChat?.messages ?? [];
    const groupedChats = useMemo(() => groupChats(chatSessions), [chatSessions]);
    const isEmpty = messages.length === 0;
    const canSend = input.trim().length > 0 && !isSending;

    useEffect(() => {
        listRef.current?.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [activeChatId, chatSessions, composerHeight]);

    const focusComposer = () => {
        window.setTimeout(() => inputRef.current?.focus(), 0);
    };

    const updateChatById = (chatId: string, updater: (chat: ChatSession) => ChatSession) => {
        setChatSessions((prev) => {
            const next = prev.map((chat) => (chat.id === chatId ? updater(chat) : chat));
            return [...next].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        });
    };

    const createAndSelectNewChat = () => {
        const fresh = createChat();
        setChatSessions((prev) => [fresh, ...prev]);
        setActiveChatId(fresh.id);
        setInput("");
        setSidebarOpen(false);
        focusComposer();
        return fresh.id;
    };

    const ensureActiveChatId = () => {
        if (activeChatId) return activeChatId;
        return createAndSelectNewChat();
    };

    const startNewChat = () => createAndSelectNewChat();

    const deleteChat = (chatId: string) => {
        const remaining = chatSessions.filter((chat) => chat.id !== chatId);
        setChatSessions(remaining);

        if (activeChatId === chatId) setActiveChatId(remaining[0]?.id ?? null);
    };

    const applySuggestion = (text: string) => {
        setInput(text);
        focusComposer();
    };

    const send = async () => {
        const q = input.trim();
        if (!q || isSending) return;

        const chatId = ensureActiveChatId();
        const snapshotMessages = chatSessions.find((chat) => chat.id === chatId)?.messages ?? [];

        setIsSending(true);
        setInput("");

        const userMsg: Message = { id: uid(), role: "user", content: q };
        const typingId = uid();

        updateChatById(chatId, (chat) => ({
            ...chat,
            title: chat.messages.length === 0 || chat.title === DEFAULT_CHAT_TITLE ? generateChatTitle(q) : chat.title,
            updatedAt: nowIso(),
            messages: [...chat.messages, userMsg, { id: typingId, role: "assistant", content: "", sources: [] }],
        }));

        try {
            const history = buildRequestHistory(snapshotMessages);
            const req: ChatRequest = { question: q, messages: history, topK: 4 };

            let fullText = "";
            let pendingBuffer = "";
            let streamDone = false;

            const flushInterval = window.setInterval(() => {
                if (!pendingBuffer) {
                    if (streamDone) window.clearInterval(flushInterval);
                    return;
                }

                const take = Math.min(8, pendingBuffer.length);
                const piece = pendingBuffer.slice(0, take);
                pendingBuffer = pendingBuffer.slice(take);
                fullText += piece;

                updateChatById(chatId, (chat) => ({
                    ...chat,
                    updatedAt: nowIso(),
                    messages: chat.messages.map((m) => (m.id === typingId ? { ...m, content: fullText, sources: [] } : m)),
                }));
            }, 20);

            await streamBackend(req, (chunk) => {
                pendingBuffer += chunk;
            });

            streamDone = true;

            while (pendingBuffer.length > 0) {
                await new Promise((resolve) => setTimeout(resolve, 20));
            }

            window.clearInterval(flushInterval);

            const sources = await fetchSources(req);

            updateChatById(chatId, (chat) => ({
                ...chat,
                updatedAt: nowIso(),
                messages: chat.messages.map((m) =>
                    m.id === typingId
                        ? {
                            ...m,
                            content: fullText.trim() ? fullText : "Ingen svartekst ble returnert fra backend.",
                            sources,
                        }
                        : m
                ),
            }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.";

            updateChatById(chatId, (chat) => ({
                ...chat,
                updatedAt: nowIso(),
                messages: chat.messages.map((m) => (m.id === typingId ? { ...m, content: msg, sources: [] } : m)),
            }));
        } finally {
            setIsSending(false);
            focusComposer();
        }
    };

    const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
        }
    };

    const toggleSidebar = () => {
        if (infoOpen) setInfoOpen(false);
        setSidebarOpen((prev) => !prev);
    };

    const gridClass = sidebarCollapsed ? "lg:grid-cols-[88px_minmax(0,1fr)]" : "lg:grid-cols-[300px_minmax(0,1fr)]";
    const scrollPaddingBottom = isDesktop ? 96 : composerHeight + 84;
    const floatingNewChatBottom = composerHeight + 20;

    return (
        <div className="min-h-screen bg-[#F5F1EA] text-[#292220]">
            {(sidebarOpen || infoOpen) && (
                <button
                    type="button"
                    className="fixed inset-0 z-30 bg-[#0F173D]/25"
                    onClick={() => {
                        setSidebarOpen(false);
                        setInfoOpen(false);
                    }}
                />
            )}

            {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}

            <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-4 py-4 lg:px-6">
                <Header firstName={firstName} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

                <div className={`mt-5 grid flex-1 grid-cols-1 gap-5 ${gridClass}`}>
                    <Sidebar
                        chatSessions={chatSessions}
                        activeChatId={activeChatId}
                        groupedChats={groupedChats}
                        sidebarOpen={sidebarOpen}
                        sidebarCollapsed={sidebarCollapsed}
                        onStartNewChat={startNewChat}
                        onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
                        onSelectChat={(chatId) => {
                            setActiveChatId(chatId);
                            setSidebarOpen(false);
                        }}
                        onDeleteChat={deleteChat}
                    />

                    <ChatWindow
                        messages={messages}
                        isEmpty={isEmpty}
                        isDesktop={isDesktop}
                        isSending={isSending}
                        firstName={firstName}
                        listRef={listRef}
                        scrollPaddingBottom={scrollPaddingBottom}
                        floatingNewChatBottom={floatingNewChatBottom}
                        audioMapRef={audioMapRef}
                        generatingMapRef={generatingMapRef}
                        onPickSuggestion={applySuggestion}
                        onStartNewChat={startNewChat}
                    >
                        <Composer
                            input={input}
                            setInput={setInput}
                            isEmpty={isEmpty}
                            isSending={isSending}
                            canSend={canSend}
                            inputRef={inputRef}
                            composerRef={composerRef}
                            onInfoClick={() => {
                                if (sidebarOpen) setSidebarOpen(false);
                                setInfoOpen(true);
                            }}
                            onMicClick={async () => {
                                try {
                                    const text = await speechToText();
                                    setInput(text);
                                } catch (err) {
                                    console.error("Speech error:", err);
                                }
                            }}
                            onSend={() => void send()}
                            onKeyDown={onKeyDown}
                        />
                    </ChatWindow>
                </div>
            </div>
        </div>
    );
}
