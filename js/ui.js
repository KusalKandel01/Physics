// ============================================================================
// ui.js — all DOM wiring & 2D HUD drawing (oscilloscope / chart / minimap).
// Talks to the rest of the app only through `bus` events + the UI namespace.
// ============================================================================

const PLAY_HALF_LEN = 900;

const DEFAULT_SETTINGS = {
  minFreq: 500, maxFreq: 700, maxSpeed: 144, soundSpeed: 343,
  showWaves: true, showLabels: true, audioEnabled: true, volume: 55,
  driver: "auto", camera: "chase", night: true,
};

const UI = (() => {
  const $ = id => document.getElementById(id);

  const el = {
    minFreq: $("minFreq"), minFreqOut: $("minFreqOut"),
    maxFreq: $("maxFreq"), maxFreqOut: $("maxFreqOut"),
    maxSpeed: $("maxSpeed"), maxSpeedOut: $("maxSpeedOut"),
    soundSpeed: $("soundSpeed"), soundSpeedOut: $("soundSpeedOut"),
    volume: $("volume"), volumeOut: $("volumeOut"),
    toggleWaves: $("toggleWaves"), toggleLabels: $("toggleLabels"), toggleAudio: $("toggleAudio"),
    driverSeg: $("driverSeg"), cameraSeg: $("cameraSeg"), presetGrid: $("presetGrid"),
    listenerList: $("listenerList"), listenerCount: $("listenerCount"), btnAddListener: $("btnAddListener"),
    speedValue: $("speedValue"), gaugeSpeedArc: $("gaugeSpeedArc"),
    shiftValue: $("shiftValue"), gaugeShiftArc: $("gaugeShiftArc"),
    emittedFreqValue: $("emittedFreqValue"), receivedFreqValue: $("receivedFreqValue"),
    formulaVars: $("formulaVars"),
    logTableBody: $("logTableBody"), btnExportCsv: $("btnExportCsv"),
    scopeCanvas: $("scopeCanvas"), chartCanvas: $("chartCanvas"), minimap: $("minimap"),
    btnExpandMap: $("btnExpandMap"), btnOpenMap: $("btnOpenMap"), mapModal: $("mapModal"),
    btnCloseMap: $("btnCloseMap"), bigMap: $("bigMap"),
    btnPlayPause: $("btnPlayPause"), iconPlay: $("iconPlay"), iconPause: $("iconPause"),
    btnReset: $("btnReset"), btnTheme: $("btnTheme"), btnHelp: $("btnHelp"), btnCloseHelp: $("btnCloseHelp"),
    helpModal: $("helpModal"), btnMenuToggle: $("btnMenuToggle"),
    loadScreen: $("loadScreen"),
  };

  const scopeCtx = el.scopeCanvas.getContext("2d");
  const chartCtx = el.chartCanvas.getContext("2d");
  const mapCtx = el.minimap.getContext("2d");
  const bigMapCtx = el.bigMap.getContext("2d");

  let logRows = [];
  const chartHistory = [];
  const CHART_WINDOW = 14; // seconds

  // ---------------------------------------------------------------- settings persistence
  function loadSettings() {
    try {
      const raw = localStorage.getItem("siren-lab-settings");
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { return { ...DEFAULT_SETTINGS }; }
  }
  function saveSettings(s) {
    try { localStorage.setItem("siren-lab-settings", JSON.stringify(s)); } catch {}
  }

  let settings = loadSettings();

  function applySettingsToInputs() {
    el.minFreq.value = settings.minFreq; el.minFreqOut.textContent = settings.minFreq;
    el.maxFreq.value = settings.maxFreq; el.maxFreqOut.textContent = settings.maxFreq;
    el.maxSpeed.value = settings.maxSpeed; el.maxSpeedOut.textContent = settings.maxSpeed;
    el.soundSpeed.value = settings.soundSpeed; el.soundSpeedOut.textContent = settings.soundSpeed;
    el.volume.value = settings.volume; el.volumeOut.textContent = settings.volume;
    el.toggleWaves.checked = settings.showWaves;
    el.toggleLabels.checked = settings.showLabels;
    el.toggleAudio.checked = settings.audioEnabled;
    setSegActive(el.driverSeg, settings.driver, "drive");
    setSegActive(el.cameraSeg, settings.camera, "cam");
    document.body.classList.toggle("day", !settings.night);
  }

  function setSegActive(seg, value, attr) {
    seg.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset[attr] === value));
  }

  // ---------------------------------------------------------------- slider wiring
  function slider(inputEl, outEl, key, cast = Number) {
    inputEl.addEventListener("input", () => {
      const v = cast(inputEl.value);
      outEl.textContent = v;
      settings[key] = v;
      saveSettings(settings);
      bus.emit("settings-changed", { key, value: v, all: settings });
    });
  }

  function initControls() {
    slider(el.minFreq, el.minFreqOut, "minFreq");
    slider(el.maxFreq, el.maxFreqOut, "maxFreq");
    slider(el.maxSpeed, el.maxSpeedOut, "maxSpeed");
    slider(el.soundSpeed, el.soundSpeedOut, "soundSpeed");
    slider(el.volume, el.volumeOut, "volume");

    el.toggleWaves.addEventListener("change", () => { settings.showWaves = el.toggleWaves.checked; saveSettings(settings); bus.emit("settings-changed", { key: "showWaves", value: settings.showWaves, all: settings }); });
    el.toggleLabels.addEventListener("change", () => { settings.showLabels = el.toggleLabels.checked; saveSettings(settings); bus.emit("settings-changed", { key: "showLabels", value: settings.showLabels, all: settings }); });
    el.toggleAudio.addEventListener("change", () => { settings.audioEnabled = el.toggleAudio.checked; saveSettings(settings); bus.emit("settings-changed", { key: "audioEnabled", value: settings.audioEnabled, all: settings }); });

    el.driverSeg.addEventListener("click", e => {
      const btn = e.target.closest("button"); if (!btn) return;
      setSegActive(el.driverSeg, btn.dataset.drive, "drive");
      settings.driver = btn.dataset.drive; saveSettings(settings);
      bus.emit("driver-changed", settings.driver);
    });

    el.cameraSeg.addEventListener("click", e => {
      const btn = e.target.closest("button"); if (!btn) return;
      setSegActive(el.cameraSeg, btn.dataset.cam, "cam");
      settings.camera = btn.dataset.cam; saveSettings(settings);
      bus.emit("camera-changed", settings.camera);
    });
    bus.on("key-camera", cam => { setSegActive(el.cameraSeg, cam, "cam"); settings.camera = cam; saveSettings(settings); bus.emit("camera-changed", cam); });

    el.presetGrid.addEventListener("click", e => {
      const btn = e.target.closest("button"); if (!btn) return;
      el.presetGrid.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      bus.emit("preset-selected", btn.dataset.preset);
    });

    el.btnAddListener.addEventListener("click", () => bus.emit("listener-add-request"));

    el.btnPlayPause.addEventListener("click", () => bus.emit("toggle-play"));
    bus.on("key-space", () => bus.emit("toggle-play"));
    el.btnReset.addEventListener("click", () => bus.emit("reset-request"));
    bus.on("key-reset", () => bus.emit("reset-request"));

    el.btnTheme.addEventListener("click", () => {
      settings.night = !settings.night;
      document.body.classList.toggle("day", !settings.night);
      saveSettings(settings);
      bus.emit("night-toggle", settings.night);
    });

    el.btnHelp.addEventListener("click", () => el.helpModal.classList.add("show"));
    el.btnCloseHelp.addEventListener("click", () => el.helpModal.classList.remove("show"));
    el.helpModal.addEventListener("click", e => { if (e.target === el.helpModal) el.helpModal.classList.remove("show"); });
    bus.on("key-help", () => el.helpModal.classList.toggle("show"));

    const openMap = () => el.mapModal.classList.add("show");
    const closeMap = () => el.mapModal.classList.remove("show");
    el.btnExpandMap.addEventListener("click", openMap);
    el.btnOpenMap.addEventListener("click", openMap);
    el.btnCloseMap.addEventListener("click", closeMap);
    el.mapModal.addEventListener("click", e => { if (e.target === el.mapModal) closeMap(); });

    el.btnMenuToggle.addEventListener("click", () => document.body.classList.toggle("panelsOpen"));

    el.btnExportCsv.addEventListener("click", () => {
      const header = "time_s,emitted_hz,received_hz,shift_hz,listener\n";
      const body = logRows.map(r => `${r.t},${r.f0},${r.f},${r.df},${r.who}`).join("\n");
      downloadTextFile("doppler-log.csv", header + body);
    });
  }

  function setPlayIcon(isPlaying) {
    el.iconPlay.style.display = isPlaying ? "none" : "block";
    el.iconPause.style.display = isPlaying ? "block" : "none";
  }

  function hideLoadScreen() { el.loadScreen.classList.add("hidden"); }

  // ---------------------------------------------------------------- listener list DOM
  function syncListeners(listeners) {
    el.listenerCount.textContent = listeners.length;
    el.listenerList.innerHTML = "";
    listeners.forEach((L, i) => {
      const li = document.createElement("li");
      li.className = "listenerChip";
      const colorHex = "#" + L.color.toString(16).padStart(6, "0");
      li.innerHTML = `
        <span class="swatch" style="background:${colorHex};color:${colorHex}"></span>
        <span class="lName">Mic ${i + 1}</span>
        <input type="range" min="${-PLAY_HALF_LEN}" max="${PLAY_HALF_LEN}" step="2" value="${L.z}">
        <span class="lFreq" data-role="freq">&mdash;</span>
        <button class="lDel" title="Remove">✕</button>`;
      const range = li.querySelector("input");
      range.addEventListener("input", () => bus.emit("listener-move", { id: L.id, z: Number(range.value) }));
      li.querySelector(".lDel").addEventListener("click", () => bus.emit("listener-remove-request", L.id));
      li._freqEl = li.querySelector('[data-role="freq"]');
      li._id = L.id;
      el.listenerList.appendChild(li);
    });
  }

  function updateListenerFreq(id, freqText) {
    const li = [...el.listenerList.children].find(n => n._id === id);
    if (li) li._freqEl.textContent = freqText;
  }

  // ---------------------------------------------------------------- gauges / readouts
  function updateGauges(speedKmh, maxSpeedKmh, shiftHz, maxShiftHz) {
    const ARC = 157;
    const sFrac = clamp(speedKmh / Math.max(1, maxSpeedKmh), 0, 1);
    el.gaugeSpeedArc.setAttribute("stroke-dashoffset", ARC - ARC * sFrac);
    el.speedValue.textContent = fmt(speedKmh, 0);

    const shiftFrac = clamp(Math.abs(shiftHz) / Math.max(1, maxShiftHz), 0, 1);
    el.gaugeShiftArc.setAttribute("stroke-dashoffset", ARC - ARC * shiftFrac);
    el.shiftValue.textContent = (shiftHz >= 0 ? "+" : "") + fmt(shiftHz, 0);
  }

  function updateFreqReadout(emitted, received) {
    el.emittedFreqValue.textContent = emitted === null ? "—" : fmt(emitted, 0) + " Hz";
    el.receivedFreqValue.textContent = received === null ? "—" : fmt(received, 0) + " Hz";
  }

  function updateFormula(v, vs, theta, label) {
    if (v === null) { el.formulaVars.textContent = "waiting for first wavefront…"; return; }
    el.formulaVars.textContent = `${label}: v=${fmt(v, 0)} m/s, vₛcosθ=${fmt(vs, 1)} m/s, θ=${fmt(theta, 0)}°`;
  }

  // ---------------------------------------------------------------- log
  function pushLog(entry) {
    logRows.push(entry);
    if (logRows.length > 400) logRows.shift();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${entry.t}</td><td>${entry.f0}</td><td>${entry.f}</td><td>${entry.df >= 0 ? "+" : ""}${entry.df}</td>`;
    el.logTableBody.appendChild(tr);
    while (el.logTableBody.children.length > 60) el.logTableBody.removeChild(el.logTableBody.firstChild);
    el.logTableBody.parentElement.parentElement.scrollTop = 1e9;
  }

  function pushChartPoint(t, emitted, received) {
    chartHistory.push({ t, emitted, received });
    while (chartHistory.length && t - chartHistory[0].t > CHART_WINDOW) chartHistory.shift();
  }

  // ---------------------------------------------------------------- oscilloscope
  function drawScope(data) {
    const w = el.scopeCanvas.width, h = el.scopeCanvas.height;
    scopeCtx.clearRect(0, 0, w, h);
    scopeCtx.strokeStyle = "rgba(255,255,255,.06)";
    scopeCtx.beginPath(); scopeCtx.moveTo(0, h / 2); scopeCtx.lineTo(w, h / 2); scopeCtx.stroke();
    if (!data) { return; }
    scopeCtx.lineWidth = 1.6;
    scopeCtx.strokeStyle = "#3fd6ff";
    scopeCtx.shadowColor = "#3fd6ff"; scopeCtx.shadowBlur = 4;
    scopeCtx.beginPath();
    const step = w / data.length;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128 - 1;
      const y = h / 2 + v * (h / 2 - 4);
      if (i === 0) scopeCtx.moveTo(0, y); else scopeCtx.lineTo(i * step, y);
    }
    scopeCtx.stroke();
    scopeCtx.shadowBlur = 0;
  }

  // ---------------------------------------------------------------- freq/time chart
  function drawChart(nowT, minF, maxF) {
    const w = el.chartCanvas.width, h = el.chartCanvas.height;
    chartCtx.clearRect(0, 0, w, h);
    const lo = Math.max(0, minF * 0.7), hi = maxF * 1.4;
    const toX = t => w - ((nowT - t) / CHART_WINDOW) * w;
    const toY = f => h - ((f - lo) / Math.max(1, hi - lo)) * h;

    chartCtx.strokeStyle = "rgba(255,255,255,.06)";
    for (let i = 1; i < 4; i++) { const y = (h / 4) * i; chartCtx.beginPath(); chartCtx.moveTo(0, y); chartCtx.lineTo(w, y); chartCtx.stroke(); }

    function line(key, color) {
      chartCtx.beginPath();
      let started = false;
      for (const p of chartHistory) {
        if (p[key] == null) continue;
        const x = toX(p.t), y = toY(p[key]);
        if (x < -5) continue;
        if (!started) { chartCtx.moveTo(x, y); started = true; } else chartCtx.lineTo(x, y);
      }
      chartCtx.strokeStyle = color; chartCtx.lineWidth = 1.8; chartCtx.stroke();
    }
    line("emitted", "#3fd6ff");
    line("received", "#ff3d6e");
  }

  // ---------------------------------------------------------------- map (minimap + expanded modal share this)
  function renderMap(ctx, canvasEl, data, zoomHalfLen) {
    const { car, listeners, waveEvents, roadWidth, avenueOffset, crossStreets, traffic } = data;
    const w = canvasEl.width, h = canvasEl.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#060a10";
    ctx.fillRect(0, 0, w, h);

    const pad = Math.max(14, w * 0.05);
    const usableH = h - pad * 2;
    const zScale = usableH / (zoomHalfLen * 2.4);
    const xScale = Math.min((w - pad * 2) / (roadWidth * 6.2), zScale);

    const wx = x => w / 2 + x * xScale;
    const wy = z => h / 2 - (z - car.z) * zScale;

    // avenues (secondary streets either side of the main road)
    ctx.fillStyle = "rgba(143,180,216,.16)";
    ctx.fillRect(wx(avenueOffset - 3.5), 0, 7 * xScale, h);
    ctx.fillRect(wx(-avenueOffset - 3.5), 0, 7 * xScale, h);

    // cross streets (perpendicular blocks)
    if (crossStreets) {
      ctx.strokeStyle = "rgba(224,122,95,.55)";
      ctx.lineWidth = Math.max(1, 2 * (w / 180));
      for (const cz of crossStreets) {
        const y = wy(cz);
        ctx.beginPath(); ctx.moveTo(wx(-avenueOffset - 46), y); ctx.lineTo(wx(avenueOffset + 46), y); ctx.stroke();
      }
    }

    // main road band + center dashes
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.fillRect(wx(-roadWidth / 2), 0, roadWidth * xScale, h);
    ctx.strokeStyle = "rgba(232,201,74,.5)";
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    ctx.setLineDash([]);

    // wave rings
    if (waveEvents) for (const ev of waveEvents) {
      const r = ev.radius * zScale;
      if (r > Math.max(w, h) * 1.4) continue;
      ctx.beginPath();
      ctx.arc(wx(ev.x), wy(ev.z), r, 0, Math.PI * 2);
      ctx.strokeStyle = ev.tone === "nee" ? "rgba(255,61,110,.5)" : "rgba(63,214,255,.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // traffic
    if (traffic) {
      ctx.fillStyle = "#f1c40f";
      for (const t of traffic) {
        const x = wx(t.x), y = wy(t.z);
        if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;
        ctx.fillRect(x - 2.2, y - 2.2, 4.4, 4.4);
      }
    }

    // listeners
    listeners.forEach(L => {
      ctx.beginPath();
      ctx.arc(wx(L.x), wy(L.z), Math.max(3, w * 0.022), 0, Math.PI * 2);
      ctx.fillStyle = "#" + L.color.toString(16).padStart(6, "0");
      ctx.fill();
    });

    // car (triangle) — always centered vertically since the map follows the car
    const cx = wx(car.x), cz = wy(car.z);
    const tri = Math.max(6, w * 0.045);
    ctx.save();
    ctx.translate(cx, cz);
    ctx.rotate(car.angle);
    ctx.beginPath();
    ctx.moveTo(0, -tri); ctx.lineTo(tri * 0.6, tri * 0.75); ctx.lineTo(-tri * 0.6, tri * 0.75); ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
  }

  function drawMinimap(data) { renderMap(mapCtx, el.minimap, data, PLAY_HALF_LEN * 0.55); }
  function drawBigMap(data) { renderMap(bigMapCtx, el.bigMap, data, PLAY_HALF_LEN * 1.6); }

  const SLIDER_MAP = {
    minFreq: [el.minFreq, el.minFreqOut], maxFreq: [el.maxFreq, el.maxFreqOut],
    maxSpeed: [el.maxSpeed, el.maxSpeedOut], soundSpeed: [el.soundSpeed, el.soundSpeedOut],
    volume: [el.volume, el.volumeOut],
  };
  function setSetting(key, value, silent = false) {
    settings[key] = value;
    const pair = SLIDER_MAP[key];
    if (pair) { pair[0].value = value; pair[1].textContent = value; }
    saveSettings(settings);
    if (!silent) bus.emit("settings-changed", { key, value, all: settings });
  }

  function resetAll() {
    chartHistory.length = 0;
    logRows = [];
    el.logTableBody.innerHTML = "";
    updateFreqReadout(null, null);
    updateFormula(null);
    el.listenerList.querySelectorAll('[data-role="freq"]').forEach(n => n.textContent = "—");
  }

  function isMapOpen() { return el.mapModal.classList.contains("show"); }

  return {
    el, initControls, applySettingsToInputs, getSettings: () => settings, setSetting, setPlayIcon, hideLoadScreen,
    syncListeners, updateListenerFreq, updateGauges, updateFreqReadout, updateFormula,
    pushLog, pushChartPoint, drawScope, drawChart, drawMinimap, drawBigMap, isMapOpen, resetAll,
  };
})();
