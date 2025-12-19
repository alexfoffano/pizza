const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Events = Matter.Events,
      World = Matter.World,
      Body = Matter.Body;

// --- CONFIGURAÇÃO ---
const LOGICAL_WIDTH = 360;  
const LOGICAL_HEIGHT = 640; 
const ASPECT_RATIO = LOGICAL_WIDTH / LOGICAL_HEIGHT;

const WALL_THICKNESS = 2000; 
const FLOOR_OFFSET = 30; 
const DEADLINE_Y = 130;

// --- IMAGENS & ASSETS ---
const ART_SIZE = 512; 
const IMG_PATH = 'img/'; 

const FRUITS = [
    { r: 16, color: '#F00', score: 2,  img: 'fruit_0.png' },
    { r: 24, color: '#F55', score: 4,  img: 'fruit_1.png' },
    { r: 32, color: '#A0A', score: 6,  img: 'fruit_2.png' },
    { r: 38, color: '#FA0', score: 8,  img: 'fruit_3.png' },
    { r: 46, color: '#F80', score: 10, img: 'fruit_4.png' },
    { r: 58, color: '#F00', score: 12, img: 'fruit_5.png' },
    { r: 70, color: '#ED0', score: 14, img: 'fruit_6.png' },
    { r: 84, color: '#FB8', score: 16, img: 'fruit_7.png' },
    { r: 98, color: '#FF0', score: 18, img: 'fruit_8.png' },
    { r: 112,color: '#0F0', score: 20, img: 'fruit_9.png' },
    { r: 126,color: '#080', score: 22, img: 'fruit_10.png'}
];

// Configuração dos Sons e Toasty
const popSounds = []; // Array para guardar os audios carregados
const soundFiles = ['sounds/pop1.mp3', 'sounds/pop2.mp3', 'sounds/pop3.mp3', 'sounds/pop4.mp3'];
const toastyImg = new Image(); 
const toastySrc = 'img/toasty.png'; // Substitua se tiver imagem local

// --- VARIÁVEIS GLOBAIS ---
let score = 0;
let dangerCounter = 0;
let currentBody = null;
let nextTier = 0;
let canDrop = true;
let gameOverState = false;
let runner; // Agora é global para poder reiniciar
let assetsLoaded = 0;
let totalAssets = 0;

// Elementos do DOM
const scoreEl = document.getElementById('score-val');
const finalScoreEl = document.getElementById('final-score');
const nextDisplay = document.getElementById('next-fruit-display');
const container = document.getElementById('game-container');
const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');
const toastyEl = document.getElementById('toasty-guy');

// --- SISTEMA DE SOM ---
function playRandomPop() {
    if (popSounds.length === 0) return; 

    const index = Math.floor(Math.random() * popSounds.length);
    const originalAudio = popSounds[index];
    
    // Clona para permitir sobreposição rápida de sons
    if (originalAudio) {
        const soundClone = originalAudio.cloneNode(); 
        soundClone.volume = 0.5; // Ajuste de volume
        soundClone.play().catch(e => {
            // Ignora erros de autoplay antes da interação do usuário
        });
    }
}

// --- PRELOADER UNIFICADO ---
function preloadAssets() {
    // Total = Frutas + Toasty + Sons
    totalAssets = FRUITS.length + 1 + soundFiles.length;
    console.log(`Iniciando carregamento de ${totalAssets} recursos...`);

    // 1. Carregar Frutas
    FRUITS.forEach((fruit) => {
        const img = new Image();
        img.src = IMG_PATH + fruit.img;
        img.onload = () => { checkLoad(); };
        img.onerror = () => { 
            console.error(`Erro fruta: ${fruit.img}`); 
            checkLoad(); 
        };
    });

    // 2. Carregar Toasty
    toastyImg.src = toastySrc;
    toastyImg.onload = () => {
        const el = document.querySelector('#toasty-guy img');
        if(el) el.src = toastySrc; 
        checkLoad();
    };
    toastyImg.onerror = () => checkLoad();

    // 3. Carregar Sons
    soundFiles.forEach((file) => {
        const audio = new Audio();
        audio.src = file;
        audio.addEventListener('canplaythrough', () => { checkLoad(); }, { once: true });
        audio.addEventListener('error', () => { 
            console.warn("Falha som:", file); 
            checkLoad(); 
        }, { once: true });
        popSounds.push(audio);
    });
}

function checkLoad() {
    assetsLoaded++;
    if (loadingText) {
        loadingText.innerText = `Carregando... ${Math.floor((assetsLoaded/totalAssets)*100)}%`;
    }

    if (assetsLoaded >= totalAssets) {
        console.log("Assets carregados. Iniciando jogo.");
        initGame();
    }
}

// --- INICIALIZAÇÃO ---
function initGame() {
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
    }
    container.style.opacity = '1';

    resizeGame();
    
    Render.run(render);
    
    // Criação do Runner Global
    runner = Runner.create();
    Runner.run(runner, engine);
    
    spawnNext();
}

// --- LÓGICA DE REINICIAR (RESET) ---
function resetGame() {
    // 1. Limpa todas as frutas (mantém paredes e chão)
    World.clear(world, true);
    
    // 2. Reseta variáveis
    score = 0;
    scoreEl.innerText = score;
    dangerCounter = 0;
    gameOverState = false;
    currentBody = null;
    isToastyActive = false;
    
    // 3. Interface
    document.getElementById('game-over').style.display = 'none';
    
    // 4. Reinicia motor e spawna fruta
    Runner.run(runner, engine);
    spawnNext();
}

// Conecta o botão de reiniciar
const restartBtn = document.getElementById('restart-btn');
if (restartBtn) {
    restartBtn.addEventListener('click', resetGame);
}

// --- RESIZE CONTROLADO ---
function resizeGame() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const winRatio = winW / winH;
    let newWidth, newHeight;

    if (winRatio > ASPECT_RATIO) {
        newHeight = Math.min(winH, 640); 
        newWidth = newHeight * ASPECT_RATIO;
    } else {
        newWidth = Math.min(winW, 360);
        newHeight = newWidth / ASPECT_RATIO;
    }
    
    container.style.width = newWidth + 'px';
    container.style.height = newHeight + 'px';
}
window.addEventListener('resize', resizeGame);

// --- SETUP ENGINE ---
const engine = Engine.create({
    positionIterations: 16,
    velocityIterations: 16,
    constraintIterations: 4,
    enableSleeping: false 
});
const world = engine.world;

const render = Render.create({
    element: container,
    engine: engine,
    options: {
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
        wireframes: false,
        background: 'transparent',
        pixelRatio: 1.5
    }
});

// --- MUNDO (PAREDES) ---
const floorY = LOGICAL_HEIGHT + (WALL_THICKNESS / 2) - FLOOR_OFFSET;

const ground = Bodies.rectangle(LOGICAL_WIDTH/2, floorY, LOGICAL_WIDTH + 200, WALL_THICKNESS, { 
    isStatic: true, render: { fillStyle: '#8d6e63' }, friction: 0.8, frictionStatic: 10, restitution: 0.0, label: "ground"
});
const leftWall = Bodies.rectangle(0 - WALL_THICKNESS/2, LOGICAL_HEIGHT/2, WALL_THICKNESS, LOGICAL_HEIGHT * 3, { isStatic: true, render: {fillStyle: '#8d6e63'}, friction: 0.0, restitution: 0.0 });
const rightWall = Bodies.rectangle(LOGICAL_WIDTH + WALL_THICKNESS/2, LOGICAL_HEIGHT/2, WALL_THICKNESS, LOGICAL_HEIGHT * 3, { isStatic: true, render: {fillStyle: '#8d6e63'}, friction: 0.0, restitution: 0.0 });

World.add(world, [ground, leftWall, rightWall]);

// --- VISUAIS EXTRAS ---
Events.on(render, 'afterRender', function() {
    const ctx = render.context;
    
    // 1. Linha de Mira
    if (currentBody && canDrop && !gameOverState) {
        ctx.beginPath();
        ctx.moveTo(currentBody.position.x, currentBody.position.y);
        ctx.lineTo(currentBody.position.x, LOGICAL_HEIGHT - FLOOR_OFFSET);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
    }

    // 2. Linha da Morte
    ctx.beginPath();
    ctx.moveTo(0, DEADLINE_Y);
    ctx.lineTo(LOGICAL_WIDTH, DEADLINE_Y);
    
    if (dangerCounter > 0) {
        const pulse = Math.sin(engine.timing.timestamp * 0.015); 
        const alpha = 0.7 + pulse * 0.3;
        const thickness = 4 + pulse * 1;
        ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
        ctx.lineWidth = thickness;
        ctx.setLineDash([12, 8]); 
        ctx.shadowColor = 'red';
        ctx.shadowBlur = 10;
    } else {
        ctx.strokeStyle = 'rgba(255, 69, 0, 0.4)';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 10]);
        ctx.shadowBlur = 0;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
});

// --- TOASTY! LOGIC ---
let isToastyActive = false;

function triggerToasty() {
    if (isToastyActive || !toastyEl) return;

    // Chance de 10% (0.1)
    if (Math.random() > 0.1) return; 

    isToastyActive = true;
    toastyEl.classList.add('appear');
    
    setTimeout(() => {
        toastyEl.classList.remove('appear');
        setTimeout(() => {
            isToastyActive = false;
        }, 300);
    }, 2000);
}

// --- CRIAÇÃO DE FRUTAS ---
function createFruit(x, y, tier, isStatic = false) {
    const cfg = FRUITS[tier];
    const scale = (cfg.r * 2) / ART_SIZE;

    const body = Bodies.circle(x, y, cfg.r, {
        label: tier.toString(),
        isStatic: isStatic,
        restitution: 0.05,
        friction: 0.2,
        frictionAir: 0.02,
        density: 0.001,
        render: { 
            fillStyle: cfg.color,
            sprite: {
                texture: IMG_PATH + cfg.img,
                xScale: scale,
                yScale: scale
            }
        }
    });
    
    if (isStatic) body.isInvulnerable = true;
    
    return body;
}

function createMergeEffect(x, y, color) {
    for (let i = 0; i < 6; i++) {
        const particle = Bodies.circle(x, y, 4, {
            render: { fillStyle: color },
            isSensor: true,
            frictionAir: 0.1
        });
        const angle = Math.random() * Math.PI * 2;
        const speed = 3;
        Body.setVelocity(particle, { x: Math.cos(angle)*speed, y: Math.sin(angle)*speed });
        World.add(world, particle);
        setTimeout(() => World.remove(world, particle), 400);
    }
}

// --- GAME LOOP ---
function pickNextTier() {
    let maxOnField = 0;
    Composite.allBodies(world).forEach(b => {
        if (!b.isStatic && parseInt(b.label) >= 0) maxOnField = Math.max(maxOnField, parseInt(b.label));
    });
    let maxSpawn = 0;
    if (maxOnField >= 2) maxSpawn = 1;
    if (maxOnField >= 4) maxSpawn = 2;
    if (maxOnField >= 6) maxSpawn = 3;

    let pool = [];
    for(let i=0; i <= maxSpawn; i++) {
        for(let k=0; k < 3; k++) pool.push(i);
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

function spawnNext() {
    if (gameOverState) return;
    const tier = nextTier;
    nextTier = pickNextTier();
    
    nextDisplay.style.backgroundColor = 'transparent';
    nextDisplay.style.backgroundImage = `url(${IMG_PATH + FRUITS[nextTier].img})`;
    
    currentBody = createFruit(LOGICAL_WIDTH / 2, 50, tier, true);
    World.add(world, currentBody);
    canDrop = true;
}

// --- INPUT HANDLERS ---
function handleInput(clientX) {
    if (!currentBody || !canDrop || gameOverState) return;
    
    const rect = render.canvas.getBoundingClientRect();
    const scale = LOGICAL_WIDTH / rect.width;
    let x = (clientX - rect.left) * scale;
    
    const r = currentBody.circleRadius;
    if (x < r) x = r;
    if (x > LOGICAL_WIDTH - r) x = LOGICAL_WIDTH - r;
    
    Body.setPosition(currentBody, { x: x, y: 50 });
}

function handleRelease() {
    if (!currentBody || !canDrop || gameOverState) return;
    canDrop = false;
	
    Body.setStatic(currentBody, false);
    Body.setAngle(currentBody, Math.random() * Math.PI * 2);

    const spinForce = (Math.random() - 0.5) * 0.2;
    Body.setAngularVelocity(currentBody, spinForce);

    currentBody = null;
    setTimeout(spawnNext, 500);
}

// Mouse
container.addEventListener('mousedown', e => handleInput(e.clientX));
container.addEventListener('mousemove', e => handleInput(e.clientX));
container.addEventListener('mouseup', handleRelease);

// Touch
container.addEventListener('touchstart', e => { 
    if(e.cancelable) e.preventDefault(); 
    handleInput(e.touches[0].clientX); 
}, { passive: false });

container.addEventListener('touchmove', e => { 
    if(e.cancelable) e.preventDefault(); 
    handleInput(e.touches[0].clientX); 
}, { passive: false });

container.addEventListener('touchend', handleRelease);

// --- COLISÃO & MERGE ---
Events.on(engine, 'collisionStart', (event) => {
    const pairs = event.pairs;
    const processed = new Set(); 

    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;
        
        const id = bodyA.id < bodyB.id ? `${bodyA.id}-${bodyB.id}` : `${bodyB.id}-${bodyA.id}`;
        if (processed.has(id)) continue;
        processed.add(id);

        if (bodyA.label === bodyB.label && !bodyA.isStatic && !bodyB.isStatic) {
            const tier = parseInt(bodyA.label);
			
            playRandomPop(); // Som!
            triggerToasty(); // Toasty!
            
            score += FRUITS[tier].score;
            scoreEl.innerText = score;

            if (tier < FRUITS.length - 1) {
                let newX = (bodyA.position.x + bodyB.position.x) / 2;
                let newY = (bodyA.position.y + bodyB.position.y) / 2;
                
                World.remove(world, [bodyA, bodyB]);

                const nextTierIdx = tier + 1;
                const finalRadius = FRUITS[nextTierIdx].r;
                
                const floorYVisual = LOGICAL_HEIGHT - FLOOR_OFFSET;
                if (newY + finalRadius > floorYVisual) newY = floorYVisual - finalRadius;
                if (newX - finalRadius < 0) newX = finalRadius;
                if (newX + finalRadius > LOGICAL_WIDTH) newX = LOGICAL_WIDTH - finalRadius;

                createMergeEffect(newX, newY, FRUITS[tier].color);
                
                const newFruit = createFruit(newX, newY, nextTierIdx);
                
                const prevRadius = FRUITS[tier].r;
                const scaleStart = prevRadius / finalRadius;
                Body.scale(newFruit, scaleStart, scaleStart);
                newFruit.isGrowing = true;
                newFruit.currentScale = scaleStart;
                newFruit.targetScale = 1.0;
                newFruit.growSpeed = 0.06; 

                Body.setVelocity(newFruit, { x: 0, y: 0 });
                Body.setAngularVelocity(newFruit, 0);

                World.add(world, newFruit);
            }
        }
    }
});

// --- UPDATE LOOP ---
Events.on(engine, 'beforeUpdate', () => {
    const bodies = Composite.allBodies(world);
    let danger = false;
    
    bodies.forEach(body => {
        if (!body.isStatic) body.lifeTime = (body.lifeTime || 0) + 1;

        if (body.isGrowing) {
            let scaleFactor = 1 + body.growSpeed;
            body.currentScale *= scaleFactor;
            if (body.currentScale >= body.targetScale) {
                const correction = body.targetScale / (body.currentScale / scaleFactor);
                Body.scale(body, correction, correction);
                body.isGrowing = false; 
            } else {
                Body.scale(body, scaleFactor, scaleFactor);
            }
        }
        
        if (body.isInvulnerable) {
            if (body.position.y - body.circleRadius > DEADLINE_Y) body.isInvulnerable = false;
            else if (body.lifeTime > 60 && body.speed < 0.2) body.isInvulnerable = false;
        }

        if (body.position.y > LOGICAL_HEIGHT + WALL_THICKNESS) World.remove(world, body);

        if (!body.isStatic && body !== currentBody && body.label !== "ground") {
            if (!body.isInvulnerable) {
                if (body.position.y < DEADLINE_Y && body.velocity.y < 0.2 && body.velocity.y > -0.2 && !body.isGrowing) {
                    danger = true;
                }
            }
        }
    });

    if (danger) {
        dangerCounter++;
        if (dangerCounter > 180) { // 3 Segundos
            gameOverState = true;
            finalScoreEl.innerText = "Score Final: " + score;
            document.getElementById('game-over').style.display = 'flex';
            
            // Para o runner (trava a física)
            if(runner) Runner.stop(runner);
        }
    } else {
        dangerCounter = 0;
    }
});

// --- INÍCIO DO PROCESSO ---
// Começa o preloader assim que o script é lido pelo navegador
window.onload = preloadAssets;
