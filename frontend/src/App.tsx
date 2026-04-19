import { useEffect, useMemo, useRef, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { callApi } from "./api/apiClient";
import { speechToText, textToSpeech } from "./services/speechService";
import mestaLogo from "./assets/Mesta_logo.svg";
import {
    Menu,
    Trash2,
    Mic,
    Send,
    FileText,
    ChevronRight,
    Volume2,
    Pause,
    PanelLeftClose,
    PanelLeftOpen,
    LoaderCircle,
    Plus,
    Info,
    X,
} from "lucide-react";

type Role = "user" | "assistant";

type ApiMessage = {
    role: "user" | "assistant";
    content: string;
};

type ChatRequest = {
    question: string;
    messages: ApiMessage[];
    topK: number;
};

type SourceHit = {
    title?: string | null;
    url?: string | null;
    contentSnippet: string;
};

type Message = {
    id: string;
    role: Role;
    content: string;
    sources?: SourceHit[];
};

type ChatSession = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: Message[];
};

const STORAGE_KEY = "mesta-ai-chat-history-tailwind-final-v7";
const DEFAULT_CHAT_TITLE = "Ny chat";
const MAX_TEXTAREA_HEIGHT = 180;

function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function nowIso() {
    return new Date().toISOString();
}

function createChat(title = DEFAULT_CHAT_TITLE): ChatSession {
    const now = nowIso();
    return {
        id: uid(),
        title,
        createdAt: now,
        updatedAt: now,
        messages: [],
    };
}

function generateChatTitle(question: string) {
    const text = question.replace(/\s+/g, " ").trim();
    if (!text) return DEFAULT_CHAT_TITLE;
    return text.length > 44 ? `${text.slice(0, 44).trim()}…` : text;
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("no-NO", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getBucketLabel(iso: string) {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    if (isSameDay(date, today)) return "I dag";
    if (isSameDay(date, yesterday)) return "I går";

    return date.toLocaleDateString("no-NO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function groupChats(chats: ChatSession[]) {
    const groups: Record<string, ChatSession[]> = {};

    chats.forEach((chat) => {
        const label = getBucketLabel(chat.updatedAt);
        if (!groups[label]) groups[label] = [];
        groups[label].push(chat);
    });

    return Object.entries(groups);
}

function buildRequestHistory(messages: Message[]): ApiMessage[] {
    return messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
            role: m.role,
            content: m.content.trim(),
        }))
        .filter((m) => m.content.length > 0)
        .slice(-6);
}

function useIsDesktop() {
    const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)");
        const handler = () => setIsDesktop(mq.matches);
        handler();
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    return isDesktop;
}

async function streamBackend(
    req: ChatRequest,
    onChunk: (chunk: string) => void
): Promise<void> {
    const base = import.meta.env.VITE_API_BASE_URL as string;

    if (!base) {
        throw new Error(
            "Mangler VITE_API_BASE_URL. Lag frontend/.env med f.eks. VITE_API_BASE_URL=https://localhost:56510 og restart npm run dev."
        );
    }

    const res = await callApi(`${base}/api/Chat/stream`, {
        method: "POST",
        body: JSON.stringify(req),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend ${res.status}: ${text || res.statusText}`);
    }

    if (!res.body) {
        throw new Error("Backend returnerte ingen stream.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            if (chunk) onChunk(chunk);
        }

        const lastChunk = decoder.decode();
        if (lastChunk) onChunk(lastChunk);
    } finally {
        reader.releaseLock();
    }
}

async function fetchSources(req: ChatRequest): Promise<SourceHit[]> {
    const base = import.meta.env.VITE_API_BASE_URL as string;

    if (!base) {
        throw new Error(
            "Mangler VITE_API_BASE_URL. Lag frontend/.env med f.eks. VITE_API_BASE_URL=https://localhost:56510 og restart npm run dev."
        );
    }

    const res = await callApi(`${base}/api/Chat/sources`, {
        method: "POST",
        body: JSON.stringify(req),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend ${res.status}: ${text || res.statusText}`);
    }

    return (await res.json()) as SourceHit[];
}

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
                .sort(
                    (a, b) =>
                        new Date(b.updatedAt).getTime() -
                        new Date(a.updatedAt).getTime()
                );

            setChatSessions(safeChats);
            if (safeChats.length > 0) {
                setActiveChatId(safeChats[0].id);
            }
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
        textarea.style.overflowY =
            textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
    }, [input]);

    useEffect(() => {
        const node = composerRef.current;
        if (!node) return;

        const updateHeight = () => {
            setComposerHeight(node.offsetHeight);
        };

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

    const updateChatById = (
        chatId: string,
        updater: (chat: ChatSession) => ChatSession
    ) => {
        setChatSessions((prev) => {
            const next = prev.map((chat) =>
                chat.id === chatId ? updater(chat) : chat
            );

            return [...next].sort(
                (a, b) =>
                    new Date(b.updatedAt).getTime() -
                    new Date(a.updatedAt).getTime()
            );
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

    const startNewChat = () => {
        createAndSelectNewChat();
    };

    const deleteChat = (chatId: string) => {
        const remaining = chatSessions.filter((chat) => chat.id !== chatId);
        setChatSessions(remaining);

        if (activeChatId === chatId) {
            setActiveChatId(remaining[0]?.id ?? null);
        }
    };

    const applySuggestion = (text: string) => {
        setInput(text);
        focusComposer();
    };

    const fillSuggestedQuestion = (text: string) => {
        setInput(text);
        setInfoOpen(false);
        focusComposer();
    };

    const send = async () => {
        const q = input.trim();
        if (!q || isSending) return;

        const chatId = ensureActiveChatId();
        const snapshotMessages =
            chatSessions.find((chat) => chat.id === chatId)?.messages ?? [];

        setIsSending(true);
        setInput("");

        const userMsg: Message = { id: uid(), role: "user", content: q };
        const typingId = uid();

        updateChatById(chatId, (chat) => ({
            ...chat,
            title:
                chat.messages.length === 0 || chat.title === DEFAULT_CHAT_TITLE
                    ? generateChatTitle(q)
                    : chat.title,
            updatedAt: nowIso(),
            messages: [
                ...chat.messages,
                userMsg,
                { id: typingId, role: "assistant", content: "", sources: [] },
            ],
        }));

        try {
            const history = buildRequestHistory(snapshotMessages);

            const req: ChatRequest = {
                question: q,
                messages: history,
                topK: 5,
            };

            let fullText = "";
            let pendingBuffer = "";
            let streamDone = false;

            const flushInterval = window.setInterval(() => {
                if (!pendingBuffer) {
                    if (streamDone) {
                        window.clearInterval(flushInterval);
                    }
                    return;
                }

                const take = Math.min(8, pendingBuffer.length);
                const piece = pendingBuffer.slice(0, take);
                pendingBuffer = pendingBuffer.slice(take);

                fullText += piece;

                updateChatById(chatId, (chat) => ({
                    ...chat,
                    updatedAt: nowIso(),
                    messages: chat.messages.map((m) =>
                        m.id === typingId
                            ? {
                                ...m,
                                content: fullText,
                                sources: [],
                            }
                            : m
                    ),
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
                            content: fullText.trim()
                                ? fullText
                                : "Ingen svartekst ble returnert fra backend.",
                            sources,
                        }
                        : m
                ),
            }));
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.";

            updateChatById(chatId, (chat) => ({
                ...chat,
                updatedAt: nowIso(),
                messages: chat.messages.map((m) =>
                    m.id === typingId
                        ? { ...m, content: msg, sources: [] }
                        : m
                ),
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

    const gridClass = sidebarCollapsed
        ? "lg:grid-cols-[88px_minmax(0,1fr)]"
        : "lg:grid-cols-[300px_minmax(0,1fr)]";

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

            {infoOpen && (
                <InfoModal
                    onClose={() => setInfoOpen(false)}
                    onUseExample={fillSuggestedQuestion}
                />
            )}

            <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-4 py-4 lg:px-6">
                <header className="sticky top-4 z-40 rounded-[28px] border border-[#E7D8C8] bg-white/95 px-5 py-4 shadow-[0_10px_30px_rgba(15,23,61,0.05)] backdrop-blur supports-[backdrop-filter]:bg-white/90">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E7D8C8] bg-[#FFF8F2]">
                                <img
                                    src={mestaLogo}
                                    alt="Mesta logo"
                                    className="max-h-8 max-w-8 object-contain"
                                />
                            </div>

                            <div className="min-w-0">
                                <div className="truncate text-[22px] font-semibold tracking-tight text-[#000099]">
                                    Mesta
                                </div>
                                <div className="text-sm text-[#6B625A]">
                                    AI Assistent
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                className="relative z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D7DDE8] bg-white text-lg text-[#000099] lg:hidden"
                                onClick={toggleSidebar}
                                title={sidebarOpen ? "Lukk historikk" : "Åpne historikk"}
                            >
                                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                            </button>

                            <div className="hidden text-sm font-medium text-[#000099] sm:block">
                                Hei, {firstName}
                            </div>

                            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D7DDE8] bg-[#F5F8FF] font-semibold text-[#000099]">
                                {firstName.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                <div className={`mt-5 grid flex-1 grid-cols-1 gap-5 ${gridClass}`}>
                    <aside
                        className={[
                            "z-40 rounded-[28px] border border-[#E7D8C8] bg-white shadow-[0_10px_30px_rgba(15,23,61,0.04)] transition-all duration-300",
                            "lg:sticky lg:top-[108px] lg:block lg:max-h-[calc(100vh-132px)]",
                            sidebarOpen
                                ? "fixed inset-y-24 left-4 w-[88vw] max-w-[320px] overflow-hidden"
                                : "hidden lg:block",
                            sidebarCollapsed ? "lg:w-[88px]" : "",
                        ].join(" ")}
                    >
                        <div className="border-b border-[#F0E5D9] p-4">
                            <div
                                className={`flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"
                                    } gap-2`}
                            >
                                {!sidebarCollapsed && (
                                    <button
                                        type="button"
                                        onClick={startNewChat}
                                        className="flex-1 rounded-2xl bg-[#FF6600] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e45b00]"
                                    >
                                        Ny chat
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setSidebarCollapsed((prev) => !prev)}
                                    className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-[#D7DDE8] bg-white text-[#000099] transition hover:bg-[#F5F8FF] lg:inline-flex"
                                    title={sidebarCollapsed ? "Åpne sidepanel" : "Lukk sidepanel"}
                                >
                                    {sidebarCollapsed ? (
                                        <PanelLeftOpen size={18} />
                                    ) : (
                                        <PanelLeftClose size={18} />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div
                            className={`overflow-y-auto p-4 ${sidebarCollapsed ? "px-2" : ""
                                } lg:max-h-[calc(100vh-220px)]`}
                        >
                            {sidebarCollapsed ? (
                                <div className="space-y-2">
                                    {chatSessions.slice(0, 12).map((chat) => {
                                        const isActive = chat.id === activeChatId;
                                        const label = chat.title.trim().charAt(0).toUpperCase();

                                        return (
                                            <button
                                                key={chat.id}
                                                type="button"
                                                onClick={() => setActiveChatId(chat.id)}
                                                className={[
                                                    "flex h-12 w-full items-center justify-center rounded-2xl border text-sm font-semibold transition",
                                                    isActive
                                                        ? "border-[#BFD2E7] bg-[#EEF6FC] text-[#000099]"
                                                        : "border-[#EFE5DA] bg-white text-[#6B625A] hover:bg-[#FBF7F2]",
                                                ].join(" ")}
                                                title={chat.title}
                                            >
                                                {label || "N"}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : groupedChats.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[#E7D8C8] bg-[#FBF7F2] p-4 text-sm text-[#6B625A]">
                                    Ingen tidligere chatter ennå.
                                </div>
                            ) : (
                                groupedChats.map(([label, chats]) => (
                                    <div key={label} className="mb-5">
                                        <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#000099]">
                                            {label}
                                        </div>

                                        <div className="space-y-2">
                                            {chats.map((chat) => {
                                                const isActive = chat.id === activeChatId;
                                                const preview =
                                                    [...chat.messages]
                                                        .reverse()
                                                        .find((m) => m.role === "assistant")
                                                        ?.content ||
                                                    chat.messages[0]?.content ||
                                                    "Tom samtale";

                                                return (
                                                    <button
                                                        key={chat.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveChatId(chat.id);
                                                            setSidebarOpen(false);
                                                        }}
                                                        className={[
                                                            "w-full rounded-2xl border p-3 text-left transition",
                                                            isActive
                                                                ? "border-[#BFD2E7] bg-[#EEF6FC]"
                                                                : "border-[#EFE5DA] bg-white hover:bg-[#FBF7F2]",
                                                        ].join(" ")}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div
                                                                className={[
                                                                    "line-clamp-2 text-sm font-semibold leading-5",
                                                                    isActive
                                                                        ? "text-[#000099]"
                                                                        : "text-[#292220]",
                                                                ].join(" ")}
                                                            >
                                                                {chat.title}
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <span className="shrink-0 text-[11px] text-[#8A8077]">
                                                                    {formatTime(chat.updatedAt)}
                                                                </span>

                                                                <span
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    className="flex h-7 w-7 items-center justify-center rounded-full text-[#8A8077] hover:bg-[#F1E6DB] hover:text-[#FF6600]"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        deleteChat(chat.id);
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (
                                                                            e.key === "Enter" ||
                                                                            e.key === " "
                                                                        ) {
                                                                            e.preventDefault();
                                                                            deleteChat(chat.id);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-2 line-clamp-2 text-xs leading-5 text-[#6B625A]">
                                                            {preview}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>

                    <main className="relative flex min-w-0 flex-col">
           

                        <section className="relative flex min-h-[calc(100vh-220px)] flex-1 flex-col overflow-visible rounded-[32px] border border-[#E7D8C8] bg-white shadow-[0_10px_30px_rgba(15,23,61,0.04)]">
                            <div
                                ref={listRef}
                                className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
                                style={{ paddingBottom: scrollPaddingBottom }}
                            >
                                {isEmpty ? (
                                    <EmptyState
                                        firstName={firstName}
                                        onPick={applySuggestion}
                                    />
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
                                                isLoading={
                                                    isSending &&
                                                    message.role === "assistant" &&
                                                    message.content.trim() === ""
                                                }
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {!isEmpty && !isDesktop && (
                                <button
                                    type="button"
                                    onClick={startNewChat}
                                    className="fixed right-4 z-20 inline-flex items-center gap-2 rounded-full border border-[#D7DDE8] bg-white px-4 py-3 text-sm font-semibold text-[#000099] shadow-[0_10px_24px_rgba(15,23,61,0.12)] transition hover:bg-[#F5F8FF]"
                                    style={{ bottom: floatingNewChatBottom }}
                                >
                                    <Plus size={16} />
                                    Ny chat
                                </button>
                            )}

                            <div
                                ref={composerRef}
                                className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#F0E5D9] bg-white/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-white/85 lg:sticky lg:bottom-0 lg:left-auto lg:right-auto lg:bg-white lg:border-t lg:p-4
    "
                            >
                                <div className="mx-auto w-full max-w-4xl">
                                    <div className="relative flex items-end gap-3 rounded-[24px] border border-[#E7D8C8] bg-[#FBF7F2] p-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sidebarOpen) setSidebarOpen(false);
                                                setInfoOpen(true);
                                            }}
                                            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D7DDE8] bg-white text-[#000099] transition hover:bg-[#F5F8FF]"
                                            title="Tips for best resultat"
                                        >
                                            <Info size={18} />
                                        </button>

                                        <div className="flex flex-1 items-start gap-3">                        

                                            <textarea
                                                ref={inputRef}
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={onKeyDown}
                                                placeholder={
                                                    isEmpty
                                                        ? "Still et spørsmål..."
                                                        : "Skriv en oppfølging..."
                                                }
                                                rows={1}
                                                disabled={isSending}
                                                className="min-h-[28px] max-h-[180px] w-full resize-none border-none bg-transparent m-1 text-[15px] text-[#292220] outline-none placeholder:text-[#8A8077]"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const text = await speechToText();
                                                    setInput(text);
                                                } catch (err) {
                                                    console.error("Speech error:", err);
                                                }
                                            }}
                                            disabled={isSending}
                                            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D7DDE8] bg-white text-lg text-[#000099] hover:bg-[#F5F8FF] disabled:cursor-not-allowed disabled:opacity-50"
                                            title="Tale til tekst"
                                        >
                                            <Mic size={20} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => void send()}
                                            disabled={!canSend}
                                            className="flex h-11 min-w-[52px] items-center justify-center rounded-2xl bg-[#FF6600] px-4 text-sm font-semibold text-white transition hover:bg-[#e45b00] disabled:cursor-not-allowed disabled:opacity-50"
                                            title={isSending ? "Henter svar..." : "Send"}
                                        >
                                            {isSending ? (
                                                <LoaderCircle size={18} className="animate-spin" />
                                            ) : (
                                                <Send size={16} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    );
}

function InfoModal({
    onClose,
    onUseExample,
}: {
    onClose: () => void;
    onUseExample: (text: string) => void;
}) {
    const examples = [
        "Hvordan registrerer jeg et avvik?",
        "Hva er stegene for å opprette en innkjøpsordre?",
        "Kan jeg sende inn arbeidsrapport etter fristen?",
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F173D]/35 p-4">
            <div className="w-full max-w-xl rounded-[28px] border border-[#E7D8C8] bg-white shadow-[0_20px_60px_rgba(15,23,61,0.18)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#F0E5D9] px-5 py-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D7DDE8] bg-[#EEF6FC] text-[#000099]">
                            <Info size={18} />
                        </div>
                        <div>
                            <div className="text-lg font-semibold text-[#000099]">
                                Slik får du best svar
                            </div>             
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D7DDE8] bg-white text-[#000099] transition hover:bg-[#F5F8FF]"
                        title="Lukk"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-5 px-5 py-5">
                    <div className="rounded-[20px] border border-[#E7D8C8] bg-[#FBF7F2] p-4">
                        <div className="text-sm font-semibold text-[#000099]">
                            Best bruk av appen
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#6B625A]">
                            Denne assistenten fungerer best når du spør om konkrete
                            arbeidsprosesser, rutiner og systembruk. Jo tydeligere
                            spørsmålet er, desto mer presist blir svaret.
                        </p>
                    </div>

                    <div>
                        <div className="text-sm font-semibold text-[#000099]">
                            Gode måter å starte et spørsmål på
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {["Hvordan ...", "Hva er ...", "Hva betyr ...", "Kan ...", "Må ...", "Skal ..."].map(
                                (item) => (
                                    <span
                                        key={item}
                                        className="rounded-full border border-[#D7DDE8] bg-[#F5F8FF] px-3 py-1.5 text-xs font-medium text-[#000099]"
                                    >
                                        {item}
                                    </span>
                                )
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="text-sm font-semibold text-[#000099]">
                            Tips for best resultat
                        </div>
                        <div className="mt-2 space-y-2 text-sm leading-6 text-[#6B625A]">
                            <div className="flex gap-3">
                                <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#FF6600]" />
                                <div>Still ett tydelig spørsmål om gangen.</div>
                            </div>
                            <div className="flex gap-3">
                                <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#FF6600]" />
                                <div>Beskriv oppgaven eller systemet du jobber i.</div>
                            </div>
                            <div className="flex gap-3">
                                <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#FF6600]" />
                                <div>
                                    For prosedyrer: spør gjerne{" "}
                                    <span className="font-medium text-[#292220]">
                                        “Hvordan ...”
                                    </span>{" "}
                                    eller{" "}
                                    <span className="font-medium text-[#292220]">
                                        “Hva er stegene for å ...”
                                    </span>
                                    .
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#FF6600]" />
                                <div>
                                    For begreper og oversikt: bruk{" "}
                                    <span className="font-medium text-[#292220]">
                                        “Hva er ...”
                                    </span>{" "}
                                    eller{" "}
                                    <span className="font-medium text-[#292220]">
                                        “Hva betyr ...”
                                    </span>
                                    .
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="text-sm font-semibold text-[#000099]">
                            Eksempler
                        </div>
                        <div className="mt-3 space-y-2">
                            {examples.map((example) => (
                                <button
                                    key={example}
                                    type="button"
                                    onClick={() => onUseExample(example)}
                                    className="flex w-full items-center justify-between rounded-[18px] border border-[#E7D8C8] bg-white px-4 py-3 text-left transition hover:bg-[#FBF7F2]"
                                >
                                    <span className="text-sm font-medium text-[#292220]">
                                        {example}
                                    </span>
                                    <ChevronRight size={18} className="text-[#000099]" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function EmptyState({
    firstName,
    onPick,
}: {
    firstName: string;
    onPick: (text: string) => void;
}) {
    const [faqOpen, setFaqOpen] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

    const faqItems = [
        {
            title: "Hvordan opprette en innkjøpsordre?",
            value: "Hvordan opprette en innkjøpsordre?",
        },
        {
            title: "Hvordan registrere avvik?",
            value: "Hvordan registrere avvik?",
        },
        {
            title: "Hva er de viktigste HMS-kravene?",
            value: "Hva er de viktigste HMS-kravene?",
        },
        {
            title: `Hva kan du hjelpe meg med, ${firstName}?`,
            value: "Hva kan du hjelpe meg med?",
        },
    ];

    const handlePick = (value: string) => {
        setSelectedQuestion(value);
        onPick(value);
    };

    return (
        <div className="mx-auto mt-6 flex max-w-4xl flex-col items-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-[#E7D8C8] bg-[#FFF8F2]">
                <div className="text-2xl text-[#FF6600]">
                    <img
                        src={mestaLogo}
                        alt="Mesta logo"
                        className="max-h-8 max-w-8 object-contain"
                    />
                </div>
            </div>

            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-[#000099] sm:text-5xl">
                Hvordan kan jeg hjelpe deg i dag?
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-7 text-[#6B625A] sm:text-lg">
                Få raske svar basert på interne dokumenter og etablerte
                arbeidsprosesser i en enkel og oversiktlig portal.
            </p>

            <div className="mt-8 w-full max-w-3xl text-left">
                <button
                    type="button"
                    onClick={() => setFaqOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-[20px] border border-[#E7D8C8] bg-white px-4 py-3 text-left transition hover:bg-[#FBF7F2]"
                >
                    <div>
                        <div className="text-base font-semibold text-[#000099]">
                            Ofte stilte spørsmål
                        </div>
                        <div className="mt-1 text-sm text-[#6B625A]">
                            Trykk for å {faqOpen ? "skjule" : "vise"} forslag
                        </div>
                    </div>

                    <ChevronRight
                        size={20}
                        className={`text-[#000099] transition-transform duration-200 ${faqOpen ? "rotate-90" : ""
                            }`}
                    />
                </button>

                {faqOpen && (
                    <div className="mt-3 space-y-3">
                        {faqItems.map((item) => (
                            <SuggestionCard
                                key={item.value}
                                title={item.title}
                                onClick={() => handlePick(item.value)}
                                isActive={selectedQuestion === item.value}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function SuggestionCard({
    title,
    onClick,
    isActive = false,
}: {
    title: string;
    onClick: () => void;
    isActive?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "flex w-full items-center gap-4 rounded-[24px] border px-5 py-4 text-left transition",
                isActive
                    ? "border-[#BFD2E7] bg-[#EEF6FC] ring-2 ring-[#D7DDE8]"
                    : "border-[#E7D8C8] bg-white hover:bg-[#FBF7F2]",
            ].join(" ")}
        >
            <div
                className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg",
                    isActive ? "bg-white text-[#000099]" : "bg-[#EEF6FC] text-[#000099]",
                ].join(" ")}
            >
                <FileText size={18} />
            </div>

            <div className="min-w-0 flex-1">
                <div
                    className={[
                        "text-sm font-semibold sm:text-base",
                        isActive ? "text-[#000099]" : "text-[#292220]",
                    ].join(" ")}
                >
                    {title}
                </div>          
            </div>

            <div
                className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xl",
                    isActive
                        ? "border-[#BFD2E7] bg-white text-[#000099]"
                        : "border-[#D7DDE8] text-[#000099]",
                ].join(" ")}
            >
                <ChevronRight size={20} />
            </div>
        </button>
    );
}

function Bubble({
    id,
    role,
    content,
    sources,
    audioMapRef,
    generatingMapRef,
    isLoading = false,
}: {
    id: string;
    role: Role;
    content: string;
    sources?: SourceHit[];
    audioMapRef: React.MutableRefObject<Map<string, HTMLAudioElement>>;
    generatingMapRef: React.MutableRefObject<Map<string, boolean>>;
    isLoading?: boolean;
}) {
    const isUser = role === "user";
    const [isPlaying, setIsPlaying] = useState(false);

    const visibleSources = (sources ?? []).filter(
        (source) => source.title || source.url
    );

    const handleTextToSpeech = async () => {
        try {
            const existing = audioMapRef.current.get(id);

            if (existing) {
                if (!existing.paused) {
                    existing.pause();
                    return;
                }

                await existing.play();
                return;
            }

            if (generatingMapRef.current.get(id)) return;
            generatingMapRef.current.set(id, true);

            const audioUrl = await textToSpeech(content);
            const audio = new Audio(audioUrl);
            audioMapRef.current.set(id, audio);

            audio.onplay = () => {
                setIsPlaying(true);
            };
            audio.onpause = () => {
                setIsPlaying(false);
            };
            audio.onended = () => {
                setIsPlaying(false);
                audioMapRef.current.delete(id);
                generatingMapRef.current.delete(id);
            };
            audio.onerror = () => {
                setIsPlaying(false);
                audioMapRef.current.delete(id);
                generatingMapRef.current.delete(id);
            };

            await audio.play();
        } catch (err) {
            console.error("TTS error:", err);
            setIsPlaying(false);
            generatingMapRef.current.delete(id);
        }
    };

    const renderStructuredContent = (text: string) => {
        const lines = text.split("\n");

        return lines.map((line, index) => {
            const trimmed = line.trim();

            if (!trimmed) {
                return <div key={index} className="h-2" />;
            }

            const isHeading =
                trimmed.endsWith(":") &&
                trimmed.length < 40 &&
                !trimmed.startsWith("-") &&
                !trimmed.startsWith("•") &&
                !/^\d+\./.test(trimmed);

            const isNumberedStep = /^\d+\.\s/.test(trimmed);
            const isBullet = /^[-•]\s/.test(trimmed);

            if (isHeading) {
                return (
                    <div
                        key={index}
                        className="pt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#000099]"
                    >
                        {trimmed}
                    </div>
                );
            }

            if (isNumberedStep) {
                const match = trimmed.match(/^(\d+)\.\s(.*)$/);
                const stepNumber = match?.[1] ?? "";
                const stepText = match?.[2] ?? trimmed;

                return (
                    <div key={index} className="flex items-start gap-3">
                        <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EEF6FC] text-xs font-semibold text-[#000099]">
                            {stepNumber}
                        </div>
                        <div className="flex-1 whitespace-pre-wrap text-[#292220]">
                            {stepText}
                        </div>
                    </div>
                );
            }

            if (isBullet) {
                const bulletText = trimmed.replace(/^[-•]\s/, "");

                return (
                    <div key={index} className="flex items-start gap-3">
                        <div className="mt-[10px] h-2 w-2 shrink-0 rounded-full bg-[#FF6600]" />
                        <div className="flex-1 whitespace-pre-wrap text-[#292220]">
                            {bulletText}
                        </div>
                    </div>
                );
            }

            return (
                <div key={index} className="whitespace-pre-wrap text-[#292220]">
                    {line}
                </div>
            );
        });
    };

    if (isUser) {
        return (
            <div className="flex justify-end">
                <div className="max-w-[85%] rounded-full bg-[#FF6600] px-5 py-3 text-sm font-medium text-white sm:max-w-[70%] sm:text-base">
                    {content}
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-start">
            <div className="w-full max-w-4xl rounded-[28px] border border-[#D7DDE8] bg-white p-5">
                {isLoading ? (
                    <div className="flex items-center gap-3 text-[#000099]">
                        <LoaderCircle size={20} className="animate-spin" />
                        <span className="text-sm font-medium text-[#6B625A]">
                            Henter svar...
                        </span>
                    </div>
                ) : (
                    <div className="space-y-3 text-[15px] leading-7 sm:text-base">
                        {renderStructuredContent(content)}
                    </div>
                )}

                {!isLoading && content.trim() && (
                    <div className="mt-5">
                        <button
                            type="button"
                            onClick={() => void handleTextToSpeech()}
                            className="rounded-full border border-[#D7DDE8] bg-[#F5F8FF] px-4 py-2 text-sm font-medium text-[#000099] hover:bg-[#EAF1FF]"
                            title="Spill av svar"
                        >
                            {isPlaying ? <Pause size={16} /> : <Volume2 size={16} />}
                        </button>
                    </div>
                )}

                {!isLoading && visibleSources.length > 0 && (
                    <div className="mt-6 border-t border-[#F0E5D9] pt-5">
                        <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#000099]">
                            Kilder
                        </div>

                        <div className="space-y-3">
                            {visibleSources.map((source, index) => (
                                <div
                                    key={`${source.url ?? source.title ?? "source"}-${index}`}
                                    className="rounded-2xl border border-[#E7D8C8] bg-[#FBF7F2] p-4"
                                >
                                    <div className="text-sm font-semibold text-[#292220]">
                                        {source.title || `Kilde ${index + 1}`}
                                    </div>

                                    {source.url ? (
                                        <a
                                            href={source.url}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="mt-2 inline-block text-sm font-medium text-[#000099] hover:text-[#FF6600] hover:underline"
                                        >
                                            Åpne i SharePoint
                                        </a>
                                    ) : (
                                        <div className="mt-2 text-sm leading-6 text-[#6B625A]">
                                            {source.contentSnippet}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}