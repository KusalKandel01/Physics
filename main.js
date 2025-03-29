const canvas = document.getElementById("myCanvas");
canvas.width = 800;
const ctx = canvas.getContext("2d");
const road = new Road(canvas.width / 2, canvas.width * 0.9);
const car = new Car(road.getLaneCenter(1), 100, 30, 50);
const microphone = new Microphone(road.getRoadCenter(), -400);

let neeNaw = "nee";
let showWaves = true;
const soundWave = [];
setInterval(() => {
    if (showWaves) {
        soundWave.push(new SoundWave(car.x, car.y, neeNaw));
    }
    neeNaw = neeNaw === "nee" ? "naw" : "nee";
}, 1000);

document.getElementById("waveToggle").addEventListener("click", () => {
    showWaves = !showWaves;
    if (!showWaves) soundWave.length = 0;
});

function updateSpeedDisplay() {
    document.getElementById("speedValue").textContent = Math.round(car.speed * 10);
    document.getElementById("maxSpeedValue").textContent = car.maxSpeed * 10;
}

function updateFreqDisplay() {
    let receivedFreq = "";
    for (const wave of soundWave) {
        if (dist(wave, microphone) <= wave.radius) {
            receivedFreq = wave.frequency + " Hz";
            break;
        }
    }
    document.getElementById("freqValue").textContent = receivedFreq;
}

function animate() {
    if (!ctx) return;
    car.update();
    microphone.update();
    for (let i = soundWave.length - 1; i >= 0; i--) {
        soundWave[i].update();
    }
    microphone.receive(soundWave);

    canvas.height = window.innerHeight;

    ctx.save();
    ctx.translate(0, -car.y + canvas.height * 0.7);

    road.draw(ctx);
    microphone.draw(ctx);
    car.draw(ctx);
    if (showWaves) {
        for (const soundwave of soundWave) {
            soundwave.draw(ctx);
        }
    }

    ctx.restore();

    updateSpeedDisplay();
    updateFreqDisplay();

    // Limit the number of sound waves to a maximum (e.g., 5)
    const maxWaves = 5;
    if (soundWave.length > maxWaves) {
        soundWave.shift(); // Remove the oldest wave
    }

    requestAnimationFrame(animate);
}

animate();