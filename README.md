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

Tudo fica em [Releases](https://github.com/wesleiad/mesa-som-comvida/releases/latest):

- **Computador Windows**: baixe o `...-setup.exe` e instale. Funciona sem internet (fala direto com a
  mesa). Depois de instalado ele **se atualiza sozinho** quando tiver internet: baixa em segundo plano
  e instala quando o programa é fechado (ou no botão "Atualizar agora").
- **Celular/tablet Android**: abra a página de Releases no aparelho, baixe o `.apk` e instale (o Android
  pede pra permitir "instalar apps desta fonte"). O app funciona **sem internet e sem o computador**,
  falando direto com a mesa pelo Wi-Fi. Quando tiver internet, ele avisa se tem versão nova.
  Opcional: em Ajustes → "Computador da igreja", ele copia e sincroniza os nomes, grupos e cenas do PC.
- **iPhone/iPad**: abra no Safari o endereço que aparece em Ajustes no programa do computador
  (ex.: http://192.168.1.13:8077) e use "Adicionar à Tela de Início". Precisa do computador ligado
  na mesma rede (não precisa de internet).

## Desenvolvimento

```bash
npm install
npm run dev        # abre o app em modo de desenvolvimento
npm run test:ui    # teste ponta a ponta no simulador (PC, tablet e celular)
```

Cada envio para o branch `main` gera uma versão nova automaticamente pelo GitHub Actions
(`.github/workflows/release.yml`): instalador do Windows + `.apk` do Android assinado (chave nos segredos
do repositório; cópia de segurança fora do repositório).
