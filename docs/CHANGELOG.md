# Changelog — Yekun Dream

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [1.2.0] — 2026-10-13

### 🚀 Novas Funcionalidades
- **Auto-Rastreamento de Vídeos e Animes (Regra dos 70%)**:
  - Implementado o módulo `YekunVideoTracker` no content script, que monitora a reprodução de tags `<video>`.
  - Salva automaticamente o episódio quando o usuário assiste a 70% ou mais da duração total (com requisito de tempo assistido de no mínimo 120 segundos para evitar falsos positivos decorrentes de saltos na barra de progresso).
  - Suporte completo a players embutidos e iframes de terceiros via `all_frames: true` e `match_about_blank: true`, com comunicação cruzada de mensagens entre frames.
  - Feedback visual sutil através de Toast in-page ("Episódio salvo").
  - Nova opção de configuração no painel do popup: `autoTrackAnime` (habilitado por padrão).
- **Sistema de Notificações de Lançamentos & Central de Sininho**:
  - Implementados dois alarmes diários em segundo plano via `chrome.alarms` e `chrome.notifications`:
    - Alerta matinal às **08:00** (`alarm_release_morning_0800`).
    - Alerta vespertino às **17:00** (`alarm_release_evening_1700`).
  - **Filtro Estrito Anti-Hiato e Anti-Cancelamento**: Obras com status de publicação em hiato (`hiato`) ou cancelada (`cancelado`), ou status de leitura concluída (`concluido`) ou dropada (`dropado`) nunca geram notificações, mesmo com dias marcados.
  - **Agendamento Híbrido (Opção 3)**:
    - Seletor semanal manual com botões interativos `[Dom] [Seg] [Ter] [Qua] [Qui] [Sex] [Sáb]` no formulário da obra.
    - Inferência automática do dia de lançamento a partir do cronograma da API GraphQL do AniList (`nextAiringEpisode.airingAt`).
    - Badges de dias de lançamento nos cards das obras (`📅 Seg, Qui`).
  - **Sininho de Notificações no Popup (`#btnNotifications`)**:
    - Indicador de novas notificações não lidas (`#notifUnreadDot`).
    - Gaveta deslizante com histórico de lançamentos recentes, data, hora e link direto de abertura.
    - Limite estrito de no máximo **20 itens** no armazenamento local, garantindo leveza e zero impacto no consumo de memória.
    - Botão "Limpar" para esvaziar o histórico.
  - Configurações globais independentes para alertas gerais, matinais e vespertinos.
- **Incremento Rápido Seguro (`+1` com Guards & Comparação Semântica)**:
  - Verificação inteligente de capítulo/episódio antes de avançar pelo botão `(+)`:
    - Compara o progresso salvo com a página da aba ativa via `StorageLocal.compareChapters` e `StorageLocal.compareUrls`.
    - Se o capítulo da aba for maior, atualiza diretamente.
    - Se o capítulo for igual, menor ou se a aba pertencer a outra obra, exibe um modal defensivo de confirmação (`showConfirmActionModal`) para evitar avanços ou sobrescritas acidentais.
- **Pipelines Especializados para Streaming e Animes**:
  - **Crunchyroll**: Extração precisa do nome principal da série mesmo em páginas com nomes de episódios específicos, e formatação padronizada e legível `Temp 01 - Ep 01` (substituindo identificadores técnicos brutos como `s01e01`).
  - **AnimesOnline (animesonlinecc.to)**: Tratamento de rotas de episódios, títulos duplos e extração robusta.
  - Separação de escopos para impedir que regexes de mangás colidam com convenções de animes/séries.

### 🎨 Melhorias de UI, UX & Conforto Visual
- **Temas Anti-Brilho (Glare-Free) e Tipografia Otimizada**: Ajustes finos nos temas Dark, Light e Pink para conforto em sessões de leitura noturna ou prolongada.
- **Gavetas em Altura Total (Full-Height Drawers)**: Layout e rolagem aprimorados para formulários e painéis de configuração, garantindo visibilidade de botões inferiores e campos adicionais.
- **Sincronização Instantânea Cross-Tab**: Alterações de permissões e configurações refletem imediatamente em todas as abas abertas sem necessidade de recarregamento.
- **Segurança de Runtime & Re-injeção**: Tratamento para contextos invalidados de extensão e re-injeção segura de scripts quando o popup interage com abas abertas antes da instalação/atualização.

### 🧪 Testes & Qualidade de Código
- Expansão da suíte de testes automatizados de **35 para 46 suítes**, cobrindo 100% dos novos módulos:
  - Video tracker e progressão aos 70%.
  - Histórico de notificações, alarmes e guarda anti-hiato.
  - Comparadores de capítulos e confirmação de incremento.
  - Extração de Crunchyroll e AnimesOnline.
  - Visibilidade de drawers e temas anti-brilho.
  - Segurança de contexto de extensão e re-injeção.

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
