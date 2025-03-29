const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

class SoundWave {
    constructor(x, y, neeNaw) {
        this.x = x;
        this.y = y;

        this.frequency = neeNaw === "nee" ? 700 : 500;
        this.color = neeNaw === "nee" ? "red" : "blue"; // Fixed to lowercase for consistency

        this.radius = 0;
        this.played = false;
    }
    
    play(duration = 1) {
        if (this.played) return;
        const osc = audioCtx.createOscillator();
        const envelope = audioCtx.createGain();

        const loudness = Math.exp(-this.radius / 500);
        envelope.gain.setValueAtTime(0, audioCtx.currentTime);
        envelope.gain.linearRampToValueAtTime(loudness, audioCtx.currentTime + 0.01);
        envelope.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(this.frequency, audioCtx.currentTime);
        osc.connect(envelope);
        envelope.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
        this.played = true;
    }

    update() {
        this.radius += 10;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.strokeStyle = this.color;
        ctx.stroke();
    }
}