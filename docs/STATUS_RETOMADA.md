# 📌 Guia de Retomada do Projeto — Yekun Dream

- **Data da Última Atualização:** 16 de Outubro de 2026
- **Estado Geral:** ✅ 60/60 Suítes de Testes Automatizados Aprovadas (100% Verdes)
- **Versão:** 1.2.0 (Yekun Cloud PRO + Feed In-App & Mapeamento de Sites)

---

## 🎯 Resumo do que foi Concluído Hoje

1. **Central de Feed, Sugestões & Mapeamento de Sites (Feed In-App)**:
   - **Limite Rígido de 300 Caracteres**: Tanto no front (`popup.html` e `popup.js`) quanto no back/RPC (`submit_feedback` e `feedback_reports.message VARCHAR(300)`), garantindo mensagens objetivas e bloqueando abusos ou textos inflados ("espertões").
   - **3 Categorias Claras**:
     - `site_mapping`: Sugerir novo site ou scan para ser adicionado ao ecossistema.
     - `bug_report`: Relatar erro na captura da obra, capítulo ou player de vídeo.
     - `suggestion`: Sugestão de melhoria, crítica ou comentário geral.
   - **Dois Pontos de Acesso na Extensão**:
     - *Aba dedicada "Feed" nas Configurações*: formulário com seletor, contador dinâmico de caracteres `0 / 300`, anexo contextual da aba ativa e e-mail opcional.
     - *Atalho Contextual "Feed" na Barra de Site*: botão discreto ao lado do switch de permissão da página ativa, que abre o formulário pré-selecionando a categoria e associando a URL e obra detectada.
   - **Script SQL no Supabase ([scripts/supabase-feedback-setup.sql](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/scripts/supabase-feedback-setup.sql))**:
     - Tabela `feedback_reports` com índices de performance (`category`, `domain`, `status`, `created_at`) e campos de gestão (`status`, `admin_notes`) prontos para o futuro painel web.
     - Tabela de rate limiting `feedback_rate_limits` (máx. 5 envios por hora).
     - RPC `submit_feedback` com `SECURITY DEFINER`, sanitização e validação defensiva.
     - RLS habilitado sem `SELECT` público (privacidade garantida; relatos só são lidos pelo administrador).
   - **Serviço Universal ([feedback-service.js](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/feedback-service.js))**: Validação de payload no cliente, helpers de telemetria do navegador e integração com a RPC do Supabase.

2. **Blindagem de Segurança no Supabase & Gateway**:
   - **Revogação de Permissão Pública (`approve_from_gateway`)**: Fechada a brecha de segurança onde qualquer usuário com a chave pública `anon` poderia aprovar pagamentos no banco. Agora apenas a `service_role` (usada pelo webhook da AbacatePay no servidor) tem permissão de aprovação.
   - **Simulador de Testes Restrito (`simulate_dev_payment`)**: Criada função isolada de simulação com guarda estrita via regex (`gateway_charge_id ~* '(test|dev)'`), impedindo qualquer simulação indevida sobre cobranças de produção.
   - **Nova RPC Segura (`claim_charge_credentials`)**: Permite que o popup da extensão, portando o `chargeId` efêmero da sessão ativa, resgate com segurança o PIN de 6 dígitos e a Chave Mestra imediatamente após o pagamento Pix ser confirmado.
   - **Patch de Produção Consolidado**: Criado [scripts/supabase-pro-production-patch.sql](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/scripts/supabase-pro-production-patch.sql) pronto para execução em 1 clique no SQL Editor do Supabase.

2. **Fluxo de Polling e Entrega de Credenciais (`popup.js` e `identity-service.js`)**:
   - Implementado método `IdentityService.claimChargeCredentials`.
   - Polling ativo verifica o `currentChargeId` e salva automaticamente o PIN de 6 dígitos e a Chave Mestra no storage local no momento da confirmação.
   - O Step 3 (Sucesso) agora exibe o PIN real de 6 dígitos e a Chave Mestra (`YK-XXXX-XXXX-XXXX`) para o usuário anotar.
   - Correção para navegadores sem login Google nativo (Brave, Edge, Opera): a ativação ocorre sem bloqueios assim que o pagamento é concluído.
   - Adicionados headers obrigatórios `apikey` e `Authorization` na chamada da Edge Function `create-pro-charge`.

3. **Gateway AbacatePay v2 & Edge Functions**:
   - Atualizado o payload de `create-pro-charge/index.ts` para enviar o objeto estruturado `customer: { email, name }` além de `metadata` em conformidade com a API v2 da AbacatePay.
   - Proteção do Webhook com conferência de segredo via header `x-abacatepay-secret` ou query `webhookSecret`.

4. **Preparação para a Chrome Web Store (`docs/GUIA_PUBLICACAO.md`)**:
   - Adicionadas justificativas formais exigidas pelo Google para as permissões `"identity"` e `"identity.email"`.
   - Adicionado checklist passo a passo para configuração de secrets e webhook de produção na AbacatePay.

---

## 🚀 Passo a Passo para Entrada em Produção

### Passo 1: Executar o Patch Consolidado no Supabase
1. Acesse o painel do seu projeto no [Supabase](https://supabase.com/).
2. No menu lateral esquerdo, clique no ícone **SQL Editor** (`>_`).
3. Abra uma **"New Query"**, cole o conteúdo completo do arquivo:
   [scripts/supabase-pro-production-patch.sql](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/scripts/supabase-pro-production-patch.sql)
4. Clique no botão verde **"Run"**.
*(Isso cria as colunas `access_pin`, `recovery_key`, `totp_secret`, as RPCs `claim_charge_credentials` e `verify_pro_access`, e blinda o `approve_from_gateway`).*

---

### Passo 2: Executar o Setup de Feed & Feedback no Supabase
1. No mesmo SQL Editor do Supabase, abra uma nova query.
2. Cole o conteúdo de:
   [scripts/supabase-feedback-setup.sql](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/scripts/supabase-feedback-setup.sql)
3. Clique em **"Run"**.
*(Isso cria as tabelas `feedback_reports` e `feedback_rate_limits`, a RPC `submit_feedback` e as regras de segurança RLS).*

---

### Passo 3: Criar um PIN de Teste no Banco (Opcional para testar PRO)
No SQL Editor do Supabase, execute o comando abaixo para gerar um código de ativação se desejar testar a assinatura:
```sql
INSERT INTO activation_pins (pin) VALUES ('7492');
```

---

### Passo 4: Recarregar e Testar na Extensão
1. No navegador (Chrome/Edge/Brave), acesse `chrome://extensions/`.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Se a extensão já estiver instalada, clique no botão de **Recarregar (🔄)** no card do **Yekun Dream**.
4. Abra o popup da extensão:
   - **Testar Feedback / Feed**:
     - Clique no botão discreto **"Feed"** na barra do site atual (ao lado do switch), ou vá em **Configurações ⚙️ → Feed**.
     - Selecione uma das 3 categorias (*Sugerir Site*, *Reportar Falha* ou *Sugestão Geral*).
     - Digite uma mensagem (observe o contador `0 / 300` atualizando em tempo real e bloqueando além de 300).
     - Clique em **"Enviar Feedback"**.
   - **Testar PRO / Sincronização**:
     - Vá na aba **PRO** das Configurações.
     - Digite o PIN `7492` e clique em **"Ativar PIN"**.
     - O selo mudará para **⭐ PRO ATIVO** por 365 dias.

---

### 🧪 Como Rodar os Testes Automatizados
Se quiser verificar a integridade de todo o projeto a qualquer momento pelo terminal:
```bash
npm test
```
*Resultado esperado: 60 suítes de testes passando (100% de sucesso).*

---

## 🔮 Sugestões para os Próximos Passos
- Gerar o arquivo `.zip` final para publicação na **Chrome Web Store** via `node scripts/package-extension.js`.
- Criar automação simples (ex: bot no Telegram/Discord ou webhook) para gerar novos PINs de 4 dígitos automaticamente a cada Pix recebido.
