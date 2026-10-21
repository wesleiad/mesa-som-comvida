// Gera ícone e tela de abertura do app Android a partir de build/icon.svg.
// Script de manutenção (só rodar de novo se o ícone mudar).
// Uso: npm install --no-save sharp && node scripts/generate-android-icons.mjs

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const res = join(root, "android", "app", "src", "main", "res");
const svg = await readFile(join(root, "build", "icon.svg"));
const BG = "#0a0a0a";

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const icon = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

for (const [d, k] of Object.entries(DENSITIES)) {
  const dir = join(res, `mipmap-${d}`);
  const legacy = await icon(Math.round(48 * k));
  await writeFile(join(dir, "ic_launcher.png"), legacy);
  await writeFile(join(dir, "ic_launcher_round.png"), legacy);
  // Ícone adaptativo: 108dp, com o desenho dentro da área segura central (~66%).
  const full = Math.round(108 * k);
  const inner = Math.round(full * 0.62);
  const fg = await sharp({ create: { width: full, height: full, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await icon(inner), gravity: "center" }])
    .png()
    .toBuffer();
  await writeFile(join(dir, "ic_launcher_foreground.png"), fg);
}

// Fundo do ícone adaptativo no mesmo preto do app.
await writeFile(
  join(res, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`,
);

// Tela de abertura: fundo preto com o ícone no meio, em todos os tamanhos que o Capacitor gerou.
for (const dir of (await readdir(res)).filter((d) => d.startsWith("drawable"))) {
  const file = join(res, dir, "splash.png");
  let meta;
  try {
    meta = await sharp(file).metadata();
  } catch {
    continue;
  }
  const side = Math.round(Math.min(meta.width, meta.height) * 0.28);
  const out = await sharp({ create: { width: meta.width, height: meta.height, channels: 4, background: BG } })
    .composite([{ input: await icon(side), gravity: "center" }])
    .png()
    .toBuffer();
  await writeFile(file, out);
}
console.log("ícones e splash do Android gerados");
