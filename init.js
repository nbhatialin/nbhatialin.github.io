import PhotoScene from "./PhotoScene";

const container = document.getElementById("container");

const photoDisplay = new PhotoScene({
    container
})

photoDisplay.init();
photoDisplay.animate();