class Microphone {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.speed = 0;
        this.maxSpeed = 2;
        this.controls = {
            up: false,
            down: false,
            reset: function() {
                this.up = false;
                this.down = false;
            }
        };
        
        this.image = new Image();
        this.image.src = "https://cdn.pixabay.com/photo/2017/11/10/12/31/music-2936214_1280.png";
        this.image.onload = () => this.isImageLoaded = true;
        this.isImageLoaded = false;
    }

    update() {
        this.speed = 0;
        if (this.controls.up) this.speed = -this.maxSpeed;
        if (this.controls.down) this.speed = this.maxSpeed;
        
        this.y += this.speed;
        
        // Keep microphone within world bounds
        this.y = Math.max(0, Math.min(4000, this.y));
    }

    receive(soundWaves) {
        for (const soundWave of soundWaves) {
            if (dist(soundWave, this) <= soundWave.radius) {
                soundWave.play(this);
            }
        }
    }

    draw(ctx) {
        if (!this.isImageLoaded) {
            ctx.fillText("🎙️", this.x, this.y);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        const scale = 0.15;
        ctx.drawImage(this.image, -this.image.width * scale / 2, -this.image.height * scale / 2, 
                     this.image.width * scale, this.image.height * scale);

        ctx.restore();
    }
}