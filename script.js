"use strict";
import * as THREE from './three/build/three.module.js';
import { TrackballControls } from './three/jsm/controls/TrackballControls.js';
import { GLTFLoader } from './three/jsm/loaders/GLTFLoader.js';
import { DDSLoader } from './three/jsm/loaders/DDSLoader.js';
import { Reflector } from './three/jsm/Reflector.js';

import { EffectComposer } from './three/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './three/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './three/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from './three/jsm/postprocessing/AfterimagePass.js';
import { FilmPass } from './three/jsm/postprocessing/FilmPass.js';

import { OutlinePass } from './three/jsm/postprocessing/OutlinePass.js';


import { ShaderPass } from './three/jsm/postprocessing/ShaderPass.js';
import { LuminosityShader } from './three/jsm/shaders/LuminosityShader.js';
import { SobelOperatorShader } from './three/jsm/shaders/SobelOperatorShader.js';




class ResourceTracker {
    constructor() {
        this.resources = new Set();
    }
    track(resource) {
        if (!resource) {
            return resource;
        }

        if (Array.isArray(resource)) {
            resource.forEach(resource => this.track(resource));
            return resource;
        }

        if (resource.dispose || resource instanceof THREE.Object3D) {
            this.resources.add(resource);
        }
        if (resource instanceof THREE.Object3D) {
            this.track(resource.geometry);
            this.track(resource.material);
            this.track(resource.children);
        } else if (resource instanceof THREE.Material) {
            for (const value of Object.values(resource)) {
                if (value instanceof THREE.Texture) {
                    this.track(value);
                }
            }
            if (resource.uniforms) {
                for (const value of Object.values(resource.uniforms)) {
                    if (value) {
                        const uniformValue = value.value;
                        if (uniformValue instanceof THREE.Texture ||
                                Array.isArray(uniformValue)) {
                            this.track(uniformValue);
                        }
                    }
                }
            }
        }
        return resource;
    }
    untrack(resource) {
        this.resources.delete(resource);
    }

    disposeNode(node) {
        if (node.geometry) {
            node.geometry.dispose();
        }
        if (node.material) {
            var materialArray;
            if (node.material instanceof THREE.MeshFaceMaterial || node.material instanceof THREE.MultiMaterial) {
                materialArray = node.material.materials;
            } else if (node.material instanceof Array) {
                materialArray = node.material;
            }
            if (materialArray) {
                materialArray.forEach(function (mtrl, idx) {
                    if (mtrl.map)
                        mtrl.map.dispose();
                    if (mtrl.lightMap)
                        mtrl.lightMap.dispose();
                    if (mtrl.bumpMap)
                        mtrl.bumpMap.dispose();
                    if (mtrl.normalMap)
                        mtrl.normalMap.dispose();
                    if (mtrl.specularMap)
                        mtrl.specularMap.dispose();
                    if (mtrl.envMap)
                        mtrl.envMap.dispose();
                    mtrl.dispose();
                });
            } else {
                if (node.material.map)
                    node.material.map.dispose();
                if (node.material.lightMap)
                    node.material.lightMap.dispose();
                if (node.material.bumpMap)
                    node.material.bumpMap.dispose();
                if (node.material.normalMap)
                    node.material.normalMap.dispose();
                if (node.material.specularMap)
                    node.material.specularMap.dispose();
                if (node.material.envMap)
                    node.material.envMap.dispose();
                node.material.dispose();
            }
        }
        if (node.dispose) {
            node.dispose();
        }
    }

    dispose() {

        for (let i = 0; i < mScene.scene.children.length; i++) {
            this.disposeNode(mScene.scene.children[i]);
            mScene.scene.remove(mScene.scene.children[i]);
        }
        for (const resource of this.resources) {

            if (resource instanceof THREE.Object3D) {
                if (resource.parent) {
                    resource.parent.remove(resource);
                }
                if (Boolean(resource.material)) {
                    resource.material.dispose();
                    resource.remove(resource.material);
                }
                if (Boolean(resource.geometry)) {
                    resource.geometry.dispose();
                    resource.remove(resource.geometry);
                }
                if (Boolean(resource.texture)) {
                    resource.texture.dispose();
                    resource.remove(resource.texture.geometry);
                }
            }
            if (resource.dispose) {
                resource.dispose();
            }
        }
        this.resources.clear();
        mScene.renderer.dispose();

        this.disposeNode(mScene.afterimagePass);
        for (let key in mScene.afterimagePass) {
            this.disposeNode(mScene.afterimagePass[key]);
        }

        this.disposeNode(mScene.bloomPass);
        for (let key in mScene.bloomPass) {
            this.disposeNode(mScene.bloomPass[key]);
        }

        for (let key in mScene.composer) {
            this.disposeNode(mScene.composer[key]);
        }

        for (let key in mScene.renderer) {
            this.disposeNode(mScene.renderer[key]);
        }

        this.disposeNode(mScene.effectFilm);
        for (let key in mScene.effectFilm) {
            this.disposeNode(mScene.effectFilm[key]);
        }

        this.disposeNode(mScene.effectSobel);
        for (let key in mScene.effectSobel) {
            this.disposeNode(mScene.effectSobel[key]);
        }
    }
}

class MultiScene {

    constructor(data) {
        this.json = data;
        this.resTracker = new ResourceTracker();
        this.track = this.resTracker.track.bind(this.resTracker);
        this.now = Date.now();
        this.delta = Date.now();
        this.then = Date.now();
        this.interval = 1000 / 30;
        this.res_param = HTMLControlls.res_param_get();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.post_dop = true;
    }

    onMouseMove(event) {

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    }

    set_scenes(id) {
        this.scene_id = id;
        this.sname = 'scene' + id;
        let start = this.json[this.sname]['start_position'];
        this.scenes = {
            Scene: {
                name: 'Main',
                url: '/assets/3d/models/' + this.json[this.sname]['gltf'] + '.gltf',
                cameraPos: new THREE.Vector3(start['x'], start['y'], start['z']),
            }
        };
    }

    camera_create() {
        if (this.scene_id === 1) {
            this.camera = new THREE.PerspectiveCamera(this.json[this.sname]['perspective'], this.w / this.h, 0.1, 1400);
            this.controls = new TrackballControls(this.camera, this.renderer.domElement);
            this.controls.maxDistance = 1500;
            this.controls.enabled = false;
        }
        this.camera.position.x = 1000;
    }

    init(gltf) {
        this.set_scenes(gltf);
        this.mobile = false;
        this.mob_delta = 0;
        this.mob_delta_x = 0;
        this.clock = new THREE.Clock();
        this.container = document.getElementById('container');
        this.w = this.container.offsetWidth / this.res_param;
        this.h = this.container.offsetHeight / this.res_param;
        this.container.style.height = '100vh';

        this.step = 0;
        this.lookSpeed = 0.5;
        this.view = {
            "x": 0,
            "y": 0,
            "z": 0
        };
        this.lookFlag = false;
        this.smoothing = 50;
        this.keys = {
            'top': {
                'down': false,
                'code': 87,
                'param': 1,
                'axis': 'y',
                'smooth': false
            },
            'bottom': {
                'down': false,
                'code': 83,
                'param': -1,
                'axis': 'y',
                'smooth': false
            },
            'left': {
                'down': false,
                'code': 68,
                'param': -1,
                'axis': 'z',
                'smooth': false
            },
            'right': {
                'down': false,
                'code': 65,
                'param': 1,
                'axis': 'z',
                'smooth': false
            }
        };
        this.godrayRenderTargetResolutionMultiplier = 1.0 / 4.0;

        this.scene = new THREE.Scene();
        this.scene.background = 'white';
        this.loader = new GLTFLoader();
        this.loader.setDDSLoader(new DDSLoader());
        this.add_shader();
        this.add_text();
        this.add_media();
    }

    set_path() {
        let dots = this.json[this.sname]['path'];
        let vectors = [];
        for (let i = 0; i < Object.keys(dots).length; i++) {
            vectors.push(new THREE.Vector3(dots[i][0], dots[i][1], dots[i][2]));
        }
        this.spline = new THREE.CatmullRomCurve3(vectors);
        this.spline.closed = false;
        if (this.json[this.sname]['debug']) {
            let points = this.spline.getPoints(50);
            let geometry = this.track(new THREE.BufferGeometry().setFromPoints(points));
            let material = this.track(new THREE.LineBasicMaterial({color: 0xff0000}));
            let curveObject = this.track(new THREE.Line(geometry, material));
            this.scene.add(curveObject);
        }
    }

    render_create() {
        if (this.scene_id === 1) {
            this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
            this.renderer.autoClear = true;
            this.renderer.autoClearColor = true;
            this.renderer.autoClearDepth = true;
            this.renderer.autoClearStencil = true;
            this.renderer.debug.checkShaderErrors = false;
            this.renderer.localClippingEnabled = true;
            this.container.appendChild(this.renderer.domElement);
        }
    }

    postprocessing_create() {

        this.composer = this.track(new EffectComposer(this.renderer));
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloomPass = this.track(new UnrealBloomPass(new THREE.Vector2(this.w, this.h), 1.5, 0.4, 0.85));
        this.bloomPass.threshold = 0.6;
        this.bloomPass.strength = 0.45;
        this.bloomPass.radius = 1.5;
        this.composer.addPass(this.bloomPass);
        this.afterimagePass = new AfterimagePass();
        this.afterimagePass.uniforms[ "damp" ].value = 0.4;
        this.afterimagePass.renderToScreen = true;
        this.composer.addPass(this.afterimagePass);

        //this.effectFilm = new FilmPass(0.02, 0.925, 10008, false);

        //this.effectFilm = new FilmPass(0.35, 0.025, 648, false);

        this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
        this.outlinePass.edgeStrength = 10;
        this.outlinePass.visibleEdgeColor.set('#931400');
        this.outlinePass.edgeThickness = 4;
        this.outlinePass.usePatternTexture = true;
        this.composer.addPass(this.outlinePass);

        // this.composer.addPass(this.effectFilm);

        //var effectGrayScale = new ShaderPass(LuminosityShader); //вариант без него
        // this.composer.addPass(effectGrayScale);
        //this.effectSobel = this.track(new ShaderPass(SobelOperatorShader));
        //this.effectSobel.uniforms[ 'resolution' ].value.x = this.w;
        //this.effectSobel.uniforms[ 'resolution' ].value.y = this.h;
        //this.composer.addPass(this.effectSobel);

        //this.set_after_post(this.json[this.sname]['amsterdam']);
    }

    after_switch() {
        let n = this.composer.passes[1].enabled;
        this.composer.passes[1].enabled = (n) ? false : true;
    }

    onload() {
        this.figure = {
            'cubes': [],
            'text': []
        };
        this.render_create();
        this.camera_create();
        this.postprocessing_create();

        this.container.style.background = this.json[this.sname]['background'];
        this.container.style.filter = this.json[this.sname]['css']['filter'];
        this.scroll_dist = this.json[this.sname]['speed'];
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.w, this.h);
        this.composer.setSize(this.w, this.h);
        this.renderer.physicallyCorrectLights = true;
        this.set_path();
        this.init_scene(this.scenes[ 'Scene' ]);
    }

    add_media() {
        let video = document.getElementById('wrd');
        let texture = this.track(new THREE.VideoTexture(video));
        var parameters = {color: 0xffffff, map: texture, wireframe: false};

        let geometry = this.track(new THREE.BoxGeometry(190, 190, 310));
        let material = this.track(new THREE.MeshLambertMaterial(parameters));
        let cube = this.track(new THREE.Mesh(geometry, material));
        cube.name = 'wrd';
        cube.position.x = -80;
        cube.position.y = -2200;
        cube.position.z = 0;
        cube.rotation.x = 0;
        cube.rotation.y = 0;
        cube.rotation.z = 0;
        this.scene.add(cube);
        video.play();
    }

    gltf_done(gltf) {
        let object = this.track(gltf.scene);

        for (let i = 0; i < object.children.length; i++) {
            this.track(object.children[i]);
        }

        let animations = gltf.animations;
        this.mixer = this.track(new THREE.AnimationMixer(object));
        for (let i = 0; i < animations.length; i++) {
            let animation = animations[ i ];
            if (this.time) {
                animation.duration = this.time;
            }
            if (!this.json[this.sname]['animation']) {
                this.mixer.update(this.clock.getDelta());
            }
            let action = this.mixer.clipAction(animation);
            action.play();
        }
        this.add_obj(object);
        this.on_window_resize();
        this.animate();
    }

    load_GLTF(url) {
        let self = this;
        return new Promise((resolve, reject) => {
            this.track(this.loader.load(url, function (gltf) {
                self.gltf_done(gltf);
            }, undefined, reject));

        });
    }

    init_scene(sceneInfo) {
        let fog = this.json[this.sname]['fog'];
        this.scene.fog = this.track(new THREE.Fog(new THREE.Color(fog.color), fog.near, fog.far));

        let ambient = this.track(new THREE.AmbientLight(this.json[this.sname]['ambient']));
        this.scene.add(ambient);
        let lgt = this.json[this.sname]['light'];
        let light = this.track(new THREE.HemisphereLight(lgt.sky, lgt.color, lgt.power));
        light.position.x = 0;
        this.scene.add(light);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1, 100);
        directionalLight.position.set(0, 1, 0);
        this.scene.add(directionalLight);
        directionalLight.shadow.mapSize.width = 512; // default
        directionalLight.shadow.mapSize.height = 512; // default
        directionalLight.shadow.camera.near = 0.5; // default
        directionalLight.shadow.camera.far = 500; // default
        this.renderer.shadowMap.enabled = true; //?
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.gltf = this.load_GLTF(sceneInfo.url);
        this.camera.position.copy(sceneInfo.cameraPos);
        this.add_sphere();
        this.point_massive();
        this.add_logo();
    }

    add_obj(obj) {
        this.scene.add(obj);
    }

    on_window_resize() {
        this.camera.aspect = this.container.offsetWidth / this.container.offsetHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
    }

    animate() {
        requestAnimationFrame(mScene.animate);
        if (mScene.json[mScene.sname]['animation']) {
            mScene.mixer.update(mScene.clock.getDelta());
        }
        mScene.controls.update();
        mScene.render();
        mScene.composer.render(mScene.delta);
    }

    render() {
    }

    get_step_size(filterLen, tapsPerPass, pass) {
        return filterLen * Math.pow(tapsPerPass, -pass);
    }

    rand_int(min, max) {
        return min + Math.floor((max - min) * Math.random());
    }

    text_done(font, data) {
        let geometry;
        for (let i = 0; i < 100; i++) {
            geometry = this.track(new THREE.TextBufferGeometry(data.text, {
                font: font,
                size: data.size,
                height: 1,
                curveSegments: 12,
                bevelEnabled: false,
                bevelThickness: 10,
                bevelSize: 8,
                bevelOffset: 0,
                bevelSegments: 5
            }));
            var obj = this.track(new THREE.Mesh(geometry));
            obj.name = data.name;
            obj.material = (data.material === 'shaderGrad') ? this.shaderGrad : new THREE.MeshBasicMaterial({color: 0x000000});

            obj.position.x = data.x;
            obj.position.y = data.y;
            obj.position.z = data.z;
            obj.rotation.x = 0;
            obj.rotation.y = data.ry;
            obj.rotation.z = 0;
            this.figure.text.push(obj);
            this.scene.add(obj);
        }
    }

    add_text() {
        var loader = new THREE.FontLoader();
        let self = this;
        let data = {
            0: {
                'text': 'Пути',
                'name': 'ousia',
                'size': 5,
                'material': 'shaderGrad',
                'x': 240,
                'y': -1.5,
                'z': 55,
                'ry': -80
            },
            1: {
                'text': 'Инструментарий',
                'name': 'no',
                'size': 10,
                'material': 'no',
                'x': 70,
                'y': -350,
                'z': 250,
                'ry': 1.5
            },
            2: {
                'text': 'Манускрипторий',
                'name': 'no',
                'size': 10,
                'material': 'no',
                'x': 70,
                'y': -350,
                'z': 50,
                'ry': 1.5
            },
            3: {
                'text': 'Цех Ордена',
                'name': 'no',
                'size': 10,
                'material': 'no',
                'x': 75,
                'y': -350,
                'z': -150,
                'ry': 1.5
            }
        };
        loader.load('/assets/3d/Proxima.json', function (font) {
            for (let i = 0; i < Object.keys(data).length; i++) {
                self.text_done(font, data[i]);
            }

        });
    }

    logo_done(texture, data) {
        let geometry = this.track(new THREE.BoxGeometry(10, 10, 10));
        let material = this.track(new THREE.MeshStandardMaterial({map: texture}));
        let cube = this.track(new THREE.Mesh(geometry, material));
        cube.name = 'sxzm';
        cube.position.x = -235;
        cube.position.y = -3365;
        cube.position.z = -120;
        cube.rotation.x = 0;
        cube.rotation.y = 0;
        cube.rotation.z = 0;
        this.scene.add(cube);
        this.figure.cubes.push(cube);
    }

    add_logo() {
        let loader = new THREE.TextureLoader();
        let self = this;
        let txt = this.track(loader.load('/assets/3d/img/4.png', function (texture) {
            self.logo_done(texture);
        }));
    }

    sphere_done(texture, data) {
        let geometry = this.track(new THREE.SphereGeometry(25, 15, 15));
        let material = this.track(new THREE.MeshStandardMaterial({map: texture}));
        let cube = this.track(new THREE.Mesh(geometry, material));

        cube.name = data.name;

        cube.material.lightMapIntensity = 0.1;
        cube.material.emissiveIntensity = 0;

        cube.position.x = data.x;
        cube.position.y = data.y;
        cube.position.z = data.z;
        cube.rotation.x = 0;
        cube.rotation.y = data.ry;
        cube.rotation.z = 0;
        this.scene.add(cube);
        this.figure.cubes.push(cube);
    }

    add_sphere() {
        let loader = new THREE.TextureLoader();
        let self = this;

        let data = {
            0: {
                'name': 'tool',
                'texture': '/assets/3d/img/3.png',
                'x': 140,
                'y': -410,
                'z': 150,
                'ry': 1.01
            },
            1: {
                'name': 'manus',
                'texture': '/assets/3d/img/1.png',
                'x': 105,
                'y': -410,
                'z': 5,
                'ry': 0
            },
            2: {
                'name': 'c',
                'texture': '/assets/3d/img/2.png',
                'x': 130,
                'y': -410,
                'z': -150,
                'ry': -1.5
            }
        };

        let txt;

        for (let i = 0; i < Object.keys(data).length; i++) {
            txt = this.track(loader.load(data[i].texture, function (texture) {
                self.sphere_done(texture, data[i]);
            }));
        }
    }
    cube_done(texture)
    {
        let rnd = this.rand_int(1, 50);
        let geometry = this.track(new THREE.BoxGeometry(rnd, rnd, rnd));
        let material = this.track(new THREE.MeshBasicMaterial({map: texture}));
        let cube = this.track(new THREE.Mesh(geometry, material));
        cube.position.x = this.rand_int(1000, -1000);
        cube.position.y = this.rand_int(-500, 500);
        cube.position.z = this.rand_int(-500, 500);
        cube.rotation.x = this.rand_int(-90, 90);
        cube.rotation.y = this.rand_int(-90, 90);
        cube.rotation.z = this.rand_int(-90, 90);
        cube.random = this.rand_int(-100, 100);
        this.scene.add(cube);
        this.figure.cubes.push(cube);
    }

    add_cube() {
        let loader = new THREE.TextureLoader();
        let t = Math.floor(Math.random() * Math.floor(14)) + 1;
        let self = this;
        let txt = this.track(loader.load('1.png', function (texture) {
            self.cube_done(texture);
        }));
    }

    mirrors_massive(x = 580, y = 0, z = 0, size_y = 250, size_z = 250) {
        this.mir_wal = [];
        for (let j = 0; j < 3; j++) {
            for (let i = 0; i < 3; i++) {
                if ((i !== 0) || (j !== 1)) {
                    let geometry = this.track(new THREE.BoxGeometry(1, size_z, size_y));
                    this.mir_wal[i] = this.track(new Reflector(geometry, {
                        clipBias: 0.05,
                        textureWidth: this.w * window.devicePixelRatio,
                        textureHeight: this.h * window.devicePixelRatio,
                        color: 0x777777,
                        recursion: 1
                    }));
                    this.mir_wal[i].position.x = x - i;
                    this.mir_wal[i].position.y = i * size_y - 0;
                    this.mir_wal[i].position.z = j * size_z - 200;
                    this.mir_wal[i].rotation.z = -0.2;
                    this.figure.mirror.push(this.mir_wal[i]);
                    this.scene.add(this.mir_wal[i]);
                }
            }
    }
    }

    mirrors_custom() {
        let data = this.json[this.sname].mirror;
        let geometry, mirror;
        for (let i = 0; i < Object.keys(data).length; i++) {
            geometry = this.track(new THREE.BoxGeometry(1, data[i].size.w, data[i].size.h));
            mirror = this.track(new Reflector(geometry, {
                clipBias: 0.05,
                textureWidth: this.w * window.devicePixelRatio,
                textureHeight: this.h * window.devicePixelRatio,
                color: 0x777777,
                recursion: 1
            }));
            mirror.position.x = data[i].pos.x;
            mirror.position.y = data[i].pos.y;
            mirror.position.z = data[i].pos.z;
            mirror.rotation.x = data[i].rotate.x;
            mirror.rotation.y = data[i].rotate.y;
            mirror.rotation.z = data[i].rotate.z;
            this.scene.add(mirror);
        }
    }

    point_massive() {
        var vertices = [];
        for (var i = 0; i < 10000; i++) {
            var x = this.rand_int(300, -2000);
            var y = this.rand_int(-900, -2000);
            var z = this.rand_int(-2000, 2000);
            vertices.push(x, y, z);
        }
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        var material = this.track(new THREE.PointsMaterial({color: 0x888888}));
        var points = this.track(new THREE.Points(geometry, material));
        this.scene.add(points);
    }

    add_mirror() {
        var mirrorGeometry = this.track(new THREE.CircleGeometry(400, 400));
        this.groundMirror = this.track(new Reflector(mirrorGeometry, {
            clipBias: 0.05,
            textureWidth: this.w * window.devicePixelRatio,
            textureHeight: this.h * window.devicePixelRatio,
            color: 0x777777,
            recursion: 1
        }));
        this.groundMirror.rotation.y = 90;
        this.scene.add(this.groundMirror);
    }

    add_shader() {
        let texture = this.track(new THREE.TextureLoader().load("/assets/3d/img/1.png"));
        this.uniforms = {
            "amplitude": {value: 1.0},
            "color": {value: new THREE.Color(0xff2200)},
            "colorTexture": {value: texture}
        };
        this.uniforms.resolution = {type: 'v2', value: new THREE.Vector2(this.w, this.h)};
        this.uniforms[ "colorTexture" ].value.wrapS = this.uniforms[ "colorTexture" ].value.wrapT = THREE.RepeatWrapping;
        this.shaderMaterial = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: document.getElementById('vertexshader').textContent,
            fragmentShader: document.getElementById('fragmentshader').textContent
        });
        this.shader_speed = 0.001;
        this.shaderGrad = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            fragmentShader: document.getElementById('fragShader').textContent
        });
    }

    scroll_timer_stop() {
        $.doTimeout('loopc');
    }

    scroll_step_done(coord, curve) {
        this.view.y = this.camera.position['y'];
        this.controls.target['y'] = this.view.y;
        if (Math.abs(this.camera.position[coord] - curve[coord]) > 1) {
            let tmp = (this.camera.position[coord] > curve[coord]) ? -1 : 1;
            if (Math.abs(this.camera.position[coord] - curve[coord]) > (this.scroll_dist * 30)) {
                curve[coord] += (this.scroll_dist * 5) * tmp * (-1);
            }
            this.camera.position[coord] += Math.abs(this.camera.position[coord] - curve[coord]) / (this.scroll_dist * 4) * tmp;
            if (this.camera.position.y < -2000 && this.camera.position.y > -2200) { //проверка на окончание прокрутки
                this.bloomPass.strength = 0.1;
            } else {
                this.bloomPass.strength = 0.4;
            }
            return true;
        } else {
            return false;
        }

    }

    scroll_do(curve) {
        let self = this;
        $.doTimeout('loopc');
        $.doTimeout('loopc', 1, function () {
            return Boolean(self.scroll_step_done('x', curve) + self.scroll_step_done('y', curve) + self.scroll_step_done('z', curve));
        });
    }

    do_step(d) {
        let nd = (d > 0) ? 1 : (-1);
        this.step += this.scroll_dist * (nd);
        return nd;
    }

    on_wheel(e) {
        let delta;
        if (this.mobile) {
            delta = this.mob_delta;
            this.scroll_dist = 10;
            //this.view.z += this.mob_delta_x * 30;
            // console.log(this.camera.position['x'] +' '+ this.view.x);
            //this.controls.target['z'] = this.view.z;
            //console.log(this.controls.target);

        } else {
            e = e || window.event;
            delta = (e !== undefined) ? e.deltaY || e.detail || e.wheelDelta : 20;
        }
        delta = this.do_step(delta);
        this.step = (this.step < 0) ? 0 : this.step;
        let curve_coord = this.spline.getPoint(this.step / 2000);
        this.scroll_do(curve_coord);
        this.uniforms[ "color" ].value.offsetHSL(0.005, 0, 0);
        if (!this.json[this.sname]['animation']) {
            this.mixer.update(curve_coord.x / 2000);
        }

    }

    addSelectedObject(object) {
        this.selectedObjects = [];
        this.selectedObjects.push(object);
    }

    inter_click() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        let intersects = this.raycaster.intersectObjects(this.scene.children);
        if (intersects.length > 0) {
            if (intersects[ 0 ].object.name !== '') {
                window.location = 'https://sacri.ru/' + intersects[ 0 ].object.name;
            }
        }
    }

    inter() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        let intersects = this.raycaster.intersectObjects(this.scene.children);

        if (intersects.length > 0 && intersects[ 0 ].object.name !== 'ousia' && intersects[ 0 ].object.name !== 'wrd') {
            if (intersects[ 0 ].object.name === 'c' && this.post_dop) {
                this.bloomPass.threshold = 0.2;
                this.bloomPass.radius = 15;
                this.bloomPass.strength = 1;
                this.post_dop = false;
                this.on_wheel();
                setTimeout(function () {
                    mScene.post_dop = true;

                }, 2000);

            }
            if (intersects[ 0 ].object.name === 'manus' && this.post_dop) {
                this.bloomPass.threshold = 0.4;
                this.bloomPass.strength = 0.4;
                this.bloomPass.radius = 1.5;
                this.post_dop = false;
                this.on_wheel();
                setTimeout(function () {
                    mScene.post_dop = true;

                }, 2000);
            }

            if (intersects[ 0 ].object.name === 'tool' && this.post_dop) {
                this.bloomPass.threshold = 0.55;
                this.bloomPass.radius = 5;
                this.bloomPass.strength = 0.1;
                this.post_dop = false;
                this.on_wheel();
                setTimeout(function () {
                    mScene.post_dop = true;

                }, 1000);
            }

            let selectedObject = intersects[ 0 ].object;
            //selectedObject.scale.set(2, 2, 2);

            this.addSelectedObject(selectedObject);
            HTMLControlls.outline(true);

        } else {
            if (this.selectedObjects) {
                for (let i = 0; i < Object.keys(this.selectedObjects).length; i++) {
                    this.selectedObjects[i].scale.set(1, 1, 1);
                }
                HTMLControlls.outline(false);
            }
        }
    }

    cursor_move(z, y) {
        if (this.mobile) {
            this.view.z += this.mob_delta_x;
            this.controls.target['z'] = this.view.z;
        } else {
            y = this.h / 4 - y / 2;
            z = this.w / 4 - z / 2;
            this.controls.target = new THREE.Vector3(this.view.x, this.view.y, z);
        }
    }

}

// Старт событий и таймеров


var json = {
    "scene1": {
        "gltf": "1",
        "perspective": 90, //перспектива камеры
        "background": "white",
        "ambient": "rgb(255, 255, 0)",
        'post': '',
        'start_position': {
            "x": 100,
            "y": 10,
            "z": 0
        },
        "light": {
            'sky': "rgb(146,181,249)",
            'color': "rgb(255, 255, 255)",
            'power': 2
        },
        "path": {
            "0": [300, 0, 0],
            "1": [290, -100, 5],
            "2": [270, -200, 30],
            "3": [240, -300, 20],
            "4": [220, -400, 0],
            "5": [200, -500, 0],
            "6": [150, -600, 0],
            "7": [130, -700, 0],
            "8": [130, -800, 0],
            "9": [130, -1000, 0],
            "10": [130, -1200, 0],
            "11": [130, -1400, 0],
            "12": [130, -1600, 0],
            "13": [130, -2000, 0],
            "14": [130, -2500, 0],
            "15": [130, -3000, 0],
            "16": [0, -3500, 0],
            "17": [-140, -500, 0],
            "18": [350, 100, 0]
        },
        "fog": {
            "color": "rgb(0, 0, 100)",
            "near": 10,
            "far": 1000
        },
        'animation': true, // автоматическая или при прокрутке
        "css": {
            "filter": "none"
        },
        "amsterdam": false, // автоматически включать AfterimagePass
        "debug": false, // рисовать маршрут движения камеры
        'speed': 10
    }
};

var mScene = new MultiScene(json);
mScene.init(1);
mScene.onload();

$('#container').on('wheel', function (e) {
    $.doTimeout('a_scroll');
    $('#play').removeClass("auto_scroll_on");
    mScene.on_wheel();
});

var lastY;
var h_fmob = document.documentElement.clientHeight;
var w_fmob = document.documentElement.clientWidth;
$('#container').on('touchmove', function (e) {
    mScene.mobile = true;
    var currentY = e.originalEvent.touches[0].clientY;
    mScene.mob_delta = (currentY > lastY) ? -0.05 : 0.05;
    lastY = currentY;

    var currentX = e.originalEvent.touches[0].clientX;
    mScene.mob_delta_x = (currentX > w_fmob / 2) ? -30 : 30;

    $('#container').trigger('wheel');
});

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Kindle|Silk|Opera Mini/i.test(navigator.userAgent)) {
    HTMLControlls.mobileIcon();
}

$("#container").click(function (event) { // обработка ссылок
    if (!mScene.mobile) {
        mScene.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mScene.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        mScene.inter_click();
    }else{
        var currentX = event.clientX;
        mScene.mob_delta_x = (currentX > w_fmob / 2) ? -30 : 30;
    }
});

$("#container").mousemove(function (event) {
    mScene.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mScene.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    mScene.cursor_move(event.clientX / mScene.res_param, event.clientY / mScene.res_param);

    mScene.inter();
});
