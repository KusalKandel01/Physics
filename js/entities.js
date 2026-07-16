// ============================================================================
// entities.js — Three.js geometry builders. Coordinate convention:
//   x = lateral (across the road), z = forward travel axis, y = up.
// ============================================================================

const ROAD_WIDTH = 26;
const ROAD_HALF_LEN = 1400;
const LANE_COUNT = 3;
const CURB = 1.4;

function laneCenterX(laneIndex) {
  const laneWidth = (ROAD_WIDTH - 2 * CURB) / LANE_COUNT;
  const left = -ROAD_WIDTH / 2 + CURB;
  return left + laneWidth / 2 + Math.min(laneIndex, LANE_COUNT - 1) * laneWidth;
}

// ---------------------------------------------------------------- lane texture
function makeLaneTexture() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#23262f";
  ctx.fillRect(0, 0, c.width, c.height);
  // subtle asphalt noise
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
  }
  // lane dashes
  ctx.fillStyle = "#e8c94a";
  const laneWidth = c.width / LANE_COUNT;
  for (let i = 1; i < LANE_COUNT; i++) {
    for (let y = 0; y < c.height; y += 64) {
      ctx.fillRect(i * laneWidth - 2, y, 4, 34);
    }
  }
  // outer solid lines
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(4, 0, 4, c.height);
  ctx.fillRect(c.width - 8, 0, 4, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, ROAD_HALF_LEN * 2 / 64);
  tex.anisotropy = 8;
  return tex;
}

function buildRoad() {
  const group = new THREE.Group();
  const tex = makeLaneTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.02 });
  const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH - 2 * CURB, ROAD_HALF_LEN * 2);
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  const curbMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.8 });
  [-1, 1].forEach(side => {
    const curbGeo = new THREE.BoxGeometry(CURB, 0.25, ROAD_HALF_LEN * 2);
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(side * (ROAD_WIDTH / 2 - CURB / 2), 0.1, 0);
    curb.receiveShadow = true; curb.castShadow = false;
    group.add(curb);
  });

  const groundGeo = new THREE.PlaneGeometry(4000, ROAD_HALF_LEN * 2 + 400);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x141a22, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  return group;
}

// ---------------------------------------------------------------- environment
function buildEnvironment(rng) {
  const group = new THREE.Group();
  const buildingMats = [0x1b2530, 0x1e2a37, 0x222e3b, 0x19212b].map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
  );
  const winTex = makeWindowTexture();

  for (let side = -1; side <= 1; side += 2) {
    let z = -ROAD_HALF_LEN + 30;
    while (z < ROAD_HALF_LEN - 30) {
      const w = 10 + rng() * 14;
      const d = 10 + rng() * 10;
      const h = 14 + rng() * 46;
      const gap = 6 + rng() * 16;
      const bx = side * (ROAD_WIDTH / 2 + 10 + rng() * 24 + w / 2);

      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = buildingMats[Math.floor(rng() * buildingMats.length)].clone();
      const bld = new THREE.Mesh(geo, mat);
      bld.position.set(bx, h / 2, z);
      bld.castShadow = true; bld.receiveShadow = true;
      group.add(bld);

      // window face (front, facing road)
      const faceGeo = new THREE.PlaneGeometry(w * 0.92, h * 0.92);
      const faceMat = new THREE.MeshBasicMaterial({ map: winTex, transparent: true });
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.set(0, 0, side < 0 ? d / 2 + 0.02 : -d / 2 - 0.02);
      if (side > 0) face.rotation.y = Math.PI;
      bld.add(face);

      z += d + gap;
    }
  }

  // streetlamps
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x30363f, roughness: 0.6, metalness: 0.4 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2c2, emissive: 0xffdf8a, emissiveIntensity: 1.4 });
  const lamps = new THREE.Group();
  for (let z = -ROAD_HALF_LEN + 20; z < ROAD_HALF_LEN; z += 55) {
    [-1, 1].forEach(side => {
      const poleGeo = new THREE.CylinderGeometry(0.16, 0.2, 8, 8);
      const pole = new THREE.Mesh(poleGeo, lampMat);
      pole.position.set(side * (ROAD_WIDTH / 2 + 1.4), 4, z);
      pole.castShadow = true;
      const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6);
      const arm = new THREE.Mesh(armGeo, lampMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(side * -1.1, 3.9, 0);
      pole.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), bulbMat);
      bulb.position.set(side * -2.1, 3.9, 0);
      pole.add(bulb);
      lamps.add(pole);
    });
  }
  group.add(lamps);
  group.userData.lamps = lamps;

  return group;
}

function makeWindowTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 96;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.clearRect(0, 0, c.width, c.height);
  const cols = 4, rows = 7;
  const cw = c.width / cols, rh = c.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const lit = Math.random() > 0.55;
      ctx.fillStyle = lit ? `rgba(255,${200 + Math.random() * 40},${120 + Math.random() * 60},0.9)` : "rgba(20,26,34,0.85)";
      ctx.fillRect(cIdx * cw + 4, r * rh + 4, cw - 8, rh - 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ---------------------------------------------------------------- ambulance
function makeStripeTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f5f7fa";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#ff3d6e";
  const step = 26;
  for (let x = -step; x < c.width + step; x += step * 2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + step, 0); ctx.lineTo(x - step * 0.4, c.height); ctx.lineTo(x - step * 1.4, c.height);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#101826";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AMBULANCE", c.width / 2, c.height / 2 + 10);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

class Ambulance {
  constructor(x, z) {
    this.originX = x; this.originZ = z;
    this.x = x; this.z = z; this.y = 0;
    this.speed = 0;
    this.acceleration = 6.5;
    this.maxSpeed = 40;           // m/s, overwritten by settings
    this.friction = 3.2;
    this.angle = 0;
    this.width = 2.4;
    this.length = 5.6;

    this.controls = { forward: false, reverse: false, left: false, right: false };
    this.group = this._build();
    this._bounce = 0;
  }

  _build() {
    const g = new THREE.Group();
    const stripeTex = makeStripeTexture();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf3f5f8, roughness: 0.4, metalness: 0.15 });
    const stripeMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.5 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1c2733, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.75 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.7 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.1, 5.4), bodyMat);
    chassis.position.y = 1.05;
    chassis.castShadow = true; chassis.receiveShadow = true;
    g.add(chassis);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.55, 5.42), stripeMat);
    stripe.position.y = 0.85;
    g.add(stripe);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.9, 2.0), bodyMat);
    cabin.position.set(0, 1.9, 1.55);
    cabin.castShadow = true;
    g.add(cabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 0.1), glassMat);
    windshield.position.set(0, 1.9, 2.5);
    windshield.rotation.x = -0.15;
    g.add(windshield);

    const rearWin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 0.06), glassMat);
    rearWin.position.set(0, 1.95, -2.7);
    g.add(rearWin);

    // bumpers
    const bumperMat = darkMat;
    const fBumper = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.35, 0.3), bumperMat);
    fBumper.position.set(0, 0.5, 2.8);
    g.add(fBumper);
    const rBumper = fBumper.clone(); rBumper.position.z = -2.8; g.add(rBumper);

    // wheels
    this.wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.8 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.3, metalness: 0.7 });
    [[1, 1.9], [-1, 1.9], [1, -1.9], [-1, -1.9]].forEach(([sx, sz]) => {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.36, 10), hubMat);
      hub.rotation.z = Math.PI / 2;
      wheel.add(tire); wheel.add(hub);
      wheel.position.set(sx * 1.15, 0.44, sz);
      g.add(wheel);
      this.wheels.push(wheel);
    });

    // light bar
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.5), darkMat);
    barBase.position.set(0, 2.42, 1.0);
    g.add(barBase);
    const lensGeo = new THREE.BoxGeometry(0.8, 0.16, 0.42);
    this.lightRed = new THREE.Mesh(lensGeo, new THREE.MeshStandardMaterial({ color: 0x330008, emissive: 0xff1744, emissiveIntensity: 0 }));
    this.lightRed.position.set(-0.45, 2.42, 1.0);
    this.lightBlue = new THREE.Mesh(lensGeo, new THREE.MeshStandardMaterial({ color: 0x001433, emissive: 0x2979ff, emissiveIntensity: 0 }));
    this.lightBlue.position.set(0.45, 2.42, 1.0);
    g.add(this.lightRed, this.lightBlue);

    this.beaconRed = new THREE.PointLight(0xff1744, 0, 14);
    this.beaconRed.position.copy(this.lightRed.position);
    this.beaconBlue = new THREE.PointLight(0x2979ff, 0, 14);
    this.beaconBlue.position.copy(this.lightBlue.position);
    g.add(this.beaconRed, this.beaconBlue);

    // headlights
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2b0, emissiveIntensity: 1.4 });
    [[0.75, 2.85], [-0.75, 2.85]].forEach(([hx, hz]) => {
      const head = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), headMat);
      head.position.set(hx, 0.85, hz);
      head.rotation.y = Math.PI;
      g.add(head);
    });

    g.position.set(this.x, 0, this.z);
    return g;
  }

  setToneFlash(tone) {
    const redOn = tone === "nee";
    this.lightRed.material.emissiveIntensity = redOn ? 4.5 : 0.15;
    this.lightBlue.material.emissiveIntensity = redOn ? 0.15 : 4.5;
    this.beaconRed.intensity = redOn ? 3.5 : 0;
    this.beaconBlue.intensity = redOn ? 0 : 3.5;
  }

  resetPosition() {
    this.x = this.originX; this.z = this.originZ;
    this.speed = 0; this.angle = 0;
  }

  update(dt, roadLeft, roadRight) {
    if (this.controls.forward) this.speed += this.acceleration * dt;
    if (this.controls.reverse) this.speed -= this.acceleration * dt;

    this.speed = clamp(this.speed, -this.maxSpeed / 2, this.maxSpeed);

    if (Math.abs(this.speed) > this.friction * dt) {
      this.speed -= Math.sign(this.speed) * this.friction * dt;
    } else {
      this.speed = 0;
    }

    if (this.speed !== 0) {
      const flip = this.speed > 0 ? 1 : -1;
      const steer = 0.85 * dt * flip;
      if (this.controls.left) this.angle += steer;
      if (this.controls.right) this.angle -= steer;
    }

    const newX = this.x + Math.sin(this.angle) * this.speed * dt;
    const newZ = this.z + Math.cos(this.angle) * this.speed * dt;

    const halfW = this.width / 2;
    if (newX - halfW < roadLeft) { this.x = roadLeft + halfW + 0.05; this.speed *= -0.2; }
    else if (newX + halfW > roadRight) { this.x = roadRight - halfW - 0.05; this.speed *= -0.2; }
    else { this.x = newX; }
    this.z = newZ;

    this._bounce += dt * (2 + Math.abs(this.speed));
    const bounceY = Math.abs(this.speed) > 0.05 ? Math.sin(this._bounce * 6) * 0.012 : 0;

    this.group.position.set(this.x, bounceY, this.z);
    this.group.rotation.y = this.angle;

    const wheelSpin = this._bounce * (this.speed >= 0 ? 3 : -3);
    this.wheels.forEach(w => { w.children[0].rotation.x = wheelSpin; w.children[1].rotation.x = wheelSpin; });

    return { x: this.x, z: this.z, vx: Math.sin(this.angle) * this.speed, vz: Math.cos(this.angle) * this.speed, speed: this.speed, angle: this.angle };
  }
}

// ---------------------------------------------------------------- listener
const LISTENER_COLORS = [0x3fd6ff, 0xffb648, 0x3fffa1, 0x7c5cff, 0xff3d6e, 0xffffff];

class Listener {
  constructor(id, x, z, colorIdx = 0) {
    this.id = id;
    this.x = x; this.z = z;
    this.vel = { x: 0, z: 0 };
    this._prevZ = z;
    this.color = LISTENER_COLORS[colorIdx % LISTENER_COLORS.length];
    this.group = this._build();
    this.lastFreq = null;
    this.lastEmitted = null;
    this.lastTime = 0;
    this.pulse = 0;
  }

  _build() {
    const g = new THREE.Group();
    const standMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.5, metalness: 0.5 });
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.5, 10), standMat);
    stand.position.y = 0.75;
    g.add(stand);

    const headMat = new THREE.MeshStandardMaterial({ color: this.color, emissive: this.color, emissiveIntensity: 0.5, roughness: 0.3 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), headMat);
    head.position.y = 1.62;
    g.add(head);
    this.headMat = headMat;

    const ringGeo = new THREE.RingGeometry(0.42, 0.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: this.color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);

    g.position.set(this.x, 0, this.z);
    return g;
  }

  setZ(z, dt) {
    const clamped = clamp(z, -ROAD_HALF_LEN + 10, ROAD_HALF_LEN - 10);
    this.vel.z = dt > 0 ? (clamped - this.z) / dt : 0;
    this.z = clamped;
    this.group.position.z = this.z;
  }

  markDetection(colorPulse = true) {
    this.pulse = 1;
  }

  updatePulse(dt) {
    if (this.pulse > 0) {
      this.pulse = Math.max(0, this.pulse - dt * 1.6);
      const s = 1 + this.pulse * 0.6;
      this.headMat.emissiveIntensity = 0.5 + this.pulse * 2.5;
      this.group.scale.setScalar(1 + this.pulse * 0.15);
    } else {
      this.group.scale.setScalar(1);
    }
  }

  dispose(scene) { scene.remove(this.group); }
}

// ---------------------------------------------------------------- wave ring pool
function makeLabelTexture(text, color) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(6,10,16,.82)";
  roundRect(ctx, 2, 2, c.width - 4, c.height - 4, 16);
  ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  roundRect(ctx, 2, 2, c.width - 4, c.height - 4, 16);
  ctx.stroke();
  ctx.fillStyle = "#eef3fa";
  ctx.font = "bold 30px 'JetBrains Mono', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

class WaveRingPool {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.meshes = new Map(); // event -> {ring, label}
  }

  setVisible(v) { this.group.visible = v; }

  spawn(event) {
    const colorHex = event.tone === "nee" ? 0xff3d6e : 0x3fd6ff;
    const colorCss = event.tone === "nee" ? "#ff3d6e" : "#3fd6ff";
    const geo = new THREE.RingGeometry(0.9, 1.15, 64);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(event.x, 0.05, event.z);
    this.group.add(ring);

    const labelTex = makeLabelTexture(`${event.tone} ${Math.round(event.sourceFreq)}Hz`, colorCss);
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false });
    const label = new THREE.Sprite(labelMat);
    label.scale.set(4.4, 1.1, 1);
    label.position.set(event.x, 2.6, event.z);
    this.group.add(label);

    this.meshes.set(event, { ring, label });
  }

  sync(events, showLabels) {
    const alive = new Set(events);
    for (const [ev, rec] of this.meshes) {
      if (!alive.has(ev)) {
        this.group.remove(rec.ring); this.group.remove(rec.label);
        rec.label.material.map.dispose(); rec.label.material.dispose();
        this.meshes.delete(ev); continue;
      }
      const r = Math.max(0.6, ev.radius);
      rec.ring.geometry.dispose();
      rec.ring.geometry = new THREE.RingGeometry(r, r * 1.012 + 0.15, 72);
      const fade = clamp(1 - ev.radius / 2600, 0, 1);
      rec.ring.material.opacity = fade * 0.85;
      rec.label.visible = showLabels;
      rec.label.material.opacity = fade;
    }
    for (const ev of events) if (!this.meshes.has(ev)) this.spawn(ev);
  }

  clear() {
    for (const [, rec] of this.meshes) {
      this.group.remove(rec.ring); this.group.remove(rec.label);
      rec.label.material.map.dispose(); rec.label.material.dispose();
    }
    this.meshes.clear();
  }
}
