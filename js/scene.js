// ============================================================================
// scene.js — renderer, lighting, sky, and camera-mode logic
// ============================================================================

class SceneCtx {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 3000);

    this.mode = "chase";
    this.night = true;
    this.orbit = { theta: 0.6, phi: 1.15, radius: 16, target: new THREE.Vector3() };
    this._dragging = false;
    this._lastPointer = null;

    this._buildLights();
    this._buildSky();
    this._bindOrbitInput();
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
      this.scene.fog = new THREE.Fog(0x0a0e18, 60, 520);
      this.hemi.intensity = 0.28;
      this.hemi.color.set(0x2a3a5c);
      this.hemi.groundColor.set(0x05060a);
      this.sun.intensity = 0.22;
      this.sun.color.set(0x8fa8ff);
      this.fill.intensity = 0.18;
    } else {
      this._paintSky("#bfe3ff", "#eef8ff");
      this.scene.fog = new THREE.Fog(0xdfeeff, 90, 640);
      this.hemi.intensity = 0.85;
      this.hemi.color.set(0xbfe0ff);
      this.hemi.groundColor.set(0x445566);
      this.sun.intensity = 1.15;
      this.sun.color.set(0xfff3d6);
      this.fill.intensity = 0.35;
    }
    bus.emit("night-changed", night);
  }

  setLampsVisible(lamps) {
    if (!lamps) return;
    lamps.children.forEach(pole => {
      const bulb = pole.children[1];
      if (bulb) bulb.material.emissiveIntensity = this.night ? 2.2 : 0.3;
    });
  }

  setMode(mode) { this.mode = mode; }

  _bindOrbitInput() {
    const el = this.canvas;
    el.addEventListener("pointerdown", e => {
      if (this.mode !== "orbit") return;
      this._dragging = true; this._lastPointer = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener("pointerup", () => this._dragging = false);
    window.addEventListener("pointermove", e => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastPointer.x, dy = e.clientY - this._lastPointer.y;
      this._lastPointer = { x: e.clientX, y: e.clientY };
      this.orbit.theta -= dx * 0.006;
      this.orbit.phi = clamp(this.orbit.phi - dy * 0.006, 0.25, 1.5);
    });
    el.addEventListener("wheel", e => {
      if (this.mode !== "orbit") return;
      e.preventDefault();
      this.orbit.radius = clamp(this.orbit.radius + e.deltaY * 0.02, 5, 90);
    }, { passive: false });
  }

  updateCamera(carPos, carAngle, dt) {
    const target = new THREE.Vector3(carPos.x, 1.4, carPos.z);
    let desired;

    if (this.mode === "chase") {
      const back = 11, up = 5.2;
      desired = new THREE.Vector3(
        carPos.x - Math.sin(carAngle) * back,
        up,
        carPos.z - Math.cos(carAngle) * back
      );
    } else if (this.mode === "top") {
      desired = new THREE.Vector3(carPos.x, 95, carPos.z + 0.001);
    } else if (this.mode === "side") {
      desired = new THREE.Vector3(carPos.x + 26, 7, carPos.z);
    } else { // orbit
      const { theta, phi, radius } = this.orbit;
      desired = new THREE.Vector3(
        carPos.x + radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        carPos.z + radius * Math.sin(phi) * Math.cos(theta)
      );
    }

    const damp = 1 - Math.pow(0.0008, dt);
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
