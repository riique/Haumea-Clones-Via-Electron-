# Haumea Clones

Aplicativo desktop para clonagem e sincronização de canais, grupos e fóruns do Telegram, com interface em Electron/React e backend Python via Telethon.

## Visão Geral

O Haumea Clones foi pensado para operação real, não só para testes. O app reúne:

- clonagem de canal para canal ou grupo
- retomada por checkpoint
- análise prévia antes de iniciar
- sync contínua para novas mensagens
- clone de múltiplos grupos para tópicos
- clone completo de fóruns
- bypass automático para conteúdo protegido
- proteção local com frequência e pausas aleatórias
- deduplicação persistente entre execuções
- monitoramento de histórico, erros e throughput

## Stack

- Electron 35
- React 19 + Vite 6
- Python + Telethon
- JSON-RPC 2.0 via stdin/stdout
- electron-store para credenciais locais
- PyInstaller para empacotar o backend
- electron-builder para gerar o `.exe`

## Arquitetura

```text
Electron (main/preload)
    -> bridge Node.js
    -> processo Python
    -> Telethon / Telegram API

Renderer React
    -> IPC segura
    -> JSON-RPC
    -> logs, progresso, sessão e telemetria
```

## Módulos do App

### Configuração

- credenciais da API do Telegram
- sessão local persistida
- limpeza de sessão
- proteção local
- deduplicação

### Clonar Canal

- clone principal entre origem e destino
- retomada de progresso salvo
- análise prévia
- sync contínua

### Clone Tópicos

- envia múltiplos grupos para um fórum de destino
- cria os tópicos automaticamente

### Clone Fórum

- replica tópicos e mensagens de um fórum para outro

### Monitoramento

- execuções recentes
- job atual
- erros consolidados
- métricas operacionais

## Persistência Local

O app mantém estado local para evitar retrabalho e melhorar estabilidade:

- credenciais e sessão via `electron-store`
- checkpoints em `progress/`
- histórico e erros em `history/`
- deduplicação e config persistente em `state/`

## Estrutura do Projeto

```text
backend/
  server.py              Backend JSON-RPC e lógica Telethon
electron/
  main.cjs               Processo principal do Electron
  preload.cjs            Bridge segura para o renderer
  python-bridge.cjs      Spawn e comunicação com o backend
src/
  components/            Componentes visuais
  hooks/                 useTelegram
  lib/                   Utilitários do renderer
  pages/                 Telas principais do app
dist-python/             Backend compilado
release/                 Artefatos de build Windows
```

## Requisitos

- Node.js 18+
- Python 3.9+
- Windows para gerar o instalador `.exe`

## Desenvolvimento

Instale as dependências:

```bash
npm install
pip install -r requirements.txt
```

Rode em desenvolvimento:

```bash
npm run dev
```

## Build

Para gerar só o renderer:

```bash
npm run build:renderer
```

Para gerar o backend compilado:

```bash
npm run build:python
```

Para gerar o pacote Windows completo com backend embutido:

```bash
npm run build
```

Saídas esperadas:

- `dist-python/haumea-backend.exe`
- `release/Haumea Clones Setup 2.0.0.exe`
- `release/win-unpacked/Haumea Clones.exe`

## Segurança

- `contextIsolation` ativo
- `nodeIntegration` desativado
- comunicação renderer/backend mediada por preload
- sessão e credenciais mantidas localmente

## Observações

- o app depende de credenciais válidas da API do Telegram
- o ritmo de envio deve respeitar limites da conta e do Telegram
- a proteção local ajuda, mas não elimina FloodWait

## Licença

MIT
