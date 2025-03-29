const canvas = document.getElementById("myCanvas");
canvas.width = 800;
const ctx = canvas.getContext("2d");
const WORLD_HEIGHT = 4000;
const road = new Road(canvas.width / 2, canvas.width * 0.9);
const car = new Car(road.getLaneCenter(1), WORLD_HEIGHT/2, 30, 50);
const microphone = new Microphone(road.getRoadCenter(), WORLD_HEIGHT/2 - 400);

// Customizable settings
let settings = {
    minFreq: 500,
    maxFreq: 700,
    maxSpeed: 144 // km/h
};

let neeNaw = "nee";
let showWaves = true;
const soundWave = [];
let lastFrequencyData = {
    emitted: null,
    received: null,
    time: 0,
    shift: 0
};

// Apply settings from UI
document.getElementById("applySettings").addEventListener("click", () => {
    settings.minFreq = parseInt(document.getElementById("minFreq").value);
    settings.maxFreq = parseInt(document.getElementById("maxFreq").value);
    settings.maxSpeed = parseInt(document.getElementById("maxSpeed").value);
    
    // Convert km/h to game units (144 km/h = 4 units)
    car.maxSpeed = settings.maxSpeed / 36;
    document.getElementById("maxSpeedValue").textContent = settings.maxSpeed;
});

setInterval(() => {
    if (showWaves) {
        soundWave.push(new SoundWave(car.x, car.y, neeNaw, car.speed, car.angle, settings));
    }
    neeNaw = neeNaw === "nee" ? "naw" : "nee";
}, 500);

document.getElementById("waveToggle").addEventListener("click", () => {
    showWaves = !showWaves;
    if (!showWaves) soundWave.length = 0;
});

function updateSpeedDisplay() {
    document.getElementById("speedValue").textContent = Math.round(car.speed * 36);
}

function updateFreqDisplay() {
    let currentData = null;
    
    for (const wave of soundWave) {
        if (dist(wave, microphone) <= wave.radius) {
            const frequencies = wave.play(microphone);
            if (frequencies) {
                currentData = {
                    emitted: frequencies.emitted,
                    received: Math.round(frequencies.received),
                    time: frequencies.time,
                    shift: Math.round(frequencies.received - frequencies.emitted)
                };
                lastFrequencyData = currentData;
            }
        }
    }
    
    const now = Date.now();
    if (now - lastFrequencyData.time < 3000) {
        document.getElementById("emittedFreqValue").textContent = 
            `${lastFrequencyData.emitted}Hz`;
        document.getElementById("receivedFreqValue").textContent = 
            `${lastFrequencyData.received}Hz (${lastFrequencyData.shift > 0 ? '+' : ''}${lastFrequencyData.shift}Hz)`;
    } else {
        document.getElementById("emittedFreqValue").textContent = "---";
        document.getElementById("receivedFreqValue").textContent = "---";
    }
}

function animate() {
    if (!ctx) return;
    car.update();
    microphone.update();
    
    // Boundary checks
    if (car.y < 0) {
        car.y = 0;
        car.speed = 0;
    }
    if (car.y > WORLD_HEIGHT) {
        car.y = WORLD_HEIGHT;
        car.speed = 0;
    }

    for (let i = soundWave.length - 1; i >= 0; i--) {
        soundWave[i].update();
        if (soundWave[i].radius > 1500) {
            soundWave.splice(i, 1);
        }
    }

    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    const cameraY = Math.max(canvas.height * 0.7, Math.min(car.y, WORLD_HEIGHT - canvas.height * 0.3));
    ctx.translate(0, -cameraY + canvas.height * 0.7);

    road.draw(ctx);
    microphone.draw(ctx);
    car.draw(ctx);
    
    if (showWaves) {
        for (const wave of soundWave) {
            wave.draw(ctx);
        }
    }

    ctx.restore();

    updateSpeedDisplay();
    updateFreqDisplay();

    if (soundWave.length > 10) {
        soundWave.shift();
    }

    requestAnimationFrame(animate);
}

animate();