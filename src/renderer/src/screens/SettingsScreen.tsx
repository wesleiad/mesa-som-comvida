import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { DEFAULT_MIXER_IP } from "@shared/constants";
import type { ServerInfo, StripKey } from "@shared/types";
import { confirmBox } from "../components/Dialog";
import { DiscoverDialog } from "../components/DiscoverDialog";
import { useUpdateStatus } from "../components/UpdateBanner";
import { useStripLook } from "../components/Strip";
import { allStripKeys, useMixer } from "../lib/mixer";
import { updateConfig, useConfig } from "../state/config";
import { useUi } from "../state/ui";
import { useSimpleKeys } from "./MixScreen";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
      <h3 className="section-title mb-3">{title}</h3>
      {children}
    </section>
  );
}

function ConnectionCard() {
  const cfg = useConfig((s) => s.config);
  const { link, model, firmware } = useMixer();
  const [ip, setIp] = useState(cfg.mixerIp);
  const [discover, setDiscover] = useState(false);
  useEffect(() => setIp(cfg.mixerIp), [cfg.mixerIp]);
  const status = { open: "Conectado ✅", connecting: "Conectando…", reconnecting: "Reconectando…", error: "Sem resposta ❌", off: "Desligado" }[link];

  return (
    <Card title="Conexão com a mesa">
      <div className="mb-3 flex rounded-xl bg-neutral-900 p-1">
        {[
          { v: false, l: "Mesa de verdade" },
          { v: true, l: "Simulador (treino)" },
        ].map((o) => (
          <button
            key={String(o.v)}
            onClick={() => updateConfig({ simulator: o.v })}
            className={`h-11 flex-1 rounded-lg font-semibold ${cfg.simulator === o.v ? "bg-brand-500 text-white" : "text-neutral-400"}`}
          >
            {o.l}
          </button>
        ))}
      </div>
      <button className="btn-brand mb-3 h-12 w-full text-base" onClick={() => setDiscover(true)}>
        🔍 Procurar mesa na rede
      </button>
      {discover && <DiscoverDialog onClose={() => setDiscover(false)} />}
      {!cfg.simulator && (
        <div className="mb-3">
          <span className="field-label">Endereço IP da mesa (se preferir digitar)</span>
          <div className="flex gap-2">
            <input className="input flex-1 font-mono" value={ip} inputMode="decimal" onChange={(e) => setIp(e.target.value)} placeholder={DEFAULT_MIXER_IP} />
            <button className="btn-brand h-12 px-4" onClick={() => updateConfig({ mixerIp: ip.trim() || DEFAULT_MIXER_IP })}>
              Conectar
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            No Wi-Fi da própria mesa o IP é <b>10.10.1.1</b>. Se a mesa está ligada no roteador da igreja, o IP aparece na tela
            original da mesa em Settings → Network.
          </p>
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-neutral-500">Situação</dt>
        <dd>{status}</dd>
        <dt className="text-neutral-500">Modelo</dt>
        <dd>{model ? { ui12: "Soundcraft Ui12", ui16: "Soundcraft Ui16", ui24: "Soundcraft Ui24R" }[model] : "—"}</dd>
        <dt className="text-neutral-500">Firmware</dt>
        <dd>{firmware || "—"}</dd>
      </dl>
      {!cfg.simulator && (
        <a href={`http://${cfg.mixerIp}/`} target="_blank" rel="noreferrer" className="btn-ghost mt-3 flex h-11 items-center justify-center text-sm">
          Abrir a tela original da mesa (EQ, compressor, efeitos) ↗
        </a>
      )}
    </Card>
  );
}

function DevicesCard() {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [qr, setQr] = useState<string>("");
  useEffect(() => {
    fetch("/api/info")
      .then((r) => r.json())
      .then((i: ServerInfo) => setInfo(i))
      .catch(() => setInfo(null));
  }, []);
  const url = info?.addresses[0] ? `http://${info.addresses[0]}:${info.port}` : "";
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#0a0a0a", light: "#ffffff" } }).then(setQr);
  }, [url]);

  return (
    <Card title="Abrir no tablet ou celular">
      {info && url ? (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {qr && <img src={qr} alt="QR code do endereço" className="h-44 w-44 rounded-xl" />}
          <div className="text-sm text-neutral-300">
            <p className="mb-2">Conecte o aparelho na mesma rede Wi-Fi deste computador e aponte a câmera pro QR code, ou digite no navegador:</p>
            {info.addresses.map((a) => (
              <div key={a} className="mb-1 font-mono text-lg text-brand-300 select-all">
                http://{a}:{info.port}
              </div>
            ))}
            <p className="mt-2 text-xs text-neutral-500">
              Dica: no tablet, use "Adicionar à tela inicial" pra virar um ícone. Este computador precisa estar com o programa aberto.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Este computador não está em nenhuma rede agora.</p>
      )}
    </Card>
  );
}

function LayoutRow({ k, i, total, move, remove }: { k: StripKey; i: number; total: number; move: (i: number, d: number) => void; remove: (k: StripKey) => void }) {
  const look = useStripLook(k);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-neutral-900 p-1.5 pl-3">
      <span className="h-6 w-1.5 rounded-full" style={{ background: look.color }} />
      <span className="text-xl">{look.icon}</span>
      <span className="min-w-0 flex-1 truncate">{look.name}</span>
      <button className="btn-ghost h-9 w-9" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">
        ↑
      </button>
      <button className="btn-ghost h-9 w-9" disabled={i === total - 1} onClick={() => move(i, 1)} aria-label="Descer">
        ↓
      </button>
      <button className="btn-ghost h-9 w-9 text-red-400" onClick={() => remove(k)} aria-label="Esconder">
        ✕
      </button>
    </div>
  );
}

function AddRow({ k }: { k: StripKey }) {
  const look = useStripLook(k);
  return (
    <>
      {look.icon} {look.name}
    </>
  );
}

function SimpleLayoutCard() {
  const layout = useSimpleKeys();
  const caps = useMixer((s) => s.caps);
  const hidden = allStripKeys(caps).flatMap((g) => g.keys).filter((k) => !layout.includes(k));
  const move = (i: number, d: number) => {
    const next = [...layout];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    updateConfig({ simpleLayout: next });
  };
  return (
    <Card title="Canais do visual básico (voluntários)">
      <p className="mb-3 text-sm text-neutral-400">
        Escolha quais canais aparecem e em que ordem. Pra mudar nome, ícone, cor e volume máximo, toque no nome do canal na aba Mesa.
      </p>
      <div className="space-y-1.5">
        {layout.map((k, i) => (
          <LayoutRow key={k} k={k} i={i} total={layout.length} move={move} remove={(r) => updateConfig({ simpleLayout: layout.filter((x) => x !== r) })} />
        ))}
      </div>
      {hidden.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-brand-300">+ Mostrar outro canal ({hidden.length} escondidos)</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hidden.map((k) => (
              <button key={k} className="btn-ghost h-10 px-3 text-sm" onClick={() => updateConfig({ simpleLayout: [...layout, k] })}>
                <AddRow k={k} />
              </button>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}

function SecurityCard() {
  const cfg = useConfig((s) => s.config);
  const [pin, setPin] = useState("");
  return (
    <Card title="Segurança">
      <span className="field-label">Nova senha do visual técnico (4 a 8 números)</span>
      <div className="mb-4 flex gap-2">
        <input className="input flex-1 font-mono" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
        <button
          className="btn-brand h-12 px-4 disabled:opacity-40"
          disabled={pin.length < 4}
          onClick={() => {
            updateConfig({ pin });
            setPin("");
          }}
        >
          Trocar
        </button>
      </div>
      {cfg.pin === "1234" && <p className="mb-3 text-sm text-amber-400">⚠ A senha ainda é a de fábrica (1234). Troque antes de deixar com os voluntários.</p>}
      <label className="flex items-center justify-between gap-3">
        <span>Pedir confirmação antes de silenciar tudo e trocar de cena</span>
        <input type="checkbox" className="h-6 w-6 accent-[#fc2747]" checked={cfg.confirmDangerous} onChange={(e) => updateConfig({ confirmDangerous: e.target.checked })} />
      </label>
      <label className="mt-3 flex items-center justify-between gap-3">
        <span>
          Começar com tudo mutado ao abrir o programa
          <span className="block text-xs text-neutral-500">Só no computador. Toque em "TUDO MUTADO" pra soltar o som.</span>
        </span>
        <input type="checkbox" className="h-6 w-6 accent-[#fc2747]" checked={cfg.muteOnStart} onChange={(e) => updateConfig({ muteOnStart: e.target.checked })} />
      </label>
    </Card>
  );
}

function VersionCard() {
  const st = useUpdateStatus();
  if (!st) return null;
  const text = {
    disabled: "Atualização automática só funciona no programa instalado.",
    idle: "Você está com a versão mais nova.",
    checking: "Procurando atualização…",
    downloading: `Baixando a versão ${st.next ?? ""}… ${st.percent ?? 0}%`,
    ready: `Versão ${st.next} pronta: instala quando fechar o programa.`,
  }[st.state];
  return (
    <Card title="Programa">
      <div className="text-sm">
        Versão <b>{st.current}</b> — {text}
      </div>
      <p className="mt-1 text-xs text-neutral-500">O programa procura atualização sozinho no GitHub ao abrir e a cada 30 minutos.</p>
    </Card>
  );
}

export function SettingsScreen() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <ConnectionCard />
          <DevicesCard />
          <SecurityCard />
        </div>
        <div className="space-y-4">
          <SimpleLayoutCard />
          <VersionCard />
          <button
            className="btn-ghost h-12 w-full"
            onClick={async () => {
              if (await confirmBox("Sair do visual técnico?", "O aparelho volta pro visual básico dos voluntários.", "Sair")) useUi.setState({ tech: false, tab: "mix" });
            }}
          >
            🔒 Sair do visual técnico
          </button>
        </div>
      </div>
    </div>
  );
}
