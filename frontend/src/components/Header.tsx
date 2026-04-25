import { Menu, X } from "lucide-react";
import mestaLogo from "../assets/Mesta_logo.svg";

export function Header({
  firstName,
  sidebarOpen,
  onToggleSidebar,
}: {
  firstName: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="sticky top-4 z-40 rounded-[28px] border border-[#E7D8C8] bg-white/95 px-5 py-4 shadow-[0_10px_30px_rgba(15,23,61,0.05)] backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E7D8C8] bg-[#FFF8F2]">
            <img src={mestaLogo} alt="Mesta logo" className="max-h-8 max-w-8 object-contain" />
          </div>

          <div className="min-w-0">
            <div className="truncate text-[22px] font-semibold tracking-tight text-[#000099]">
              MDS AI Assistent
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D7DDE8] bg-white text-lg text-[#000099] lg:hidden"
            onClick={onToggleSidebar}
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
  );
}
