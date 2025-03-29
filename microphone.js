class Microphone {
    constructor(x, y) {
        this.x = x; // Centered at lane 1
        this.y = y;
        this.image = new Image();
        this.image.src = "https://cdn.pixabay.com/photo/2017/11/10/12/31/music-2936214_1280.png";
        this.image.onload = () => this.isImageLoaded = true;
        this.isImageLoaded = false;
    }

    receive(soundWaves) {
        for (const soundWave of soundWaves) {
            if (dist(soundWave, this) <= soundWave.radius) {
                soundWave.play();
            }
        }
    }

    update() {
        // No pulsing needed since detection range is removed
    }

    draw(ctx) {
        if (!this.isImageLoaded) {
            ctx.fillText("🎙️", this.x, this.y);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);

        const scale = 0.15;
        ctx.drawImage(this.image, -this.image.width * scale / 2, -this.image.height * scale / 2, this.image.width * scale, this.image.height * scale);

        ctx.restore();
    }
}