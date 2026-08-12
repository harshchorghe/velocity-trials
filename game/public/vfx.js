/**
 * LAYER 0: ATMOSPHERIC VFX (THREE.JS PARTICLE FIELD & GSAP)
 */
async function loadScripts() {
    const scripts = [
        "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"
    ];

    for (const src of scripts) {
        if (!document.querySelector(`script[src="${src}"]`)) {
            await new Promise((resolve) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                document.head.appendChild(s);
            });
        }
    }
}

async function initAtmosphere() {
    await loadScripts();

    // 1. Scan Line & Noise Overlays (CSS injected via JS)
    const overlay = document.createElement('div');
    overlay.id = 'vfx-atmosphere-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        pointer-events: none;
        z-index: 5;
        background: repeating-linear-gradient(transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
    `;

    const vignette = document.createElement('div');
    vignette.id = 'vfx-vignette';
    vignette.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        pointer-events: none;
        z-index: 6;
        background: radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.4) 100%);
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(vignette);

    // 2. Three.js Particle Field
    const container = document.createElement('div');
    container.id = 'vfx-canvas-container';
    container.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        pointer-events: none;
        z-index: 0;
    `;
    document.body.insertBefore(container, document.body.firstChild);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 300;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const particleCount = 800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    const basePositions = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color(0x00F5C4);
    const color2 = new THREE.Color(0x7B2FFF);

    for (let i = 0; i < particleCount; i++) {
        // Random volume: x: -400 to 400, y: -300 to 300, z: -200 to 100
        const x = (Math.random() - 0.5) * 800;
        const y = (Math.random() - 0.5) * 600;
        const z = (Math.random() - 0.5) * 300 - 50;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        basePositions[i * 3] = x;
        basePositions[i * 3 + 1] = y;
        basePositions[i * 3 + 2] = z;

        phases[i] = Math.random() * Math.PI * 2;

        const c = Math.random() > 0.3 ? color1 : color2;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 1.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        sizeAttenuation: true
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    let mouseX = 0;
    let mouseY = 0;
    let time = 0;

    window.addEventListener('mousemove', (e) => {
        // Normalize mouse for camera parallax
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate() {
        requestAnimationFrame(animate);
        time += 0.003;

        const posAttr = geometry.attributes.position;
        const posArray = posAttr.array;

        // Camera Parallax (Lerp)
        camera.position.x += (mouseX * 15 - camera.position.x) * 0.05;
        camera.position.y += (mouseY * 10 - camera.position.y) * 0.05;

        // Breathing Drift
        for (let i = 0; i < particleCount; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;
            
            // Re-apply drift to base position
            posArray[iy] = basePositions[iy] + Math.sin(time + phases[i]) * 15;
        }
        
        posAttr.needsUpdate = true;
        renderer.render(scene, camera);
    }
    animate();
}

// Boot the VFX
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAtmosphere);
} else {
    initAtmosphere();
}
