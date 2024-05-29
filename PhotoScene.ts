import * as THREE from "three";
import { Sky, TGALoader, Water } from "three/examples/jsm/Addons.js";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

type PhotoSceneProps = {
    container: HTMLElement,

}

export default class PhotoScene {

    constructor(props: PhotoSceneProps) {
        this.container = props.container
        this.renderer = new THREE.WebGLRenderer();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 10000 );

        this.sun = new THREE.Vector3();
        this.parameters = {
            elevation: 2,
            azimuth: 180
        }
        this.clock = new THREE.Clock();
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 3);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 3);

        this.radius = 600
        this.theta = 0

        this.speed = 5

        this.animate = this.animate.bind(this);
        this.render = this.render.bind(this);

    }

    /**
     * HTMLElement to append Three JS DOM elements
     */
    container: HTMLElement

    scene: THREE.Scene

    renderer: THREE.WebGLRenderer

    camera: THREE.PerspectiveCamera | any

    model: THREE.Object3D[]

    skeleton: THREE.SkeletonHelper

    balooMixer: THREE.AnimationMixer

    clock: THREE.Clock

    sun: THREE.Vector3

    water: Water | any

    sky: Sky | any

    pmremGenerator: THREE.PMREMGenerator

    sceneEnv: THREE.Scene

    renderTarget: THREE.WebGLRenderTarget

    hemiLight: THREE.HemisphereLight | any

    dirLight: THREE.DirectionalLight | any

    balooMesh: THREE.Mesh | any

    // Rotate theta degrees this.radius distance away from the subject 
    radius: number
    theta: number

    // Used in emulating movement of Baloo
    speed: number 

    parameters: {
        elevation: number,
        azimuth: number
    }

    init() {
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.setAnimationLoop( this.animate );
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;

        this.container.appendChild( this.renderer.domElement );

        // Want to vary between 100 & 300 to give good perspective
        this.camera.position.y = 100;

        this.initWater()
        this.initSkybox()
        this.initLights()

        this.loadBaloo()
        
    }

    initWater() {
        const waterGeometry = new THREE.PlaneGeometry( 1000000, 1000000 );
        this.water = new Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                waterNormals: new THREE.TextureLoader().load( 'textures/waternormals.jpg', function ( texture ) {

                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

                } ),
                sunDirection: new THREE.Vector3(),
                sunColor: 0xffffff,
                waterColor: 0x001e0f,
                distortionScale: 3.7,
                fog: this.scene.fog !== undefined
            }
        );

        this.water.rotation.x = - Math.PI / 2;

        this.scene.add( this.water );
    }

    initSkybox() {
        this.sky = new Sky();
        this.sky.scale.setScalar( 10000 );
        this.scene.add( this.sky );

        const skyUniforms = this.sky.material.uniforms;

        skyUniforms[ 'turbidity' ].value = 10;
        skyUniforms[ 'rayleigh' ].value = 2;
        skyUniforms[ 'mieCoefficient' ].value = 0.005;
        skyUniforms[ 'mieDirectionalG' ].value = 0.8;

        this.pmremGenerator = new THREE.PMREMGenerator( this.renderer );
        this.sceneEnv = new THREE.Scene();

        this.updateSun()
    }

    initLights() {
        this.hemiLight.position.set(0, 20, 0);
        this.scene.add(this.hemiLight);

        this.dirLight.position.set(3, 10, 10);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.camera.top = 2;
        this.dirLight.shadow.camera.bottom = -2;
        this.dirLight.shadow.camera.left = -2;
        this.dirLight.shadow.camera.right = 2;
        this.dirLight.shadow.camera.near = 0.1;
        this.dirLight.shadow.camera.far = 40;
        this.scene.add(this.dirLight);
    }

    loadBaloo() {
        const loader = new GLTFLoader();
        loader.load( 'models/gltf/Horse.glb', ( gltf ) => {

            this.balooMesh = gltf.scene.children[ 0 ];
            this.balooMesh.scale.set( 1, 1, 1);
            this.scene.add( this.balooMesh );

            this.balooMixer = new THREE.AnimationMixer( this.balooMesh );

            this.balooMixer.clipAction( gltf.animations[ 0 ] ).setDuration( 1 ).play();

        } );
    }

    updateSun() {

        const phi = THREE.MathUtils.degToRad( 90 - this.parameters.elevation );
        const theta = THREE.MathUtils.degToRad( this.parameters.azimuth );

        this.sun.setFromSphericalCoords( 1, phi, theta );

        this.sky.material.uniforms[ 'sunPosition' ].value.copy( this.sun );
        this.water.material.uniforms[ 'sunDirection' ].value.copy( this.sun ).normalize();

        if ( this.renderTarget !== undefined ) this.renderTarget.dispose();

        this.sceneEnv.add( this.sky );
        this.renderTarget = this.pmremGenerator.fromScene( this.sceneEnv );
        this.scene.add( this.sky );

        this.scene.environment = this.renderTarget.texture;

    }

    animate() {    
        // requestAnimationFrame( this.animate );
        this.render();
    }

    render() {

        // for flipping cube (photo)
        // const time = performance.now() * 0.001;

        // Adjust added value to change rotation velocity
        this.theta += 0.1;

        if ( this.balooMesh ) {
            this.balooMesh.translateZ(this.speed)

            this.camera.position.x = this.balooMesh.position.x + this.radius * Math.sin( THREE.MathUtils.degToRad( this.theta ) );
            this.camera.position.z = this.balooMesh.position.z + this.radius * Math.cos( THREE.MathUtils.degToRad( this.theta ) );

            this.camera.lookAt( this.balooMesh.position );
        }

        if ( this.balooMixer ) {
            this.balooMixer.update( this.clock.getDelta() );
        }

        // for flipping cube (photo)
        // mesh.position.y = Math.sin( time ) * 20 + 5;
        // mesh.rotation.x = time * 0.5;
        // mesh.rotation.z = time * 0.51;

        this.water.material.uniforms[ 'time' ].value += 1.0 / 60.0;

        this.renderer.render( this.scene, this.camera );

    }
}