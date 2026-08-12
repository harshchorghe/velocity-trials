/**
 * 3D Procedural Maps using Three.js for Velocity Trials
 * Replaces the 2D background with dynamic 3D environments that react to player movement.
 */

let map3dScene, map3dCamera, map3dRenderer, map3dAnimationId;
let playerMesh;

function initThreeJSMap(containerId, canvasWidth, canvasHeight) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    if (map3dRenderer) {
        cancelAnimationFrame(map3dAnimationId);
        container.innerHTML = '';
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020a14, 0.003);

    const camera = new THREE.PerspectiveCamera(60, canvasWidth / canvasHeight, 0.1, 2000);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(canvasWidth, canvasHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    map3dScene = scene;
    map3dCamera = camera;
    map3dRenderer = renderer;

    return { scene, camera, renderer };
}

function initLevel2Map3D(w, h) {
    const ctx3d = initThreeJSMap('map3d-container-l2', w, h);
    if (!ctx3d) return;

    const { scene, camera, renderer } = ctx3d;
    
    // City Floor Grid
    const gridHelper = new THREE.GridHelper(2000, 40, 0x00d4ff, 0x003355);
    gridHelper.position.y = -20;
    scene.add(gridHelper);

    // Procedural Buildings
    const buildingMaterial = new THREE.MeshPhongMaterial({
        color: 0x0a2814,
        emissive: 0x001100,
        specular: 0x39ff14,
        shininess: 100,
        transparent: true,
        opacity: 0.8,
        wireframe: true
    });
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    // Scatter buildings
    for (let i = 0; i < 40; i++) {
        const mesh = new THREE.Mesh(geometry, buildingMaterial);
        mesh.position.x = (Math.random() - 0.5) * 1500;
        mesh.position.z = (Math.random() - 0.5) * 1500;
        
        const scaleY = 50 + Math.random() * 200;
        mesh.scale.set(60 + Math.random() * 80, scaleY, 60 + Math.random() * 80);
        mesh.position.y = scaleY / 2 - 20;
        
        scene.add(mesh);
    }

    // Player indicator
    playerMesh = new THREE.Mesh(
        new THREE.SphereGeometry(15, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true })
    );
    scene.add(playerMesh);

    // Camera perspective: Angled top-down
    camera.position.set(0, 400, 600);
    camera.lookAt(0, 0, 0);

    function animate() {
        map3dAnimationId = requestAnimationFrame(animate);
        
        // Sync with GAME_STATE.level2
        if (typeof GAME_STATE !== 'undefined' && GAME_STATE.level2) {
            const px = GAME_STATE.level2.playerX - (w / 2);
            const pz = GAME_STATE.level2.playerY - (h / 2);
            
            playerMesh.position.x = px;
            playerMesh.position.z = pz;

            // Camera smoothly follows player
            camera.position.x += (px - camera.position.x) * 0.05;
            camera.position.z += (pz + 600 - camera.position.z) * 0.05;
            camera.lookAt(camera.position.x, 0, camera.position.z - 600);
        }

        renderer.render(scene, camera);
    }
    animate();
}

function initLevel3Map3D(w, h) {
    const ctx3d = initThreeJSMap('map3d-container-l3', w, h);
    if (!ctx3d) return;

    const { scene, camera, renderer } = ctx3d;
    
    // Blood red fog for MK vibe
    scene.fog = new THREE.FogExp2(0x330000, 0.002);
    scene.background = new THREE.Color(0x1a0000);
    
    // MK Arena Floor - Solid stone-like
    const floorGeo = new THREE.CylinderGeometry(500, 500, 20, 64);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.9,
        metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -30;
    scene.add(floor);

    // Inner glowing ring (blood sigil)
    const ringGeo = new THREE.RingGeometry(400, 420, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -19; // Just above floor
    scene.add(ring);

    // Massive Spikes / Pillars
    const pGeo = new THREE.ConeGeometry(30, 400, 4);
    const pMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7, metalness: 0.8 });
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const p = new THREE.Mesh(pGeo, pMat);
        p.position.set(Math.cos(angle) * 480, 150, Math.sin(angle) * 480);
        
        // Add fire/glow to top of each spike
        const fire = new THREE.PointLight(0xff3300, 1, 300);
        fire.position.set(0, 200, 0);
        p.add(fire);
        
        scene.add(p);
    }

    // Directional light for shadows
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(0, 1000, 500);
    scene.add(dirLight);
    
    // Floating Embers (Particles)
    const emberGeo = new THREE.BufferGeometry();
    const emberCount = 1000;
    const emberPositions = new Float32Array(emberCount * 3);
    for(let i=0; i<emberCount*3; i++) {
        emberPositions[i] = (Math.random() - 0.5) * 1200;
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
    const emberMat = new THREE.PointsMaterial({ color: 0xff5500, size: 4, transparent: true, opacity: 0.8 });
    const embers = new THREE.Points(emberGeo, emberMat);
    scene.add(embers);

    // The Overlord Core
    const coreMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(60, 0),
        new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff0000, roughness: 0.2, metalness: 1 })
    );
    coreMesh.position.y = 150;
    scene.add(coreMesh);

    camera.position.set(0, 300, 800);
    camera.lookAt(0, 0, 0);

    let time = 0;
    function animate() {
        map3dAnimationId = requestAnimationFrame(animate);
        time += 0.01;
        
        // Rotate Core
        coreMesh.rotation.y += 0.02;
        coreMesh.rotation.z += 0.01;
        coreMesh.position.y = 150 + Math.sin(time * 3) * 20;

        // Animate Embers upwards
        const positions = embers.geometry.attributes.position.array;
        for(let i=1; i<emberCount*3; i+=3) {
            positions[i] += Math.random() * 2;
            if(positions[i] > 600) positions[i] = -200; // Reset height
        }
        embers.geometry.attributes.position.needsUpdate = true;

        // Cinematic slow camera rotation around the arena
        camera.position.x = Math.sin(time * 0.2) * 800;
        camera.position.z = Math.cos(time * 0.2) * 800;
        camera.lookAt(0, 100, 0);

        renderer.render(scene, camera);
    }
    animate();
}
