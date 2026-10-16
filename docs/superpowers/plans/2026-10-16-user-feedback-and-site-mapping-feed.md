# Central de Feedback e Mapeamento de Sites (Feed In-App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar canal de feedback, reporte de falhas e sugestões de novos sites diretamente no popup da extensão, com armazenamento seguro no Supabase, limites estritos de caracteres no front e back, rate-limiting anti-spam e arquitetura pronta para futura gestão via painel web.

**Architecture:** Novo script SQL no Supabase cria `feedback_reports` com tipos estritos (`VARCHAR(1000)` para mensagem, etc.), tabela de rate-limit e RPC `submit_feedback` protegida por RLS. No cliente, `feedback-service.js` valida tamanhos e anexa metadados da página ativa. A interface em `popup.html`, `popup.css` e `popup.js` adiciona formulário com contador de caracteres dinâmico nas Configurações e atalho contextual no site ativo.

**Tech Stack:** Vanilla JavaScript (ES2022), Chrome Extensions MV3 (`chrome.tabs`, `chrome.storage.local`), Supabase REST API & PostgreSQL RPC, Node.js Test Runner.

**Spec:** [docs/superpowers/specs/2026-10-16-user-feedback-and-site-mapping-feed-design.md](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/docs/superpowers/specs/2026-10-16-user-feedback-and-site-mapping-feed-design.md)

## Global Constraints

- Limite estrito de mensagem: mínimo 5 caracteres, máximo 300 caracteres no frontend (`maxlength="300"`) e no backend (`VARCHAR(300)` e validação RPC).
- Limites estritos em campos secundários: URL máx 300, título máx 200, capítulo máx 50, e-mail máx 150, navegador máx 150.
- Categorias permitidas: exatamente `'site_mapping'`, `'bug_report'`, `'suggestion'`.
- Rate limiting no backend: máximo de 5 envios por hora por identificador/e-mail.
- Segurança de dados: tabela `feedback_reports` com RLS ativado e sem permissão de SELECT para o role `anon` (dados privados para o desenvolvedor).
- Todas as 56 suítes de testes automatizados existentes devem continuar passando 100% verdes.

## Review Focus

- Tentativa de envio com texto vazio ou menor que 5 caracteres: bloqueio no frontend com aviso visual e rejeição segura na RPC.
- Tentativa de envio de mensagem inflada (> 300 caracteres) via console/API: rejeição explícita na RPC com mensagem amigável sem estourar o banco.
- Usuário tentando floodar múltiplos envios repetidos: ativação do rate limit na 6ª tentativa dentro de 1 hora.
- Contexto de página ativa desativado pelo usuário: desmarcar o checkbox remove os metadados da URL e da obra sem quebrar o envio.
- Falha de conexão com a nuvem: feedback visual de erro sem travar a interface da extensão.

---

### Task 1: Script SQL do Supabase (`scripts/supabase-feedback-setup.sql`)

**Files:**
- Create: `scripts/supabase-feedback-setup.sql`
- Create: `tests/test-supabase-feedback-sql.js`

**Interfaces:**
- Produces: Esquema relacional no Supabase com tabelas `feedback_reports`, `feedback_rate_limits`, função RPC `submit_feedback` e políticas RLS.

- [ ] **Step 1: Escrever teste de validação do arquivo SQL**

Crie `tests/test-supabase-feedback-sql.js` verificando:
- Existência do arquivo `scripts/supabase-feedback-setup.sql`.
- Declaração de `CREATE TABLE IF NOT EXISTS feedback_reports` com colunas `VARCHAR(1000)` para mensagem, `category CHECK (...)`, `status DEFAULT 'pending'`.
- Declaração de `CREATE TABLE IF NOT EXISTS feedback_rate_limits`.
- Declaração de `CREATE OR REPLACE FUNCTION submit_feedback` com `SECURITY DEFINER`.
- Verificação de limites de tamanho (`length(...) < 5`, `length(...) > 1000`).
- Trava de rate-limit (máx 5 por hora).
- Concessão de execução de `submit_feedback` para `anon` e RLS ativado.

- [ ] **Step 2: Executar teste para verificar que falha**

Run: `node tests/test-supabase-feedback-sql.js`  
Expected: FAIL com arquivo não encontrado.

- [ ] **Step 3: Criar `scripts/supabase-feedback-setup.sql`**

Criar o arquivo SQL contendo as DDLs e a RPC `submit_feedback` exatamente conforme especificado na seção 3 do documento de spec.

- [ ] **Step 4: Executar teste para verificar que passa**

Run: `node tests/test-supabase-feedback-sql.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/supabase-feedback-setup.sql tests/test-supabase-feedback-sql.js
git commit -m "feat(feedback): criar script SQL de feedback e sugestao de sites com limites de tamanho"
```

---

### Task 2: Serviço de Feedback (`feedback-service.js`)

**Files:**
- Create: `feedback-service.js`
- Create: `tests/test-feedback-service.js`
- Modify: `manifest.json:41` (se necessário incluir em content scripts ou popup)

**Interfaces:**
- Produces: `FeedbackService`:
  - `validatePayload(payload: { category, message, siteUrl, ... }): { valid: boolean, error?: string }`
  - `submitFeedback(config: { supabaseUrl, supabaseKey }, data: Object): Promise<{ success: boolean, message: string, error?: string }>`
  - `getBrowserInfo(): string`

- [ ] **Step 1: Escrever teste de unidade para `FeedbackService`**

Crie `tests/test-feedback-service.js` testando:
- Rejeição de mensagem com menos de 5 caracteres.
- Rejeição ou truncamento de mensagem com mais de 1.000 caracteres.
- Rejeição de categoria inválida.
- Sanitização de URLs e e-mails.
- Chamada da RPC `submit_feedback` mockando `fetch`.
- Compatibilidade com escopo do Service Worker / Node.js.

- [ ] **Step 2: Executar teste para verificar que falha**

Run: `node tests/test-feedback-service.js`  
Expected: FAIL com `FeedbackService is not defined`.

- [ ] **Step 3: Implementar `feedback-service.js`**

Implementar `FeedbackService` com validações no cliente, helpers de extração de metadados do navegador e chamada à RPC do Supabase.

- [ ] **Step 4: Executar teste para verificar que passa**

Run: `node tests/test-feedback-service.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add feedback-service.js tests/test-feedback-service.js
git commit -m "feat(feedback): implementar FeedbackService com validacao de limites e envio ao Supabase"
```

---

### Task 3: Interface no Popup (`popup.html`, `popup.css`, `popup.js`)

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`
- Modify: `popup.js`
- Create: `tests/test-popup-feedback-ui.js`

**Interfaces:**
- Produces:
  - Seção "💡 Feedback & Sugestões" no drawer de Configurações do popup com seletor de 3 categorias, textarea com contador `0 / 1000`, badge da página ativa com checkbox de inclusão, e-mail de contato e botão de envio.
  - Atalho contextual discreto 💬 "Reportar problema" na barra superior do site ativo.
  - Handlers de evento em `popup.js` para contagem dinâmica de caracteres, alternância de placeholders contextuais e submissão via `FeedbackService`.

- [ ] **Step 1: Escrever teste de verificação da UI de Feedback**

Crie `tests/test-popup-feedback-ui.js` verificando:
- Presença dos elementos no HTML: `#feedbackCategorySelect`, `#feedbackMessage`, `#feedbackCharCounter`, `#feedbackIncludeSiteToggle`, `#feedbackEmail`, `#btnSubmitFeedback`.
- Presença de `maxlength="1000"` no textarea.
- Presença do atalho contextual `#btnQuickReportSite`.
- Presença das classes de estilo no CSS.
- Presença dos handlers de eventos no `popup.js`.

- [ ] **Step 2: Executar teste para verificar que falha**

Run: `node tests/test-popup-feedback-ui.js`  
Expected: FAIL com elementos ausentes.

- [ ] **Step 3: Modificar `popup.html`**

Adicionar a seção de Feedback dentro das Configurações e o atalho contextual na barra de status do site ativo.

- [ ] **Step 4: Modificar `popup.css`**

Estilizar o formulário de feedback acompanhando os temas Cyber Dark, Light e Pink (seletores de categorias estilo pilula, contador de caracteres responsivo, card contextual discreto).

- [ ] **Step 5: Modificar `popup.js`**

Implementar:
- Importação/uso de `FeedbackService`.
- Atualização em tempo real do contador de caracteres (`${len} / 1000`).
- Pré-preenchimento automático da URL e do título da aba ativa ao abrir o popup.
- Lógica de clique do botão "Enviar Feedback", com feedback de progresso e toast de confirmação.

- [ ] **Step 6: Executar teste para verificar que passa**

Run: `node tests/test-popup-feedback-ui.js`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add popup.html popup.css popup.js tests/test-popup-feedback-ui.js
git commit -m "feat(ui): adicionar formulario de feedback com contador de caracteres e atalho contextual"
```

---

### Task 4: Atualização da Suíte Principal & Verificação

**Files:**
- Modify: `tests/run-all-tests.js`
- Modify: `docs/STATUS_RETOMADA.md`

- [ ] **Step 1: Adicionar novos testes ao `run-all-tests.js`**

Registrar os 3 novos testes:
- `Supabase Feedback SQL syntax`
- `Feedback Service & Text Limits`
- `Popup Feedback UI & Shortcuts`

- [ ] **Step 2: Executar suíte completa**

Run: `npm test`  
Expected: PASS em 100% dos testes (59/59 suítes verdes).

- [ ] **Step 3: Atualizar documentação de retomada**

Documentar a adição do subsistema de feedback no `docs/STATUS_RETOMADA.md`.

- [ ] **Step 4: Commit**

```bash
git add tests/run-all-tests.js docs/STATUS_RETOMADA.md
git commit -m "docs: consolidar suite de testes de feedback no orquestrador de testes"
```
