import { ChevronRight, FileText } from "lucide-react";

export function SuggestionCard({
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
        <div className={["text-sm font-semibold sm:text-base", isActive ? "text-[#000099]" : "text-[#292220]"].join(" ")}>{title}</div>
      </div>

      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xl",
          isActive ? "border-[#BFD2E7] bg-white text-[#000099]" : "border-[#D7DDE8] text-[#000099]",
        ].join(" ")}
      >
        <ChevronRight size={20} />
      </div>
    </button>
  );
}
