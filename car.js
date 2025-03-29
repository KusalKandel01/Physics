class Car {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.speed = 0;
        this.acceleration = 0.15;
        this.maxSpeed = 4;
        this.friction = 0.1;
        this.angle = 0;

        this.controls = new Controls();
        
        this.image = new Image();
        this.image.src = "Ambulance.png";
        this.image.onload = () => this.isImageLoaded = true;
        this.isImageLoaded = false;
    }

    update() {
        this.#move();
    }

    #move() {
        if (this.controls.forward) this.speed += this.acceleration;
        if (this.controls.reverse) this.speed -= this.acceleration;

        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;

        if (Math.abs(this.speed) > this.friction) {
            this.speed -= Math.sign(this.speed) * this.friction;
        } else {
            this.speed = 0;
        }

        if (this.speed !== 0) {
            const flip = this.speed > 0 ? 1 : -1;
            if (this.controls.left) this.angle += 0.03 * flip;
            if (this.controls.right) this.angle -= 0.03 * flip;
        }

        const newX = this.x - Math.sin(this.angle) * this.speed;
        const newY = this.y - Math.cos(this.angle) * this.speed;

        const leftBoundary = road.left + road.curbs + this.width / 2;
        const rightBoundary = road.right - road.curbs - this.width / 2;

        if (newX - this.width / 2 < leftBoundary) {
            this.x = leftBoundary + this.width / 2 + 1;
            this.speed *= -0.2;
        } else if (newX + this.width / 2 > rightBoundary) {
            this.x = rightBoundary - this.width / 2 - 1;
            this.speed *= -0.2;
        } else {
            this.x = newX;
        }

        if (newY > road.top && newY < road.bottom) this.y = newY;
    }

    draw(ctx) {
        if (!this.isImageLoaded) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-this.angle);

        const scaleFactor = 4;
        const newWidth = this.width * scaleFactor;
        const newHeight = this.height * scaleFactor / 1.5;

        // Draw shadow
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;

        ctx.drawImage(this.image, -newWidth / 2, -newHeight / 2, newWidth, newHeight);

        // Reset shadow settings
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.restore();
    }
}