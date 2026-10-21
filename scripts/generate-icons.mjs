// Gera os ícones do app (build/icon.ico + resources/icon.png) a partir de
// build/icon.svg. Script de uso único/manutenção — não faz parte do build
// normal (electron-builder e o BrowserWindow só leem os arquivos gerados).
//
// Uso: node scripts/generate-icons.mjs (gera também src/renderer/public/icon-512.png pro tablet)
// Depende de "sharp" e "png-to-ico" instalados (não são dependências do
// projeto — instale com `npm install --no-save sharp png-to-ico` antes de
// rodar, se precisar regenerar os ícones no futuro).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "build", "icon.svg");
const buildDir = join(root, "build");
const resourcesDir = join(root, "resources");

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  await mkdir(buildDir, { recursive: true });
  await mkdir(resourcesDir, { recursive: true });

  const svg = await readFile(svgPath);

  // PNGs pro .ico (multi-resolução)
  const pngBuffers = await Promise.all(
    ICO_SIZES.map((size) =>
      sharp(svg, { density: 384 }).resize(size, size).png().toBuffer(),
    ),
  );

  const ico = await pngToIco(pngBuffers);
  await writeFile(join(buildDir, "icon.ico"), ico);
  console.log("build/icon.ico gerado (%d resoluções)", ICO_SIZES.length);

  // PNG 512x512 pro build/icon.png (fallback genérico do electron-builder)
  const png512 = await sharp(svg, { density: 384 })
    .resize(512, 512)
    .png()
    .toBuffer();
  await writeFile(join(buildDir, "icon.png"), png512);
  console.log("build/icon.png gerado (512x512)");
  await writeFile(join(root, "src", "renderer", "public", "icon-512.png"), png512);

  // PNG 256x256 pro ícone da janela em dev/runtime (resources/icon.png,
  // importado em src/main/index.ts via `?asset`)
  const png256 = await sharp(svg, { density: 384 })
    .resize(256, 256)
    .png()
    .toBuffer();
  await writeFile(join(resourcesDir, "icon.png"), png256);
  console.log("resources/icon.png gerado (256x256)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
