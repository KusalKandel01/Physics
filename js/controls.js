// ============================================================================
// controls.js — keyboard + touch input. Driving flags live on the car object;
// everything else (play/pause, camera cycle, reset, help) goes through `bus`.
// ============================================================================

class InputController {
  constructor() {
    this.car = null;
    this.autopilot = false;
    this._bind();
  }

  bindCar(car) { this.car = car; }
  setAutopilot(on) { this.autopilot = on; if (this.car) Object.assign(this.car.controls, { forward: false, reverse: false, left: false, right: false }); }

  _isTyping() {
    const el = document.activeElement;
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
  }

  _bind() {
    const cameraOrder = ["chase", "orbit", "top", "side"];
    let camIdx = 0;

    window.addEventListener("keydown", e => {
      if (this._isTyping()) return;
      if (!this.autopilot && this.car) {
        switch (e.key) {
          case "ArrowUp": this.car.controls.forward = true; e.preventDefault(); break;
          case "ArrowDown": this.car.controls.reverse = true; e.preventDefault(); break;
          case "ArrowLeft": this.car.controls.left = true; e.preventDefault(); break;
          case "ArrowRight": this.car.controls.right = true; e.preventDefault(); break;
        }
      }
      if (e.code === "Space") { bus.emit("key-space"); e.preventDefault(); }
      if (e.key === "r" || e.key === "R") bus.emit("key-reset");
      if (e.key === "c" || e.key === "C") {
        camIdx = (camIdx + 1) % cameraOrder.length;
        bus.emit("key-camera", cameraOrder[camIdx]);
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) bus.emit("key-help");
    });

    window.addEventListener("keyup", e => {
      if (!this.car) return;
      switch (e.key) {
        case "ArrowUp": this.car.controls.forward = false; break;
        case "ArrowDown": this.car.controls.reverse = false; break;
        case "ArrowLeft": this.car.controls.left = false; break;
        case "ArrowRight": this.car.controls.right = false; break;
      }
    });

    // touch buttons
    document.querySelectorAll("#touchControls [data-k]").forEach(btn => {
      const key = btn.dataset.k;
      const map = { forward: "forward", reverse: "reverse", left: "left", right: "right" };
      const setFlag = (val) => { if (this.car && !this.autopilot) this.car.controls[map[key]] = val; };
      btn.addEventListener("touchstart", e => { setFlag(true); e.preventDefault(); }, { passive: false });
      btn.addEventListener("touchend", e => { setFlag(false); e.preventDefault(); }, { passive: false });
      btn.addEventListener("pointerdown", () => setFlag(true));
      btn.addEventListener("pointerup", () => setFlag(false));
      btn.addEventListener("pointerleave", () => setFlag(false));
    });
  }
}

const inputController = new InputController();
