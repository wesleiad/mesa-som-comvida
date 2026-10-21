# Mesa de Som - Com.Vida

Controle fácil das mesas de som **Soundcraft Ui12 / Ui16 / Ui24R** pelo computador, tablet ou celular,
com a identidade visual da Comunidade Vida. Inspirado no Mixing Station, mas mais simples.

- **Visual básico** (voluntários): faders grandes com nome e ícone de cada canal, botão
  MUTADO/DESMUTADO, volume máximo por canal, retornos e cenas liberados pelo técnico.
- **Visual técnico** (com senha): faixas estilo Mixing Station com ganho, 48V, pan, mute, solo,
  todos os canais, retornos (AUX), cenas da mesa e configurações.
- **Procurar mesa**: acha a Soundcraft na rede sozinho, sem precisar saber o IP.
- **Tablet/celular**: abre pelo navegador (QR code em Ajustes), sem instalar nada.
- **Simulador**: dá pra treinar sem a mesa ligada.

## Instalar

Baixe o instalador `.exe` mais recente em [Releases](https://github.com/wesleiad/mesa-som-comvida/releases/latest).
Depois de instalado, o programa **se atualiza sozinho**: ele procura versão nova ao abrir e a cada
30 minutos, baixa em segundo plano e instala quando o programa é fechado (ou no botão "Atualizar agora").

## Desenvolvimento

```bash
npm install
npm run dev        # abre o app em modo de desenvolvimento
npm run test:ui    # teste ponta a ponta no simulador (PC, tablet e celular)
```

Cada envio para o branch `main` gera uma versão nova automaticamente pelo GitHub Actions
(`.github/workflows/release.yml`).
