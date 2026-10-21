import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { SERVER_PORT } from "./shared/constants";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8")) as { version: string };

const shared = { "@shared": resolve("shared") };

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], resolve: { alias: shared } },
  renderer: {
    resolve: {
      alias: { "@renderer": resolve("src/renderer/src"), ...shared },
    },
    plugins: [react(), tailwindcss()],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    // Em dev o Vite serve a tela, mas a configuração continua vindo do
    // servidor embutido no processo principal (o mesmo que o tablet usa).
    server: { proxy: { "/api": `http://127.0.0.1:${SERVER_PORT}` } },
  },
});
