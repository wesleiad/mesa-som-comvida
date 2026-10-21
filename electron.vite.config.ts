import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { SERVER_PORT } from "./shared/constants";

const shared = { "@shared": resolve("shared") };

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], resolve: { alias: shared } },
  renderer: {
    resolve: {
      alias: { "@renderer": resolve("src/renderer/src"), ...shared },
    },
    plugins: [react(), tailwindcss()],
    // Em dev o Vite serve a tela, mas a configuração continua vindo do
    // servidor embutido no processo principal (o mesmo que o tablet usa).
    server: { proxy: { "/api": `http://127.0.0.1:${SERVER_PORT}` } },
  },
});
