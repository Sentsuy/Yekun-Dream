const assert = require('assert');

// Mock chrome environment
global.chrome = {
  runtime: {
    getManifest: () => ({ version: '1.2.0' })
  }
};

const { FeedbackService } = require('../feedback-service');

(async function runTests() {
  console.log('1. Testing payload validation...');
  
  // Categoria inválida
  const invalidCat = FeedbackService.validatePayload({ category: 'invalid', message: 'Teste válido' });
  assert.strictEqual(invalidCat.valid, false);
  assert.ok(invalidCat.error.includes('Categoria'));

  // Mensagem muito curta (< 5)
  const shortMsg = FeedbackService.validatePayload({ category: 'site_mapping', message: 'Oi' });
  assert.strictEqual(shortMsg.valid, false);
  assert.ok(shortMsg.error.includes('5'));

  // Mensagem muito longa (> 300)
  const longMsgText = 'A'.repeat(301);
  const longMsg = FeedbackService.validatePayload({ category: 'bug_report', message: longMsgText });
  assert.strictEqual(longMsg.valid, false);
  assert.ok(longMsg.error.includes('300'));

  // Mensagem no limite exato (300)
  const exact300 = 'B'.repeat(300);
  const valid300 = FeedbackService.validatePayload({ category: 'suggestion', message: exact300 });
  assert.strictEqual(valid300.valid, true);

  console.log('2. Testing browser info helper...');
  const bInfo = FeedbackService.getBrowserInfo();
  assert.ok(typeof bInfo === 'string' && bInfo.length > 0);

  console.log('3. Testing submitFeedback with mocked fetch...');
  const originalFetch = global.fetch;
  let capturedBody = null;
  global.fetch = async (url, opts) => {
    if (url.includes('submit_feedback')) {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          report_id: 'rep_123',
          message: 'Feedback recebido com sucesso!'
        })
      };
    }
    return { ok: false, text: async () => 'Not found' };
  };

  const res = await FeedbackService.submitFeedback(
    { supabaseUrl: 'https://mock.supabase.co', supabaseKey: 'mock-key' },
    {
      category: 'site_mapping',
      message: 'Por favor mapeiem o site mangaschan.com',
      siteUrl: 'https://mangaschan.com/manga/solo-leveling/cap-10',
      detectedTitle: 'Solo Leveling',
      detectedChapter: 'Cap. 10',
      userEmail: 'user@test.com'
    }
  );

  assert.strictEqual(res.success, true);
  assert.strictEqual(capturedBody.p_category, 'site_mapping');
  assert.strictEqual(capturedBody.p_message, 'Por favor mapeiem o site mangaschan.com');
  assert.strictEqual(capturedBody.p_site_url, 'https://mangaschan.com/manga/solo-leveling/cap-10');
  assert.strictEqual(capturedBody.p_detected_title, 'Solo Leveling');
  assert.strictEqual(capturedBody.p_detected_chapter, 'Cap. 10');
  assert.strictEqual(capturedBody.p_user_email, 'user@test.com');
  assert.strictEqual(capturedBody.p_extension_version, '1.2.0');

  // Teste de rejeição precoce sem chamar fetch
  capturedBody = null;
  const invalidRes = await FeedbackService.submitFeedback(
    { supabaseUrl: 'https://mock.supabase.co', supabaseKey: 'mock-key' },
    { category: 'site_mapping', message: 'abc' }
  );
  assert.strictEqual(invalidRes.success, false);
  assert.strictEqual(capturedBody, null, 'Fetch não deve ser chamado se o payload for inválido');

  global.fetch = originalFetch;

  console.log('✓ test-feedback-service passed');
  process.exit(0);
})();
