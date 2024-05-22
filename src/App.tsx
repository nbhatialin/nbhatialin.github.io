import { MutableRefObject, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import Stats from "three/addons/libs/stats.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let renderer: THREE.WebGLRenderer;
let stats: Stats;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let model, skeleton;
let mixer: THREE.AnimationMixer;
let clock: THREE.Clock;
const crossFadeControls = [];

let currentBaseAction = "idle";
const allActions: THREE.AnimationAction[] = [];
const baseActions: Record<
    string,
    { weight: number; action?: THREE.AnimationAction }
> = {
    idle: { weight: 1 },
    walk: { weight: 0 },
    run: { weight: 0 },
};

const additiveActions: Record<
    string,
    { weight: number; action?: THREE.AnimationAction }
> = {
    sneak_pose: { weight: 0 },
    sad_pose: { weight: 0 },
    agree: { weight: 0 },
    headShake: { weight: 0 },
};
let panelSettings;
let numAnimations: number;


function init(container: MutableRefObject<any>) {
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 3);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 3);
    dirLight.position.set(3, 10, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 2;
    dirLight.shadow.camera.bottom = -2;
    dirLight.shadow.camera.left = -2;
    dirLight.shadow.camera.right = 2;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 40;
    scene.add(dirLight);

    // ground

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const loader = new GLTFLoader();
    loader.load("models/gltf/Xbot.glb", function (gltf) {
        model = gltf.scene;
        scene.add(model);

        model.traverse(function (object) {
            if (object instanceof THREE.Mesh) {
                object.castShadow = true;
            }
        });

        skeleton = new THREE.SkeletonHelper(model);
        skeleton.visible = false;
        scene.add(skeleton);

        const animations = gltf.animations;
        mixer = new THREE.AnimationMixer(model);

        numAnimations = animations.length;

        for (let i = 0; i !== numAnimations; ++i) {
            let clip = animations[i];
            const name = clip.name;

            if (baseActions[name]) {
                const action = mixer.clipAction(clip);
                activateAction(action);
                baseActions[name].action = action;
                allActions.push(action);
            } else if (additiveActions[name]) {
                // Make the clip additive and remove the reference frame

                THREE.AnimationUtils.makeClipAdditive(clip);

                if (clip.name.endsWith("_pose")) {
                    clip = THREE.AnimationUtils.subclip(
                        clip,
                        clip.name,
                        2,
                        3,
                        30,
                    );
                }

                const action = mixer.clipAction(clip);
                activateAction(action);
                additiveActions[name].action = action;
                allActions.push(action);
            }
        }

        // createPanel();

        animate();
    });

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.current.appendChild(renderer.domElement);

    // camera
    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        1,
        100,
    );
    camera.position.set(-1, 2, 3);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.target.set(0, 1, 0);
    controls.update();

    stats = new Stats();
    container.current.appendChild(stats.dom);

    window.addEventListener("resize", onWindowResize);
}

function activateAction(action: THREE.AnimationAction) {
    const clip = action.getClip();
    const settings = baseActions[clip.name] || additiveActions[clip.name];
    setWeight(action, settings.weight);
    action.play();
}

// This function is needed, since animationAction.crossFadeTo() disables its start action and sets
// the start action's timeScale to ((start animation's duration) / (end animation's duration))

function setWeight(action: THREE.AnimationAction, weight: number) {
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(weight);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    // Render loop

    requestAnimationFrame(animate);

    for (let i = 0; i !== numAnimations; ++i) {
        const action = allActions[i];
        const clip = action.getClip();
        const settings = baseActions[clip.name] || additiveActions[clip.name];
        settings.weight = action.getEffectiveWeight();
    }

    // Get the time elapsed since the last frame, used for mixer update

    const mixerUpdateDelta = clock.getDelta();

    // Update the animation mixer, the stats panel, and render this frame

    mixer.update(mixerUpdateDelta);

    stats.update();

    renderer.render(scene, camera);
}

function App() {
    const container = useRef(null);

    init(container);
    
    return <div ref={container} id="container"></div>;
}

export default App;
