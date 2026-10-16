# 🚀 Guia Oficial de Publicação — Yekun Dream

Este guia reúne todos os passos, textos prontos para copiar e colar, justificativas de permissões e requisitos necessários para publicar a extensão na **Chrome Web Store**, no **Firefox Add-ons (AMO)** e no **Microsoft Edge Add-ons**.

---

## 1. Visão Geral: O Projeto Está Pronto?

**Sim! Tecnicamente o código está 100% pronto para publicação.**
- ✅ **Manifest V3 Compliant**: 100% em conformidade com as diretrizes do Manifest V3.
- ✅ **Zero Código Remoto**: Sem uso de `eval()`, bibliotecas externas via CDN ou scripts dinâmicos de terceiros (o que é estritamente proibido pelo Google).
- ✅ **46 Suítes de Testes Aprovadas**: Cobertura completa de modelos, CRUD, SPAs, Crunchyroll, anime tracker, notificações e layout.
- ✅ **Pacote de Produção Automatizado**: O comando `npm run pack` gera automaticamente um `.zip` limpo de apenas **~95 KB**, sem arquivos de teste ou documentação interna.

---

## 2. Passo a Passo: Publicação na Chrome Web Store

### 2.1. Pré-Requisitos
1. Acesse o [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
2. Faça login com sua Conta Google.
3. Se for sua primeira extensão, o Google cobra uma taxa única de registro de desenvolvedor de **US$ 5,00** (pago com cartão de crédito internacional).

### 2.2. Gerando o Pacote (.zip)
No terminal do projeto, execute:
```bash
npm run pack
```
O arquivo pronto para envio será gerado em:
📁 `dist/yekun-dream-v1.2.0.zip`

---

## 3. Textos Oficiais para a Ficha da Loja (Copiar e Colar)

### Nome da Extensão
```text
Yekun Dream
```

### Resumo Curto (Limite de 132 caracteres)
```text
Acompanhe seu progresso em animes, mangás e webtoons com botão flutuante, histórico multi-fontes e notificações de lançamentos.
```

### Categoria Recomendada
- **Categoria**: Produtividade (ou Entretenimento / Ferramentas)

### Descrição Detalhada
```markdown
O Yekun Dream é um gerenciador inteligente, leve e 100% livre para salvar e acompanhar seu progresso de leitura e streaming de animes, mangás, manhwas, webtoons e séries diretamente em qualquer página web.

Diferente de soluções comuns que criam entradas duplicadas a cada site diferente, o Yekun Dream adota uma arquitetura multi-fontes: acompanhe a mesma obra em múltiplos leitores ou scans mantendo seu progresso unificado em um único card, com histórico detalhado e sincronização em nuvem.

◈ PRINCIPAIS RECURSOS:

• 🎬 Auto-Rastreamento de Animes & Vídeos (Regra dos 70%):
Ao assistir 70% ou mais de um episódio em qualquer reprodutor de vídeo da web (inclusive em players incorporados/iframes), a extensão salva o progresso automaticamente, exibindo uma confirmação discreta sem interromper seu episódio.

• 🔔 Alertas de Lançamento & Histórico com Sininho:
Configure os dias da semana em que suas obras são lançadas. A extensão notifica você nos horários programados (08:00 da manhã e 17:00 da tarde) quando houver novidades. Além disso, conta com uma central de notificações com os lançamentos recentes. Trava inteligente contra obras em hiato ou canceladas.

• ◈ Botão Flutuante In-Page Inteligente:
Um botão discreto e reposicionável na página que detecta automaticamente o título e o capítulo/episódio atual, permitindo salvar o progresso com apenas 1 clique.

• 🛡️ Avanço Rápido Seguro (+1):
Validação semântica que verifica a página atual antes de incrementar o capítulo, exibindo alerta de confirmação caso você já esteja no capítulo atual ou em outra página, evitando avanços acidentais.

• 🎨 3 Temas Calibrados Anti-Brilho:
Dark (Azul Neon), Light (Branco & Azul) e Pink (Sakura), desenhados para máximo conforto visual em sessões prolongadas de leitura noturna. Ícone dinâmico do navegador que acompanha as cores do tema ativo.

• 🌐 Decodificadores Avançados de SPAs & Streaming:
Compatibilidade refinada com Crunchyroll (formatação padronizada "Temp 01 - Ep 01"), AnimesOnline, MangaDex, Vegitoons, MangásTop, NexusToons e centenas de outros sites.

• ☁️ Sincronização em Nuvem & Backup:
Sincronize entre computadores e navegadores diferentes (Chrome, Brave, Edge, Opera) com sua Chave de Sincronização pessoal (Sync Key). Exporte e importe backups completos em .json a qualquer momento.

• 🔒 Filosofia Local-First & Privacidade Total:
Funciona 100% offline. Zero coleta de dados pessoais, sem rastreadores, sem anúncios e sem venda de informações. Seus dados pertencem estritamente a você.
```

---

## 4. Justificativas de Permissões (Aba "Práticas de Privacidade")

O Google Web Store exige que o desenvolvedor declare a **Finalidade Única** (*Single Purpose*) e justifique formalmente o uso de cada permissão:

### Finalidade Única (Single Purpose Description)
```text
Permitir que o usuário acompanhe, unifique e sincronize seu progresso de leitura e visualização de mangás, animes e webtoons diretamente nas páginas da web que visita, oferecendo botão flutuante de captura rápida, rastreamento automático de vídeos aos 70% e alertas de lançamentos semanais.
```

### Justificativas Específicas de Permissões:

1. **Permissão `<all_urls>` / Acesso a sites**:
   ```text
   A extensão precisa injetar o botão flutuante e o rastreador de progresso de vídeo em qualquer site de leitura de mangás ou plataforma de streaming web acessada pelo usuário para identificar o título da obra e o capítulo/episódio em reprodução.
   ```

2. **Permissão `storage`**:
   ```text
   Necessária para salvar localmente a lista de obras cadastradas, o histórico de capítulos lidos, os dias de lançamento semanais, as configurações de tema e a lista de domínios permitidos/bloqueados do usuário.
   ```

3. **Permissão `alarms`**:
   ```text
   Necessária para agendar a rotina periódica de sincronização em nuvem em segundo plano (a cada 15 minutos) e os dois lembretes diários de lançamento (às 08:00 e às 17:00).
   ```

4. **Permissão `notifications`**:
   ```text
   Necessária para disparar notificações na área de trabalho quando houver novos capítulos ou episódios disponíveis para as obras cadastradas pelo usuário no dia correspondente.
   ```

5. **Permissão `scripting`**:
   ```text
   Necessária para re-injetar os scripts de conteúdo quando o usuário interage com uma aba que já estava aberta antes da extensão ser instalada ou atualizada.
   ```

6. **Permissões `tabs` e `activeTab`**:
   ```text
   Necessárias para ler a URL e o título da aba atual ao clicar no botão "Capturar Aba", atualizar o ícone do site ativo e notificar as abas abertas quando o usuário altera as configurações de tema ou ativa/desativa o botão flutuante no domínio.
   ```

7. **Permissões `identity` e `identity.email`**:
   ```text
   Necessárias exclusivamente para detectar a conta Google conectada ao navegador do usuário e utilizá-la como identificador único da assinatura Yekun Cloud PRO, permitindo vincular o pagamento via Pix e sincronizar com segurança as leituras entre múltiplos dispositivos do próprio usuário sem necessidade de cadastros manuais ou criação de senhas.
   ```

### Declaração de Coleta de Dados (Data Usage):
Na seção de certificações, marque:
- [x] **Não vendo nem transfiro dados de usuários para terceiros.**
- [x] **Não utilizo nem transfiro dados de usuários para fins não relacionados à funcionalidade principal da extensão.**
- [x] **Não utilizo nem transfiro dados de usuários para determinar solvência nem para fins de concessão de empréstimos.**
- [x] **Dados de Identificação Pessoal (E-mail):** Coletado estritamente para autenticação de licença e sincronização em nuvem do usuário.

---

## 5. Requisitos Visuais Obrigatórios da Loja

O Google exige os seguintes arquivos de imagem no envio:

| Tipo de Imagem | Resolução Exigida | Formato | Status no Projeto |
| :--- | :--- | :--- | :--- |
| **Ícone da Loja** | 128 x 128 px | PNG | ✅ Pronto em `icons/icon128.png` |
| **Captura de Tela 1** | 1280 x 800 px ou 640 x 400 px | PNG ou JPEG | ⚠️ Tirar print do popup aberto com cards |
| **Captura de Tela 2** | 1280 x 800 px ou 640 x 400 px | PNG ou JPEG | ⚠️ Tirar print do botão flutuante em uma página de mangá/anime |
| **Pequeno Mosaico Promocional (Small Promo Tile)** | 440 x 280 px | PNG | ⚠️ Banner simples com o logo e nome Yekun Dream |

> **Dica para os Prints**: Abra o navegador com a extensão instalada, adicione 2 ou 3 obras ilustrativas (ex: Solo Leveling, Dandadan), abra o popup e capture a tela no tamanho 1280x800 usando uma ferramenta de captura (como a ferramenta de recorte do Windows ou o modo responsivo do DevTools F12).

---

## 6. URL da Política de Privacidade

Como a extensão requer `<all_urls>`, o Google **exige obrigatoriamente um link público para a Política de Privacidade**.

Você pode publicar um texto simples no seu domínio (`https://sentsuy.ddns.net/privacidade.html`) ou no GitHub Pages com o seguinte conteúdo:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Política de Privacidade — Yekun Dream</title></head>
<body style="font-family:sans-serif; max-width:700px; margin:40px auto; line-height:1.6; padding:0 20px;">
  <h1>Política de Privacidade — Yekun Dream</h1>
  <p><strong>Última atualização:</strong> Outubro de 2026</p>
  <p>A extensão <strong>Yekun Dream</strong> foi desenvolvida com a filosofia <em>Local-First</em> e prioridade total à privacidade do usuário.</p>
  <h2>1. Coleta de Dados</h2>
  <p>O Yekun Dream <strong>NÃO</strong> coleta, não armazena em servidores proprietários, não rastreia e não compartilha quaisquer dados pessoais dos usuários, incluindo histórico de navegação pessoal, senhas, e-mails ou endereços IP.</p>
  <h2>2. Armazenamento Local</h2>
  <p>Todas as informações sobre obras, capítulos, fontes e preferências são armazenadas estritamente no armazenamento local do navegador do próprio usuário (<code>chrome.storage.local</code>).</p>
  <h2>3. Sincronização Opcional</h2>
  <p>Caso o usuário opte por configurar uma Chave de Sincronização em Nuvem (Sync Key), os registros de obras serão transmitidos de forma segura diretamente para a infraestrutura de nuvem pessoal configurada pelo usuário, sem acesso por terceiros.</p>
  <h2>4. Contato</h2>
  <p>Dúvidas sobre esta política podem ser enviadas através do site oficial: <a href="https://sentsuy.ddns.net/">sentsuy.ddns.net</a>.</p>
</body>
</html>
```

---

## 7. Publicação em Outras Lojas (Opcional)

### Microsoft Edge Add-ons
- Aceita exatamente o mesmo arquivo `.zip` gerado pelo `npm run pack`.
- Cadastro gratuito no [Partner Center da Microsoft](https://partner.microsoft.com/dashboard/microsoftedge).
- Processo de aprovação rápido (geralmente 24 a 48 horas).

### Firefox Add-ons (Mozilla AMO)
- Acesse o [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/).
- Faça o upload do `.zip`. O Firefox possui suporte ao Manifest V3.

---

## 8. Checklist de Produção: Supabase & Gateway AbacatePay

Antes de subir a versão final para os usuários:

### 8.1. Aplicar o Patch de Produção no Supabase
1. Acesse o [SQL Editor do Supabase](https://supabase.com/dashboard/project/wbappdsgstzintgznikb/sql).
2. Abra o arquivo [scripts/supabase-pro-production-patch.sql](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/scripts/supabase-pro-production-patch.sql).
3. Cole todo o conteúdo e clique em **Run**.
4. Isso garante:
   - Criação das colunas de segurança `access_pin`, `recovery_key` e `totp_secret`.
   - RPC `claim_charge_credentials` para resgate automático e instantâneo do PIN de 6 dígitos no popup.
   - Revogação de permissões públicas no `approve_from_gateway` (fechando qualquer brecha de aprovação indevida).

### 8.2. Configurar a AbacatePay em Modo Produção
1. No painel da **AbacatePay**, gere sua chave de API com permissão `TRANSPARENT:CREATE`.
2. Configure o Webhook:
   - **URL**: `https://wbappdsgstzintgznikb.supabase.co/functions/v1/abacatepay-webhook?webhookSecret=SEU_WEBHOOK_SECRET`
   - **Eventos**: Marque `transparent.completed` e `billing.paid`.
3. Defina os Secrets nas Edge Functions do Supabase:
   ```bash
   supabase secrets set ABACATEPAY_API_KEY="sua_chave_producao_aqui"
   supabase secrets set ABACATEPAY_WEBHOOK_SECRET="seu_webhook_secret_aqui"
   supabase secrets set ABACATEPAY_BASE_URL="https://api.abacatepay.com/v2"
   ```

