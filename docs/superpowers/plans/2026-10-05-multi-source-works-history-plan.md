# Plano de Implementação: Obras Centralizadas, Múltiplas Fontes e Histórico de Leitura

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralizar o rastreamento na Obra (1:N com sites/fontes), registrar histórico de leitura cronológico, atualizar o botão in-page para vincular múltiplos sites e transformar o popup em cards com badges de sites e gaveta expansível de detalhes.

**Architecture:** A camada de persistência local (`storage-local.js`) passa a gerenciar `WorkEntry` contendo arrays aninhados de `sources` e `history`, com migração automática retrocompatível de v2 para v3. O script injetado (`content.js`) reconhece obras e vincula novos domínios sem duplicar cards. O popup (`popup.html`/`popup.js`) renderiza cards por obra com tags coloridas dos sites e accordion de fontes e histórico.

**Tech Stack:** JavaScript (ES2022 / Vanilla WebExtensions Manifest V3), Chrome Storage Local API, Shadow DOM isolado, Node.js para bateria de testes automatizados.

**Spec:** [`docs/superpowers/specs/2026-10-05-multi-source-works-history-design.md`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/docs/superpowers/specs/2026-10-05-multi-source-works-history-design.md)

---

## Global Constraints

- Manifest V3 sem frameworks pesados de terceiros no runtime do browser.
- Comunicação e logs da extensão em Português do Brasil (pt-BR).
- Persistência primária offline-first em `chrome.storage.local`.
- Migração transparente dos dados sem qualquer perda das obras salvas em v2.
- Limite máximo padrão de 50 entradas de histórico por obra para otimização de memória.

---

## Review Focus

1. **Migração v2 ➔ v3 com dados legados existentes:** O migrador deve converter perfeitamente uma entrada v2 simples em uma obra com 1 fonte e 1 histórico, sem sobrescrever `chapter_tracker_entries_v2`.
2. **Adição de novo site a uma obra existente via leitor (`content.js`):** Quando a obra já existe e o leitor está em um domínio inédito, deve adicionar a nova fonte ao array `sources` da mesma obra, sem criar um novo card de obra.
3. **Atualização de capítulo em fonte já existente:** Ao salvar no mesmo site, deve atualizar apenas o capítulo e data daquela fonte específica, atualizar o `mainChapter` global da obra e registrar uma nova entrada na timeline de histórico.
4. **Remoção de fonte individual vs remoção de obra completa:** Remover um site dentro do accordion não deve deletar a obra se ela ainda tiver outros sites. Se a última fonte for removida ou a obra excluída no card principal, aplica soft-delete (`deleted = true`).
5. **Busca e filtro no popup com dados aninhados:** A busca textual do popup deve filtrar tanto pelo nome da obra quanto pelos nomes dos sites cadastrados, capítulos ou URLs.

---

### Task 1: Camada de Armazenamento Local v3 e Motor de Migração (`storage-local.js`)

**Files:**
- Modify: `storage-local.js`
- Create: `tests/test-storage-v3.js`
- Modify: `tests/run-all-tests.js`

**Interfaces:**
- Consumes: `chrome.storage.local`
- Produces:
  - `StorageLocal.getWorks(includeDeleted?: boolean): Promise<WorkEntry[]>`
  - `StorageLocal.getWorkById(id: string): Promise<WorkEntry|null>`
  - `StorageLocal.findWorkByName(name: string): Promise<WorkEntry|null>`
  - `StorageLocal.saveWorkReading(payload: { workId?: string, workName: string, tag?: string, siteName?: string, domain?: string, url?: string, chapter: string }): Promise<WorkEntry>`
  - `StorageLocal.updateWorkDetails(id: string, updates: { name?: string, tag?: string }): Promise<WorkEntry>`
  - `StorageLocal.deleteWork(id: string): Promise<boolean>`
  - `StorageLocal.deleteSource(workId: string, sourceId: string): Promise<WorkEntry|null>`
  - `StorageLocal.quickIncrementWork(workId: string): Promise<WorkEntry|null>`
  - `StorageLocal.exportBackup(): Promise<string>`
  - `StorageLocal.importBackup(jsonString: string): Promise<number>`

- [ ] **Step 1: Escrever teste de falha para migração e persistência v3**

Criar `tests/test-storage-v3.js` testando a inicialização de dados legados v2, migração automática para v3, salvamento de leitura em múltiplos sites na mesma obra, limite do histórico e incremento rápido de capítulo.

- [ ] **Step 2: Executar teste e validar falha**

Run: `node tests/test-storage-v3.js`  
Expected: FAIL com métodos v3 não definidos ou chave v3 não encontrada.

- [ ] **Step 3: Implementar modelo v3, migração automática e métodos CRUD em `storage-local.js`**

Implementar:
- Constante `STORAGE_KEY_ENTRIES_V3 = 'chapter_tracker_entries_v3'`.
- Rotina `migrateV2ToV3IfNeeded()` executada antes de `getWorks()`.
- Utilitário `extractDomain(url)` e `formatSiteName(domain)`.
- `saveWorkReading()` que busca por `workId` ou nome normalizado, atualiza ou insere fonte em `sources`, atualiza `mainChapter`, `lastReadSourceId` e insere item em `history` (fatiado em até 50 itens).
- Preservar métodos legados `getEntries` apontando para compatibilidade retroativa.

- [ ] **Step 4: Executar teste e validar sucesso**

Run: `node tests/test-storage-v3.js`  
Expected: PASS com 100% dos testes de persistência, migração e multi-fontes passando.

- [ ] **Step 5: Commit**

```bash
git add storage-local.js tests/test-storage-v3.js tests/run-all-tests.js
git commit -m "feat: implement v3 multi-source works storage and auto-migration engine"
```

---

### Task 2: Detecção Inteligente e Associação de Fontes no Leitor (`content.js`)

**Files:**
- Modify: `content.js`
- Create: `tests/test-content-v3.js`

**Interfaces:**
- Consumes: `StorageLocal.getWorks()`, `StorageLocal.saveWorkReading()`, `StorageLocal.parseChapterIncrement()`
- Produces: In-page Floating Widget com reconhecimento de obra existente vs novo site

- [ ] **Step 1: Escrever teste de unidade para detecção de sites e obras no content script**

Criar `tests/test-content-v3.js` cobrindo:
- Extração limpa de título e de nome de site por domínio.
- Identificação de obra existente com fonte já conhecida.
- Identificação de obra existente com novo domínio/site a vincular.
- Criação de nova obra com primeiro site.

- [ ] **Step 2: Executar teste e validar falha**

Run: `node tests/test-content-v3.js`  
Expected: FAIL indicando lógica v3 ausente no content helper.

- [ ] **Step 3: Refatorar `content.js` com a lógica multi-fontes e Shadow DOM**

Atualizar `content.js`:
- Incluir campo/identificador visual do site atual (ex: `"Site: MangaDex"`).
- Ao abrir o painel: buscar obras via `StorageLocal.getWorks()`.
- Se obra existir:
  - Se domínio atual já é fonte da obra: status `"Continuando: [Nome] ([Site])"`, pré-preenche capítulo dessa fonte.
  - Se domínio atual for novo: status `"＋ Nova fonte para [Nome] detectada!"`, campo de capítulo limpo/pronto.
- Ao clicar em Salvar: chamar `StorageLocal.saveWorkReading()` passando dados da obra e da fonte.

- [ ] **Step 4: Executar testes de content e sintaxe**

Run: `node tests/test-content-v3.js && node --check content.js`  
Expected: PASS sem erros de execução e sintaxe válida.

- [ ] **Step 5: Commit**

```bash
git add content.js tests/test-content-v3.js
git commit -m "feat: enhance content script to link multiple sources per work"
```

---

### Task 3: Interface do Popup com Cards de Obras, Badges de Sites e Accordion (`popup.html`, `popup.css`, `popup.js`)

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`
- Modify: `popup.js`
- Create: `tests/test-popup-v3.js`

**Interfaces:**
- Consumes: `StorageLocal.getWorks()`, `StorageLocal.saveWorkReading()`, `StorageLocal.updateWorkDetails()`, `StorageLocal.deleteWork()`, `StorageLocal.deleteSource()`, `StorageLocal.quickIncrementWork()`
- Produces: Popup UI moderno com visualização por obra, chips de sites, gaveta retrátil de fontes e histórico

- [ ] **Step 1: Escrever teste de renderização e busca para Popup v3**

Criar `tests/test-popup-v3.js` verificando:
- Estruturação do card de obra contendo badges para cada fonte.
- Filtragem de busca por nome da obra, nome do site e capítulo.
- Alternância de visibilidade do accordion de fontes e histórico.

- [ ] **Step 2: Executar teste e validar falha**

Run: `node tests/test-popup-v3.js`  
Expected: FAIL com novos elementos visuais e comportamentos não implementados.

- [ ] **Step 3: Atualizar `popup.html` e `popup.css`**

- Adicionar estilos em `popup.css` para:
  - `.entry-sources-chips`: container com badges clicáveis de sites (`.source-chip`).
  - `.accordion-toggle`: botão retrátil com ícone indicador `▼`.
  - `.accordion-panel`: gaveta interna contendo abas "Fontes" e "Histórico".
  - `.source-item-row`: linha de cada site com botão de abrir (`↗`), editar (`✎`) e excluir (`✕`).
  - `.history-timeline`: lista cronológica com bolinhas e linhas conectadas.
- Atualizar o Drawer de formulário em `popup.html` para permitir cadastrar/editar obra e fontes.

- [ ] **Step 4: Atualizar `popup.js` com os manipuladores de eventos e renderização v3**

- Ajustar `renderList()` para iterar sobre `works` v3.
- Renderizar chips de cada site cadastrado no card. Clicar no chip abre a URL daquele site em nova aba.
- Implementar toggle do accordion exibindo fontes cadastradas e histórico de leituras.
- Adicionar botões de ação na fonte (abrir, editar, remover) e botão "＋ Adicionar Site".
- Atualizar busca para filtrar por nome da obra e por fontes cadastradas.

- [ ] **Step 5: Executar testes de popup e checagem de sintaxe**

Run: `node tests/test-popup-v3.js && node --check popup.js`  
Expected: PASS com testes aprovados e sintaxe 100% limpa.

- [ ] **Step 6: Commit**

```bash
git add popup.html popup.css popup.js tests/test-popup-v3.js
git commit -m "feat: add multi-source badges and expandable history drawer in popup"
```

---

### Task 4: Sincronização em Nuvem, Integração Completa e Bateria Geral de Testes

**Files:**
- Modify: `sync-service.js`
- Modify: `tests/run-all-tests.js`

**Interfaces:**
- Consumes: `StorageLocal.getWorks(true)`, PostgREST endpoint
- Produces: Sincronização compatível com schema v3 e suíte de testes completa

- [ ] **Step 1: Ajustar `sync-service.js` para persistir e mesclar obras v3**

Garantir que a sincronização em nuvem sincronize a chave `chapter_tracker_entries_v3` com suporte aos campos aninhados `sources` e `history`.

- [ ] **Step 2: Atualizar `tests/run-all-tests.js` com todas as novas suítes**

Integrar:
- `test-storage-v3.js`
- `test-content-v3.js`
- `test-popup-v3.js`
- Verificações de sintaxe de todos os arquivos do projeto.

- [ ] **Step 3: Executar a suíte de testes unificada completa**

Run: `npm test`  
Expected: PASS em todos os testes (100% de sucesso).

- [ ] **Step 4: Commit**

```bash
git add sync-service.js tests/run-all-tests.js
git commit -m "feat: finalize v3 cloud sync and integrate full test runner"
```
