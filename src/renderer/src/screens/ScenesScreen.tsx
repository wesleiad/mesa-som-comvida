import { useMemo } from "react";
import type { ShowsWithDetails } from "soundcraft-ui-connection";
import { STRIP_COLORS } from "@shared/defaults";
import type { SceneButton } from "@shared/types";

type SceneKind = NonNullable<SceneButton["kind"]>;
import { confirmBox } from "../components/Dialog";
import { useMixer, useObs } from "../lib/mixer";
import { updateConfig, useConfig } from "../state/config";
import { useUi } from "../state/ui";

function useShows() {
  const ui = useMixer((s) => s.ui);
  const shows = useObs<ShowsWithDetails>(ui?.shows.shows$, {});
  const currentShow = useObs(ui?.shows.currentShow$, "");
  const currentSnap = useObs(ui?.shows.currentSnapshot$, "");
  const currentCue = useObs(ui?.shows.currentCue$, "");
  return { ui, shows, currentShow, currentSnap, currentCue };
}

export function ScenesScreen() {
  const tech = useUi((s) => s.tech);
  const scenes = useConfig((s) => s.config.scenes);
  const confirmDangerous = useConfig((s) => s.config.confirmDangerous);
  const { ui, shows, currentShow, currentSnap, currentCue } = useShows();

  async function load(show: string, name: string, label: string, kind: SceneKind = "snapshot") {
    if (!ui) return;
    const what =
      kind === "cue"
        ? "Parte dos ajustes da mesa vai mudar pra esse cue. Use só antes do culto ou entre os momentos."
        : "Todos os volumes e mutes da mesa vão mudar pra essa cena. Use só antes do culto ou entre os momentos.";
    if (confirmDangerous && !(await confirmBox(`Carregar "${label}"?`, what, "Carregar cena"))) return;
    if (kind === "cue") ui.shows.loadCue(show, name);
    else ui.shows.loadSnapshot(show, name);
  }

  const isCurrent = (show: string, name: string, kind: SceneKind = "snapshot") =>
    show === currentShow && name === (kind === "cue" ? currentCue : currentSnap);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="mb-1 text-xl font-semibold">Cenas</h2>
      <p className="mb-4 text-sm text-neutral-400">
        Uma cena deixa a mesa toda pronta de uma vez (volumes, mutes, retornos).
        {currentSnap && (
          <>
            {" "}Agora: <b className="text-brand-300">{currentSnap}</b>
          </>
        )}
      </p>

      {scenes.length > 0 ? (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {scenes.map((s) => (
            <button
              key={s.id}
              onClick={() => load(s.show, s.snapshot, s.label, s.kind)}
              className={`flex h-28 flex-col items-start justify-end rounded-2xl p-4 text-left text-lg font-semibold transition active:scale-95 ${
                isCurrent(s.show, s.snapshot, s.kind) ? "ring-4 ring-white" : "ring-1 ring-white/10"
              }`}
              style={{ background: `linear-gradient(135deg, ${s.color ?? "#fc2747"}cc, ${s.color ?? "#fc2747"}44)` }}
            >
              {isCurrent(s.show, s.snapshot, s.kind) && <span className="mb-auto rounded-full bg-black/40 px-2 py-0.5 text-xs">● ativa</span>}
              {s.label}
              {s.kind === "cue" && <span className="text-xs font-normal opacity-70">cue</span>}
            </button>
          ))}
        </div>
      ) : (
        !tech && (
          <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-neutral-400">
            Nenhuma cena liberada ainda. O técnico escolhe quais cenas aparecem aqui, no visual técnico.
          </div>
        )
      )}

      {tech && <TechScenes shows={shows} isCurrent={isCurrent} load={load} />}
    </div>
  );
}

function TechScenes({
  shows,
  isCurrent,
  load,
}: {
  shows: ShowsWithDetails;
  isCurrent: (show: string, name: string, kind?: SceneKind) => boolean;
  load: (show: string, name: string, label: string, kind?: SceneKind) => void;
}) {
  const scenes = useConfig((s) => s.config.scenes);
  const ui = useMixer((s) => s.ui);
  const entries = useMemo(() => Object.entries(shows), [shows]);

  const same = (s: SceneButton, show: string, name: string, kind: SceneKind) => s.show === show && s.snapshot === name && (s.kind ?? "snapshot") === kind;

  function toggle(show: string, snapshot: string, kind: SceneKind) {
    const existing = scenes.find((s) => same(s, show, snapshot, kind));
    if (existing) {
      updateConfig({ scenes: scenes.filter((s) => s !== existing) });
    } else {
      const btn: SceneButton = {
        id: `${Date.now()}`,
        label: snapshot,
        show,
        snapshot,
        ...(kind === "cue" ? { kind } : {}),
        color: STRIP_COLORS[scenes.length % STRIP_COLORS.length],
      };
      updateConfig({ scenes: [...scenes, btn] });
    }
  }

  async function saveCurrent() {
    if (!ui) return;
    if (await confirmBox("Salvar por cima da cena atual?", "A cena ativa na mesa vai ser trocada pelos volumes e ajustes de agora.", "Salvar", true)) {
      ui.shows.updateCurrentSnapshot();
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-title">Todas as cenas da mesa (visual técnico)</h3>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost h-10 px-3 text-sm" onClick={() => ui?.shows.refreshShows()}>
            ↻ Atualizar lista
          </button>
          <button className="btn-ghost h-10 px-3 text-sm" onClick={saveCurrent}>
            💾 Salvar cena atual
          </button>
        </div>
      </div>
      {scenes.length > 0 && <SceneLabels />}
      {entries.length === 0 && <p className="text-neutral-500">A mesa ainda não mandou a lista de shows/cenas.</p>}
      {entries.map(([show, d]) => (
        <div key={show} className="rounded-2xl border border-white/10 bg-neutral-950 p-3">
          <div className="mb-2 font-semibold">📁 {show}</div>
          {sceneList("Snapshots (mesa inteira)", "Sem snapshots neste show.", show, d.snapshots, "snapshot")}
          {d.cues.length > 0 && sceneList("Cues (só parte da mesa)", "", show, d.cues, "cue")}
        </div>
      ))}
    </section>
  );

  function sceneList(title: string, empty: string, show: string, names: string[], kind: SceneKind) {
    return (
      <div key={kind} className="mb-2 space-y-1.5">
        <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
        {names.length === 0 && <div className="text-sm text-neutral-500">{empty}</div>}
        {names.map((name) => {
          const on = scenes.some((s) => same(s, show, name, kind));
          return (
            <div key={name} className="flex items-center gap-2 rounded-xl bg-neutral-900 p-2">
              <span className="min-w-0 flex-1 truncate">
                {isCurrent(show, name, kind) && <span className="mr-1 text-brand-400">●</span>}
                {name}
              </span>
              <button className={`h-10 rounded-lg px-3 text-sm ${on ? "btn-brand" : "btn-ghost"}`} onClick={() => toggle(show, name, kind)}>
                {on ? "★ Voluntários" : "☆ Voluntários"}
              </button>
              <button className="btn-ghost h-10 px-3 text-sm" onClick={() => load(show, name, name, kind)}>
                Carregar
              </button>
            </div>
          );
        })}
      </div>
    );
  }
}

/** Renomear os botões de cena que os voluntários veem. */
function SceneLabels() {
  const scenes = useConfig((s) => s.config.scenes);
  const set = (id: string, patch: Partial<SceneButton>) => updateConfig({ scenes: scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const move = (i: number, d: number) => {
    const next = [...scenes];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    updateConfig({ scenes: next });
  };
  return (
    <div className="space-y-1.5 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-3">
      <div className="mb-1 text-sm text-neutral-400">Botões dos voluntários (nome, cor e ordem):</div>
      {scenes.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <input className="input h-10 flex-1" defaultValue={s.label} onBlur={(e) => set(s.id, { label: e.target.value.trim() || s.snapshot })} />
          <div className="flex gap-1">
            {STRIP_COLORS.slice(0, 6).map((c) => (
              <button key={c} onClick={() => set(s.id, { color: c })} className={`h-7 w-7 rounded-full ${s.color === c ? "ring-2 ring-white" : ""}`} style={{ background: c }} aria-label={`cor ${c}`} />
            ))}
          </div>
          <button className="btn-ghost h-10 w-10" onClick={() => move(i, -1)} aria-label="Subir">
            ↑
          </button>
          <button className="btn-ghost h-10 w-10" onClick={() => move(i, 1)} aria-label="Descer">
            ↓
          </button>
        </div>
      ))}
    </div>
  );
}
