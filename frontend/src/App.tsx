import { useEffect, useMemo, useRef, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { callApi } from "./api/apiClient";
import { speechToText, textToSpeech } from "./services/speechService";
import {
    Bot,
    ChevronRight,
    FileText,
    Mic,
    Search,
    Sparkles,
    User,
    Volume2,
} from "lucide-react";

type Role = "user" | "assistant";

type ApiMessage = { role: "user" | "assistant"; content: string };

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

type ChatApiResponse = {
    answer?: string;
    sources?: SourceHit[];
};

type Message = {
    id: string;
    role: Role;
    content: string;
    sources?: SourceHit[];
};

const faqItems = [
    "Hvordan opprette en innkjøpsordre?",
    "Hvordan registrere avvik?",
    "Hva er de viktigste HMS-kravene?",
    "Hvordan føre arbeidslogger?",
];

function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

async function askBackend(req: ChatRequest): Promise<ChatApiResponse> {
    const base = import.meta.env.VITE_API_BASE_URL as string;

    if (!base) {
        throw new Error(
            "Mangler VITE_API_BASE_URL. Lag frontend/.env med f.eks. VITE_API_BASE_URL=https://localhost:56510 og restart npm run dev."
        );
    }

    const res = await callApi(`${base}/api/Chat`, {
        method: "POST",
        body: JSON.stringify(req),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend ${res.status}: ${text || res.statusText}`);
    }

    return (await res.json()) as ChatApiResponse;
}

export default function App() {
    const { accounts } = useMsal();
    const user = accounts[0];

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);

    const listRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const canSend = useMemo(
        () => input.trim().length > 0 && !isSending,
        [input, isSending]
    );

    const isEmpty = messages.length === 0;

    useEffect(() => {
        if (!isEmpty) {
            listRef.current?.scrollTo({
                top: listRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [messages.length, isEmpty]);

    const startNew = () => {
        setMessages([]);
        setInput("");
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const applySuggestion = (text: string) => {
        setInput(text);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const send = async () => {
        const q = input.trim();
        if (!q || isSending) return;

        setIsSending(true);
        setInput("");

        const userMsg: Message = { id: uid(), role: "user", content: q };
        const typingId = uid();

        setMessages((prev) => [
            ...prev,
            userMsg,
            { id: typingId, role: "assistant", content: "Søker…" },
        ]);

        try {
            const history: ApiMessage[] = messages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .slice(-6)
                .map((m) => ({ role: m.role, content: m.content }));

            const req: ChatRequest = {
                question: q,
                messages: history,
                topK: 5,
            };

            const response = await askBackend(req);
            const answerText =
                response.answer?.trim() || "Ingen svartekst ble returnert fra backend.";

            setMessages((prev) =>
                prev.map((m) =>
                    m.id === typingId
                        ? {
                            id: typingId,
                            role: "assistant",
                            content: answerText,
                            sources: response.sources ?? [],
                        }
                        : m
                )
            );
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.";
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === typingId
                        ? { id: typingId, role: "assistant", content: msg, sources: [] }
                        : m
                )
            );
        } finally {
            setIsSending(false);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    const onInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            void send();
        }
    };

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#eef6ff_0%,#f7fbff_38%,#f9fbff_100%)] text-slate-900">
            <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
                <nav className="sticky top-4 z-20 mb-6">
                    <div className="mx-auto flex h-18 items-center justify-between rounded-[28px] border border-white/70 bg-white/75 px-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:px-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-blue-100 shadow-sm">
                                <Sparkles className="h-5 w-5 text-sky-700" />
                            </div>
                            <div className="text-[17px] font-semibold tracking-tight text-slate-900">
                                Mesta
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {user?.name && (
                                <span className="hidden sm:block text-sm font-medium text-slate-700">
                                    Hei, {user.name.split(" ")[0]}
                                </span>
                            )}

                            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white shadow-sm">
                                {user?.name?.[0] ? (
                                    <span className="text-sm font-semibold text-slate-700">
                                        {user.name[0].toUpperCase()}
                                    </span>
                                ) : (
                                    <User className="h-4.5 w-4.5 text-slate-600" />
                                )}
                            </div>
                        </div>
                    </div>
                </nav>

                <main className="flex flex-1 flex-col">
                    {isEmpty ? (
                        <section className="flex flex-1 flex-col items-center px-1 pb-10 pt-6 sm:pt-10 lg:pt-14">
                            <div className="w-full max-w-4xl text-center">
                                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/80 bg-white/80 shadow-[0_12px_30px_rgba(37,99,235,0.08)] backdrop-blur">
                                    <Bot className="h-7 w-7 text-sky-700" />
                                </div>

                                <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-[56px] lg:leading-[1.08]">
                                    Hvordan kan jeg hjelpe deg i dag?
                                </h1>

                                <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                                    Få raske svar basert på interne dokumenter og etablerte
                                    arbeidsprosesser i en rolig, oversiktlig og profesjonell
                                    portal.
                                </p>

                                <div className="mx-auto mt-10 w-full max-w-3xl">
                                    <div className="rounded-[30px] border border-white/80 bg-white/90 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                                        <div className="flex flex-col gap-3 rounded-[24px] bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:gap-2 sm:p-3.5">
                                            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                                                    <Search className="h-4.5 w-4.5" />
                                                </div>

                                                <input
                                                    ref={inputRef}
                                                    value={input}
                                                    onChange={(e) => setInput(e.target.value)}
                                                    onKeyDown={onInputKeyDown}
                                                    placeholder="Still et spørsmål..."
                                                    disabled={isSending}
                                                    className="h-10 w-full min-w-0 border-0 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        const text = await speechToText();
                                                        setInput(text);
                                                        setTimeout(() => inputRef.current?.focus(), 0);
                                                    } catch (err) {
                                                        console.error("Speech error:", err);
                                                    }
                                                }}
                                                disabled={isSending}
                                                className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-slate-200 bg-white text-sky-700 shadow-sm transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-[52px] sm:w-[52px]"
                                                title="Snakk"
                                            >
                                                <Mic className="h-5 w-5" />
                                            </button>

                                            <button
                                                onClick={() => void send()}
                                                disabled={!canSend}
                                                className="inline-flex h-14 items-center justify-center rounded-[20px] bg-gradient-to-r from-sky-600 to-blue-600 px-7 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.28)] transition hover:translate-y-[-1px] hover:shadow-[0_16px_32px_rgba(37,99,235,0.32)] disabled:cursor-not-allowed disabled:opacity-50 sm:h-[52px]"
                                            >
                                                Søk
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-14 w-full max-w-4xl">
                                <div className="mb-5 px-1">
                                    <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                                        Ofte stilte spørsmål
                                    </h2>
                                </div>

                                <div className="space-y-4">
                                    {faqItems.map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => applySuggestion(item)}
                                            className="group flex w-full items-center gap-4 rounded-[28px] border border-white/80 bg-white/85 px-5 py-5 text-left shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-100 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)] sm:px-6 sm:py-6"
                                        >
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                                                <FileText className="h-5 w-5" />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="text-[16px] font-semibold tracking-tight text-slate-900 sm:text-[17px]">
                                                    {item}
                                                </div>

                                                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                                                    <FileText className="h-4 w-4" />
                                                    <span>Basert på dokumenter i SharePoint</span>
                                                </div>
                                            </div>

                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 text-slate-500 transition group-hover:border-sky-100 group-hover:bg-sky-50 group-hover:text-sky-700">
                                                <ChevronRight className="h-4.5 w-4.5" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className="flex flex-1 flex-col overflow-hidden">
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                                        Mesta AI Assistent
                                    </h1>
                                    <p className="mt-1 text-sm text-slate-600">
                                        Spør om prosedyrer, HMS, inspeksjoner og rapportering.
                                    </p>
                                </div>

                                <button
                                    onClick={startNew}
                                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                                >
                                    Ny chat
                                </button>
                            </div>

                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-white/80 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                                <div
                                    ref={listRef}
                                    className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6 lg:p-8"
                                >
                                    {messages.map((m) => (
                                        <MessageBubble
                                            key={m.id}
                                            role={m.role}
                                            content={m.content}
                                            sources={m.sources}
                                        />
                                    ))}
                                </div>

                                    <div className="border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
                                        <div className="flex items-center gap-3 rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)]">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm">
                                                <Bot className="h-5 w-5" />
                                            </div>

                                            <input
                                                ref={inputRef}
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={onInputKeyDown}
                                                placeholder="Still et spørsmål..."
                                                disabled={isSending}
                                                className="h-12 w-full min-w-0 border-0 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                                            />

                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        const text = await speechToText();
                                                        setInput(text);
                                                        setTimeout(() => inputRef.current?.focus(), 0);
                                                    } catch (err) {
                                                        console.error("Speech error:", err);
                                                    }
                                                }}
                                                disabled={isSending}
                                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sky-700 shadow-sm transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                title="Snakk"
                                            >
                                                <Mic className="h-4.5 w-4.5" />
                                            </button>

                                            <button
                                                onClick={() => void send()}
                                                disabled={!canSend}
                                                className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-600 to-blue-600 px-5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(37,99,235,0.22)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Søk
                                            </button>
                                        </div>
                                    </div>
                            </div>
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
}

function MessageBubble({
    role,
    content,
    sources,
}: {
    role: Role;
    content: string;
    sources?: SourceHit[];
}) {
    const isUser = role === "user";
    const visibleSources = (sources ?? []).filter(
        (source) => source.title || source.url
    );

    return (
        <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={[
                    "max-w-[90%] rounded-[28px] px-5 py-4 sm:max-w-[78%]",
                    isUser
                        ? "bg-gradient-to-br from-sky-600 to-blue-600 text-white shadow-[0_16px_30px_rgba(37,99,235,0.22)]"
                        : "border border-slate-200/80 bg-white text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.06)]",
                ].join(" ")}
            >
                <div className="space-y-2">
                    {content.split("\n").map((line, i) => (
                        <p
                            key={i}
                            className={`whitespace-pre-wrap text-[15px] leading-7 ${isUser ? "text-white/95" : "text-slate-700"
                                }`}
                        >
                            {line || "\u00A0"}
                        </p>
                    ))}
                </div>

                {!isUser && (
                    <div className="mt-4 flex items-center">
                        <button
                            onClick={async () => {
                                try {
                                    const audioUrl = await textToSpeech(content);
                                    const audio = new Audio(audioUrl);
                                    await audio.play();
                                } catch (err) {
                                    console.error("TTS error:", err);
                                }
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                            title="Spill av svar"
                        >
                            <Volume2 className="h-3.5 w-3.5" />
                            Spill av
                        </button>
                    </div>
                )}

                {!isUser && visibleSources.length > 0 && (
                    <div className="mt-5 border-t border-slate-200/80 pt-4">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Kilder
                        </div>

                        <div className="space-y-3">
                            {visibleSources.map((source, index) => (
                                <div
                                    key={`${source.url ?? source.title ?? "source"}-${index}`}
                                    className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"
                                >
                                    <div className="text-sm font-semibold text-slate-900">
                                        {source.title || `Kilde ${index + 1}`}
                                    </div>

                                    {source.url ? (
                                        <a
                                            href={source.url}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="mt-2 inline-flex items-center text-sm font-medium text-sky-700 hover:text-sky-800"
                                        >
                                            Åpne i SharePoint
                                        </a>
                                    ) : (
                                        <p className="mt-2 text-sm leading-6 text-slate-600">
                                            {source.contentSnippet}
                                        </p>
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