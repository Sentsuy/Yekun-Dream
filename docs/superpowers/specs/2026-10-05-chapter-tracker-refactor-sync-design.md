# Chapter Tracker — Design Specification

> **Documento de Especificação Arquitetural**  
> Data: 2026-10-05  
> Status: Aprovado  
> Escopo: Refatoração de Persistência Local, Correção de Fluxos, Módulo de Sincronização Cross-Browser e Preparação para Publicação.

---

## 1. Visão Geral e Objetivos

O **Chapter Tracker** é uma extensão WebExtensions / Manifest V3 voltada ao acompanhamento contínuo de progresso de leitura e visualização de mídias (mangás, animes, séries, livros).

### Metas do Projeto
1. **Estabilidade e Testabilidade Imediata:** Tornar a extensão 100% executável localmente, com ícones válidos, sem falhas de cota de armazenamento e sem duplicação de cards.
2. **Arquitetura Offline-First (Local-First):** Armazenamento primário local em `chrome.storage.local`, sem latência de rede e sem o limite de 8KB por item do `chrome.storage.sync`.
3. **Sincronização em Nuvem Cross-Browser:** Permitir sincronização bidirecional entre diferentes navegadores (Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, Arc) utilizando API REST leve (Supabase) via chave de sincronização simples ou autenticação de usuário.
4. **Conformidade para Publicação:** Atender às exigências da Chrome Web Store, Firefox AMO e Edge Add-ons (controle de injeção em páginas, permissões justificadas e documentação de privacidade).

---

## 2. Arquitetura do Sistema

```mermaid
flowchart TB
    subgraph Browser ["Navegador (Chrome / Edge / Firefox)"]
        subgraph UI ["Camada de Interface"]
            POP["Popup Interface (popup.html / popup.js)"]
            FAB["Floating Action Button / In-Page Form (content.js - Shadow DOM)"]
        end

        subgraph Core ["Núcleo de Armazenamento e Lógica"]
            STORE["Módulo Storage Local (storage-local.js)"]
            SYNC["Módulo de Sincronização (sync-service.js)"]
        end

        subgraph Engine ["Segundo Plano"]
            BG["Background Service Worker (background.js)"]
        end

        POP <-->|Leitura e Escrita Imediata| STORE
        FAB <-->|Leitura e Escrita Imediata| STORE
        STORE <-->|Fila de Pendências| SYNC
        BG <-->|Alarmes Periódicos de Sync| SYNC
    end

    subgraph Cloud ["Serviço em Nuvem (Supabase)"]
        REST["REST API / PostgREST"]
        AUTH["Auth / Sync Key Mapping"]
        DB[("PostgreSQL (Tabela: entries)")]
        REST <--> DB
        AUTH <--> DB
    end

    SYNC <-->|HTTPS REST (fetch)| REST
```

---

## 3. Estrutura de Arquivos e Responsabilidades

```text
.
├── icons/
│   ├── icon16.png            # Ícone 16x16 para barra de favoritos / favicon
│   ├── icon32.png            # Ícone 32x32 para telas HiDPI
│   ├── icon48.png            # Ícone 48x48 para gerenciador de extensões
│   └── icon128.png           # Ícone 128x128 para Chrome Web Store e instalação
├── manifest.json             # Configurações Manifest V3 com ícones e permissões
├── storage-local.js          # Utilitário de persistência unificada (CRUD, busca, soft-delete)
├── sync-service.js           # Mecanismo de sincronização REST com nuvem (pull, push, LWW)
├── background.js             # Service Worker gerenciador de alarmes periódicos de sync
├── content.js                # Injeção em páginas com Shadow DOM (detecção e atualização)
├── popup.html                # Estrutura do menu de controle
├── popup.css                 # Estilos visuais Dark Neon
├── popup.js                  # Controle de eventos do popup (busca, drawer, +1, export/import)
├── package.json              # Metadados e scripts de build/validação limpos
└── README.md                 # Documentação do projeto
```

---

## 4. Modelo de Dados Unificado (Schema)

Cada entrada de mídia no banco local e remoto segue a interface padronizada abaixo:

```typescript
interface TrackerEntry {
  id: string;               // UUID v4 único imutável
  name: string;             // Nome limpo da obra (ex: "Jujutsu Kaisen")
  chapter: string;          // Capítulo ou episódio (ex: "Cap. 260")
  url: string;              // URL exata do capítulo/episódio
  tag: 'manga' | 'anime' | 'serie' | 'livro' | 'outro';
  createdAt: number;        // Epoch timestamp em milissegundos
  updatedAt: number;        // Epoch timestamp em milissegundos (critério Last-Write-Wins)
  deleted: boolean;         // Soft delete (true para registros excluídos a propagar)
  syncStatus: 'synced' | 'pending'; // Estado local de sincronismo
}

interface AppSettings {
  syncKey: string;           // Chave de sincronização do usuário (ex: "CT-9X2A8B")
  supabaseUrl: string;       // URL do endpoint Supabase
  supabaseKey: string;       // Anon public API Key
  autoSyncIntervalMinutes: number; // Intervalo de sincronização (padrão: 15 min)

  // Toggles de preferências do usuário (quais partes estão ativas)
  enableFloatingButton: boolean;      // Ativar/desativar botão flutuante nas páginas
  enableBadgeCount: boolean;          // Exibir/ocultar contador de obras no botão flutuante
  enableQuickIncrement: boolean;      // Exibir/ocultar botão rápido de "+1 capítulo" nos cards
  enableAutoTitleDetection: boolean;  // Preenchimento automático do título da aba
  enableAutoSync: boolean;            // Sincronização periódica automática em segundo plano
  blockedDomains: string[];           // Lista de sites onde o botão flutuante fica oculto
}
```

---

## 5. Especificação dos Componentes

### 5.1. Ícones da Extensão (`icons/`)
- **Arquivo Vetorial Master (`icons/icon.svg`):** Arquivo SVG vetorial editável contendo a geometria do símbolo `◈` com propriedades CSS para alteração imediata de cores (`#e8ff47` neon) e proporções.
- **Geração Automática de PNGs (`scripts/generate-icons.js`):** Script utilitário leve em Node.js (via canvas nativo ou SVG-to-PNG) que gera os 4 arquivos PNG compatíveis com o Chrome Manifest V3 (`16x16`, `32x32`, `48x48`, `128x128`). Dessa forma, basta alterar o SVG para redefinir as cores e tamanhos da marca.

### 5.2. Painel de Configurações e Toggles do Usuário (`popup.html` / `popup.js`)
- Botão de Configurações (`⚙`) com gaveta dedicada onde o usuário pode ligar/desligar individualmente cada recurso:
  - Toggle: **Botão flutuante nas páginas** (liga/desliga injeção in-page).
  - Toggle: **Contador no botão flutuante** (liga/desliga badge numérico).
  - Toggle: **Botão rápido "+1"** nos cards da lista.
  - Toggle: **Detecção automática de títulos** de abas.
  - Toggle: **Sincronização automática em nuvem**.
  - Lista de domínios bloqueados (ex: `google.com, youtube.com`).
  - Chave de sincronização em nuvem e botões de Backup (Exportar/Importar JSON).

### 5.3. Camada de Persistência Local (`storage-local.js`)
- **API Utilizada:** `chrome.storage.local`.
- **Chaves Utilizadas:**
  - `chapter_tracker_entries_v2`: Lista de objetos `TrackerEntry`.
  - `chapter_tracker_settings`: Objeto `AppSettings`.
- **Métodos Expostos:**
  - `getEntries(includeDeleted = false)`: Retorna entradas ativas (ou todas se para sync).
  - `saveEntry(entry)`: Cria ou atualiza por `id` ou por `name` normalizado; atualiza `updatedAt = Date.now()` e `syncStatus = 'pending'`.
  - `deleteEntry(id)`: Realiza soft-delete (`deleted = true`, `updatedAt = Date.now()`, `syncStatus = 'pending'`).
  - `quickIncrementChapter(id)`: Detecta o número no texto do capítulo (ex: "Cap. 104" -> "Cap. 105"), atualiza e salva.
  - `exportBackup()`: Gera string JSON para download.
  - `importBackup(jsonString)`: Valida e mescla dados importados sem perda de integridade.

### 5.4. Botão Flutuante In-Page (`content.js`)
- **Verificação de Permissão de Domínio:** Antes de injetar, consulta `chapter_tracker_settings`. Se o domínio atual estiver em `blockedDomains` ou se `enableFloatingButton === false`, interrompe a injeção.
- **Normalização e Detecção:**
  - Limpa sufixos do `document.title` (ex: ` - MangaDex`, ` | Ler Online`).
  - Consulta `storage-local.js` para verificar se existe entrada ativa com o mesmo nome normalizado.
- **Modo Atualização vs Modo Criação:**
  - Se a obra **já existir**:
    - O campo título exibe o nome existente e fica somente leitura (`readOnly`).
    - Exibe indicação: `"Continuando: [Nome da Obra]"`.
    - Ao salvar, localiza o item pelo ID original, atualiza o capítulo, data e URL, salvando sem criar card duplicado.
  - Se a obra **for nova**:
    - Permite editar o título, capítulo, categoria e cria novo registro.

### 5.5. Interface do Popup (`popup.html`, `popup.css`, `popup.js`)
- **Ações Rápidas por Card:**
  - Botão de abertura de URL (`↗`).
  - Botão de avanço rápido de capítulo (`+1`) que incrementa números automaticamente sem precisar abrir formulário.
  - Botão de edição (`✎`).
  - Botão de remoção (`✕`).
- **Barra de Ferramentas / Configurações:**
  - Botão de Nova Entrada (`＋`).
  - Botão de Configurações / Nuvem (`⚙`), revelando painel retrátil de configurações com todos os toggles do usuário.

### 5.6. Serviço de Sincronização em Nuvem (`sync-service.js`)
- **Protocolo:** Requisições HTTPS diretas para Supabase PostgREST (`/rest/v1/entries`).
- **Fluxo Bidirecional:**
  1. **Push:** Coleta todas as entradas locais com `syncStatus === 'pending'` e envia via `POST/PATCH` (upsert com base no `id`). Ao confirmar sucesso, marca `syncStatus = 'synced'`.
  2. **Pull:** Consulta entradas remotas onde `updated_at > lastSyncTime`. Para cada registro remoto:
     - Se não existir localmente e `deleted === false`: insere localmente.
     - Se existir localmente: compara `updatedAt`. Se remoto for mais recente, atualiza localmente.
  3. **Purge:** Limpeza física local de itens marcados como `deleted` após garantia de que a deleção foi propagada para a nuvem.

### 5.7. Service Worker (`background.js`)
- Cria alarme via `chrome.alarms` para disparo a cada 15 minutos (`"chapter_tracker_sync_alarm"`).
- Ao disparar o alarme ou ao iniciar o navegador (`chrome.runtime.onStartup`), executa a rotina `syncAll()` do `sync-service.js` em segundo plano se a chave de sincronização e o toggle `enableAutoSync` estiverem ativos.

---

## 6. Validação e Estratégia de Testes

1. **Testes de Instalação e Carregamento:**
   - Carregar extensão descompactada em `chrome://extensions/` e `edge://extensions/` sem avisos ou erros no console de extensões.
   - Ícones visíveis na barra de ferramentas e no gerenciador.
2. **Testes de Persistência Local:**
   - Cadastro de 50 obras simuladas com URLs extensas para certificar que o limite do storage local não é atingido.
   - Teste de busca por texto filtrando nomes e capítulos.
3. **Testes do Botão Flutuante (In-Page):**
   - Abertura de página de mangá simulada.
   - Clique no botão flutuante e registro do primeiro capítulo.
   - Navegação para o capítulo seguinte: verificar se a extensão detecta `"Continuando"` e atualiza o mesmo card, sem gerar duplicata.
4. **Testes de Incremento Rápido (+1):**
   - Entradas no formato "Cap. 10", "Capítulo 45.5", "Episódio 12" -> verificar cálculo de incremento.
5. **Testes de Backup e Restauração:**
   - Exportar JSON, limpar dados locais e importar JSON: integridade total mantida.
6. **Testes de Sincronização Cross-Browser:**
   - Cadastro de obras no Chrome, inserção da chave no Edge/Firefox -> sincronização instantânea dos mesmos dados.

---

## 7. Roteiro de Implementação em Fases

* **Fase 1 (Testes Imediatos e Estabilidade Local):**
  - Geração dos ícones (`icons/`).
  - Criação de `storage-local.js` e migração completa de `chrome.storage.sync` para `chrome.storage.local`.
  - Refatoração de `content.js` eliminando duplicações e respeitando configurações de domínio.
  - Atualização do popup (`popup.js`, `popup.html`, `popup.css`) com botão "+1" e export/import JSON.
  - Limpeza de dependências inúteis no `package.json`.
* **Fase 2 (Sincronização em Nuvem e Publicação):**
  - Criação de `sync-service.js` com suporte a Supabase REST.
  - Painel de configurações no popup para inserção da Chave de Sincronização.
  - Configuração do alarme periódico no `background.js`.
  - Validação das políticas da Chrome Web Store e criação da documentação de privacidade.
