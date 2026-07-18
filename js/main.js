// ============================================================================
// main.js — orchestration + animation loop
// ============================================================================

(function () {
 try {
  if (typeof THREE === "undefined") throw new Error("THREE is undefined — three.js did not load.");

  const rng = mulberry32(1337);
  const settings = UI.getSettings();
  UI.applySettingsToInputs();
  UI.initControls();

  const sceneCtx = new SceneCtx(document.getElementById("scene"));
  sceneCtx.setMode(settings.camera);
  sceneCtx.applyNight(settings.night, true);

  const road = buildRoad();
  sceneCtx.scene.add(road);
  const city = new City(sceneCtx.scene, rng);
  city.setNight(sceneCtx.night);
  city.update(0);

  const roadLeft = -ROAD_WIDTH / 2 + CURB + 0.15;
  const roadRight = ROAD_WIDTH / 2 - CURB - 0.15;

  const car = new Ambulance(laneCenterX(1), -PLAY_HALF_LEN + 40);
  car.maxSpeed = settings.maxSpeed / 3.6;
  sceneCtx.scene.add(car.group);
  inputController.bindCar(car);
  inputController.setAutopilot(settings.driver === "auto");

  const dopplerField = new DopplerField();
  const waveRingPool = new WaveRingPool(sceneCtx.scene);
  waveRingPool.setVisible(settings.showWaves);

  let listenerIdSeq = 1;
  const listeners = [];
  function saveListenerState() {
    try { localStorage.setItem("siren-lab-listeners", JSON.stringify(listeners.map(l => l.z))); } catch (e) {}
  }
  function loadListenerState() {
    try {
      const raw = localStorage.getItem("siren-lab-listeners");
      if (!raw) return null;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) && arr.length ? arr.slice(0, 6) : null;
    } catch (e) { return null; }
  }
  function addListener(z) {
    const L = new Listener(listenerIdSeq++, ROAD_WIDTH / 2 + 6, z ?? 0, listeners.length);
    listeners.push(L);
    sceneCtx.scene.add(L.group);
    UI.syncListeners(listeners);
    saveListenerState();
    return L;
  }
  function removeListener(id) {
    if (listeners.length <= 1) { bus.emit("listener-remove-denied", id); return; }
    const idx = listeners.findIndex(l => l.id === id);
    if (idx === -1) return;
    listeners[idx].dispose(sceneCtx.scene);
    listeners.splice(idx, 1);
    UI.syncListeners(listeners);
    saveListenerState();
  }
  const savedListenerZs = loadListenerState();
  if (savedListenerZs) savedListenerZs.forEach(z => addListener(clamp(z, -PLAY_HALF_LEN, PLAY_HALF_LEN)));
  else addListener(0);

  // ---------------------------------------------------------------- presets
  const PRESETS = {
    ambulance: { minFreq: 500, maxFreq: 700, maxSpeed: 144, soundSpeed: 343 },
    train: { minFreq: 120, maxFreq: 175, maxSpeed: 160, soundSpeed: 343 },
    f1: { minFreq: 900, maxFreq: 1450, maxSpeed: 320, soundSpeed: 343 },
    jet: { minFreq: 200, maxFreq: 260, maxSpeed: 320, soundSpeed: 220 },
  };

  // ---------------------------------------------------------------- state
  let running = true;
  let simClock = 0;
  let toneTimer = 0;
  let tone = "nee";
  let lastEmittedFreq = settings.maxFreq;
  const lastReceivedByListener = new Map();
  let autopilotState = "forward";
  let autopilotTurnDir = 1;
  let autopilotTurnRemaining = 0;

  UI.setPlayIcon(true);

  // ---------------------------------------------------------------- bus wiring
  bus.on("settings-changed", ({ key, value }) => {
    settings[key] = value;
    if (key === "maxSpeed") car.maxSpeed = value / 3.6;
    if (key === "audioEnabled") { audioEngine.setEnabled(value); if (!value) hideAudioHint(); }
    if (key === "volume") audioEngine.setVolume(value / 100);
    if (key === "showWaves") waveRingPool.setVisible(value);
  });

  bus.on("driver-changed", mode => {
    settings.driver = mode;
    inputController.setAutopilot(mode === "auto");
    autopilotState = "forward";
  });

  bus.on("camera-changed", mode => sceneCtx.setMode(mode));

  bus.on("preset-selected", name => {
    const p = PRESETS[name];
    if (!p) return;
    Object.entries(p).forEach(([k, v]) => UI.setSetting(k, v, true));
    car.maxSpeed = p.maxSpeed / 3.6;
    lastEmittedFreq = p.maxFreq;
  });

  bus.on("toggle-play", () => { running = !running; UI.setPlayIcon(running); });

  bus.on("reset-request", () => {
    car.resetPosition();
    car.x = laneCenterX(1); car.z = -PLAY_HALF_LEN + 40;
    dopplerField.clear();
    waveRingPool.clear();
    simClock = 0; toneTimer = 0; tone = "nee";
    autopilotState = "forward";
    lastReceivedByListener.clear();
    UI.resetAll();
  });

  bus.on("night-toggle", night => { sceneCtx.applyNight(night); city.setNight(night); });

  bus.on("listener-add-request", () => addListener(clamp((rng() - 0.5) * PLAY_HALF_LEN, -PLAY_HALF_LEN + 20, PLAY_HALF_LEN - 20)));
  bus.on("listener-remove-request", id => removeListener(id));
  bus.on("listener-move", ({ id, z }) => {
    const L = listeners.find(l => l.id === id);
    if (L) { L.setZ(z, 1 / 60); saveListenerState(); }
  });

  // first user gesture unlocks audio
  const audioHintEl = document.getElementById("audioHint");
  function hideAudioHint() { if (audioHintEl) audioHintEl.classList.remove("show"); }
  if (audioHintEl && settings.audioEnabled) {
    setTimeout(() => audioHintEl.classList.add("show"), 600);
  }
  ["pointerdown", "keydown"].forEach(evt => window.addEventListener(evt, () => {
    audioEngine.resume().then(hideAudioHint).catch(hideAudioHint);
  }, { once: true }));
  audioEngine.setEnabled(settings.audioEnabled);
  audioEngine.setVolume(settings.volume / 100);

  // ---------------------------------------------------------------- autopilot
  // Pre-step: decide this frame's control flags. Any state transition into
  // "turning" also seeds autopilotTurnRemaining; completion is measured from
  // the *actual* angle delta car.update() produces (see post-step below), so
  // there is no fragile target-angle comparison that could stall or spin.
  function driveAutopilotPre() {
    if (autopilotState === "forward") {
      car.controls.forward = true; car.controls.reverse = false;
      car.controls.left = false; car.controls.right = false;
      const headingPositive = Math.cos(car.angle) >= 0;
      if (headingPositive && car.z > PLAY_HALF_LEN - 40) {
        autopilotState = "turning"; autopilotTurnDir = 1; autopilotTurnRemaining = Math.PI;
        car.speed = clamp(car.speed, 4, 7); car.x = 0;
      } else if (!headingPositive && car.z < -PLAY_HALF_LEN + 40) {
        autopilotState = "turning"; autopilotTurnDir = -1; autopilotTurnRemaining = Math.PI;
        car.speed = clamp(Math.abs(car.speed), 4, 7); car.x = 0;
      }
    } else { // turning
      car.controls.forward = true; car.controls.reverse = false;
      car.controls.left = autopilotTurnDir > 0;
      car.controls.right = autopilotTurnDir < 0;
      car.speed = clamp(car.speed, 4, 7);
    }
  }

  // Post-step: called right after car.update() with the angle it had before
  // that update, so we can measure exactly how far it actually turned.
  function driveAutopilotPost(prevAngle) {
    if (autopilotState !== "turning") return;
    let delta = car.angle - prevAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    autopilotTurnRemaining -= Math.abs(delta);
    if (autopilotTurnRemaining <= 0) {
      autopilotState = "forward";
      car.controls.left = false; car.controls.right = false;
    }
  }

  // ---------------------------------------------------------------- main loop
  let prevT = nowMs();
  function frame() {
   try {
    const t = nowMs();
    let dt = (t - prevT) / 1000;
    prevT = t;
    dt = clamp(dt, 0, 0.05);

    if (running) {
      simClock += dt;

      if (settings.driver === "auto") driveAutopilotPre();
      const prevAngle = car.angle;
      const carState = car.update(dt, roadLeft, roadRight);
      city.update(car.z);
      city.animate(dt);
      if (settings.driver === "auto") driveAutopilotPost(prevAngle);

      toneTimer -= dt;
      if (toneTimer <= 0) {
        toneTimer = 0.62;
        tone = tone === "nee" ? "naw" : "nee";
        lastEmittedFreq = tone === "nee" ? settings.maxFreq : settings.minFreq;
        dopplerField.emit({
          x: car.x, z: car.z, sourceFreq: lastEmittedFreq, tone,
          sourceVel: { x: carState.vx, z: carState.vz },
          soundSpeed: settings.soundSpeed, emittedAt: simClock,
        });
        car.setToneFlash(tone);
      }

      dopplerField.update(dt);

      listeners.forEach((L, idx) => {
        L.updatePulse(dt);
        const hit = dopplerField.poll(L);
        if (hit) {
          L.pulse = 1;
          lastReceivedByListener.set(L.id, hit.frequency);
          UI.updateListenerFreq(L.id, fmt(hit.frequency, 0) + " Hz");
          UI.pushLog({ t: fmt(simClock, 1), f0: fmt(hit.event.sourceFreq, 0), f: fmt(hit.frequency, 0), df: fmt(hit.frequency - hit.event.sourceFreq, 0) });
          audioEngine.playTone(hit.frequency, hit.distance);
          if (idx === 0) {
            UI.updateFreqReadout(hit.event.sourceFreq, hit.frequency);
            const thetaDeg = Math.acos(clamp(hit.vSrcTowardListener / Math.max(1e-3, Math.hypot(carState.vx, carState.vz) || 1), -1, 1)) * 180 / Math.PI;
            UI.updateFormula(settings.soundSpeed, hit.vSrcTowardListener, isFinite(thetaDeg) ? thetaDeg : 0, "Mic 1");
          }
        }
      });

      UI.pushChartPoint(simClock, lastEmittedFreq, lastReceivedByListener.get(listeners[0]?.id) ?? null);
      waveRingPool.sync(dopplerField.events, settings.showLabels);
    }

    sceneCtx.updateCamera({ x: car.x, z: car.z }, car.angle, dt);

    UI.drawScope(audioEngine.getWaveform());
    UI.drawChart(simClock, settings.minFreq, settings.maxFreq);
    const mapData = {
      car: { x: car.x, z: car.z, angle: car.angle },
      listeners, waveEvents: dopplerField.events, roadWidth: ROAD_WIDTH,
      avenueOffset: AVENUE_OFFSET, crossStreets: city.crossStreetsNear(car.z, PLAY_HALF_LEN * 1.7), traffic: city.listTraffic(),
    };
    UI.drawMinimap(mapData);
    if (UI.isMapOpen()) UI.drawBigMap(mapData);
    const vsMax = settings.maxSpeed / 3.6;
    const maxShiftRef = settings.maxFreq * settings.soundSpeed / Math.max(30, settings.soundSpeed - vsMax) - settings.maxFreq;
    UI.updateGauges(Math.abs(car.speed) * 3.6, settings.maxSpeed,
      (lastReceivedByListener.get(listeners[0]?.id) ?? lastEmittedFreq) - lastEmittedFreq,
      Math.max(40, maxShiftRef));

    sceneCtx.render();
    requestAnimationFrame(frame);
   } catch (err) {
    console.error(err);
    if (window.__sirenFatal) window.__sirenFatal((err && err.message) || String(err));
   }
  }

  requestAnimationFrame(() => { UI.hideLoadScreen(); requestAnimationFrame(frame); });
 } catch (err) {
  console.error(err);
  if (window.__sirenFatal) window.__sirenFatal((err && err.message) || String(err));
 }
})();
