class Road {
    constructor(x, width, laneCount = 4) {
        this.x = x;
        this.width = width;
        this.laneCount = laneCount;

        this.left = x - width / 2;
        this.right = x + width / 2;

        const infinity = 1000000;
        this.top = -infinity;
        this.bottom = infinity;

        this.borders = [
            [{ x: this.left, y: this.top }, { x: this.left, y: this.bottom }],
            [{ x: this.right, y: this.top }, { x: this.right, y: this.bottom }]
        ];
        this.curbs = 20;
    }

    getLaneCenter(laneIndex) {
        const laneWidth = (this.width - 2 * this.curbs) / this.laneCount;
        return this.left + this.curbs + laneWidth / 2 + Math.min(laneIndex, this.laneCount - 1) * laneWidth;
    }

    getRoadCenter() {
        return this.left + this.width / 2;
    }

    draw(ctx) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = "white";

        // Draw road surface
        ctx.fillStyle = "#333333";
        ctx.fillRect(this.left + this.curbs, this.top, this.width - 2 * this.curbs, this.bottom - this.top);

        // Draw curbs with gradient
        const curbGradient = ctx.createLinearGradient(this.left, 0, this.left + this.curbs, 0);
        curbGradient.addColorStop(0, "#666");
        curbGradient.addColorStop(1, "#999");
        ctx.fillStyle = curbGradient;
        ctx.fillRect(this.left, this.top, this.curbs, this.bottom - this.top);

        const rightCurbGradient = ctx.createLinearGradient(this.right - this.curbs, 0, this.right, 0);
        rightCurbGradient.addColorStop(0, "#999");
        rightCurbGradient.addColorStop(1, "#666");
        ctx.fillStyle = rightCurbGradient;
        ctx.fillRect(this.right - this.curbs, this.top, this.curbs, this.bottom - this.top);

        // Draw lanes
        for (let i = 0; i <= this.laneCount; i++) {
            const x = this.left + this.curbs + i * ((this.width - 2 * this.curbs) / this.laneCount);
            ctx.beginPath();
            ctx.moveTo(x, this.top);
            ctx.lineTo(x, this.bottom);
            ctx.strokeStyle = i === 0 || i === this.laneCount ? "white" : "yellow";
            ctx.setLineDash(i === 0 || i === this.laneCount ? [] : [20, 20]);
            ctx.stroke();
        }

        ctx.setLineDash([]);
        this.borders.forEach(border => {
            ctx.beginPath();
            ctx.moveTo(border[0].x, border[0].y);
            ctx.lineTo(border[1].x, border[1].y);
            ctx.stroke();
        });
    }
}