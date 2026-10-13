# Anime Auto-Tracker (70% Video Progress) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar detecção automática de reprodução e avanço de animes quando o vídeo atingir 70% de progresso com tolerância a pulo de abertura e suporte a players em iframes.

**Architecture:** Módulo de rastreamento de vídeo injetado via content scripts em todos os quadros (`all_frames: true`), que calcula o progresso relativo e o tempo real assistido (`playedSeconds >= 120s`) com *throttling* de 2 segundos. Ao cruzar o limiar de 70%, despacha mensagem para o quadro principal salvar a obra via `StorageLocal.saveWorkReading` com trava única de sessão e exibir um Toast de confirmação.

**Tech Stack:** JavaScript (ES6+), Chrome Extensions API (Manifest V3, `all_frames`, Storage API, messaging), HTML5 Media API (`HTMLMediaElement`).

**Spec:** `docs/superpowers/specs/2026-10-12-anime-auto-tracker-video-progress-design.md`

## Global Constraints

- Compatível com Manifest V3 do Chrome.
- Preservar integridade de todas as suites de testes existentes (45/45 passando).
- Throttling mandatório no evento `timeupdate` (intervalo mínimo de 2000ms) para consumo de CPU < 0.1%.
- Vídeos com duração total inferior a 60 segundos (`duration < 60`) devem ser ignorados (filtro anti-anúncio).
- Idempotência estrita: cada episódio deve ser salvo no máximo uma única vez por sessão.

## Review Focus

1. **Avanço manual (Seek) direto para > 70%**: Não deve computar se `playedSeconds < 120`.
2. **Pulo de abertura (Seek de 0:00 para 2:00)**: Deve computar normalmente quando cruzar 70% após assistir o episódio.
3. **Players em iframes de outros domínios**: Comunicação via `window.parent.postMessage` / `chrome.runtime` deve alcançar o top frame.
4. **Troca dinâmica de episódio (Autoplay / SPA)**: Novo vídeo ou alteração de `src` deve resetar os contadores de progresso.
5. **Configuração desativada**: Quando `autoTrackAnime === false`, nenhum salvamento automático deve ser disparado.

---

### Task 1: Configuração Global no Storage Local

**Files:**
- Modify: `storage-local.js:20-50`
- Test: `tests/test-storage-v3.js`

**Interfaces:**
- Consumes: `DEFAULT_SETTINGS` em `storage-local.js`
- Produces: `settings.autoTrackAnime: boolean` (padrão: `true`)

- [ ] **Step 1: Escrever teste para a configuração `autoTrackAnime`**
Adicionar verificação em `tests/test-storage-v3.js` validando que `StorageLocal.getSettings()` retorna `autoTrackAnime: true` por padrão e permite atualização para `false`.

- [ ] **Step 2: Executar teste para verificar falha inicial**
Run: `node tests/test-storage-v3.js`
Expected: FAIL com assertion sobre `autoTrackAnime`

- [ ] **Step 3: Implementar `autoTrackAnime: true` em `storage-local.js`**
Adicionar `autoTrackAnime: true` no objeto `DEFAULT_SETTINGS` em `storage-local.js`.

- [ ] **Step 4: Executar teste para verificar aprovação**
Run: `node tests/test-storage-v3.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add storage-local.js tests/test-storage-v3.js
git commit -m "feat: adicionar configuracao autoTrackAnime no storage local"
```

---

### Task 2: Toggle no Painel de Configurações do Popup

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`
- Test: `tests/verify-popup-features.js`

**Interfaces:**
- Consumes: `StorageLocal.getSettings()`, `StorageLocal.saveSettings()`
- Produces: Elemento checkbox `#cfgAutoTrackAnime` sincronizado com o storage

- [ ] **Step 1: Escrever teste de interface para `#cfgAutoTrackAnime`**
Adicionar verificação em `tests/verify-popup-features.js` checando a presença do toggle `#cfgAutoTrackAnime` no HTML e sua sincronização no `popup.js`.

- [ ] **Step 2: Executar teste para verificar falha**
Run: `node tests/verify-popup-features.js`
Expected: FAIL indicando elemento ausente

- [ ] **Step 3: Implementar elemento e binding no popup**
- Em `popup.html`: adicionar toggle switch "Auto-marcar animes ao assistir 70%" no grupo de preferências.
- Em `popup.js`: vincular checkbox `#cfgAutoTrackAnime` ao carregar e salvar configurações.

- [ ] **Step 4: Executar teste para verificar aprovação**
Run: `node tests/verify-popup-features.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add popup.html popup.js tests/verify-popup-features.js
git commit -m "feat: adicionar controle visual de autoTrackAnime nas configuracoes do popup"
```

---

### Task 3: Motor de Rastreamento de Vídeo (Video Tracker)

**Files:**
- Create: `tests/test-anime-video-tracker.js`
- Modify: `content.js`

**Interfaces:**
- Consumes: `HTMLMediaElement` (`play`, `pause`, `timeupdate`, `ended`)
- Produces: Função `initVideoTracker({ onProgressComplete, isEnabled })`
- Regras: `ratio >= 0.70`, `playedSeconds >= 120s`, `duration >= 60s`, throttle de 2000ms.

- [ ] **Step 1: Escrever teste unitário completo em `tests/test-anime-video-tracker.js`**
Cobrir cenários:
1. Pulo de abertura (0:00 -> 2:00) seguido de reprodução até 70% com `playedSeconds >= 120` dispara evento.
2. Salto acidental (Seek direto para 80%) com `playedSeconds < 120` NÃO dispara.
3. Vídeo com menos de 60 segundos ignorado (anti-anúncio).
4. Throttle de 2 segundos respeitado.
5. Evento `ended` com mais de 60s tocados dispara como fallback.

- [ ] **Step 2: Executar teste para verificar falha inicial**
Run: `node tests/test-anime-video-tracker.js`
Expected: FAIL (módulo ou lógica ainda não integrada)

- [ ] **Step 3: Implementar lógica do Video Tracker em `content.js`**
Implementar o monitoramento de `<video>`:
- MutationObserver leve para encontrar o player.
- Contadores de `playedSeconds` incrementados apenas quando `!video.paused`.
- Throttle de 2000ms na checagem dos 70%.
- Reset de estado quando o `src` do vídeo mudar (novo episódio).

- [ ] **Step 4: Executar teste para verificar aprovação**
Run: `node tests/test-anime-video-tracker.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add content.js tests/test-anime-video-tracker.js
git commit -m "feat: implementar motor de rastreamento de video e progresso 70%"
```

---

### Task 4: Suporte a Iframes Cross-Origin e Salvamento no Top Frame

**Files:**
- Modify: `manifest.json`
- Modify: `content.js`
- Modify: `tests/test-anime-video-tracker.js`

**Interfaces:**
- Consumes: `window.postMessage`, `window.addEventListener('message')`, `StorageLocal.saveWorkReading`
- Produces: Trava de sessão `autoSavedInSession: Set<string>`, disparo automático de save e exibição de Toast.

- [ ] **Step 1: Adicionar teste de comunicação entre frames e disparo do Toast**
Adicionar teste simulando mensagem de frame filho para frame pai acionando `saveWorkReading` e exibindo mensagem `"✓ Progresso atualizado — Ep. [X] (70%)"`.

- [ ] **Step 2: Executar teste para verificar falha**
Run: `node tests/test-anime-video-tracker.js`
Expected: FAIL

- [ ] **Step 3: Configurar `manifest.json` e integração no `content.js`**
- Em `manifest.json`: adicionar `"all_frames": true` na entrada de content_scripts.
- Em `content.js`:
  - Se for iframe: executa Video Tracker e envia `window.parent.postMessage({ type: 'YEKUN_VIDEO_PROGRESS_COMPLETED' }, '*')`.
  - Se for top frame: escuta `message`, valida origem/formato, verifica se a obra/episódio já foi salva nesta sessão, chama `btnSave.click()` ou rotina direta de salvamento, atualiza badge e exibe o Toast.

- [ ] **Step 4: Executar teste para verificar aprovação**
Run: `node tests/test-anime-video-tracker.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add manifest.json content.js tests/test-anime-video-tracker.js
git commit -m "feat: habilitar all_frames e comunicacao entre frames com auto-save e toast"
```

---

### Task 5: Integração no Test Runner Geral & Verificação de Regressão

**Files:**
- Modify: `tests/run-all-tests.js`

- [ ] **Step 1: Registrar `test-anime-video-tracker.js` no `run-all-tests.js`**
- [ ] **Step 2: Executar a suite completa de testes**
Run: `node tests/run-all-tests.js`
Expected: Todas as suites passando (46/46), sem nenhuma regressão.
- [ ] **Step 3: Commit**
```bash
git add tests/run-all-tests.js
git commit -m "test: integrar test-anime-video-tracker ao runner geral"
```
