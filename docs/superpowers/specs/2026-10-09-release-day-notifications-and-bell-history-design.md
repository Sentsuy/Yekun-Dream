# Especificação Técnica: Notificações de Lançamento e Histórico do Sininho

**Data:** 2026-10-09  
**Status:** Aprovado  
**Autor:** Antigravity & Sentsuy (Sentsuy Corp)  
**Projeto:** Yekun Dream (Extensão Chrome MV3)

---

## 1. Visão Geral e Motivação

Muitos leitores e espectadores acompanham animes, mangás, manhwas e webtoons com periodicidade semanal (ex: episódios exibidos aos domingos, capítulos lançados às quartas-feiras).  
O objetivo deste recurso é manter o usuário informado no próprio dia do lançamento com dois alertas pontuais:
1. **08:00 (Manhã):** Lembrete antecipado para planejar o dia com os lançamentos esperados.
2. **17:00 (Tarde):** Chamada para ação no momento em que as scans e plataformas de streaming já costumam ter disponibilizado o conteúdo.

Além disso, adiciona-se o **Sininho de Notificações** no cabeçalho do popup, que armazena um histórico das últimas notificações recebidas, limitado estritamente a **no máximo 20 itens** para garantir desempenho instantâneo e leveza no armazenamento local.

---

## 2. Requisitos Funcionais

### 2.1. Cronograma de Lançamento (Híbrido)
* **Dias da Semana:** Um array de números inteiros de 0 a 6 (`0 = Dom, 1 = Seg, 2 = Ter, 3 = Qua, 4 = Qui, 5 = Sex, 6 = Sáb`) armazenado no objeto da obra: `work.releaseDays: number[]`.
* **Sugestão Automática via AniList:** Ao resolver uma obra no [canonical-resolver.js](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/canonical-resolver.js), se o GraphQL retornar `nextAiringEpisode.airingAt`, o dia da semana local correspondente é calculado e sugerido automaticamente.
* **Seletor Visual no Formulário:** No painel de cadastro/edição da obra no popup (e botão flutuante), um grupo de botões chips: `[Dom] [Seg] [Ter] [Qua] [Qui] [Sex] [Sáb]`. O usuário pode clicar para alternar qualquer dia.

### 2.2. Regra de Omissão para Obras Canceladas ou em Hiato (Adendo do Usuário)
* Se a obra estiver marcada com:
  - `publicationStatus === 'hiatus'` (Em hiato)
  - `publicationStatus === 'cancelled'` (Cancelada)
  - `readingStatus === 'dropado'` (Dropada pelo usuário)
  - `readingStatus === 'concluido'` (Concluída)
* **Regra estrita:** A extensão **NÃO disparará alertas nem adicionará ao histórico**, mesmo que a obra possua dias da semana configurados em `releaseDays`. Somente obras ativas em andamento (`publicationStatus: 'releasing'` ou `'upcoming'` ou indefinido) e com leitura em andamento (`readingStatus: 'lendo'` ou `'planejo'`) serão notificadas.

### 2.3. Alarmes em Segundo Plano (`background.js`)
* Configuração de alarmes diários através de `chrome.alarms`:
  - `release_alarm_morning`: Disparo diário às 08:00.
  - `release_alarm_evening`: Disparo diário às 17:00.
* Cálculo do próximo disparo: Se o horário do dia já passou, programa para o dia seguinte no horário exato.
* Permissão `"notifications"` adicionada a [manifest.json](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/manifest.json).
* Notificação Nativa do Sistema (`chrome.notifications.create`):
  - Título matinal: `☀️ Lançamentos de Hoje — Yekun Dream`
  - Mensagem matinal: Exibe o(s) título(s) das obras com lançamento hoje.
  - Título vespertino: `🌆 Disponível Agora — Yekun Dream`
  - Mensagem vespertina: Avisa que os novos lançamentos já devem estar no ar.
  - Ao clicar na notificação: abre a URL da fonte ativa da obra no navegador.

### 2.4. Histórico do Sininho (Máx 20 Itens)
* Armazenado em `chrome.storage.local` sob a chave `chapter_tracker_notifications_v1`.
* Cada item do histórico contém:
  - `id`: Identificador único (`notif_...`).
  - `workId`: ID da obra associada.
  - `workName`: Nome da obra.
  - `type`: `'morning'` ou `'evening'`.
  - `timestamp`: Milissegundos do disparo.
  - `url`: Link para abrir a obra.
  - `tag`: Categoria da obra (`anime`, `manga`, etc.).
  - `read`: Booleano indicando se o usuário já visualizou.
* **Capacidade Máxima:** Estritamente limitados a **20 itens** mais recentes (`history.slice(0, 20)`).
* Botão do Sininho no cabeçalho do popup (`#btnNotifications`):
  - Exibe um badge/ponto colorido (`.notif-unread-dot`) enquanto houver itens com `read === false`.
  - Ao abrir o painel deslizante (`#notificationsPanel`), marca os itens como lidos e remove o badge.
  - Botão no cabeçalho do painel: `Limpar tudo`.

### 2.5. Configurações Globais
* Campos adicionados a `DEFAULT_SETTINGS` em [storage-local.js](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/storage-local.js):
  - `enableReleaseNotifications: true`
  - `enableMorningNotification: true` (08:00)
  - `enableEveningNotification: true` (17:00)
* Toggles no painel de configurações da extensão para fácil controle do usuário.

---

## 3. Arquitetura e Componentes

### 3.1. Arquivos Modificados
1. `manifest.json`: Adiciona permissão `"notifications"`.
2. `storage-local.js`:
   - Campos de configurações em `DEFAULT_SETTINGS`.
   - Gerenciamento do histórico de notificações (adicionar, listar, marcar lidas, limpar, com corte em 20).
   - Suporte a `releaseDays` no `saveWorkReading` e `updateWorkDetails`.
   - Filtro `getEligibleReleasingWorks(dayOfWeek)`.
3. `canonical-resolver.js`:
   - Extrai `airingAt` do `nextAiringEpisode` do AniList para derivar o dia da semana de lançamento.
4. `background.js`:
   - Agendamento e escuta de alarmes às 08:00 e 17:00.
   - Disparo de notificações e gravação no histórico.
   - Clique na notificação abrindo a obra.
5. `popup.html`:
   - Botão do Sininho (`#btnNotifications`) com indicador de unread.
   - Painel deslizante de notificações (`#notificationsPanel`).
   - Seletor de dias da semana no formulário de edição de obra.
   - Toggles nas Configurações.
6. `popup.css`:
   - Estilização do botão de sininho, badge unread, painel de notificações e chips de dias da semana.
7. `popup.js`:
   - Abertura/fechamento do painel do sininho.
   - Renderização da lista de até 20 notificações.
   - Seleção e manipulação dos chips de dias da semana.
   - Configurações de notificações.

---

## 4. Casos de Teste e Validação
1. Suíte de testes automatizados `tests/test-release-notifications.js`:
   - Salvar e persistir `releaseDays` em obras.
   - Filtro de elegibilidade (ignorar canceladas, hiato, concluídas, dropadas).
   - Limite estrito de no máximo 20 notificações no histórico.
   - Marcação de lido e limpeza do histórico.
   - Cálculo de dia da semana via AniList GraphQL.
2. Execução da suíte completa com `tests/run-all-tests.js` (mantendo 100% de aprovação).
