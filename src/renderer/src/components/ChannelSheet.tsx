import { useMemo, useState } from "react";
import { STRIP_COLORS, STRIP_ICONS } from "@shared/defaults";
import type { StripKey } from "@shared/types";
import { allStripKeys, masterChannel, parseKey, useMixer, useObs } from "../lib/mixer";
import { updateConfig, updateStrip, useConfig } from "../state/config";
import { confirmBox, Modal } from "./Dialog";
import { useStripLook } from "./Strip";

const CAPS: { label: string; value: number | undefined }[] = [
  { label: "Sem limite", value: undefined },
  { label: "+5 dB", value: 5 },
  { label: "0 dB", value: 0 },
  { label: "−5 dB", value: -5 },
  { label: "−10 dB", value: -10 },
];

/** Ajustes completos de um canal (só no visual técnico). */
export function ChannelSheet({ skey, onClose }: { skey: StripKey; onClose: () => void }) {
  const ui = useMixer((s) => s.ui);
  const caps = useMixer((s) => s.caps);
  const look = useStripLook(skey);
  const cfg = useConfig((s) => s.config);
  const { kind, n } = parseKey(skey);
  const ch = useMemo(() => (ui ? masterChannel(ui, skey) : null), [ui, skey]);
  const hw = useMemo(() => (ui && kind === "i" ? ui.hw(n) : null), [ui, kind, n]);
  const pan = useObs(ch && "pan$" in ch ? ch.pan$ : null, 0.5);
  const gainDb = useObs(hw?.gainDB$, 0);
  const phantom = useObs(hw?.phantom$, false);
  const [label, setLabel] = useState(cfg.strips[skey]?.label ?? "");
  const flags = cfg.strips[skey]?.groups ?? [];
  const channelGroups = cfg.groups.filter((g) => g.kind === "channels");

  const layout = cfg.simpleLayout.length ? cfg.simpleLayout : allStripKeys(caps)[0].keys;
  const inSimple = layout.includes(skey);

  function toggleSimple() {
    updateConfig({ simpleLayout: inSimple ? layout.filter((k) => k !== skey) : [...layout, skey] });
  }

  async function togglePhantom() {
    if (!hw) return;
    const ok = await confirmBox(
      phantom ? "Desligar 48V?" : "Ligar 48V (phantom)?",
      phantom
        ? "Abaixe o volume do canal antes: desligar o 48V faz um estalo."
        : "Só ligue em microfone condensador ou direct box ativo. Nunca em microfone de fita. Abaixe o volume antes: faz um estalo.",
      phantom ? "Desligar" : "Ligar 48V",
      true,
    );
    if (ok) hw.togglePhantom();
  }

  return (
    <Modal title={`${look.icon} ${look.name}`} onClose={onClose} wide>
      <div className="grid gap-5 sm:grid-cols-2">
        <section className="space-y-3">
          <h3 className="section-title">Como aparece</h3>
          <label className="block">
            <span className="field-label">Nome no app</span>
            <input
              className="input"
              value={label}
              placeholder={look.mixerName || "nome da mesa"}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => updateStrip(skey, { label: label.trim() || undefined })}
            />
          </label>
          {label.trim() && label.trim() !== look.mixerName && (
            <button className="btn-ghost h-10 w-full text-sm" onClick={() => ch?.setName(label.trim())}>
              Gravar esse nome também na mesa
            </button>
          )}
          <div>
            <span className="field-label">Ícone</span>
            <div className="flex flex-wrap gap-1.5">
              {STRIP_ICONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => updateStrip(skey, { icon: ic })}
                  className={`h-11 w-11 rounded-xl text-2xl ${look.icon === ic ? "bg-brand-500/30 ring-2 ring-brand-500" : "bg-neutral-800"}`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="field-label">Cor</span>
            <div className="flex flex-wrap gap-2">
              {STRIP_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateStrip(skey, { color: c })}
                  aria-label={`cor ${c}`}
                  className={`h-10 w-10 rounded-full ${look.color === c ? "ring-4 ring-white/80" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="section-title">Grupos (flags)</h3>
          <div className="flex flex-wrap gap-1.5">
            {channelGroups.map((g) => {
              const on = flags.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => updateStrip(skey, { groups: on ? flags.filter((x) => x !== g.id) : [...flags, g.id] })}
                  aria-pressed={on}
                  className={`h-10 rounded-xl px-3 text-sm font-semibold ${on ? "text-black" : "btn-ghost"}`}
                  style={on ? { background: g.color } : undefined}
                >
                  {on ? "✓ " : ""}
                  {g.icon} {g.name}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-neutral-500">Os botões de grupo mutam todos os canais marcados de uma vez, no PA e nos retornos.</p>

          <h3 className="section-title pt-2">Pros voluntários</h3>
          {kind === "f" ? (
            <p className="text-sm text-neutral-500">Efeitos ficam travados no visual básico.</p>
          ) : (
          <button onClick={toggleSimple} className={`h-12 w-full rounded-xl font-semibold ${inSimple ? "btn-brand" : "btn-ghost"}`}>
            {inSimple ? "✓ Aparece no visual básico" : "Escondido no visual básico"}
          </button>
          )}
          <div>
            <span className="field-label">Volume máximo no visual básico</span>
            <div className="flex flex-wrap gap-1.5">
              {CAPS.map((c) => (
                <button
                  key={c.label}
                  onClick={() => updateStrip(skey, { maxDb: c.value })}
                  className={`h-10 rounded-xl px-3 text-sm ${look.maxDb === c.value ? "btn-brand" : "btn-ghost"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <h3 className="section-title pt-2">Som</h3>
          {ch && "setPan" in ch && (
            <label className="block">
              <span className="field-label flex justify-between">
                <span>Pan</span>
                <span>{pan < 0.49 ? `E ${Math.round((0.5 - pan) * 200)}` : pan > 0.51 ? `D ${Math.round((pan - 0.5) * 200)}` : "Centro"}</span>
              </span>
              <input type="range" min={0} max={1} step={0.01} value={pan} onChange={(e) => ch.setPan(Number(e.target.value))} onDoubleClick={() => ch.setPan(0.5)} className="range" />
            </label>
          )}
          {hw && (
            <>
              <label className="block">
                <span className="field-label flex justify-between">
                  <span>Ganho (pré-amp)</span>
                  <span>{gainDb.toFixed(0)} dB</span>
                </span>
                <div className="flex items-center gap-2">
                  <button className="btn-ghost h-11 w-11 text-xl" onClick={() => hw.changeGainDB(-1)}>
                    −
                  </button>
                  <div className="flex-1 text-center text-2xl font-semibold tabular-nums">{gainDb.toFixed(0)} dB</div>
                  <button className="btn-ghost h-11 w-11 text-xl" onClick={() => hw.changeGainDB(1)}>
                    +
                  </button>
                </div>
              </label>
              <button onClick={togglePhantom} className={`h-12 w-full rounded-xl font-bold ${phantom ? "bg-amber-500 text-black" : "btn-ghost"}`}>
                48V {phantom ? "LIGADO" : "desligado"}
              </button>
            </>
          )}
          <p className="text-xs text-neutral-500">
            Equalizador, compressor e efeitos ficam na tela original da mesa (botão em Ajustes).
          </p>
        </section>
      </div>
    </Modal>
  );
}
