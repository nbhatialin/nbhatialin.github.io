import * as THREE from "three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky, Water } from "three/examples/jsm/Addons.js";
import getRandomInt from "./getRandomInt";

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
        this.starMeshes = []
        this.renderedStars = new Set()
        this.starCounter = 0
        this.parameters = {
            elevation: 2,
            azimuth: 180
        }
        this.clock = new THREE.Clock();
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 3);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 3);

        this.radius = 600
        this.theta = 0

        this.speed = 4

        this.varianceFactor = [13, 31, 19, 41]
        this.varianceFactorLength = 3
        this.varianceFactorIndex = 0

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

    // used to change camera between stars & baloo
    target: THREE.Mesh

    // Array to store meshes of photo-textured stars
    // Could be a map to refer by image name then delete later
    
    // or make it an array, potentially initialize all at load & just select at random when dropping from sky
    // not random, loop through to ensure unique star
    // 2 arrays -- one to store stars in sky & one to store options
    starMeshes: Array<THREE.Mesh>
    renderedStars: Set<THREE.Mesh>
    starCounter: number


    varianceFactor: Array<number>
    varianceFactorIndex: number
    varianceFactorLength: number

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

        // this.loadStars()
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
                distortionScale: 3.7, // how clearly items reflect in water
                fog: this.scene.fog !== undefined
            }
        );

        this.water.rotation.x = - Math.PI / 2;

        this.scene.add( this.water );
    }

    initSkybox() {
        this.sky = new Sky();
        // Should match waterGeometry size for extended runway if target is moving
        this.sky.scale.setScalar( 100000000 );
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
        loader.load( 'models/gltf/Horse.glb', async ( gltf ) => {
            console.log(gltf)
            this.balooMesh = gltf.scene.children[0];
            this.balooMesh.scale.set( .5, .5, .5);
            this.scene.add( this.balooMesh );

            this.balooMixer = new THREE.AnimationMixer( this.balooMesh );

            this.balooMixer.clipAction( gltf.animations[ 0 ] ).setDuration( 1 ).play();

            this.target = this.balooMesh
            this.loadStars()
        } );
    }

    loadStars() {
        for (let i = 1; i < 366; i++) {
            this.generateStar(i)
        }
        
        setTimeout(() => {
            this.renderStars()  
        }, 5000);
    }

    generateStar(idx: number) {
        const texture = new THREE.TextureLoader().load( `textures/ab_aw/aw_${idx}.jpeg` );
        texture.colorSpace = THREE.SRGBColorSpace;

        const geometry = new THREE.BoxGeometry( 30, 30, 30 );
        const material = new THREE.MeshBasicMaterial( { map: texture } );
        const mesh = new THREE.Mesh( geometry, material );

        this.starMeshes.push(mesh)
    }

    renderStars() { 
        if (this.starCounter < 365) {
            this.renderStar(this.starCounter)
            this.starCounter++
            setTimeout(() => {
                this.renderStars()  
            }, 100); // initial frequency at which stars render
        } else {
            console.log('365 rendered')
        }
        

    }

    renderStar(idx: number) {
        const meshPosition = this.balooMesh.position.clone()

        meshPosition.x += getRandomInt(-1000, 1000);
        meshPosition.y = getRandomInt(500, 1500);
        // meshPosition.y = 100
        meshPosition.z += getRandomInt(888, 2888);

        this.starMeshes[idx].position.copy( meshPosition )
        // initialize position based on current baloo.position + add y to drop from sky

        this.scene.add( this.starMeshes[idx] );

        // temporary to track star
        // this.target = mesh

        this.renderedStars.add(this.starMeshes[idx])
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
        const time = performance.now() * 0.001;
        // Adjust added value to change rotation velocity
        this.theta += 0.1;
        const delta = this.clock.getDelta()

        // console.log(Math.cos(this.clock.elapsedTime / 50))
        // console.log(this.clock.elapsedTime)
        // console.log(Math.sin( delta ))
        
        // adjust camera radius / zoom for variability
        this.radius = Math.abs(Math.cos(this.clock.elapsedTime / 20) * 600) + 200

        if ((this.clock.elapsedTime + 1) % this.varianceFactor[this.varianceFactorIndex % this.varianceFactorLength] < 1) {
            this.varianceFactorIndex++
            // Swap targets
            // this.target = [...this.renderedStars][Math.floor(Math.random()*this.renderedStars.size)]
        }

        // Case for slowmo: radius < x && variance factor == certain 1 or 2


        // if camera zoom far in go slow mo (slow speed of falling stars & z translate proportionally)


        // Rotate and drop stars through scene
        for (const mesh of this.renderedStars) {
            mesh.position.y -= Math.sin( delta ) * this.speed + 1;
            mesh.rotation.x = time * 0.5;
            mesh.rotation.z = time * 0.51;
            if (mesh.position.y < -15) {
                this.renderedStars.delete(mesh)
                this.scene.remove(mesh)
                this.renderStar(getRandomInt(1, 364))
            }
        }

        if ( this.balooMesh ) {
            this.balooMesh.translateZ(this.speed) + 1   
        }

        // have camera track target
        if (this.target) {
            // 
            this.camera.position.y = this.target.position.y + 200

            // rotate around target
            this.camera.position.x = this.target.position.x + this.radius * Math.sin( THREE.MathUtils.degToRad( this.theta ) );
            this.camera.position.z = this.target.position.z + this.radius * Math.cos( THREE.MathUtils.degToRad( this.theta ) );
            
            // focus on target
            this.camera.lookAt( this.target.position );
        }

        if ( this.balooMixer ) {
            this.balooMixer.update( delta );
        }

        this.water.material.uniforms[ 'time' ].value += 1.0 / 60.0;

        this.renderer.render( this.scene, this.camera );

    }
}