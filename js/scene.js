// ============================================================================
// scene.js — renderer, lighting, sky, and camera-mode logic.
// Every camera mode is drag-to-rotate + wheel-to-zoom, not just "Orbit" —
// the mode buttons just choose the default framing you start from.
// ============================================================================

class SceneCtx {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 4000);

    this.mode = "chase";
    this.night = true;

    // orbit mode: fully free spherical camera around the car
    this.orbit = { theta: 0.6, phi: 1.15, radius: 16 };
    // chase / side modes: user-adjustable offset on top of the mode's default framing
    this.free = { yaw: 0, pitch: 0, zoom: 1 };
    this.topZoom = 1;

    this._dragging = false;
    this._lastPointer = null;

    this._buildLights();
    this._buildSky();
    this._bindCameraInput();
    this._onResize();
    window.addEventListener("resize", () => this._onResize());
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0x6fa8ff, 0x0a0e14, 0.55);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 0.9);
    this.sun.position.set(60, 90, -40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.camera.far = 300;
    this.sun.shadow.bias = -0.0015;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.fill = new THREE.AmbientLight(0x334455, 0.25);
    this.scene.add(this.fill);
  }

  _buildSky() {
    const c = document.createElement("canvas");
    c.width = 8; c.height = 256;
    this._skyCanvas = c;
    this._skyCtx = c.getContext("2d");
    this.skyTexture = new THREE.CanvasTexture(c);
    this.scene.background = this.skyTexture;
    this.applyNight(true, true);
  }

  _paintSky(topColor, bottomColor) {
    const ctx = this._skyCtx;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 8, 256);
    this.skyTexture.needsUpdate = true;
  }

  applyNight(night, instant = false) {
    this.night = night;
    if (night) {
      this._paintSky("#040611", "#182338");
      this.scene.fog = new THREE.Fog(0x0a0e18, 60, 560);
      this.hemi.intensity = 0.28;
      this.hemi.color.set(0x2a3a5c);
      this.hemi.groundColor.set(0x05060a);
      this.sun.intensity = 0.22;
      this.sun.color.set(0x8fa8ff);
      this.fill.intensity = 0.18;
    } else {
      this._paintSky("#bfe3ff", "#eef8ff");
      this.scene.fog = new THREE.Fog(0xdfeeff, 90, 680);
      this.hemi.intensity = 0.85;
      this.hemi.color.set(0xbfe0ff);
      this.hemi.groundColor.set(0x445566);
      this.sun.intensity = 1.15;
      this.sun.color.set(0xfff3d6);
      this.fill.intensity = 0.35;
    }
    bus.emit("night-changed", night);
  }

  setMode(mode) {
    this.mode = mode;
    // reset user offsets so each mode button gives a predictable default view
    this.free.yaw = 0; this.free.pitch = 0; this.free.zoom = 1;
    this.topZoom = 1;
    this.orbit.theta = 0.6; this.orbit.phi = 1.15; this.orbit.radius = 16;
  }

  _bindCameraInput() {
    const el = this.canvas;
    el.addEventListener("pointerdown", e => {
      this._dragging = true;
      this._lastPointer = { x: e.clientX, y: e.clientY };
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    const stop = e => { this._dragging = false; try { el.releasePointerCapture(e.pointerId); } catch (err) {} };
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
    el.addEventListener("pointermove", e => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastPointer.x, dy = e.clientY - this._lastPointer.y;
      this._lastPointer = { x: e.clientX, y: e.clientY };

      if (this.mode === "orbit") {
        this.orbit.theta -= dx * 0.006;
        this.orbit.phi = clamp(this.orbit.phi - dy * 0.006, 0.2, 1.5);
      } else if (this.mode === "top") {
        // top-down: no rotation, just let wheel zoom handle it
      } else {
        this.free.yaw -= dx * 0.006;
        this.free.pitch = clamp(this.free.pitch - dy * 0.004, -0.25, 0.85);
      }
    });
    el.addEventListener("wheel", e => {
      e.preventDefault();
      if (this.mode === "orbit") this.orbit.radius = clamp(this.orbit.radius + e.deltaY * 0.02, 5, 90);
      else if (this.mode === "top") this.topZoom = clamp(this.topZoom + e.deltaY * 0.0015, 0.35, 3.2);
      else this.free.zoom = clamp(this.free.zoom + e.deltaY * 0.0015, 0.5, 2.6);
    }, { passive: false });
  }

  updateCamera(carPos, carAngle, dt) {
    const target = new THREE.Vector3(carPos.x, 1.4, carPos.z);
    let desired;

    if (this.mode === "chase") {
      const yaw = carAngle + Math.PI + this.free.yaw;
      const pitchAngle = 0.32 + this.free.pitch;
      const dist = 12 * this.free.zoom;
      desired = new THREE.Vector3(
        carPos.x + dist * Math.cos(pitchAngle) * Math.sin(yaw),
        1.1 + dist * Math.sin(pitchAngle),
        carPos.z + dist * Math.cos(pitchAngle) * Math.cos(yaw)
      );
    } else if (this.mode === "side") {
      const yaw = carAngle + Math.PI / 2 + this.free.yaw;
      const pitchAngle = 0.16 + this.free.pitch;
      const dist = 24 * this.free.zoom;
      desired = new THREE.Vector3(
        carPos.x + dist * Math.cos(pitchAngle) * Math.sin(yaw),
        1.4 + dist * Math.sin(pitchAngle),
        carPos.z + dist * Math.cos(pitchAngle) * Math.cos(yaw)
      );
    } else if (this.mode === "top") {
      desired = new THREE.Vector3(carPos.x, 95 * this.topZoom, carPos.z + 0.001);
    } else { // orbit
      const { theta, phi, radius } = this.orbit;
      desired = new THREE.Vector3(
        carPos.x + radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        carPos.z + radius * Math.sin(phi) * Math.cos(theta)
      );
    }

    const damp = this._camInitialized ? 1 - Math.pow(0.0008, dt) : 1;
    this._camInitialized = true;
    this.camera.position.lerp(desired, this.mode === "top" ? 1 : damp);
    this._lookTarget = (this._lookTarget || target.clone()).lerp(target, damp);
    if (this.mode === "top") this.camera.up.set(0, 0, -1); else this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this._lookTarget);
  }

  _onResize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
