import type { CapacitorConfig } from "@capacitor/cli";

// App Android: a mesma tela do programa, empacotada dentro do aparelho.
// Fala direto com a mesa pelo Wi-Fi, sem internet e sem o computador ligado.
const config: CapacitorConfig = {
  appId: "com.comvida.mesadesom",
  appName: "Mesa de Som",
  webDir: "out/renderer",
  server: {
    // A mesa só fala ws:// (sem criptografia). Servindo o app por http://localhost
    // o Android deixa a conexão acontecer; com https ela seria bloqueada.
    androidScheme: "http",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
