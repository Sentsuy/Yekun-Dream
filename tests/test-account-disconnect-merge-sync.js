const assert = require('assert');
const { StorageLocal } = require('../storage-local');
const { SyncService } = require('../sync-service');
const { IdentityService } = require('../identity-service');

console.log('Testing Account Disconnect, Multi-Account Sync Gate & Anti-Duplication Merge...');

const V3_KEY = 'chapter_tracker_entries_v3';

// ── Setup Mock Environment ──────────────────────────────────
const mockStorage = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => { if (mockStorage[k] !== undefined) res[k] = mockStorage[k]; });
        } else if (typeof keys === 'string') {
          if (mockStorage[keys] !== undefined) res[keys] = mockStorage[keys];
        } else if (typeof keys === 'object' && keys !== null) {
          Object.keys(keys).forEach(k => {
            res[k] = mockStorage[k] !== undefined ? mockStorage[k] : keys[k];
          });
        }
        cb(res);
      },
      set: (obj, cb) => {
        Object.assign(mockStorage, obj);
        if (cb) cb();
      },
      remove: (keys, cb) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => delete mockStorage[k]);
        if (cb) cb();
      }
    }
  }
};

(async () => {
  // ── 1. Teste de mergeWorkData: Junta Capítulos e Sites sem Duplicar ──
  console.log('1. Testing StorageLocal.mergeWorkData (Sites & Chapters unification)...');
  const targetWork = {
    id: 'work_local_1',
    name: 'Solo Leveling',
    mainChapter: 'Cap. 10',
    tag: 'manga',
    lastReadSourceId: 'src_1',
    updatedAt: 1000,
    sources: [
      { id: 'src_1', siteName: 'Scan Alpha', domain: 'alpha.com', url: 'https://alpha.com/solo/10', chapter: 'Cap. 10', updatedAt: 1000 }
    ],
    history: [
      { id: 'h1', chapter: 'Cap. 10', url: 'https://alpha.com/solo/10', timestamp: 1000 }
    ],
    aliases: ['Ore dake Level Up']
  };

  const incomingWork = {
    id: 'work_remote_99',
    name: 'Solo Leveling',
    mainChapter: 'Cap. 15',
    tag: 'manga',
    lastReadSourceId: 'src_remote_2',
    updatedAt: 2000,
    sources: [
      { id: 'src_remote_2', siteName: 'Scan Beta', domain: 'beta.com', url: 'https://beta.com/solo/15', chapter: 'Cap. 15', updatedAt: 2000 }
    ],
    history: [
      { id: 'h2', chapter: 'Cap. 15', url: 'https://beta.com/solo/15', timestamp: 2000 }
    ],
    aliases: ['Na Honjaman Level Up']
  };

  const merged = StorageLocal.mergeWorkData(targetWork, incomingWork);

  // Deve manter o mesmo id original local
  assert.strictEqual(merged.id, 'work_local_1');
  // Deve ter reunido as DUAS fontes (Scan Alpha e Scan Beta)
  assert.strictEqual(merged.sources.length, 2);
  assert.ok(merged.sources.some(s => s.domain === 'alpha.com'));
  assert.ok(merged.sources.some(s => s.domain === 'beta.com'));
  // O capítulo principal deve ser o mais recente (Cap. 15)
  assert.strictEqual(merged.mainChapter, 'Cap. 15');
  // Aliases devem conter ambos sem repetição
  assert.strictEqual(merged.aliases.length, 2);
  assert.ok(merged.aliases.includes('Ore dake Level Up'));
  assert.ok(merged.aliases.includes('Na Honjaman Level Up'));
  // Histórico deve conter ambos
  assert.strictEqual(merged.history.length, 2);
  console.log('  ✓ mergeWorkData unificou sites e capítulos com sucesso!');

  // ── 2. Teste de markAllWorksPendingSync ──────────────────────
  console.log('2. Testing markAllWorksPendingSync...');
  mockStorage[V3_KEY] = [
    { id: 'w1', name: 'Work 1', syncStatus: 'synced', sources: [] },
    { id: 'w2', name: 'Work 2', syncStatus: 'pending', sources: [] }
  ];
  StorageLocal._v3MigrationDone = true;

  const count = await StorageLocal.markAllWorksPendingSync();
  assert.strictEqual(count, 2);
  assert.strictEqual(mockStorage[V3_KEY][0].syncStatus, 'pending');
  assert.strictEqual(mockStorage[V3_KEY][1].syncStatus, 'pending');
  console.log('  ✓ markAllWorksPendingSync marcou todas as obras como pending!');

  // ── 3. Teste de Desconexão: Preserva Obras e Grava E-mail Anterior ──
  console.log('3. Testing IdentityService.signOutGoogle (Disconnect preserves works)...');
  await IdentityService.setCustomProEmail('user1@gmail.com', 'google');
  const idInfoBefore = await IdentityService.getIdentityInfo();
  assert.strictEqual(idInfoBefore.email, 'user1@gmail.com');

  // As obras já existem no storage
  assert.strictEqual(mockStorage[V3_KEY].length, 2);

  // Desconecta a conta
  const signOutRes = await IdentityService.signOutGoogle();
  assert.strictEqual(signOutRes.success, true);

  // Obras locais permanecem 100% intactas!
  assert.strictEqual(mockStorage[V3_KEY].length, 2);
  assert.strictEqual(mockStorage[V3_KEY][0].name, 'Work 1');

  // E-mail anterior desconectado foi gravado para detecção de troca de conta
  const lastDisconnected = await IdentityService.getLastDisconnectedEmail();
  assert.strictEqual(lastDisconnected, 'user1@gmail.com');

  // Credenciais ativas foram limpas
  const idInfoAfter = await IdentityService.getIdentityInfo();
  assert.strictEqual(idInfoAfter.email, '');
  console.log('  ✓ Desconexão preservou obras e registrou e-mail anterior!');

  // ── 4. Teste de pullRemote: Anti-Duplicação na Sincronização ──
  console.log('4. Testing SyncService.pullRemote anti-duplication by title/alias...');
  mockStorage[V3_KEY] = [
    {
      id: 'local_frieren',
      name: 'Sousou no Frieren',
      mainChapter: 'Cap. 50',
      updatedAt: 1000,
      sources: [{ id: 's1', siteName: 'Scan Local', domain: 'scanlocal.com', chapter: 'Cap. 50', updatedAt: 1000 }],
      history: []
    }
  ];

  // Simula fetch retornando obra da conta 2 com título idêntico mas ID diferente
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.includes('/rest/v1/entries')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'remote_different_id_999',
            name: 'Sousou no Frieren',
            chapter: 'Cap. 65',
            updated_at: 2000,
            sources: JSON.stringify([{ id: 's_rem', siteName: 'Scan Remota', domain: 'scanremota.com', chapter: 'Cap. 65', updatedAt: 2000 }]),
            history: JSON.stringify([{ chapter: 'Cap. 65', timestamp: 2000 }])
          }
        ]
      };
    }
    return { ok: false };
  };

  // Mock getClientConfig para simular PRO ativo na Conta 2
  SyncService.getClientConfig = async () => ({
    isPro: true,
    syncKey: 'user2@gmail.com',
    supabaseUrl: 'https://mock.supabase.co',
    supabaseKey: 'mock-key',
    proEmail: 'user2@gmail.com'
  });

  const pullRes = await SyncService.pullRemote();
  assert.strictEqual(pullRes.pulled, 1);

  // NÃO pode haver 2 obras no array! Deve existir apenas UMA obra mesclada:
  const finalWorks = mockStorage[V3_KEY];
  assert.strictEqual(finalWorks.length, 1, 'NÃO deve duplicar a obra por ter ID diferente!');
  assert.strictEqual(finalWorks[0].name, 'Sousou no Frieren');
  assert.strictEqual(finalWorks[0].mainChapter, 'Cap. 65', 'Deve ter atualizado para o capítulo mais recente');
  assert.strictEqual(finalWorks[0].sources.length, 2, 'Deve ter unificado os dois sites/fontes!');

  global.fetch = originalFetch;
  console.log('  ✓ pullRemote evitou duplicação e mesclou fontes e capítulos com perfeição!');

  // ── 5. Teste de Botão de Cabeçalho e 2FA Google Authenticator Opcional ──
  console.log('5. Testing Header Auth Button & Google Authenticator 2FA...');
  const fs = require('fs');
  const path = require('path');
  const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');

  // Verifica que o botão #btnHeaderAuth está localizado antes do sino #btnNotifications no header
  const headerIdx = popupHtml.indexOf('class="header-actions"');
  const btnHeaderAuthIdx = popupHtml.indexOf('id="btnHeaderAuth"', headerIdx);
  const btnNotifIdx = popupHtml.indexOf('id="btnNotifications"', headerIdx);
  assert.ok(btnHeaderAuthIdx !== -1 && btnNotifIdx !== -1, 'Ambos os botões devem existir no header');
  assert.ok(btnHeaderAuthIdx < btnNotifIdx, '#btnHeaderAuth deve vir antes (à esquerda) de #btnNotifications');

  // Verifica URL do Google Authenticator formatada com padrão otpauth://
  const testTotpUrl = IdentityService.Totp.getOtpAuthUrl('leitor@gmail.com', 'JBSWY3DPEHPK3PXP');
  assert.ok(testTotpUrl.startsWith('otpauth://totp/'), 'Deve iniciar com protocolo otpauth://totp/');
  assert.ok(testTotpUrl.includes('secret=JBSWY3DPEHPK3PXP'), 'Deve incluir o secret base32');
  assert.ok(testTotpUrl.includes('issuer=Yekun%20Dream'), 'Deve definir Yekun Dream como issuer');
  assert.ok(testTotpUrl.includes('leitor%40gmail.com'), 'Deve conter e-mail codificado');

  // Verifica setupTotp
  const totpSetup = await IdentityService.setupTotp('leitor@gmail.com');
  assert.strictEqual(totpSetup.secret.length, 16);
  assert.ok(totpSetup.qrUrl.startsWith('data:image/') || totpSetup.qrUrl.includes('api.qrserver.com'), 'Deve gerar Data URI ou URL para o QR Code');
  assert.ok(typeof totpSetup.svg === 'string' && totpSetup.svg.includes('<svg'), 'Deve gerar SVG vetorial local para o QR Code');

  // Verifica elementos e layout do QR Code no popup.html e popup.css
  assert.ok(popupHtml.includes('id="proTotpQrWrap"'), 'popup.html deve conter #proTotpQrWrap');
  assert.ok(popupHtml.includes('id="proTotpQrHint"'), 'popup.html deve conter #proTotpQrHint');
  const qrWrapPos = popupHtml.indexOf('id="proTotpQrWrap"');
  const qrHintPos = popupHtml.indexOf('id="proTotpQrHint"');
  assert.ok(qrWrapPos !== -1 && qrHintPos !== -1 && qrWrapPos < qrHintPos, '#proTotpQrHint deve estar posicionado abaixo de #proTotpQrWrap');

  const popupCss = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
  assert.ok(popupCss.includes('.pro-totp-qr-hint'), 'popup.css deve estilizar .pro-totp-qr-hint');
  assert.ok(popupCss.includes('.pro-totp-qr-wrap svg'), 'popup.css deve conter estilos para SVG vetorial em .pro-totp-qr-wrap');

  // Ativação opcional com verificação de token
  const validToken = await IdentityService.Totp.generateToken(totpSetup.secret);
  const enableRes = await IdentityService.verifyAndEnableTotp({}, 'leitor@gmail.com', totpSetup.secret, validToken);
  assert.strictEqual(enableRes.success, true);
  const credsWithTotp = await IdentityService.getStoredCredentials();
  assert.strictEqual(credsWithTotp.totpEnabled, true);

  // Desativação
  await IdentityService.disableTotp();
  const credsDisabled = await IdentityService.getStoredCredentials();
  assert.strictEqual(credsDisabled.totpEnabled, false);

  // Verifica modalConfirmDisconnect no HTML
  assert.ok(popupHtml.includes('id="modalConfirmDisconnect"'), 'popup.html deve conter #modalConfirmDisconnect');
  assert.ok(popupHtml.includes('id="btnConfirmDisconnectAccount"'), 'popup.html deve conter #btnConfirmDisconnectAccount');

  // Verifica persistência de desconexão (isUserSignedOut / setUserSignedOut)
  await IdentityService.setUserSignedOut(true);
  const signedOut = await IdentityService.isUserSignedOut();
  assert.strictEqual(signedOut, true, 'isUserSignedOut deve ser true');
  const emptyInfo = await IdentityService.getIdentityInfo();
  assert.strictEqual(emptyInfo.email, '', 'getIdentityInfo deve permanecer vazio quando desconectado');

  console.log('  ✓ Botão do cabeçalho, modal de confirmação e fluxo 2FA opcional validados com sucesso!');

  console.log('✓ All Account Disconnect, Anti-Duplication & Header 2FA tests passed successfully!');
  process.exit(0);
})();
