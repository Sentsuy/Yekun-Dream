# 📌 Guia de Retomada do Projeto — Yekun Dream

- **Data da Última Atualização:** 21 de Outubro de 2026
- **Estado Geral:** ✅ 68/68 Suítes de Testes Automatizados Aprovadas (100% Verdes)
- **Versão:** 1.2.0 (Yekun Cloud PRO + Device Session Security + Filtro Multi-Status Fluido + Popovers Status/Categoria + Turbo Startup)
- **Pacote de Produção:** `dist/yekun-dream-v1.2.0.zip` (167.6 KB) pronto para o Chrome Web Store Developer Dashboard.

---

## 🎯 Resumo do Status Atual do Projeto

### 1. ⚡ Otimização Extrema de Desempenho e Startup Instantâneo (< 10ms)
- **Leitura Atômica em Único IPC (`StorageLocal.getInitialData`)**:
  - Unificação de 6 viagens consecutivas a disco (`chrome.storage.local.get`) em **1 único IPC atômico**: configurações, obras salvas, histórico de notificações, credenciais PRO e status da sessão.
  - Eliminação de gravações síncronas bloqueantes durante a inicialização.
- **Cache Volátil em Memória (`IdentityService.primeCache`)**:
  - Sessão e credenciais do usuário PRO disponíveis instantaneamente em memória RAM.
  - O botão de autenticação no cabeçalho (login ↔ desconectar) reflete o estado da conta de imediato, sem tela branca, sem *layout shift* e sem atrasos de rede.
- **Renderização Progressiva por Lotes (*Chunked Batching*) no `renderList()`**:
  - Para evitar o travamento do navegador ao carregar dezenas ou centenas de obras, os primeiros 15 cards são criados e renderizados imediatamente (tempo de pintura $< 10\text{ms}$).
  - Os cards seguintes são inseridos progressivamente em lotes via `requestAnimationFrame`. Cancelamento automático de lotes pendentes caso o usuário digite na busca ou mude de filtro.
- **Desacoplamento de Tarefas Secundárias**:
  - Consulta de abas ativas do Chrome (`chrome.tabs.query`) agendada para o próximo frame livre.
  - Ativação das folhas de estilo e verificação de sincronização periódica em nuvem postergadas para períodos de ociosidade da CPU (`requestIdleCallback`).

---

### 2. 🛡️ Segurança de Sessão por Dispositivo & Proteção Anti-Scraping
- **Tabela `device_sessions` no Supabase**:
  - Cada navegador/dispositivo autorizado recebe um `device_token` criptograficamente seguro via `crypto.randomUUID()`.
  - Tokens são emitidos automaticamente após confirmação de pagamento Pix (`claim_charge_credentials`), validação de PIN de acesso (`verify_pro_access`), login 2FA via Google Authenticator (`verify_totp_login`) ou sessão Google autorizada.
- **Imposição de Token no Row Level Security (RLS)**:
  - Função no banco PostgreSQL: `is_authorized_sync(p_sync_key)`.
  - Toda operação (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) em obras e preferências remotas exige o header `x-sync-token` validado contra a tabela `device_sessions`.
  - Tentativas de invasão, ataques man-in-the-middle ou raspagem pública são bloqueadas nativamente no banco (código HTTP 401/403).
- **Rate Limiting por IP no Supabase**:
  - A RPC `check_pro_status` possui limite estrito de **máximo 60 requisições a cada 5 minutos por IP** via tabela `pro_status_rate_limits`, mitigando ataques de força bruta ou enumeração de e-mails.
- **Script SQL Consolidado**:
  - Localizado em [`scripts/supabase-device-session-security.sql`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/scripts/supabase-device-session-security.sql).

---

### 3. 🎛️ Filtro Multi-Seleção de Status & Visualização Sob Demanda
- **Barra de Filtro `#statusFilterBar`**:
  - Chips interativos: `Lendo / Assistindo`, `Pausados`, `Dropados`, `Concluídos`, `Planejo` e `Todos`.
  - **Padrão Inteligente e Leve**: Ao abrir o popup, exibe por padrão apenas as obras em `Lendo` (ou `Assistindo` para animes/séries/filmes), deixando a lista visualmente limpa e leve.
  - **Multi-Seleção Flexível**: Permite alternar e combinar múltiplos status simultaneamente (ex: `Lendo` + `Pausados`).
  - Destaque cromático dinâmico no fundo dos chips ativos.

---

### 4. 🏷️ Menu Suspenso (Popover) de Status com Hover de 0.5s e Posição Inteligente
- **Popover Interativo no Card da Obra**:
  - Pousar o cursor por **0.5s** sobre o badge de status (ou clicar diretamente) abre o menu popover com todas as opções (`Lendo/Assistindo`, `Pausado`, `Dropado`, `Concluído`, `Planejo`).
  - **Abertura Inteligente Direcional**: Abre para baixo por padrão; caso seja o último card da lista ou se o espaço inferior for $< 145\text{px}$, abre para cima, evitando que o menu seja cortado pela borda inferior do popup.
  - **Atualização Sem Reordenação (`touchUpdatedAt: false`)**: A troca de status atualiza a obra no banco local sem alterar seu `updatedAt`, impedindo que a obra "pule" de posição na lista enquanto o usuário navega.

---

### 5. 🎨 Menu Suspenso (Popover) de Categoria/Tipo de Obra com Hover de 0.5s
- **Popover Interativo no Badge de Categoria (`.entry-cat-badge`)**:
  - Pousar o cursor por **0.5s** (ou clicar diretamente) abre o menu popover de tipos: `Mangá`, `Manhwa`, `Manhua`, `Anime`, `Webtoon`, `Série`, `Filme`, `Livro`, `Outro`.
  - **Mesmas Regras Direcionais**: Abre para baixo por default, e para cima no último card ou espaço livre inferior $< 145\text{px}$.
  - **Sincronização Semântica Dinâmica (Texto ↔ Vídeo)**:
    - Alternar para formato audiovisual (`anime`, `serie`, `filme`) converte automaticamente o rótulo de leitura ativa de `Lendo` para `Assistindo` e atualiza o botão principal de ação (`Continuar assistindo`).
    - Alternar de volta para leitura gráfica/textual (`manga`, `manhwa`, etc.) restaura para `Lendo` e `Continuar lendo`.
  - **Atualização In-Place sem Re-renderização Total**: Atualiza os badges e atributos diretamente no DOM, evitando qualquer reordenação ou flickering de tela.
  - **Zero Emojis / Tipografia Clean**: Uso exclusivo de labels textuais limpos com pontos cromáticos do CSS (`.dot-manga`, `.dot-anime`, etc.), atendendo à diretriz de design da comunidade.
  - **Storage Atômico**: Método `StorageLocal.updateWorkCategory(id, tag, { touchUpdatedAt: false })`.

---

### 6. 📬 Central de Feed, Sugestões & Mapeamento de Sites (In-App)
- **Limite Rígido de 300 Caracteres**: Validado no front (`popup.html`/`popup.js`), serviço (`feedback-service.js`) e no Postgres (`feedback_reports.message VARCHAR(300)`).
- **3 Categorias**: `site_mapping` (sugerir site/scan), `bug_report` (falha de captura) e `suggestion` (melhoria geral).
- **Atalho Rápido na Barra de Site**: Botão discreto ao lado do botão flutuante para relatar a página ativa com contexto pré-preenchido.
- **Proteção Anti-Spam**: Máximo de 5 envios por hora por IP/usuário via `feedback_rate_limits`.
- **Script SQL**: [`scripts/supabase-feedback-setup.sql`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/scripts/supabase-feedback-setup.sql).

---

### 7. 💳 Pagamento Pix & Entrega de Credenciais Híbridas (PIN + 2FA)
- **Gateway AbacatePay v2**: Webhook seguro autenticado com segredo (`x-abacatepay-secret`).
- **Resgate Automático de Credenciais**: Imediatamente após a confirmação do Pix, a RPC `claim_charge_credentials` entrega ao popup o PIN de 6 dígitos e a Chave de Recuperação (`YK-XXXX-XXXX-XXXX`).
- **Google Authenticator (2FA TOTP)**: Chaves manuais Base32 e QR Code gerados no front, validados via RFC 6238 antes da ativação.

---

## 🚀 Guia de Execução dos Scripts SQL no Supabase

Para garantir que o banco em produção possua todas as tabelas, funções e travas de segurança ativas, execute os 3 scripts a seguir no **SQL Editor** do Supabase na seguinte ordem:

### 1. Patch de Produção PRO
Execute o arquivo:
[`scripts/supabase-pro-production-patch.sql`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/scripts/supabase-pro-production-patch.sql)
*(Garante as colunas `access_pin`, `recovery_key`, `totp_secret`, e as RPCs `claim_charge_credentials` e `verify_pro_access`).*

### 2. Setup do Feed e Mapeamento de Sites
Execute o arquivo:
[`scripts/supabase-feedback-setup.sql`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/scripts/supabase-feedback-setup.sql)
*(Cria as tabelas `feedback_reports` e `feedback_rate_limits`, a RPC `submit_feedback` e as regras de segurança RLS).*

### 3. Sessões de Dispositivo, RLS e Rate Limiting Anti-Scraping
Execute o arquivo:
[`scripts/supabase-device-session-security.sql`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/scripts/supabase-device-session-security.sql)
*(Cria `device_sessions`, `pro_status_rate_limits`, a função `is_authorized_sync` e blinda as tabelas com verificação obrigatória de `x-sync-token`).*

---

## 🧪 Verificação da Suíte de Testes

Para validar a integridade completa da extensão (68 suítes cobrindo storage, segurança, RLS, TOTP, UI, performance e sintaxe):

```bash
npm test
```

**Resultado esperado:**
```text
═══════════════════════════════════════════════════════
   Yekun Dream — Executing Test Suite
═══════════════════════════════════════════════════════
...
───────────────────────────────────────────────────────
Results: 68 passed, 0 failed (68 total)
───────────────────────────────────────────────────────
✓ All test suites passed successfully!
```

---

## 📦 Como Gerar o Pacote para Publicação

Para gerar o arquivo zip otimizado pronto para upload na Chrome Web Store:

```bash
npm run pack
```

Arquivo gerado em:
`dist/yekun-dream-v1.2.0.zip`

---

## 📋 Arquitetura de Arquivos Principais

| Arquivo | Função Principal |
| :--- | :--- |
| [`popup.js`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/popup.js) | Controle de interface, renderização em lotes, filtro multi-status, popovers hover (status e categoria), gavetas e binding de eventos. |
| [`popup.html`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/popup.html) | Estrutura semântica, chips de filtro multi-status, modais de 2FA, PIN, termos de uso e gaveta de feed. |
| [`popup.css`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/popup.css) | Estilização completa, popovers direcionais (`status-popover`, `category-popover`), temas escuro/claro/rosa/neon. |
| [`storage-local.js`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/storage-local.js) | CRUD local v3, método `getInitialData()` com agregação em 1 IPC e métodos `updateWorkStatus`/`updateWorkCategory` com `touchUpdatedAt: false`. |
| [`identity-service.js`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/identity-service.js) | Gestão de identidade, `primeCache()`, verificação de PIN, TOTP RFC 6238, sessions tokens e status PRO. |
| [`sync-service.js`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/sync-service.js) | Sincronização em nuvem bidirecional com anexação do header `x-sync-token` e resolução de conflitos. |
| [`feedback-service.js`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/feedback-service.js) | Validação e envio de sugestões/bugs para o Supabase com rate limit. |
| [`background.js`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/background.js) | Service Worker MV3, alarmes matutinos/vespertinos, sync periódico e notificações de novos capítulos. |
| [`content.js`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/content.js) | Extração de dados da página ativa, rastreador de vídeo 70% e botão flutuante draggable. |
