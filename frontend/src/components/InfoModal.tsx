import { Info, X } from "lucide-react";

export function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F173D]/35 p-4">
      <div className="w-full max-w-xl rounded-[28px] border border-[#E7D8C8] bg-white shadow-[0_20px_60px_rgba(15,23,61,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#F0E5D9] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D7DDE8] bg-[#EEF6FC] text-[#000099]">
              <Info size={18} />
            </div>
            <div>
              <div className="text-lg font-semibold text-[#000099]">Slik får du best svar</div>
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
            <div className="text-sm font-semibold text-[#000099]">Best bruk av appen</div>
            <p className="mt-2 text-sm leading-6 text-[#6B625A]">
              Denne assistenten fungerer best når du spør om konkrete arbeidsprosesser,
              rutiner og systembruk. Jo tydeligere spørsmålet er, desto mer presist blir svaret.
            </p>
          </div>

          <div>
            <div className="text-sm font-semibold text-[#000099]">Gode måter å starte et spørsmål på</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Hvordan ...", "Hva er ...", "Hva betyr ...", "Kan ...", "Må ...", "Skal ..."].map((item) => (
                <span key={item} className="rounded-full border border-[#D7DDE8] bg-[#F5F8FF] px-3 py-1.5 text-xs font-medium text-[#000099]">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-[#000099]">Tips for best resultat</div>
            <div className="mt-2 space-y-2 text-sm leading-6 text-[#6B625A]">
              <Tip>Still ett tydelig spørsmål om gangen.</Tip>
              <Tip>Beskriv oppgaven eller systemet du jobber i.</Tip>
              <Tip>
                For prosedyrer: spør gjerne <span className="font-medium text-[#292220]">“Hvordan ...”</span> eller{" "}
                <span className="font-medium text-[#292220]">“Hva er stegene for å ...”</span>.
              </Tip>
              <Tip>
                For begreper og oversikt: bruk <span className="font-medium text-[#292220]">“Hva er ...”</span> eller{" "}
                <span className="font-medium text-[#292220]">“Hva betyr ...”</span>.
              </Tip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#FF6600]" />
      <div>{children}</div>
    </div>
  );
}
