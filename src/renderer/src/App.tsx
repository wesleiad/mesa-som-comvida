import { useEffect, useMemo, useState } from "react";
import { ConfirmHost, PinDialog, confirmBox } from "./components/Dialog";
import { DiscoverDialog } from "./components/DiscoverDialog";
import { UpdateBanner } from "./components/UpdateBanner";
import { connectMixer, useMixer, useObs, type LinkState } from "./lib/mixer";
import { useConfig } from "./state/config";
import { useUi, type Tab } from "./state/ui";
import { MixScreen } from "./screens/MixScreen";
import { ReturnsScreen } from "./screens/ReturnsScreen";
import { ScenesScreen } from "./screens/ScenesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

const TABS: { id: Tab; label: string; icon: string; tech?: boolean }[] = [
  { id: "mix", label: "Mesa", icon: "🎚️" },
  { id: "returns", label: "Retornos", icon: "🎧" },
  { id: "scenes", label: "Cenas", icon: "⭐" },
  { id: "settings", label: "Ajustes", icon: "⚙️", tech: true },
];

const LINK_LOOK: Record<LinkState, { text: string; cls: string }> = {
  open: { text: "Mesa conectada", cls: "bg-emerald-500/15 text-emerald-300" },
  connecting: { text: "Conectando…", cls: "bg-amber-500/15 text-amber-300" },
  reconnecting: { text: "Reconectando…", cls: "bg-amber-500/15 text-amber-300" },
  error: { text: "Mesa sem resposta", cls: "bg-red-500/20 text-red-300" },
  off: { text: "Desconectado", cls: "bg-neutral-800 text-neutral-400" },
};

function Logo() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <img src="/icon.svg" alt="" className="h-9 w-9 shrink-0" />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[15px] font-bold">
          Comunidade <span className="text-brand-500">Vida</span>
        </div>
        <div className="truncate text-xs text-neutral-400">Mesa de Som</div>
      </div>
    </div>
  );
}

function MuteAllButton() {
  const ui = useMixer((s) => s.ui);
  const confirmDangerous = useConfig((s) => s.config.confirmDangerous);
  const group = useMemo(() => (ui ? ui.muteGroup("all") : null), [ui]);
  const on = useObs(group?.state$, false);
  async function click() {
    if (!group) return;
    if (!on && confirmDangerous && !(await confirmBox("Silenciar tudo?", "Todo o som da igreja vai ficar mudo até você tocar de novo neste botão.", "Silenciar tudo", true)))
      return;
    group.toggle();
  }
  return (
    <button
      onClick={click}
      className={`h-11 shrink-0 rounded-xl px-3 text-sm font-bold transition active:scale-95 ${on ? "pulse-red bg-red-600 text-white" : "bg-neutral-800 text-red-300 ring-1 ring-red-500/40"}`}
      aria-pressed={on}
    >
      {on ? (
        <>
          🔇 TUDO MUTADO<span className="hidden sm:inline"> — tocar pra voltar</span>
        </>
      ) : (
        <>
          🔇<span className="hidden sm:inline"> Silenciar tudo</span>
        </>
      )}
    </button>
  );
}

export default function App() {
  const cfg = useConfig((s) => s.config);
  const online = useConfig((s) => s.online);
  const link = useMixer((s) => s.link);
  const simulator = useMixer((s) => s.simulator);
  const { tab, tech } = useUi();
  const [askPin, setAskPin] = useState(false);
  const [discover, setDiscover] = useState(false);

  useEffect(() => {
    connectMixer(cfg.mixerIp, cfg.simulator);
  }, [cfg.mixerIp, cfg.simulator]);

  const tabs = TABS.filter((t) => !t.tech || tech);
  const current = tabs.some((t) => t.id === tab) ? tab : "mix";
  const go = (id: Tab) => useUi.setState({ tab: id });
  const look = LINK_LOOK[link];

  return (
    <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex items-center gap-3 border-b border-white/10 bg-neutral-950 px-3 py-2">
        <Logo />
        <nav className="ml-4 hidden gap-1 md:flex">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              className={`h-11 rounded-xl px-4 font-semibold transition ${current === t.id ? "bg-brand-500 text-white" : "text-neutral-300 hover:bg-white/5"}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className={`hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline ${look.cls}`}>
            {simulator ? "🧪 Simulador" : look.text}
          </span>
          <span className={`h-3 w-3 rounded-full sm:hidden ${link === "open" ? "bg-emerald-400" : link === "error" ? "bg-red-500" : "bg-amber-400"}`} title={look.text} />
          <MuteAllButton />
          <div className="flex shrink-0 rounded-xl bg-neutral-800 p-1 ring-1 ring-white/10" role="group" aria-label="Visual do programa">
            <button
              onClick={() => useUi.setState({ tech: false })}
              aria-pressed={!tech}
              aria-label="Visual básico"
              className={`h-9 rounded-lg px-2 text-xs font-semibold sm:px-3 sm:text-sm ${!tech ? "bg-brand-500 text-white" : "text-neutral-400"}`}
            >
              Básico
            </button>
            <button
              onClick={() => !tech && setAskPin(true)}
              aria-pressed={tech}
              aria-label="Visual técnico"
              className={`h-9 rounded-lg px-2 text-xs font-semibold sm:px-3 sm:text-sm ${tech ? "bg-amber-400 text-black" : "text-neutral-400"}`}
            >
              {tech ? "Técnico" : "🔒 Técnico"}
            </button>
          </div>
        </div>
      </header>

      <UpdateBanner />
      {link !== "open" && !simulator && (
        <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-1.5 text-center text-sm ${look.cls}`}>
          <span>
            {link === "error" || link === "reconnecting"
              ? `Não estou achando a mesa em ${cfg.mixerIp}.`
              : `Conectando na mesa em ${cfg.mixerIp}…`}
          </span>
          <button className="rounded-lg bg-white/15 px-3 py-1 font-semibold" onClick={() => setDiscover(true)}>
            🔍 Procurar mesa
          </button>
        </div>
      )}
      {!online && <div className="bg-amber-500/15 px-3 py-1 text-center text-xs text-amber-300">Sem contato com o computador da igreja: mudanças de nomes/cenas não estão sendo salvas.</div>}

      <main className="flex min-h-0 flex-1 flex-col">
        {current === "mix" && <MixScreen />}
        {current === "returns" && <ReturnsScreen />}
        {current === "scenes" && <ScenesScreen />}
        {current === "settings" && <SettingsScreen />}
      </main>

      <nav className="flex border-t border-white/10 bg-neutral-950 pb-[env(safe-area-inset-bottom)] md:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            className={`flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${current === t.id ? "text-brand-400" : "text-neutral-400"}`}
          >
            <span className="text-xl">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {askPin && (
        <PinDialog
          pin={cfg.pin}
          onClose={() => setAskPin(false)}
          onOk={() => {
            setAskPin(false);
            useUi.setState({ tech: true });
          }}
        />
      )}
      {discover && <DiscoverDialog onClose={() => setDiscover(false)} />}
      <ConfirmHost />
    </div>
  );
}
