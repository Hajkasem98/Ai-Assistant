import { FileText } from "lucide-react";
import type { SourceHit } from "../types/chat";

export function SourcesList({
  sources,
  sourcesOpen,
  onToggle,
}: {
  sources: SourceHit[];
  sourcesOpen: boolean;
  onToggle: () => void;
}) {
  const visibleSources = sources.filter((source) => source.title || source.url);

  if (visibleSources.length === 0) return null;

  return (
    <div className="mt-6 border-t border-[#F0E5D9] pt-5">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-2 rounded-full border border-[#D7DDE8] bg-[#F5F8FF] px-4 py-2 text-sm font-medium text-[#000099] hover:bg-[#EAF1FF]"
      >
        <FileText size={16} />
        {sourcesOpen ? "Skjul kilder" : `Vis kilder (${visibleSources.length})`}
      </button>

      {sourcesOpen && (
        <div className="mt-4 space-y-3">
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
                <div className="mt-2 space-y-1">
                  <div className="text-sm font-medium text-[#B42318]">
                    Denne kilden har ingen direkte lenke
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
