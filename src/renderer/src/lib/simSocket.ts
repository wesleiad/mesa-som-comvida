// Mesa de mentirinha: imita uma Soundcraft Ui24R pela mesma "conversa" de
// WebSocket que a biblioteca usa. Serve pra treinar voluntários e testar o
// app sem a mesa ligada. O estado fica só na memória da aba.

const NAMES = [
  "Voz Pastor", "Voz Ministro", "Back 1", "Back 2", "Back 3", "Violão", "Teclado L", "Teclado R",
  "Baixo", "Guitarra", "Bumbo", "Caixa", "Tom 1", "Tom 2", "Surdo", "Over L", "Over R",
  "Sax", "Mic Púlpito", "Mic Sem Fio", "Notebook L", "Notebook R", "Ambiente L", "Ambiente R",
];

const SHOWS: Record<string, string[]> = {
  "Comunidade Vida": ["Culto Domingo", "Culto Quarta", "Só Pregação", "Ensaio"],
  Eventos: ["Conferência", "Batismo"],
};

const INPUTS = 24;
const AUXES = 10;
const FX = 4;

function initialState(): Map<string, string> {
  const s = new Map<string, string>();
  const set = (k: string, v: string | number) => s.set(k, String(v));
  set("model", "ui24");
  set("firmware", "3.3.8293-ui24 (simulador)");
  set("m.mix", 0.72);
  set("m.mute", 0);
  for (let i = 0; i < INPUTS; i++) {
    set(`i.${i}.name`, NAMES[i] ?? `CH ${i + 1}`);
    set(`i.${i}.mix`, 0.55 + Math.random() * 0.15);
    set(`i.${i}.mute`, i >= 20 ? 1 : 0);
    set(`i.${i}.pan`, 0.5);
    set(`hw.${i}.gain`, 0.35);
    set(`hw.${i}.phantom`, i >= 2 && i <= 4 ? 1 : 0);
    for (let a = 0; a < AUXES; a++) {
      set(`i.${i}.aux.${a}.value`, 0.5);
      set(`i.${i}.aux.${a}.mute`, 0);
    }
  }
  for (let l = 0; l < 2; l++) {
    set(`l.${l}.mix`, 0.5);
    set(`p.${l}.mix`, 0.5);
    set(`p.${l}.name`, l === 0 ? "Player L" : "Player R");
  }
  for (let f = 0; f < FX; f++) {
    set(`f.${f}.mix`, 0.5);
    set(`f.${f}.name`, ["Reverb", "Delay", "Chorus", "Room"][f]);
  }
  for (let a = 0; a < AUXES; a++) {
    set(`a.${a}.mix`, 0.6);
    set(`a.${a}.mute`, 0);
    set(`a.${a}.name`, `AUX ${a + 1}`);
  }
  set("var.currentShow", "Comunidade Vida");
  set("var.currentSnapshot", "Culto Domingo");
  set("mgmask", 0);
  return s;
}

// O estado é compartilhado entre conexões (reconectar não "zera" a mesa).
let state: Map<string, string> | null = null;

/** Construtor compatível com WebSocket, passado em `webSocketCtor`. */
export class SimSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = 0;
  binaryType = "blob";
  protocol = "";
  extensions = "";
  bufferedAmount = 0;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  private vuTimer: number | undefined;

  constructor(public url: string) {
    state ??= initialState();
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.(new Event("open"));
      for (const [k, v] of state!) {
        const isNum = v !== "" && !Number.isNaN(Number(v)) && !k.endsWith(".name") && k !== "model" && k !== "firmware";
        this.emit(`${isNum ? "SETD" : "SETS"}^${k}^${v}`);
      }
      this.vuTimer = window.setInterval(() => this.emit(`VU2^${buildVu()}`), 80);
    }, 150);
  }

  private emit(msg: string) {
    if (this.readyState !== 1) return;
    this.onmessage?.(new MessageEvent("message", { data: `3:::${msg}` }));
  }

  send(raw: string) {
    if (!raw.startsWith("3:::")) return;
    const msg = raw.slice(4);
    const parts = msg.split("^");
    switch (parts[0]) {
      case "SETD":
      case "SETS":
        state!.set(parts[1], parts.slice(2).join("^"));
        break;
      case "SHOWLIST":
        this.emit(`SHOWLIST^${Object.keys(SHOWS).join("^")}`);
        break;
      case "SNAPSHOTLIST":
        this.emit(`SNAPSHOTLIST^${parts[1]}^${(SHOWS[parts[1]] ?? []).join("^")}`);
        break;
      case "CUELIST":
        this.emit(`CUELIST^${parts[1]}^`);
        break;
      case "LOADSNAPSHOT":
        state!.set("var.currentShow", parts[1]);
        state!.set("var.currentSnapshot", parts[2]);
        this.emit(`SETS^var.currentShow^${parts[1]}`);
        this.emit(`SETS^var.currentSnapshot^${parts[2]}`);
        break;
    }
  }

  close() {
    window.clearInterval(this.vuTimer);
    this.readyState = 2;
    // Igual a um WebSocket de verdade: o "close" chega depois, não na hora.
    setTimeout(() => {
      this.readyState = 3;
      this.onclose?.(new CloseEvent("close", { wasClean: true, code: 1000 }));
    }, 0);
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
}

// Medidores falsos que "respiram" como música, respeitando fader e mute.
let t = 0;
function buildVu(): string {
  t += 0.08;
  const st = state!;
  const num = (k: string, d = 0) => Number(st.get(k) ?? d);
  const header = [INPUTS, 2, 6, FX, AUXES, 2, 2, 0];
  const bytes: number[] = [...header];
  const lvl = (base: number) => Math.max(0, Math.min(240, Math.round(base * 240)));
  const mm = num("mgmask") & (1 << 23) ? 0 : 1; // bit 23 = MUTE ALL
  let masterPre = 0;
  for (let i = 0; i < INPUTS; i++) {
    const active = i < 20 ? 1 : 0;
    const pre = active * (0.55 + 0.3 * Math.abs(Math.sin(t * (1 + i * 0.13) + i)) * Math.random());
    const post = pre * 0.95;
    const pf = num(`i.${i}.mute`) ? 0 : post * Math.min(1, num(`i.${i}.mix`) * 1.25) * mm;
    masterPre = Math.max(masterPre, pf);
    bytes.push(lvl(pre), lvl(post), lvl(pf), 0, 0, 0);
  }
  for (let p = 0; p < 2; p++) bytes.push(0, 0, 0, 0, 0, 0);
  for (let s = 0; s < 6; s++) bytes.push(0, 0, 0, 0, 0, 0, 0);
  for (let f = 0; f < FX; f++) bytes.push(0, 0, 0, 0, 0, 0, 0);
  for (let a = 0; a < AUXES; a++) {
    const v = num(`a.${a}.mute`) ? 0 : masterPre * Math.min(1, num(`a.${a}.mix`) * 1.25);
    bytes.push(lvl(masterPre), lvl(v), 0, 0, 0);
  }
  const m = num("m.mute") ? 0 : masterPre * Math.min(1, num("m.mix") * 1.25);
  for (let c = 0; c < 2; c++) bytes.push(lvl(masterPre), lvl(m * (0.97 + 0.03 * c)), 0, 0, 0);
  for (let l = 0; l < 2; l++) bytes.push(0, 0, 0, 0, 0, 0);
  return btoa(String.fromCharCode(...bytes));
}
