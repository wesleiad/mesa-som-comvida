// Verificação ponta a ponta no simulador: abre o app compilado (out/) no
// Electron e a mesma tela no "celular" e no "tablet" (Chromium apontando pro
// servidor embutido), mexe em fader/mute/senha/retornos/cenas e tira prints.
// Uso: npm run build && node scripts/verify-ui.mjs
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const APP_DIR = path.resolve(import.meta.dirname, "..");
let pw;
try {
  pw = require("playwright-core");
} catch {
  pw = require(path.resolve(APP_DIR, "../Multitracks-Weslei/node_modules/playwright-core"));
}
const SHOTS = path.join(APP_DIR, "scripts", "shots");
fs.mkdirSync(SHOTS, { recursive: true });

// dados de dev limpos (nunca mexe no config do app instalado)
fs.rmSync(path.join(process.env.APPDATA, "mesadesom-comvida-dev"), { recursive: true, force: true });

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"} ${name} ${extra}`);
};
const errors = [];

// Mesa falsa em 127.0.0.77:80: aceita o WebSocket e se apresenta como Ui24,
// igual a Soundcraft faz. Serve pra testar o "Procurar mesa".
const FAKE_IP = "127.0.0.77";
const fake = net.createServer((sock) => {
  sock.on("error", () => {});
  sock.once("data", (d) => {
    const key = /Sec-WebSocket-Key: (.+)\r\n/i.exec(d.toString())?.[1]?.trim();
    if (!key) return sock.end("HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n");
    const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    for (const msg of ["3:::SETS^model^ui24", "3:::SETS^firmware^teste", "3:::SETS^i.0.name^Mesa Falsa"]) {
      const p = Buffer.from(msg);
      sock.write(Buffer.concat([Buffer.from([0x81, p.length]), p]));
    }
  });
});
await new Promise((r) => fake.listen(80, FAKE_IP, r));

const app = await pw._electron.launch({ args: ["."], cwd: APP_DIR, env: { ...process.env, ELECTRON_RENDERER_URL: "", MESA_DISCOVER_EXTRA: FAKE_IP, MESA_PORT: "8078" } });
const win = await app.firstWindow();
win.on("pageerror", (e) => errors.push(`desktop: ${e.message}`));
win.on("console", (m) => m.type() === "error" && errors.push(`desktop console: ${m.text()}`));
await win.setViewportSize({ width: 1440, height: 860 });
await win.waitForSelector("text=Volume geral", { timeout: 15000 });
await win.waitForTimeout(1200);

check("simulador conectado", (await win.locator("text=🧪 Simulador").count()) > 0);

// ao abrir, a mesa começa toda mutada; um toque solta o som
await win.waitForSelector("text=TUDO MUTADO", { timeout: 5000 }).catch(() => {});
check("abre com tudo mutado", (await win.locator("text=TUDO MUTADO").count()) === 1);
await win.screenshot({ path: path.join(SHOTS, "00-desktop-abre-mutado.png") });
await win.locator("button", { hasText: "TUDO MUTADO" }).click();
await win.waitForTimeout(150);
check("tocar em TUDO MUTADO solta o som", (await win.locator("text=TUDO MUTADO").count()) === 0);
const sliders = win.locator('[data-kind="fader"]');
check("faders das 24 entradas + geral", (await sliders.count()) === 25, `(${await sliders.count()})`);
check("nome do canal vindo da mesa", (await win.locator("text=Voz Pastor").count()) > 0);
await win.screenshot({ path: path.join(SHOTS, "01-desktop-simples.png") });

// fader relativo: tocar sem arrastar NÃO muda o volume; arrastar muda
const first = sliders.first();
const before = Number(await first.getAttribute("aria-valuenow"));
const box = await first.boundingBox();
await win.mouse.click(box.x + box.width / 2, box.y + 20);
await win.waitForTimeout(100);
const afterTap = Number(await first.getAttribute("aria-valuenow"));
check("tocar no fader não pula o volume", Math.abs(afterTap - before) < 1e-6, `${before} → ${afterTap}`);
await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await win.mouse.down();
await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 120, { steps: 8 });
await win.mouse.up();
await win.waitForTimeout(100);
const afterDrag = Number(await first.getAttribute("aria-valuenow"));
check("arrastar o fader sobe o volume", afterDrag > before + 0.05, `${before.toFixed(3)} → ${afterDrag.toFixed(3)}`);

// mute
const muteBtn = win.locator("button", { hasText: "DESMUTADO" }).first();
await muteBtn.click();
check("mute liga (MUTADO)", (await win.getByRole("button", { name: "MUTADO", exact: true }).count()) >= 1);

// silenciar tudo (com confirmação)
await win.locator("button", { hasText: "Silenciar tudo" }).click();
await win.locator('[role="dialog"] button', { hasText: "Silenciar tudo" }).click();
await win.waitForTimeout(150);
check("silenciar tudo ativo", (await win.locator("text=TUDO MUTADO").count()) === 1);
await win.screenshot({ path: path.join(SHOTS, "02-desktop-tudo-mudo.png") });
await win.locator("button", { hasText: "TUDO MUTADO" }).click();
check("silenciar tudo desliga", (await win.locator("text=TUDO MUTADO").count()) === 0);

// senha errada e certa
await win.locator('button[aria-label="Visual técnico"]').click();
for (const d of "9999") await win.keyboard.press(d);
await win.waitForTimeout(500);
check("senha errada não libera", (await win.locator("text=Ajustes").count()) === 0);
for (const d of "1234") await win.keyboard.press(d);
await win.waitForTimeout(300);
check("senha certa libera modo técnico", (await win.locator("nav >> text=Ajustes").count()) >= 1);
check("modo técnico mostra linha/player/FX", (await sliders.count()) === 24 + 4 + 4 + 1, `(${await sliders.count()})`);
await win.screenshot({ path: path.join(SHOTS, "03-desktop-tecnico.png") });

// renomear canal + esconder outro do modo simples
await win.locator("button", { hasText: "Voz Pastor" }).first().click();
await win.locator('[role="dialog"] input').first().fill("Pastor Fulano");
await win.locator('[role="dialog"] input').first().blur();
await win.locator('[role="dialog"] button', { hasText: "🎙️" }).click();
await win.getByRole("button", { name: "0 dB", exact: true }).click();
await win.screenshot({ path: path.join(SHOTS, "04-desktop-canal.png") });
await win.keyboard.press("Escape");
check("nome personalizado aparece", (await win.locator("text=Pastor Fulano").count()) > 0);

// grupos (flags): marca 2 microfones como "Mic com fio" e muta o grupo no PA
for (const name of ["Pastor Fulano", "Voz Ministro"]) {
  await win.locator("button", { hasText: name }).first().click();
  await win.locator('[role="dialog"] button', { hasText: "Mic com fio" }).click();
  await win.keyboard.press("Escape");
}
const micGroup = win.locator("button[aria-pressed]", { hasText: "Mic com fio" }).first();
check("grupo mostra 2 canais", (await micGroup.textContent()).includes("2"), await micGroup.textContent());
await micGroup.click();
await win.waitForTimeout(200);
check("grupo muta os canais no PA", (await micGroup.getAttribute("aria-pressed")) === "true");
await win.screenshot({ path: path.join(SHOTS, "04b-desktop-grupo-mutado.png") });
await micGroup.click();
await win.waitForTimeout(200);
check("grupo desmuta de novo", (await micGroup.getAttribute("aria-pressed")) === "false");

// retornos: liberar AUX 1 pros voluntários
await win.locator("nav >> text=Retornos").first().click();
await win.locator("button", { hasText: "AUX 1" }).first().click();
await win.locator('input[placeholder^="Nome"]').fill("Retorno Ministro");
await win.locator("button", { hasText: "Mostrar pros voluntários" }).click();
await win.waitForTimeout(200);
check("retorno liberado e renomeado", (await win.locator("text=Retorno Ministro").count()) > 0);
await win.screenshot({ path: path.join(SHOTS, "05-desktop-retorno.png") });

// grupo de canais dentro do retorno + grupo de retornos
const micInAux = win.locator("button[aria-pressed]", { hasText: "Mic com fio" }).first();
await micInAux.click();
await win.waitForTimeout(200);
check("grupo muta dentro do retorno", (await micInAux.getAttribute("aria-pressed")) === "true");
await micInAux.click();
await win.locator("button", { hasText: "Retornos do palco" }).first().click();
await win.locator('button[aria-label="Voltar pra lista de retornos"]').click();
const retGroup = win.locator("button[aria-pressed]", { hasText: "Retornos do palco" }).first();
await retGroup.click();
await win.waitForTimeout(200);
check("grupo de retornos muta o retorno", (await retGroup.getAttribute("aria-pressed")) === "true");
await win.screenshot({ path: path.join(SHOTS, "05b-desktop-grupo-retornos.png") });
await retGroup.click();
await win.locator("button", { hasText: "Retorno Ministro" }).first().click();

// cenas: liberar uma cena
await win.locator("nav >> text=Cenas").first().click();
await win.waitForSelector("text=Culto Quarta");
await win.locator("div.rounded-xl", { hasText: "Culto Quarta" }).locator("button", { hasText: "Voluntários" }).click();
check("cena liberada", (await win.locator("button.h-28", { hasText: "Culto Quarta" }).count()) === 1);
await win.locator("button.h-28", { hasText: "Culto Quarta" }).click();
await win.locator('[role="dialog"] button', { hasText: "Carregar cena" }).click();
await win.waitForTimeout(200);
check("carregar cena muda a cena ativa", (await win.locator("button.h-28", { hasText: "● ativa" }).count()) === 1);
await win.screenshot({ path: path.join(SHOTS, "06-desktop-cenas.png") });

// ajustes
await win.locator("nav >> text=Ajustes").first().click();
await win.waitForTimeout(500);
check("QR code pro tablet", (await win.locator('img[alt="QR code do endereço"]').count()) === 1);
await win.screenshot({ path: path.join(SHOTS, "07-desktop-ajustes.png") });

// procurar mesa: acha a mesa falsa, conecta nela e volta pro simulador
await win.locator("button", { hasText: "Procurar mesa na rede" }).click();
await win.waitForSelector(`text=${FAKE_IP}`, { timeout: 30000 });
check("procurar mesa acha a Ui24R", (await win.locator('[role="dialog"]', { hasText: "Soundcraft Ui24R" }).count()) === 1);
await win.screenshot({ path: path.join(SHOTS, "07b-procurar-mesa.png") });
await win.locator('[role="dialog"] button', { hasText: "Usar esta" }).click();
await win.waitForSelector("text=Mesa conectada", { timeout: 10000 }).catch(() => {});
await win.screenshot({ path: path.join(SHOTS, "07c-conectado.png") });
check("conecta na mesa encontrada", (await win.locator("text=Mesa conectada").count()) > 0 && (await win.locator("dd", { hasText: "teste" }).count()) > 0);
await win.locator("button", { hasText: "Simulador (treino)" }).click();
await win.waitForSelector("text=🧪 Simulador");

// ---- celular e tablet: mesma página pelo servidor embutido ----
const browser = await pw.chromium.launch({ channel: "chrome" }).catch(() => pw.chromium.launch({ channel: "msedge" }));
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
phone.on("pageerror", (e) => errors.push(`celular: ${e.message}`));
await phone.goto("http://127.0.0.1:8078/");
await phone.waitForSelector("text=Volume geral");
await phone.waitForTimeout(800);
check("celular recebe nome salvo no PC", (await phone.locator("text=Pastor Fulano").count()) > 0);
check("celular não muta tudo ao abrir", (await phone.locator("text=TUDO MUTADO").count()) === 0);
check("celular (básico) mostra os grupos", (await phone.locator("button[aria-pressed]", { hasText: "Mic com fio" }).count()) === 1);
check("celular começa no visual básico", (await phone.locator('button[aria-label="Visual básico"]').getAttribute("aria-pressed")) === "true");
const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check("celular sem rolagem lateral", !overflow);
await phone.screenshot({ path: path.join(SHOTS, "08-celular-mesa.png") });
await phone.locator("nav >> text=Retornos").last().tap();
await phone.waitForTimeout(300);
await phone.screenshot({ path: path.join(SHOTS, "09-celular-retornos.png") });
check("celular vê só o retorno liberado", (await phone.locator("button", { hasText: "AUX 2" }).count()) === 0 && (await phone.locator("text=Retorno Ministro").count()) > 0);
await phone.locator("nav >> text=Cenas").last().tap();
await phone.waitForTimeout(300);
await phone.screenshot({ path: path.join(SHOTS, "10-celular-cenas.png") });

// sincronização ao vivo: renomeia no PC, o celular atualiza sozinho
await win.locator("nav >> text=Mesa").first().click();
await win.locator("button", { hasText: "Pastor Fulano" }).first().click();
await win.locator('[role="dialog"] input').first().fill("Pastor Ciclano");
await win.locator('[role="dialog"] input').first().blur();
await win.keyboard.press("Escape");
await phone.locator("nav >> text=Mesa").last().tap();
await phone.waitForTimeout(800);
check("mudança no PC chega no celular ao vivo", (await phone.locator("text=Pastor Ciclano").count()) > 0);

const tablet = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: true });
tablet.on("pageerror", (e) => errors.push(`tablet: ${e.message}`));
await tablet.goto("http://127.0.0.1:8078/");
await tablet.waitForSelector("text=Volume geral");
await tablet.waitForTimeout(800);
await tablet.screenshot({ path: path.join(SHOTS, "11-tablet-mesa.png") });

// visual técnico no celular (faixas estreitas, rolando pro lado)
await phone.locator('button[aria-label="Visual técnico"]').tap();
for (const d of "1234") await phone.keyboard.press(d);
await phone.waitForTimeout(600);
check("celular entra no visual técnico", (await phone.locator('[data-kind="pan"]').count()) > 0);
await phone.screenshot({ path: path.join(SHOTS, "12-celular-tecnico.png") });

check("sem erros de JavaScript", errors.length === 0, errors.join(" | "));

await browser.close();
fake.close();
await app.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
