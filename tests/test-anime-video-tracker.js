const assert = require('assert');

// Test Suite: Yekun Dream - Anime Video Tracker Engine (70% progress)
const contentModule = require('../content.js');
const YekunVideoTracker = contentModule.YekunVideoTracker;

class MockVideo {
  constructor(duration = 1440) {
    this.duration = duration;
    this.currentTime = 0;
    this.paused = true;
    this.currentSrc = 'https://anime-stream.example/ep1.mp4';
    this.listeners = {};
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  removeEventListener(event, fn) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    }
  }

  dispatchEvent(event) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn());
    }
  }

  play() {
    this.paused = false;
    this.dispatchEvent('play');
  }

  pause() {
    this.paused = true;
    this.dispatchEvent('pause');
  }

  seek(toSeconds) {
    this.currentTime = toSeconds;
    this.dispatchEvent('seeking');
    this.dispatchEvent('seeked');
  }

  progress(toSeconds, elapsedRealSeconds = 2) {
    this.currentTime = toSeconds;
    this.dispatchEvent('timeupdate');
  }

  finish() {
    this.currentTime = this.duration;
    this.dispatchEvent('ended');
  }
}

(async function runTests() {
  console.log('--- TEST 1: YekunVideoTracker definition and defaults ---');
  assert.ok(YekunVideoTracker, 'YekunVideoTracker must be exported from content.js');
  assert.strictEqual(YekunVideoTracker.targetRatio, 0.70, 'Target ratio must be 70%');
  assert.strictEqual(YekunVideoTracker.minPlayedSeconds, 120, 'Minimum played time must be 120s (2 min)');
  assert.strictEqual(YekunVideoTracker.minDurationSeconds, 60, 'Minimum duration must be 60s');
  assert.strictEqual(YekunVideoTracker.checkThrottleMs, 2000, 'Check throttle must be 2000ms');

  console.log('--- TEST 2: Normal watching with Opening Skip (0:00 -> 2:00) ---');
  {
    const video = new MockVideo(1440); // 24 minutos
    let triggered = false;
    let triggerData = null;

    YekunVideoTracker.reset();
    YekunVideoTracker.attach(video, (data) => {
      triggered = true;
      triggerData = data;
    });

    // Inicia vídeo
    video.play();

    // Simula pulo de abertura aos 10s para 120s
    YekunVideoTracker.simulatePlayTime(video, 10); // 10s tocados
    video.seek(120); // pula abertura para 2 min

    // Toca continuamente por 150 segundos reais
    YekunVideoTracker.simulatePlayTime(video, 150); // total 160s tocados (> 120s)
    video.progress(500); // 500s de vídeo (ainda < 70%)
    assert.strictEqual(triggered, false, 'Não deve disparar antes de 70%');

    // Avança para 70% do vídeo (1008s de 1440s)
    YekunVideoTracker.simulatePlayTime(video, 50); // mais 50s tocados
    video.progress(1008); // 70% exato

    assert.strictEqual(triggered, true, 'Deve disparar aos 70% com pulo de abertura');
    assert.ok(triggerData.ratio >= 0.70, 'Ratio deve ser >= 70%');
    assert.ok(triggerData.playedSeconds >= 120, 'Tempo tocado deve ser >= 120s');

    // Continua tocando após disparar: NÃO deve disparar novamente (idempotência)
    let secondTrigger = false;
    YekunVideoTracker.attach(video, () => { secondTrigger = true; });
    video.progress(1200);
    assert.strictEqual(secondTrigger, false, 'Não deve disparar novamente na mesma sessão');
  }

  console.log('--- TEST 3: Anti-Seek Guard (salto acidental para 80% sem assistir) ---');
  {
    const video = new MockVideo(1440);
    let triggered = false;

    YekunVideoTracker.reset();
    YekunVideoTracker.attach(video, () => { triggered = true; });

    video.play();
    YekunVideoTracker.simulatePlayTime(video, 5); // apenas 5 segundos tocados
    video.seek(1200); // saltou para mais de 80%
    video.progress(1200);

    assert.strictEqual(triggered, false, 'Não deve disparar se tempo real tocado for < 120s');

    // Agora o usuário assiste de fato por mais 120s
    YekunVideoTracker.simulatePlayTime(video, 120);
    video.progress(1250);
    assert.strictEqual(triggered, true, 'Deve disparar assim que acumular os 120s reais');
  }

  console.log('--- TEST 4: Anti-Ad Guard (vídeo curto < 60s) ---');
  {
    const shortVideo = new MockVideo(30); // 30s propaganda
    let triggered = false;

    YekunVideoTracker.reset();
    YekunVideoTracker.attach(shortVideo, () => { triggered = true; });

    shortVideo.play();
    YekunVideoTracker.simulatePlayTime(shortVideo, 25);
    shortVideo.progress(25);
    shortVideo.finish();

    assert.strictEqual(triggered, false, 'Vídeos de propaganda < 60s devem ser ignorados');
  }

  console.log('--- TEST 5: Fallback no evento ended (com reprodução válida) ---');
  {
    const video = new MockVideo(120); // curta de 2 minutos
    let triggered = false;

    YekunVideoTracker.reset();
    YekunVideoTracker.attach(video, () => { triggered = true; });

    video.play();
    YekunVideoTracker.simulatePlayTime(video, 65); // assistiu mais de 60s
    video.finish(); // terminou antes dos 70%

    assert.strictEqual(triggered, true, 'Deve disparar no ended quando playedSeconds >= 60');
  }

  console.log('--- TEST 6: Reset automático na troca de episódio (src change) ---');
  {
    const video = new MockVideo(1440);
    let triggerCount = 0;

    YekunVideoTracker.reset();
    YekunVideoTracker.attach(video, () => { triggerCount++; });

    video.play();
    YekunVideoTracker.simulatePlayTime(video, 130);
    video.progress(1010);
    assert.strictEqual(triggerCount, 1, 'Primeiro episódio computado');

    // Novo episódio (troca de URL/src)
    video.currentSrc = 'https://anime-stream.example/ep2.mp4';
    video.currentTime = 0;
    YekunVideoTracker.onSourceChange(video);

    // Segundo episódio
    YekunVideoTracker.simulatePlayTime(video, 130);
    video.progress(1010);
    assert.strictEqual(triggerCount, 2, 'Segundo episódio computado após troca de src');
  }

  console.log('--- TEST 7: Manifest all_frames configuration ---');
  {
    const fs = require('fs');
    const path = require('path');
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8'));
    assert.ok(manifest.content_scripts, 'Manifest must have content_scripts');
    const cs = manifest.content_scripts[0];
    assert.strictEqual(cs.all_frames, true, 'content_scripts must have all_frames: true');
  }

  console.log('--- TEST 8: Cross-Frame Message Protocol & Idempotency ---');
  {
    const fs = require('fs');
    const path = require('path');
    const contentSource = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');

    assert.ok(contentSource.includes('YEKUN_VIDEO_PROGRESS_COMPLETED'), 'content.js must define or handle YEKUN_VIDEO_PROGRESS_COMPLETED');
    assert.ok(contentSource.includes('window.top === window') || contentSource.includes('window.top!==window') || contentSource.includes('isTopFrame'), 'content.js must check top frame vs iframe');
    assert.ok(contentSource.includes('autoSavedInSession') || contentSource.includes('autoTrack'), 'content.js must handle session idempotency or autoTrack');
  }

  console.log('✓ All anime video tracker tests passed successfully!');
})().catch(err => {
  console.error('FAIL in anime video tracker tests:', err);
  process.exit(1);
});
