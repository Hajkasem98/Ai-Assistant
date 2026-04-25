import { Info, LoaderCircle, Mic, Send } from "lucide-react";

export function Composer({
  input,
  setInput,
  isEmpty,
  isSending,
  canSend,
  inputRef,
  composerRef,
  onInfoClick,
  onMicClick,
  onSend,
  onKeyDown,
}: {
  input: string;
  setInput: (value: string) => void;
  isEmpty: boolean;
  isSending: boolean;
  canSend: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  composerRef: React.RefObject<HTMLDivElement | null>;
  onInfoClick: () => void;
  onMicClick: () => void;
  onSend: () => void;
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
}) {
  return (
    <div
      ref={composerRef}
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#F0E5D9] bg-white/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-white/85 lg:sticky lg:bottom-0 lg:left-auto lg:right-auto lg:border-t lg:bg-white lg:p-4"
    >
      <div className="mx-auto w-full max-w-4xl">
        <div className="relative flex items-end gap-3 rounded-[24px] border border-[#E7D8C8] bg-[#FBF7F2] p-3">
          <button
            type="button"
            onClick={onInfoClick}
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
              placeholder={isEmpty ? "Still et spørsmål..." : "Skriv en oppfølging..."}
              rows={1}
              disabled={isSending}
              className="m-1 min-h-[28px] max-h-[180px] w-full resize-none border-none bg-transparent text-[15px] text-[#292220] outline-none placeholder:text-[#8A8077]"
            />
          </div>

          <button
            type="button"
            onClick={onMicClick}
            disabled={isSending}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D7DDE8] bg-white text-lg text-[#000099] hover:bg-[#F5F8FF] disabled:cursor-not-allowed disabled:opacity-50"
            title="Tale til tekst"
          >
            <Mic size={20} />
          </button>

          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="flex h-11 min-w-[52px] items-center justify-center rounded-2xl bg-[#FF6600] px-4 text-sm font-semibold text-white transition hover:bg-[#e45b00] disabled:cursor-not-allowed disabled:opacity-50"
            title={isSending ? "Henter svar..." : "Send"}
          >
            {isSending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
