# CLAUDE.md

## O que é

"Mesa de Som - Com.Vida": controle simplificado (estilo Mixing Station, mais fácil) das mesas
Soundcraft Ui12/Ui16/Ui24R da Comunidade Vida. Identidade visual igual à Escala do Louvor
(vermelho-coral `#fc2747`, fundo `#0a0a0a`, fonte Fredoka embutida).

Stack: Electron 33 + electron-vite + React 19 + Tailwind v4 + zustand.
Protocolo da mesa: biblioteca `soundcraft-ui-connection` (fixada em 7.0.3; traz o rxjs embutido —
o `rxjs` em devDependencies é só pros tipos).

## Arquitetura

- `src/main/server.ts`: servidor HTTP na porta 8077 (0.0.0.0). Serve a tela (`out/renderer`) pra
  tablets/celulares e guarda a configuração em `userData/config.json` (`GET/PUT /api/config`,
  `/api/events` em SSE avisa todos os aparelhos quando muda).
- A janela do Electron abre `http://127.0.0.1:8077` — PC e tablet rodam exatamente o mesmo código.
- Cada aparelho conecta **direto** na mesa por WebSocket (`ws://<ip-da-mesa>`); a mesa aceita vários.
- `src/renderer/src/lib/simSocket.ts`: simulador de Ui24R (mesmo protocolo), ligado por padrão.
- Visual básico (voluntários, `Strip`/`BusStrip`) × visual técnico estilo Mixing Station (senha,
  padrão 1234; `TechStrip`/`TechBusStrip`). Teto de volume por canal só vale no visual básico.
- "Procurar mesa" (`src/main/discovery.ts`, `/api/discover`): varre a /24 de cada rede privada +
  10.10.1.1, abre o WebSocket da mesa e espera `SETS^model^uiXX`. `MESA_DISCOVER_EXTRA` (só testes)
  inclui IPs extras.
- Atualização automática (`src/main/updater.ts`, electron-updater): baixa da Release do GitHub e
  instala ao fechar; `/api/update` + botão "Atualizar agora" (só aceito vindo do próprio PC).
  O GitHub Actions publica `1.0.<run_number>` a cada push no `main` — não mexer na versão à mão.
- EQ/compressor/FX não estão no app: botão em Ajustes abre a tela original da mesa.

## Comandos

```bash
npm run dev          # dev (o Vite faz proxy de /api pro servidor do processo principal)
npm run typecheck
npm run test:ui      # build + teste ponta a ponta no simulador (PC, celular e tablet) + prints em scripts/shots/
npm run build:win    # instalador local em dist/ (perMachine: instalar com elevação; cria regra no firewall)
# testes usam MESA_PORT=8078 pra poder rodar com o programa instalado aberto
```

Fora do instalador o app usa `userData` com sufixo `-dev` pra não sobrescrever a configuração real.
