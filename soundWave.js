const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const SPEED_OF_SOUND = 343;

class SoundWave {
    constructor(x, y, neeNaw, carSpeed, carAngle, settings) {
        this.x = x;
        this.y = y;
        this.carSpeed = carSpeed * 10;
        this.carAngle = carAngle;
        this.settings = settings;

        this.sourceFrequency = neeNaw === "nee" ? settings.maxFreq : settings.minFreq;
        this.color = neeNaw === "nee" ? "red" : "blue";
        
        this.radius = 0;
        this.hasPlayed = false;
        this.audioNodes = null;
        this.receivedFrequency = null;
        this.detectedTime = null;
    }
    
    play(microphone) {
        if (this.hasPlayed) return null;
        
        const dx = microphone.x - this.x;
        const dy = microphone.y - this.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        const directionX = dx/distance;
        const directionY = dy/distance;
        
        const carVelX = -Math.sin(this.carAngle) * this.carSpeed;
        const carVelY = -Math.cos(this.carAngle) * this.carSpeed;
        
        const relativeVelocity = carVelX * directionX + carVelY * directionY;
        this.receivedFrequency = this.sourceFrequency * (SPEED_OF_SOUND / (SPEED_OF_SOUND - relativeVelocity));
        this.detectedTime = Date.now();

        const osc = audioCtx.createOscillator();
        const envelope = audioCtx.createGain();

        const duration = 0.5;
        const loudness = Math.min(1, 1/(distance/100));
        envelope.gain.setValueAtTime(0, audioCtx.currentTime);
        envelope.gain.linearRampToValueAtTime(loudness, audioCtx.currentTime + 0.05);
        envelope.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);

        osc.type = "sine";
        osc.frequency.setValueAtTime(this.receivedFrequency, audioCtx.currentTime);
        osc.connect(envelope);
        envelope.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
        
        this.hasPlayed = true;
        this.audioNodes = { osc, envelope };
        
        return {
            emitted: this.sourceFrequency,
            received: this.receivedFrequency,
            time: this.detectedTime
        };
    }

    update() {
        this.radius += 8;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if (this.radius < 150 && this.receivedFrequency) {
            ctx.fillStyle = "white";
            ctx.font = "bold 14px Arial";
            ctx.fillText(`${this.sourceFrequency}Hz→${Math.round(this.receivedFrequency)}Hz`, 
                         this.x - 50, this.y - this.radius - 10);
        }
    }
}