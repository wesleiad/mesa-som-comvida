import { useEffect, useState, type ReactNode } from "react";
import { create } from "zustand";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-neutral-900 p-5 shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="btn-ghost h-10 w-10 text-xl" aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---- Confirmação (uma por vez, chamada de qualquer lugar com `confirm(...)`) ----

interface Ask {
  title: string;
  text: string;
  ok: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
}
const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }));

export function confirmBox(title: string, text: string, ok = "Confirmar", danger = false): Promise<boolean> {
  return new Promise((resolve) => useAsk.setState({ ask: { title, text, ok, danger, resolve } }));
}

export function ConfirmHost() {
  const ask = useAsk((s) => s.ask);
  if (!ask) return null;
  const done = (v: boolean) => {
    useAsk.setState({ ask: null });
    ask.resolve(v);
  };
  return (
    <Modal title={ask.title} onClose={() => done(false)}>
      <p className="mb-6 text-lg text-neutral-300">{ask.text}</p>
      <div className="flex gap-3">
        <button className="btn-ghost h-14 flex-1 text-lg" onClick={() => done(false)}>
          Cancelar
        </button>
        <button className={`h-14 flex-1 text-lg ${ask.danger ? "btn-danger" : "btn-brand"}`} onClick={() => done(true)} autoFocus>
          {ask.ok}
        </button>
      </div>
    </Modal>
  );
}

// ---- Senha do visual técnico ----

export function PinDialog({ pin, onOk, onClose }: { pin: string; onOk: () => void; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [wrong, setWrong] = useState(false);
  const press = (d: string) => {
    const next = (typed + d).slice(0, 8);
    setWrong(false);
    setTyped(next);
    if (next === pin) onOk();
    else if (next.length >= pin.length) {
      setWrong(true);
      setTimeout(() => setTyped(""), 400);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") setTyped((t) => t.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <Modal title="Visual técnico" onClose={onClose}>
      <p className="mb-4 text-neutral-400">Digite a senha pra liberar ganho, 48V, todos os canais e as configurações.</p>
      <div className={`mb-5 flex justify-center gap-3 ${wrong ? "shake" : ""}`}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <div key={i} className={`h-4 w-4 rounded-full ${i < typed.length ? (wrong ? "bg-red-500" : "bg-brand-500") : "bg-neutral-700"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k) =>
          k === "" ? (
            <div key="blank" />
          ) : (
            <button
              key={k}
              className="btn-ghost h-16 text-2xl"
              onClick={() => (k === "⌫" ? setTyped((t) => t.slice(0, -1)) : press(k))}
            >
              {k}
            </button>
          ),
        )}
      </div>
    </Modal>
  );
}
