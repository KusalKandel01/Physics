// ============================================================================
// doppler.js — physics core. No rendering here: pure data + classical formulas.
// ============================================================================

// A single emitted pulse. It expands as a true sphere from the point it was
// emitted at (NOT attached to the source) — this is what produces the
// bunching/stretching that listeners perceive as a pitch shift.
class SoundEvent {
  constructor({ x, z, sourceFreq, tone, sourceVel, soundSpeed, emittedAt }) {
    this.x = x;
    this.z = z;
    this.sourceFreq = sourceFreq;
    this.tone = tone;                 // "nee" | "naw" — purely cosmetic colour tag
    this.sourceVel = sourceVel;       // {x, z} m/s at the instant of emission
    this.soundSpeed = soundSpeed;     // medium propagation speed, m/s (scaled units)
    this.emittedAt = emittedAt;       // simulation clock, seconds
    this.radius = 0;
    this.playedFor = new Set();       // listener ids already triggered by this ring
    this.receivedByListener = {};     // id -> {frequency, atTime}
  }

  update(dt) {
    this.radius += this.soundSpeed * dt;
  }

  // Classical (source-moving / listener-stationary component already folded
  // into vRel) Doppler formula, evaluated against a specific listener.
  frequencyFor(listenerX, listenerZ, listenerVel = { x: 0, z: 0 }) {
    const dx = listenerX - this.x;
    const dz = listenerZ - this.z;
    const distance = Math.sqrt(dx * dx + dz * dz) || 1e-6;
    const dirX = dx / distance, dirZ = dz / distance;

    const vSrcTowardListener = this.sourceVel.x * dirX + this.sourceVel.z * dirZ;
    const vListenerTowardSrc = -(listenerVel.x * dirX + listenerVel.z * dirZ);

    const denom = this.soundSpeed - vSrcTowardListener;
    const safeDenom = Math.abs(denom) < 8 ? Math.sign(denom || 1) * 8 : denom;
    const rawF = this.sourceFreq * (this.soundSpeed + vListenerTowardSrc) / safeDenom;
    const f = Number.isFinite(rawF) ? clamp(rawF, 20, 5000) : this.sourceFreq;
    return { frequency: f, distance, vSrcTowardListener, vListenerTowardSrc };
  }

  hasReached(listenerX, listenerZ) {
    return dist2(this.x, this.z, listenerX, listenerZ) <= this.radius;
  }
}

// Keeps the full set of live wavefronts and evaluates listener detections.
class DopplerField {
  constructor() {
    this.events = [];
    this.maxRadius = 2600;
  }

  emit(params) {
    const ev = new SoundEvent(params);
    this.events.push(ev);
    return ev;
  }

  update(dt) {
    for (const ev of this.events) ev.update(dt);
    this.events = this.events.filter(ev => ev.radius < this.maxRadius);
  }

  // Call once per frame per listener; returns a detection the first time
  // each wavefront crosses that listener, else null.
  poll(listener) {
    let hit = null;
    for (const ev of this.events) {
      if (ev.playedFor.has(listener.id)) continue;
      if (ev.hasReached(listener.x, listener.z)) {
        ev.playedFor.add(listener.id);
        const result = ev.frequencyFor(listener.x, listener.z, listener.vel);
        ev.receivedByListener[listener.id] = { frequency: result.frequency, atTime: ev.emittedAt };
        hit = { event: ev, ...result };
      }
    }
    return hit;
  }

  clear() { this.events.length = 0; }
}
