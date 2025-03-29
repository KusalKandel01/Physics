class Controls {
    constructor() {
        this.reset();
        this.#addKeyboardListeners();
    }

    reset() {
        this.forward = false;
        this.reverse = false;
        this.left = false;
        this.right = false;
    }

    #addKeyboardListeners() {
        document.onkeydown = (event) => {
            switch (event.key) {
                case "ArrowUp":
                    if (controlAmbulance) car.controls.forward = true;
                    else microphone.controls.up = true;
                    break;
                case "ArrowDown":
                    if (controlAmbulance) car.controls.reverse = true;
                    else microphone.controls.down = true;
                    break;
                case "ArrowLeft":
                    if (controlAmbulance) car.controls.left = true;
                    break;
                case "ArrowRight":
                    if (controlAmbulance) car.controls.right = true;
                    break;
            }
        };

        document.onkeyup = (event) => {
            switch (event.key) {
                case "ArrowUp":
                    if (controlAmbulance) car.controls.forward = false;
                    else microphone.controls.up = false;
                    break;
                case "ArrowDown":
                    if (controlAmbulance) car.controls.reverse = false;
                    else microphone.controls.down = false;
                    break;
                case "ArrowLeft":
                    if (controlAmbulance) car.controls.left = false;
                    break;
                case "ArrowRight":
                    if (controlAmbulance) car.controls.right = false;
                    break;
            }
        };
    }
}