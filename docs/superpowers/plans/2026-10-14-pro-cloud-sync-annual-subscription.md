# Yekun Cloud PRO (Assinatura Anual R$ 20 & PIN 4 Dígitos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a Sincronização em Nuvem (Cloud Sync) em um recurso exclusivo Yekun Cloud PRO (R$ 20,00/ano) com detecção automática de conta Google, fallback por e-mail manual, ativação instantânea por PIN de 4 dígitos e proteção no Supabase.

**Architecture:** O novo módulo `identity-service.js` gerencia a identidade da conta Google via `chrome.identity` ou e-mail customizado. `StorageLocal` armazena as configurações e o cache de licença (TTL de 6h). `sync-service.js` bloqueia requisições em nuvem se o usuário não for PRO ativo. No Supabase, tabelas `subscriptions` e `activation_pins` são gerenciadas com RLS e uma função RPC segura `redeem_activation_pin`. A interface do popup ganha um card PRO, campo de PIN de 4 dígitos e modal de Pix.

**Tech Stack:** Vanilla JavaScript (ES2022), Chrome Extensions MV3 (`chrome.identity`, `chrome.storage.local`), Supabase REST API & RPC, Node.js Test Runner.

**Spec:** [2026-10-14-pro-cloud-sync-annual-subscription-design.md](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/docs/superpowers/specs/2026-10-14-pro-cloud-sync-annual-subscription-design.md)

## Global Constraints

- Preço fixo anual: R$ 20,00 por ano (validade de 365 dias = 31.536.000.000 ms).
- Permissão `"identity"` deve ser adicionada a `manifest.json`.
- Apenas PINs numéricos de exatamente 4 dígitos são aceitos.
- E-mails devem ser estritamente normalizados em minúsculas e sem espaços (`trim().toLowerCase()`).
- O armazenamento local e funcionalidades offline (auto-save a 70%, histórico, filtros, export JSON) devem permanecer 100% livres para usuários gratuitos.
- Todas as suítes de testes automatizados devem permanecer verdes.

## Review Focus

- Usuário sem conta Google sincronizada no Chrome ou usando Brave/Edge: fallback para `customProEmail` sem travar a extensão.
- PIN de 4 dígitos com espaços ou letras: sanitização e validação rejeitando caracteres não numéricos.
- Expiração da assinatura: transição suave para o estado FREE com mensagem orientando renovação.
- Falha de conexão de rede ao consultar status: uso do último cache válido sem rebaixar o usuário a FREE inadvertidamente.
- Tentativa de sincronização em nuvem sem assinatura ativa: bloqueio amigável com toast explicativo.

---

### Task 1: Script SQL do Supabase (`subscriptions`, `activation_pins` e RPC)

**Files:**
- Create: `scripts/supabase-pro-setup.sql`
- Test: `tests/test-supabase-pro-sql-syntax.js`

**Interfaces:**
- Produces: Esquema SQL completo do Supabase com tabelas `subscriptions`, `activation_pins`, políticas RLS e a função segura `redeem_activation_pin(p_pin, p_email)`.

- [ ] **Step 1: Escrever teste de validação do arquivo SQL**

Crie `tests/test-supabase-pro-sql-syntax.js` verificando que o arquivo SQL existe e contém as declarações essenciais (`CREATE TABLE IF NOT EXISTS subscriptions`, `CREATE TABLE IF NOT EXISTS activation_pins`, `CREATE OR REPLACE FUNCTION redeem_activation_pin`, `ENABLE ROW LEVEL SECURITY`).

- [ ] **Step 2: Executar teste para verificar que falha**

Run: `node tests/test-supabase-pro-sql-syntax.js`  
Expected: FAIL com arquivo não encontrado.

- [ ] **Step 3: Criar `scripts/supabase-pro-setup.sql`**

Criar o arquivo com os comandos DDL completos copiados da especificação de design:
1. `CREATE TABLE IF NOT EXISTS subscriptions` com campos `id`, `email`, `google_id`, `plan`, `status`, `amount_paid`, `valid_until`, `created_at`, `updated_at`.
2. `CREATE TABLE IF NOT EXISTS activation_pins` com campos `id`, `pin`, `is_redeemed`, `redeemed_by_email`, `redeemed_at`, `valid_duration_days`, `created_at`.
3. Função `redeem_activation_pin(p_pin TEXT, p_email TEXT)` com `SECURITY DEFINER`.
4. Políticas RLS para `subscriptions`, `activation_pins` e `entries`.

- [ ] **Step 4: Executar teste para verificar que passa**

Run: `node tests/test-supabase-pro-sql-syntax.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/supabase-pro-setup.sql tests/test-supabase-pro-sql-syntax.js
git commit -m "feat(pro): criar script SQL de assinaturas e ativacao por PIN para Supabase"
```

---

### Task 2: Serviço de Identidade e Assinatura (`identity-service.js`)

**Files:**
- Create: `identity-service.js`
- Modify: `manifest.json:10-25`
- Test: `tests/test-identity-service.js`

**Interfaces:**
- Consumes: `chrome.identity.getProfileUserInfo`, `StorageLocal.getSettings()`.
- Produces: `IdentityService`:
  - `normalizeEmail(email: string): string`
  - `getIdentityInfo(): Promise<{ email: string, source: 'google' | 'custom' | 'none' }>`
  - `checkProStatus(config: { supabaseUrl, supabaseKey }, forceRefresh?: boolean): Promise<{ isPro: boolean, email: string, daysLeft: number, validUntil: number, plan: string, cached: boolean }>`
  - `redeemPin(config: { supabaseUrl, supabaseKey }, pin: string, email: string): Promise<{ success: boolean, message: string, validUntil?: number }>`

- [ ] **Step 1: Escrever teste de unidade para `IdentityService`**

Crie `tests/test-identity-service.js` mockando `chrome.identity`, `chrome.storage.local` e `fetch` para testar:
- Normalização de e-mails (`" Fulano@GMAIL.com "` -> `"fulano@gmail.com"`).
- Detecção de e-mail via `chrome.identity`.
- Fallback para e-mail customizado.
- Validação de PIN de 4 dígitos inválido (< 4 ou > 4 dígitos).
- Chamada da RPC `redeem_activation_pin` com retorno de sucesso.
- Cálculo de dias restantes até `valid_until`.

- [ ] **Step 2: Executar teste para verificar que falha**

Run: `node tests/test-identity-service.js`  
Expected: FAIL com `IdentityService is not defined`.

- [ ] **Step 3: Atualizar `manifest.json` com a permissão `"identity"`**

Adicionar `"identity"` no array `permissions` de `manifest.json`.

- [ ] **Step 4: Implementar `identity-service.js`**

Implementar `IdentityService` com suporte a execução no browser e em ambiente Node.js (`module.exports`).

- [ ] **Step 5: Executar teste para verificar que passa**

Run: `node tests/test-identity-service.js`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add manifest.json identity-service.js tests/test-identity-service.js
git commit -m "feat(pro): implementar identity-service com deteccao Google e resgate de PIN"
```

---

### Task 3: Integração no Storage e Guarda no `sync-service.js`

**Files:**
- Modify: `storage-local.js:58-75,666-680`
- Modify: `sync-service.js:10-30,170-192`
- Test: `tests/test-pro-cloud-sync.js`

**Interfaces:**
- Consumes: `IdentityService.getIdentityInfo()`, `IdentityService.checkProStatus()`.
- Produces:
  - `StorageLocal`: campos `customProEmail: ''`, `proSubscriptionCache: null`.
  - `SyncService.pushPending()` e `SyncService.pullRemote()`: validam `isPro === true` antes de disparar requisições. Se `!isPro`, abortam com `{ ok: false, error: 'Recurso exclusivo Yekun PRO...', isProRequired: true }`.
  - `SyncService`: usa o e-mail do usuário PRO como `sync_key` padrão.

- [ ] **Step 1: Escrever teste de integração para o guarda do SyncService**

Crie `tests/test-pro-cloud-sync.js` testando que:
- Tentativa de sync com usuário Free é bloqueada e retorna erro sem tocar na API de dados.
- Tentativa de sync com usuário PRO ativo prossegue normalmente com `sync_key` igual ao e-mail.
- Usuário com cache PRO expirado é impedido de sincronizar até renovar.

- [ ] **Step 2: Executar teste para verificar que falha**

Run: `node tests/test-pro-cloud-sync.js`  
Expected: FAIL pois `sync-service.js` ainda não checa o status PRO.

- [ ] **Step 3: Atualizar `storage-local.js`**

Adicionar `customProEmail: ''` e `proSubscriptionCache: null` em `DEFAULT_SETTINGS` e garantir persistência.

- [ ] **Step 4: Atualizar `sync-service.js` com a guarda PRO**

Integrar checagem de `IdentityService.checkProStatus` em `getClientConfig` e `syncAll`. Se não for PRO, retornar `{ ok: false, error: 'A sincronização em nuvem é um recurso do Yekun Cloud PRO. Ative sua assinatura anual por R$ 20/ano.', isProRequired: true }`.

- [ ] **Step 5: Executar teste para verificar que passa**

Run: `node tests/test-pro-cloud-sync.js`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add storage-local.js sync-service.js tests/test-pro-cloud-sync.js
git commit -m "feat(pro): integrar guarda PRO e sincronizacao vinculada ao email no sync-service"
```

---

### Task 4: Interface do Usuário no Popup (Card PRO, PIN de 4 Dígitos & Modal Pix)

**Files:**
- Modify: `popup.html:315-340`
- Modify: `popup.css` (estilos para o card PRO, input do PIN de 4 dígitos, badge e modal)
- Modify: `popup.js:840-880,1716-1736`
- Test: `tests/test-popup-pro-ui.js`

**Interfaces:**
- Consumes: `IdentityService.getIdentityInfo()`, `IdentityService.checkProStatus()`, `IdentityService.redeemPin()`.
- Produces: Elementos no popup:
  - Card `#proStatusCard` com estado FREE (cadeado, botão de assinar, input de PIN de 4 dígitos `#inputProPin`, botão `#btnRedeemPin`) ou PRO (badge `⭐ PRO ATIVO`, dias restantes, e-mail).
  - Modal `#modalProPix` com QR Code Pix, instruções de pagamento e campo de ativação.
  - Bloqueio visual nos botões de sync quando FREE.

- [ ] **Step 1: Escrever teste de asserção visual/DOM para o popup**

Crie `tests/test-popup-pro-ui.js` validando que:
- O arquivo `popup.html` possui a marcação do card PRO, input de PIN de 4 dígitos e modal de assinatura.
- O arquivo `popup.css` possui estilos para o badge PRO e os campos de ativação.
- O arquivo `popup.js` possui listeners para resgate de PIN e abertura do modal Pix.

- [ ] **Step 2: Executar teste para verificar que falha**

Run: `node tests/test-popup-pro-ui.js`  
Expected: FAIL por ausência dos elementos no HTML/JS.

- [ ] **Step 3: Atualizar `popup.html`**

Adicionar na gaveta de configurações a seção estilizada do **Yekun Cloud PRO**, campos de PIN de 4 dígitos e o modal de assinatura Pix. Incluir a tag `<script src="identity-service.js"></script>` antes de `popup.js`.

- [ ] **Step 4: Atualizar `popup.css`**

Adicionar estilos modernos para:
- `.pro-badge-active` (verde com gradiente sutil e brilho dourado).
- `.pro-pin-box` (input numérico centralizado de 4 dígitos com espaçamento de caracteres).
- `.pro-upgrade-card` (borda dourada translúcida, ícone de diamante/estrela).

- [ ] **Step 5: Atualizar `popup.js`**

Implementar a inicialização do status PRO, evento do botão `#btnRedeemPin` chamando `IdentityService.redeemPin()`, atualização reativa da UI e abertura do modal Pix.

- [ ] **Step 6: Executar teste para verificar que passa**

Run: `node tests/test-popup-pro-ui.js`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add popup.html popup.css popup.js tests/test-popup-pro-ui.js
git commit -m "feat(pro): adicionar card PRO, input de PIN 4 digitos e modal Pix no popup"
```

---

### Task 5: Integração no Runner Geral e Verificação de Regressão

**Files:**
- Modify: `tests/run-all-tests.js:40-55`
- Test: Todos os 46+ testes existentes

- [ ] **Step 1: Adicionar os novos testes ao runner `tests/run-all-tests.js`**

Incluir:
- `Syntax check: identity-service.js`
- `Supabase PRO SQL syntax & RPC check`
- `Identity Service & PIN validation tests`
- `PRO Cloud Sync Guard & Storage tests`
- `Popup PRO UI & PIN flow tests`

- [ ] **Step 2: Executar toda a suíte de testes do projeto**

Run: `npm test`  
Expected: Todas as suítes passam (50+ testes aprovados, 0 falhas).

- [ ] **Step 3: Commit**

```bash
git add tests/run-all-tests.js
git commit -m "test(pro): integrar testes do Yekun Cloud PRO ao runner geral"
```
