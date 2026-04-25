import { useState } from "react";
import { ChevronRight } from "lucide-react";
import mestaLogo from "../assets/Mesta_logo.svg";
import { SuggestionCard } from "./SuggestionCard";

export function EmptyState({
  onPick,
}: {
  firstName: string;
  onPick: (text: string) => void;
}) {
  const [faqOpen, setFaqOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  const faqItems = [
    { title: "Hvordan opprette en innkjøpsordre?", value: "Hvordan opprette en innkjøpsordre?" },
    { title: "Hvordan oppsetter oppdragsmaler?", value: "Hvordan oppsetter oppdragsmaler?" },
    { title: "Hva er praktisk bruk av systemene", value: "Hva er praktisk bruk av systemene" },
    { title: "Hvordan tilpasse pakkene?", value: "Hvordan tilpasse pakkene?" },
    { title: "Hva krever manuell behandling?", value: "Hva krever manuell behandling?" },
    { title: "hva er metode for godkjenning av mengder Mesta?", value: "hva er metode for godkjenning av mengder Mesta?" },
    { title: "hva er Viktige momenter ved øktbehandling Mesta?", value: "hva er Viktige momenter ved øktbehandling Mesta?" },
    { title: "Hvordan logger jeg på combo?", value: "Hvordan logger jeg på combo?" },
    { title: "Beskrivelse under Basert på brukerveiledning i datafangst", value: "Beskrivelse under Basert på brukerveiledning i datafangs" },
    { title: "Hvordan registrere avvik?", value: "Hvordan registrere avvik?" },
    { title: "Hva er de viktigste HMS-kravene?", value: "Hva er de viktigste HMS-kravene?" },
  ];

  const handlePick = (value: string) => {
    setSelectedQuestion(value);
    onPick(value);
  };

  return (
    <div className="mx-auto mt-6 flex max-w-4xl flex-col items-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-[#E7D8C8] bg-[#FFF8F2]">
        <div className="text-2xl text-[#FF6600]">
          <img src={mestaLogo} alt="Mesta logo" className="max-h-8 max-w-8 object-contain" />
        </div>
      </div>

      <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-[#000099] sm:text-5xl">
        Hvordan kan jeg hjelpe deg i dag?
      </h2>

      <p className="mt-5 max-w-2xl text-base leading-7 text-[#6B625A] sm:text-lg">
        Her kan du stille spørsmål om MDS i Mesta
      </p>

      <div className="mt-8 w-full max-w-3xl text-left">
        <button
          type="button"
          onClick={() => setFaqOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-[20px] border border-[#E7D8C8] bg-white px-4 py-3 text-left transition hover:bg-[#FBF7F2]"
        >
          <div>
            <div className="text-base font-semibold text-[#000099]">Ofte stilte spørsmål</div>
            <div className="mt-1 text-sm text-[#6B625A]">Trykk for å {faqOpen ? "skjule" : "vise"} forslag</div>
          </div>

          <ChevronRight size={20} className={`text-[#000099] transition-transform duration-200 ${faqOpen ? "rotate-90" : ""}`} />
        </button>

        {faqOpen && (
          <div className="mt-3 space-y-3">
            {faqItems.map((item) => (
              <SuggestionCard key={item.value} title={item.title} onClick={() => handlePick(item.value)} isActive={selectedQuestion === item.value} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
