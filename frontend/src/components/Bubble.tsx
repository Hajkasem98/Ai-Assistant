import { useState } from "react";
import { LoaderCircle, Pause, Volume2 } from "lucide-react";
import { textToSpeech } from "../services/speechService";
import type { Role, SourceHit } from "../types/chat";
import { SourcesList } from "./SourcesList";

export function Bubble({
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
  const [sourcesOpen, setSourcesOpen] = useState(false);

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

      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
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
            <span className="text-sm font-medium text-[#6B625A]">Henter svar...</span>
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

        {!isLoading && (
          <SourcesList
            sources={sources ?? []}
            sourcesOpen={sourcesOpen}
            onToggle={() => setSourcesOpen((prev) => !prev)}
          />
        )}
      </div>
    </div>
  );
}

function renderStructuredContent(text: string) {
  const normalizeStructuredText = (raw: string) =>
    raw
      .replace(/\r\n/g, "\n")
      .replace(/(?:(?<=[!?;:])|(?:(?<!\d)\.))\s*(?=\d{1,2}\.\s*\p{L})/gu, "\n")
      .replace(/(?:(?<=[.!?;:])|(?<=[\p{L})\]]))\s*(?=[-•]\s+)/gu, "\n")
      .replace(/\n{3,}/g, "\n\n");

  const lines = normalizeStructuredText(text).split("\n");

  return lines.map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={index} className="h-2" />;
    }

    const normalized = trimmed.toLowerCase().replace(/:$/, "");

    const isHeading =
      (trimmed.endsWith(":") ||
        normalized === "kort svar" ||
        normalized === "steg for steg" ||
        normalized === "viktig å huske" ||
        normalized === "viktige punkter" ||
        normalized === "viktige detaljer") &&
      trimmed.length < 40 &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("•") &&
      !/^\d+\./.test(trimmed);

    const isNumberedStep = /^\d+\.\s*/.test(trimmed);
    const isBullet = /^[-•]\s*/.test(trimmed);

    if (isHeading) {
      return (
        <div key={index} className="pt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#000099]">
          {trimmed}
        </div>
      );
    }

    if (isNumberedStep) {
      const match = trimmed.match(/^(\d+)\.\s*(.*)$/);
      const stepNumber = match?.[1] ?? "";
      const stepText = match?.[2] ?? trimmed;

      return (
        <div key={index} className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EEF6FC] text-xs font-semibold text-[#000099]">
            {stepNumber}
          </div>
          <div className="flex-1 whitespace-pre-wrap text-[#292220]">{stepText}</div>
        </div>
      );
    }

    if (isBullet) {
      const bulletText = trimmed.replace(/^[-•]\s*/, "");
      return (
        <div key={index} className="flex items-start gap-3">
          <div className="mt-[10px] h-2 w-2 shrink-0 rounded-full bg-[#FF6600]" />
          <div className="flex-1 whitespace-pre-wrap text-[#292220]">{bulletText}</div>
        </div>
      );
    }

    return (
      <div key={index} className="whitespace-pre-wrap text-[#292220]">
        {line}
      </div>
    );
  });
}
