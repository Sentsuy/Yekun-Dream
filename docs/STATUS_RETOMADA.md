# 📌 Guia de Retomada do Projeto — Yekun Dream

- **Data da Última Atualização:** 14 de Outubro de 2026
- **Estado Geral:** ✅ 51/51 Suítes de Testes Automatizados Aprovadas (100% Verdes)
- **Versão:** 1.2.0

---

## 🎯 Resumo do que foi Concluído Hoje

1. **Validação da Conexão com Supabase**:
   - URL do Projeto configurada: `https://wbappdsgstzintgznikb.supabase.co`
   - Teste de requisição REST via `anon key` executado e aprovado com sucesso (leitura e gravação de teste).
   - As credenciais padrão foram integradas em `DEFAULT_SETTINGS` com fallback inteligente em `storage-local.js`.

2. **Modelo de Negócio e Licenciamento (Yekun Cloud PRO)**:
   - **Plano Anual**: R$ 20,00 por ano (validade de 365 dias).
   - **Identidade Sem Fricção (`identity-service.js`)**: Detecção automática da conta Google conectada ao Chrome via `chrome.identity.getProfileUserInfo`, com campo para e-mail manual para quem usa Brave, Edge ou Opera.
   - **Ativação por PIN de 4 Dígitos**: Sistema de validação instantânea via código numérico (ex: `7492`). Ao pagar o Pix, o usuário recebe o código e ativa 365 dias com 1 clique.

3. **Segurança no Banco de Dados (Supabase)**:
   - Criado o script [scripts/supabase-pro-setup.sql](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/scripts/supabase-pro-setup.sql) contendo:
     - Tabela `subscriptions` (controle de planos, e-mails e data de expiração `valid_until`).
     - Tabela `activation_pins` (PINs de 4 dígitos não expostos ao público).
     - Função RPC segura `redeem_activation_pin(p_pin, p_email)` com `SECURITY DEFINER`.
     - Políticas RLS atualizadas na tabela `entries` para só autorizar sincronização de quem tiver assinatura ativa.

4. **Guarda no Motor de Sincronização (`sync-service.js`)**:
   - Bloqueio elegante para usuários gratuitos com mensagem informativa.
   - O e-mail da conta PRO passa a ser a `sync_key` universal entre dispositivos.

5. **Interface no Popup (`popup.html` e `popup.css`)**:
   - Card PRO no menu de configurações com indicador de status (`FREE` ou `⭐ PRO ATIVO`).
   - Campo de ativação rápida por PIN numérico de 4 dígitos.
   - Modal com QR Code Pix oficial, botão de cópia de chave e instruções passo a passo.

6. **Correção de Extração na Crunchyroll (`content.js` e `popup.js`)**:
   - **Diagnóstico do Problema**: Em páginas de catálogo de animes da Crunchyroll (como `/series/GT00383992/full-clearing-another-world-under-a-goddess-with-zero-believers`), o driver anterior fazia uma busca global `a[href*="/series/"]`, capturando o primeiro link presente no menu/header de navegação global ("Solo Leveling", "One Piece", etc.) antes de chegar ao título do anime atual.
   - **Solução Implementada**:
     - **Cenário 1 (Página de Série `/series/`)**: Prioridade máxima no `h1.title` da série, JSON-LD `@type: TVSeries`, meta tag `og:title` ou no slug da própria URL atual (`StorageLocal.extractSlugTitle`), bloqueando terminantemente buscas em links de menu externos.
     - **Cenário 2 (Player / Episódio `/watch/`)**: Prioridade no JSON-LD `TVEpisode` (`partOfSeries.name`), seletores específicos do player (`.show-title-link`, `[data-t="show-title-link"]`, breadcrumbs) e exclusão de links no `header`, `nav`, `footer` e carrosséis.
     - Suíte de testes atualizada em [tests/test-crunchyroll-and-streaming.js](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/tests/test-crunchyroll-and-streaming.js) cobrindo Casos A até H com 100% de aprovação.

---

## 🚀 Passo a Passo para Retomar Amanhã (Em Qualquer Computador)

### Passo 1: Rodar o Script no Supabase
1. Acesse o painel do seu projeto no [Supabase](https://supabase.com/).
2. No menu lateral esquerdo, clique no ícone **SQL Editor** (`>_`).
3. Abra uma **"New Query"**, cole o conteúdo completo do arquivo:
   `scripts/supabase-pro-setup.sql`
4. Clique no botão verde **"Run"**.

---

### Passo 2: Criar um PIN de Teste no Banco
No mesmo SQL Editor do Supabase, execute o comando abaixo para gerar seu primeiro código de ativação:
```sql
INSERT INTO activation_pins (pin) VALUES ('7492');
```
*(Você pode criar quantos PINs de 4 dígitos quiser trocando o número).*

---

### Passo 3: Recarregar e Testar na Extensão
1. No navegador (Chrome/Edge/Brave), acesse `chrome://extensions/`.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Se a extensão já estiver instalada, clique no botão de **Recarregar (🔄)** no card do **Yekun Dream**.
   *(Se estiver em outro PC, clique em "Carregar sem compactação" e aponte para a pasta deste projeto).*
4. Abra o popup da extensão e vá até a aba/gaveta de **Configurações ⚙️**.
5. No bloco **Sincronização em Nuvem (Yekun Cloud PRO)**:
   - Digite o código `7492` no campo de PIN.
   - Clique em **"Ativar PIN"**.
   - O selo mudará para **⭐ PRO ATIVO**, informando que sua anuidade está garantida por **365 dias**, e a sincronização em nuvem será liberada imediatamente!

---

### 🧪 Como Rodar os Testes Automatizados
Se quiser verificar a integridade de todo o projeto a qualquer momento pelo terminal:
```bash
npm test
```
*Resultado esperado: 51 testes passando (0 falhas).*

---

## 🔮 Sugestões para os Próximos Passos
- Gerar o arquivo `.zip` final para publicação na **Chrome Web Store** via `node scripts/package-extension.js`.
- Criar automação simples (ex: bot no Telegram/Discord ou webhook) para gerar novos PINs de 4 dígitos automaticamente a cada Pix recebido.
