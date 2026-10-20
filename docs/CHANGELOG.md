# Changelog — Yekun Dream

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [1.2.0] — 2026-10-20

### 🚀 Novas Funcionalidades & Otimizações
- **Startup Instantâneo (< 10ms) & Renderização por Lotes (*Chunked Batching*)**:
  - Consolidação de leitura atômica em 1 único IPC no `StorageLocal.getInitialData()` (redução de 6 consultas consecutivas para 1).
  - Cache de identidade em memória (`IdentityService.primeCache`) eliminando consultas redundantes de storage e rede na abertura do popup.
  - Renderização progressiva em lotes de 15 cards via `requestAnimationFrame` no `renderList()`, impedindo o congelamento da tela em coleções extensas.
  - Desacoplamento da consulta de abas ativas e fontes externas para períodos ociosos.
- **Segurança de Sessão por Dispositivo & Anti-Scraping (PostgreSQL RLS)**:
  - Tabela `device_sessions` no Supabase com tokens randômicos criptográficos (`crypto.randomUUID()`).
  - Cabeçalho obrigatório `x-sync-token` em `pushPending`, `pullRemote` e `syncSettings` validado pela função `is_authorized_sync(p_sync_key)` nas políticas RLS.
  - Rate limiting por IP na RPC `check_pro_status` (máx. 60 requisições a cada 5 min).
- **Barra de Filtros Multi-Seleção de Status (`#statusFilterBar`)**:
  - Chips interativos com seleção múltipla (`Lendo/Assistindo`, `Pausados`, `Dropados`, `Concluídos`, `Planejo`, `Todos`).
  - Filtro padrão leve exibindo somente obras ativas (`Lendo`/`Assistindo`).
- **Popover de Status com Hover de 0.5s & Posição Inteligente**:
  - Abertura suave ao pousar o mouse por 0.5s ou clicar diretamente no badge.
  - Direcionamento automático para baixo por padrão e para cima no último card ou perto do rodapé.
  - Atualização *in-place* sem reordenar a lista (`touchUpdatedAt: false`).
- **Central de Feed, Sugestões & Mapeamento de Sites In-App**:
  - Formulário com limite estrito de 300 caracteres, 3 categorias e proteção anti-spam (máx. 5 envios/hora).
  - Atalho contextual na barra de permissão do site ativo.
- **Auto-Rastreamento de Vídeos e Animes (Regra dos 70%)**:
  - Módulo `YekunVideoTracker` no content script monitorando tags `<video>`.
  - Salva automaticamente ao atingir 70% ou mais com pelo menos 120 segundos assistidos.
  - Suporte a iframes e players embutidos com comunicação cruzada de mensagens.
- **Sistema de Notificações de Lançamentos & Central de Sininho**:
  - Alarmes diários matinal (08:00) e vespertino (17:00) via `chrome.alarms` e `chrome.notifications`.
  - Guarda anti-hiato e anti-cancelamento.
  - Histórico leve no popup limitado a 20 entradas.
- **Incremento Rápido Seguro (`+1` com Guards & Comparação Semântica)**:
  - Comparadores `compareChapters` e `compareUrls` com modal confirmatório em caso de divergência.
- **Pipelines Especializados para Streaming e Animes**:
  - Extração limpa para Crunchyroll (`Temp 01 - Ep 01`) e AnimesOnline.

### 🧪 Testes & Qualidade de Código
- Expansão da suíte de testes automatizados para **66 suítes completas** (100% aprovadas), cobrindo desde RLS, device session security, performance e renderização até fluxos de TOTP 2FA e PIX.

---

## [1.1.0] — 2026-10-08

### 🚀 Novas Funcionalidades
- **Resolução Canônica com AniList e MangaDex (`canonical-resolver.js`)**: Identificação de títulos oficiais, sinônimos internacionais e IDs canônicos.
- **Catálogo Colaborativo de Aliases (`alias-crowd-service.js`)**: Consenso comunitário com validação por quórum (mínimo de 2 confirmações independentes) e prevenção de colisões 1-para-1.
- **Central de Sites Consolidada & Bottom Nav**: Nova aba inferior para visualização agregada de todos os domínios de leitura cadastrados e contagem de obras vinculadas.
- **Status de Leitura e Publicação**: Categorização por status (`Lendo`, `Concluído`, `Pausado`, `Dropado`, `Planejo`) e publicação (`Em Lançamento`, `Finalizada`, `Em Hiato`, `Cancelada`).
- **3 Temas Visuais Integrados**: Dark (Azul Neon), Light (Branco & Azul) e Pink (Sakura), com ícones dinâmicos no navegador correspondentes ao tema.

---

## [1.0.0] — 2026-10-05

### 🚀 Lançamento Inicial
- **Arquitetura Multi-Fontes (Schema v3)**: Consolidação de múltiplas fontes e scans em uma única obra, eliminando duplicatas.
- **Histórico Retrátil**: Até 50 acessos por obra com timestamp, domínio e capítulo lido.
- **Botão Flutuante In-Page (`◈`)**: Draggable e isolado via Shadow DOM para leitura em qualquer site.
- **Sincronização em Nuvem (Supabase REST)**: Backup e sincronização entre navegadores com Chave de Sincronização pessoal (Sync Key).
- **Lista de Domínios Permitidos e Bloqueados**: Nuvem de chips para controle de ativação por domínio.
- **Privacidade Local-First**: Zero telemetria, sem rastreadores, 100% offline-first.
