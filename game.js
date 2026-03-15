// ═══════════════════════════════════════════════════════════
//  NEURAL ARENA — game.js
// ═══════════════════════════════════════════════════════════

// ── Difficulty Presets ─────────────────────────────────────
const DIFF = {
  easy:   { speed: 3.0,  rate: 3000, spread: 0.15, dmg: 12, name: 'EASY',   key: 'easy'   },
  medium: { speed: 5.0,  rate: 2000, spread: 0.07, dmg: 18, name: 'MEDIUM', key: 'medium' },
  hard:   { speed: 7.5,  rate: 1000, spread: 0.02, dmg: 24, name: 'HARD',   key: 'hard'   }
};
let diff = DIFF.medium;

// ── Renderer / Scene / Camera ──────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000408);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('cw').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog   = new THREE.FogExp2(0x000408, 0.015);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 150);

// ── Player Container ───────────────────────────────────────
const playerObj = new THREE.Object3D();
playerObj.position.set(0, 1.7, 10);
scene.add(playerObj);
playerObj.add(camera);
camera.position.set(0, 0, 0);

// ── Game State ─────────────────────────────────────────────
const GS = {
  phase: 'menu',   // menu | playing | levelclear | gameover | confirm
  level: 1, hp: 100, score: 0, shots: 0, enemyCount: 0,
  hidingTime: 0, hidingWarn: false, piercing: false,
  lastPos: new THREE.Vector3(), keys: {}
};

// ── Runtime Arrays ─────────────────────────────────────────
let enemies   = [];
let pBullets  = [];
let eBullets  = [];
let pickups   = [];
let particles = [];

// ── Static Collision Data ──────────────────────────────────
let wallBoxes  = [];
let coverBoxes = [];

// ── Constants ──────────────────────────────────────────────
const ARENA       = 24;
const WALL_H      = 7;
const P_SPEED     = 8;
const ROT_SPEED   = 1.8;
const PB_SPEED    = 32;
const EB_SPEED    = 18;
const DETECT_R    = 17;
const SHOOT_R     = 13;
const BOT_HP      = 3;
const HIDE_WARN   = 5;
const HIDE_PIERCE = 8;

// ═══════════════════════════════════════════════════════════
//  SCENE CONSTRUCTION
// ═══════════════════════════════════════════════════════════

// Lights ────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x040810, 1.6));
scene.add(new THREE.HemisphereLight(0x001a30, 0x000408, 0.7));

const ctrLight = new THREE.PointLight(0x3366ff, 1.8, 35);
ctrLight.position.set(0, 6, 0);
scene.add(ctrLight);

[
  { c: 0x00ccff, x: -ARENA + 2, z: -ARENA + 2 },
  { c: 0xff00cc, x:  ARENA - 2, z: -ARENA + 2 },
  { c: 0x00ff88, x: -ARENA + 2, z:  ARENA - 2 },
  { c: 0xff6600, x:  ARENA - 2, z:  ARENA - 2 }
].forEach(l => {
  const pl = new THREE.PointLight(l.c, 2.8, ARENA + 6);
  pl.position.set(l.x, 4, l.z);
  scene.add(pl);
});

// Floor ─────────────────────────────────────────────────────
{
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
    new THREE.MeshStandardMaterial({
      color: 0x010810, roughness: 0.9, metalness: 0.1,
      emissive: 0x001020, emissiveIntensity: 0.45
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

// Cyber grid ────────────────────────────────────────────────
const g1 = new THREE.GridHelper(ARENA * 2, 48, 0x003a66, 0x001a33);
g1.position.y = 0.012;
scene.add(g1);

const g2 = new THREE.GridHelper(ARENA * 2, 12, 0x0066bb, 0x002244);
g2.position.y = 0.015;
scene.add(g2);

// Walls ─────────────────────────────────────────────────────
function mkWall(w, h, d, x, y, z, col) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: col, roughness: 0.45, metalness: 0.75,
      emissive: new THREE.Color(col).multiplyScalar(0.12)
    })
  );
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);

  // Top neon strip
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.02, 0.09, d + 0.02),
    new THREE.MeshBasicMaterial({ color: 0x0077ff, transparent: true, opacity: 0.85 })
  );
  strip.position.y = h / 2 + 0.045;
  m.add(strip);
  return m;
}

const wallMeshes = [
  mkWall(ARENA * 2 + 2, WALL_H, 0.8,            0, WALL_H / 2, -ARENA, 0x040c18),
  mkWall(ARENA * 2 + 2, WALL_H, 0.8,            0, WALL_H / 2,  ARENA, 0x040c18),
  mkWall(0.8, WALL_H, ARENA * 2 + 2,       -ARENA, WALL_H / 2,      0, 0x050f1c),
  mkWall(0.8, WALL_H, ARENA * 2 + 2,        ARENA, WALL_H / 2,      0, 0x050f1c),
];
wallBoxes = wallMeshes.map(w => new THREE.Box3().setFromObject(w));

// Mid-wall accent lights
[
  [0, WALL_H - 0.4, -ARENA + 1],
  [0, WALL_H - 0.4,  ARENA - 1],
  [-ARENA + 1, WALL_H - 0.4, 0],
  [ ARENA - 1, WALL_H - 0.4, 0]
].forEach(([x, y, z]) => {
  const pl = new THREE.PointLight(0x0088ff, 1.4, 28);
  pl.position.set(x, y, z);
  scene.add(pl);
});

// Pillars / Cover ────────────────────────────────────────────
const PILLAR_DEFS = [
  { x: -11, z:  -9, w: 3.0, h: 4, d: 3.0, c: 0x04101d },
  { x:  11, z:  -9, w: 3.0, h: 4, d: 3.0, c: 0x04101d },
  { x:   0, z: -17, w: 3.5, h: 5, d: 3.5, c: 0x05081e },
  { x: -17, z:   1, w: 2.0, h: 4, d: 4.0, c: 0x051810 },
  { x:  17, z:   1, w: 2.0, h: 4, d: 4.0, c: 0x051810 },
  { x:  -8, z:  12, w: 3.0, h: 4, d: 3.0, c: 0x0f0610 },
  { x:   8, z:  12, w: 3.0, h: 4, d: 3.0, c: 0x0f0610 },
  { x:   0, z:   5, w: 1.8, h: 5, d: 1.8, c: 0x060818 },
];

const NEON_C = [0x00ffff, 0xff00ff, 0x00ff88, 0xff8800, 0xffff00, 0x0088ff, 0xff0088, 0x88ff00];

PILLAR_DEFS.forEach((def, i) => {
  const geo = new THREE.BoxGeometry(def.w, def.h * 2, def.d);
  const m   = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: def.c, roughness: 0.25, metalness: 0.85,
    emissive: new THREE.Color(def.c).multiplyScalar(0.3)
  }));
  m.position.set(def.x, def.h, def.z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);

  // Neon edge wireframe
  const nc = NEON_C[i % NEON_C.length];
  m.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: nc, transparent: true, opacity: 0.55 })
  ));

  // Top glow point light
  const pl = new THREE.PointLight(nc, 1.1, 10);
  pl.position.set(def.x, def.h * 2 + 1.2, def.z);
  scene.add(pl);

  // Cover AABB for collision / hiding detection
  const box = new THREE.Box3().setFromObject(m);
  coverBoxes.push(box);
});

// ═══════════════════════════════════════════════════════════
//  HOVER-BOT — Enemy Class
// ═══════════════════════════════════════════════════════════
class HoverBot {
  constructor(spawnPos) {
    this.hp       = BOT_HP;
    this.alive    = true;
    this.state    = 'PATROL';   // PATROL | CHASE | SHOOT
    this.stTimer  = 0;
    this.lastFire = 0;
    this.floatPh  = Math.random() * Math.PI * 2;
    this.waypoint = this._newWaypoint();

    this.group = new THREE.Group();
    this.group.position.copy(spawnPos);

    // SpotLight world-space target
    this.spotTarget = new THREE.Object3D();
    this.spotTarget.position.set(spawnPos.x, 0, spawnPos.z);
    scene.add(this.spotTarget);

    this._build();
    scene.add(this.group);
  }

  _newWaypoint() {
    const m = 5;
    return new THREE.Vector3(
      (Math.random() - 0.5) * (ARENA * 2 - m * 2), 0,
      (Math.random() - 0.5) * (ARENA * 2 - m * 2)
    );
  }

  _build() {
    // HEAD — metallic sphere with icosahedron edge lines
    this.headMat = new THREE.MeshStandardMaterial({
      color: 0x1a0505, roughness: 0.08, metalness: 0.96,
      emissive: 0x550000, emissiveIntensity: 0.5
    });
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 14), this.headMat);
    this.head.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.56, 1)),
      new THREE.LineBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.38 })
    ));
    this.group.add(this.head);

    // EYE — glowing sphere
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.eye    = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), this.eyeMat);
    this.eye.position.set(0, 0.06, 0.5);
    this.head.add(this.eye);
    this.eyeLight = new THREE.PointLight(0x00ff00, 2.8, 8);
    this.eye.add(this.eyeLight);

    // SPOTLIGHT (scanning / tracking)
    this.spot = new THREE.SpotLight(0x00ff44, 5, 24, Math.PI / 7, 0.48);
    this.spot.position.set(0, -0.1, 0.35);
    this.spot.castShadow = false;
    this.head.add(this.spot);
    this.spot.target = this.spotTarget;

    // PRIMARY RING — horizontal torus
    this.ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.077, 8, 42),
      new THREE.MeshStandardMaterial({
        color: 0x0055ff, emissive: 0x0033cc,
        emissiveIntensity: 1.9, roughness: 0.08, metalness: 0.92
      })
    );
    this.ring1.rotation.x = Math.PI / 2;
    this.group.add(this.ring1);

    // SECONDARY RING — tilted torus
    this.ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.73, 0.052, 8, 36),
      new THREE.MeshStandardMaterial({
        color: 0xff0088, emissive: 0xcc0066,
        emissiveIntensity: 1.6, roughness: 0.08, metalness: 0.92
      })
    );
    this.ring2.rotation.set(Math.PI / 3.5, 0, Math.PI / 5);
    this.group.add(this.ring2);

    // ENERGY CORE — spinning octahedron
    this.core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.19, 0),
      new THREE.MeshBasicMaterial({ color: 0xff6600 })
    );
    this.core.position.y = -0.22;
    this.group.add(this.core);

    // BODY GLOW
    this.bodyLight = new THREE.PointLight(0xff2200, 1.6, 11);
    this.group.add(this.bodyLight);

    // HP PIPS — small spheres above head
    this.pips = [];
    for (let i = 0; i < BOT_HP; i++) {
      const pip = new THREE.Mesh(
        new THREE.SphereGeometry(0.068, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x00ff66 })
      );
      pip.position.set((i - (BOT_HP - 1) / 2) * 0.29, 0.88, 0);
      this.group.add(pip);
      this.pips.push(pip);
    }
  }

  // State machine transitions ─────────────────────────────
  _setState(s) {
    if (this.state === s) return;
    this.state   = s;
    this.stTimer = 0;
    const COLS = {
      PATROL: [0x00ff44, 0x00ff44],
      CHASE:  [0xffaa00, 0xff8800],
      SHOOT:  [0xff0000, 0xff0000]
    };
    const [sc, ec] = COLS[s];
    this.spot.color.setHex(sc);
    this.eyeLight.color.setHex(ec);
    this.eyeMat.color.setHex(ec);
  }

  update(dt) {
    if (!this.alive) return;
    const t    = Date.now() * 0.001;
    const pPos = playerObj.position.clone();

    // Float & spin animations
    this.group.position.y  = 2.4 + Math.sin(t * 1.6 + this.floatPh) * 0.28;
    this.ring1.rotation.z += dt * 1.85;
    this.ring2.rotation.y -= dt * 1.35;
    this.core.rotation.x  += dt * 3.6;
    this.core.rotation.z  += dt * 2.3;

    const toP  = new THREE.Vector3().subVectors(pPos, this.group.position);
    toP.y      = 0;
    const dist = toP.length();
    this.stTimer += dt;

    // ── PATROL ──────────────────────────────────────────
    if (this.state === 'PATROL') {
      const sw = Math.sin(t * 1.35 + this.floatPh) * 0.55;
      this.spotTarget.position.set(
        this.group.position.x + Math.sin(this.head.rotation.y + sw) * 12,
        0,
        this.group.position.z + Math.cos(this.head.rotation.y + sw) * 12
      );

      const toW = new THREE.Vector3(
        this.waypoint.x - this.group.position.x, 0,
        this.waypoint.z - this.group.position.z
      );
      if (toW.length() < 2.5) {
        this.waypoint = this._newWaypoint();
      } else {
        toW.normalize();
        this.group.position.x += toW.x * diff.speed * 0.45 * dt;
        this.group.position.z += toW.z * diff.speed * 0.45 * dt;
        this.head.rotation.y   = Math.atan2(toW.x, toW.z);
      }
      if (dist < DETECT_R) this._setState('CHASE');
    }

    // ── CHASE ────────────────────────────────────────────
    else if (this.state === 'CHASE') {
      if (dist > DETECT_R + 5) { this._setState('PATROL'); return; }
      if (dist < SHOOT_R)      { this._setState('SHOOT');  return; }

      const dir = toP.clone().normalize();
      this.group.position.x += dir.x * diff.speed * dt;
      this.group.position.z += dir.z * diff.speed * dt;
      this.group.position.x  = THREE.MathUtils.clamp(this.group.position.x, -ARENA + 2, ARENA - 2);
      this.group.position.z  = THREE.MathUtils.clamp(this.group.position.z, -ARENA + 2, ARENA - 2);
      this.head.rotation.y   = Math.atan2(dir.x, dir.z);
      this.spotTarget.position.copy(pPos);
    }

    // ── SHOOT ────────────────────────────────────────────
    else if (this.state === 'SHOOT') {
      if (dist > SHOOT_R + 3) { this._setState('CHASE'); return; }

      const dir = toP.clone().normalize();
      this.head.rotation.y = Math.atan2(dir.x, dir.z);
      this.spotTarget.position.copy(pPos);

      const now = Date.now();
      if (now - this.lastFire >= diff.rate) {
        this.lastFire = now;
        this._fire(pPos);
        this.bodyLight.intensity = 6;
        setTimeout(() => { if (this.alive) this.bodyLight.intensity = 1.6; }, 90);
      }
    }
  }

  _fire(targetPos) {
    const origin = this.group.position.clone();
    origin.y += 0.1;
    const dir = new THREE.Vector3().subVectors(targetPos, origin).normalize();
    dir.x += (Math.random() - 0.5) * diff.spread * 2;
    dir.z += (Math.random() - 0.5) * diff.spread * 2;
    dir.normalize();
    const b = mkBullet(origin, dir, false);
    if (GS.piercing) b.piercing = true;
    eBullets.push(b);
  }

  takeDamage() {
    this.hp--;
    if (this.pips[this.hp]) this.pips[this.hp].material.color.setHex(0x220000);
    this.headMat.emissiveIntensity = 4.5;
    setTimeout(() => { if (this.alive) this.headMat.emissiveIntensity = 0.5; }, 140);
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.alive = false;
    spawnExplosion(this.group.position.clone(), 0xff4400, 20);
    scene.remove(this.group);
    scene.remove(this.spotTarget);
    GS.score++;
    GS.enemyCount = Math.max(0, GS.enemyCount - 1);
    updateHUD();
    if (GS.enemyCount === 0) onLevelClear();
  }
}

// ═══════════════════════════════════════════════════════════
//  BULLET SYSTEM
// ═══════════════════════════════════════════════════════════
function mkBullet(pos, dir, isPlayer) {
  const col  = isPlayer ? 0x00ffff : 0xff5500;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshBasicMaterial({ color: col })
  );
  mesh.position.copy(pos);
  scene.add(mesh);

  // Bullet PointLight — illuminates room as it flies
  const bLight = new THREE.PointLight(col, 3.2, 10);
  mesh.add(bLight);

  // Trail — 2-point BufferGeometry line from origin to current pos
  const tPositions = new Float32Array(6);
  tPositions[0] = pos.x; tPositions[1] = pos.y; tPositions[2] = pos.z;
  tPositions[3] = pos.x; tPositions[4] = pos.y; tPositions[5] = pos.z;
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPositions, 3));
  const trail = new THREE.Line(tGeo, new THREE.LineBasicMaterial({
    color: isPlayer ? 0x88ffff : 0xff8844, transparent: true, opacity: 0.68
  }));
  scene.add(trail);

  return {
    mesh, trail, tGeo,
    origin:   pos.clone(),
    dir:      dir.clone().normalize(),
    speed:    isPlayer ? PB_SPEED : EB_SPEED,
    isPlayer,
    alive:    true,
    piercing: false
  };
}

function updateTrail(b) {
  const a = b.tGeo.attributes.position;
  a.setXYZ(0, b.origin.x, b.origin.y, b.origin.z);
  a.setXYZ(1, b.mesh.position.x, b.mesh.position.y, b.mesh.position.z);
  a.needsUpdate = true;
}

function killBullet(arr, i) {
  scene.remove(arr[i].mesh);
  scene.remove(arr[i].trail);
  arr[i].alive = false;
  arr.splice(i, 1);
}

// Muzzle Flash ──────────────────────────────────────────────
function muzzleFlash() {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffff44 })
  );
  flash.position.set(0, -0.09, -0.78);
  const fl = new THREE.PointLight(0xffdd00, 12, 8);
  flash.add(fl);
  camera.add(flash);
  setTimeout(() => camera.remove(flash), 55);
}

// ═══════════════════════════════════════════════════════════
//  PARTICLE / IMPACT SYSTEM
// ═══════════════════════════════════════════════════════════
function spawnImpact(pos, col, n = 8) {
  for (let i = 0; i < n; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.044 + Math.random() * 0.065, 4, 4),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1 })
    );
    mesh.position.copy(pos);
    scene.add(mesh);
    particles.push({
      mesh,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        Math.random() * 5.5 + 2,
        (Math.random() - 0.5) * 10
      ),
      life: 1
    });
  }
}

function spawnExplosion(pos, col, n = 16) {
  spawnImpact(pos, col, n);
  spawnImpact(pos, 0xffcc00, Math.floor(n / 2));
  spawnImpact(pos, 0xffffff, 4);
  const fl = new THREE.PointLight(col, 14, 20);
  fl.position.copy(pos);
  scene.add(fl);
  setTimeout(() => scene.remove(fl), 260);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt * 2.4;
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); continue; }
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 12 * dt;
    p.mesh.material.opacity = Math.max(0, p.life);
    p.mesh.scale.setScalar(Math.max(0.01, p.life));
  }
}

// ═══════════════════════════════════════════════════════════
//  HEALTH PICKUPS
// ═══════════════════════════════════════════════════════════
function spawnPickup() {
  if (GS.phase !== 'playing') return;
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x00ff44, emissive: 0x00aa22, emissiveIntensity: 2.2, roughness: 0.15
  });
  grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.14), mat));
  grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.14), mat));

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.03, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.65 })
  );
  grp.add(ring);
  grp.add(Object.assign(new THREE.PointLight(0x00ff44, 2.2, 7)));

  let x, z, tries = 0;
  do {
    x = (Math.random() - 0.5) * (ARENA * 2 - 8);
    z = (Math.random() - 0.5) * (ARENA * 2 - 8);
    tries++;
  } while (tries < 30 && coverBoxes.some(b => b.containsPoint(new THREE.Vector3(x, 1, z))));

  grp.position.set(x, 0.55, z);
  scene.add(grp);
  pickups.push(grp);
}

function updatePickups(dt) {
  const t = Date.now() * 0.001;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.rotation.y += dt * 1.7;
    p.position.y  = 0.55 + Math.sin(t * 2.1 + i * 1.5) * 0.17;
    const dx = p.position.x - playerObj.position.x;
    const dz = p.position.z - playerObj.position.z;
    if (Math.sqrt(dx * dx + dz * dz) < 1.45) {
      GS.hp = Math.min(100, GS.hp + 20);
      scene.remove(p);
      pickups.splice(i, 1);
      updateHUD();
      showPickupFlash();
      setTimeout(spawnPickup, 10000);
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  HIDING DETECTION
// ═══════════════════════════════════════════════════════════
function updateHiding(dt) {
  const pos = playerObj.position;
  if (pos.distanceTo(GS.lastPos) > 0.38) {
    GS.lastPos.copy(pos);
    GS.hidingTime = 0;
    if (GS.hidingWarn || GS.piercing) {
      GS.hidingWarn = false;
      GS.piercing   = false;
      document.getElementById('hidewarn').style.opacity = '0';
    }
    return;
  }

  const nearCover = coverBoxes.some(b => {
    const ex = b.clone().expandByScalar(2.6);
    return ex.containsPoint(new THREE.Vector3(pos.x, 1, pos.z));
  });
  if (!nearCover) return;

  GS.hidingTime += dt;

  if (GS.hidingTime >= HIDE_WARN && !GS.hidingWarn) {
    GS.hidingWarn = true;
    document.getElementById('hidewarn').style.opacity = '1';
  }
  if (GS.hidingTime >= HIDE_PIERCE && !GS.piercing) {
    GS.piercing = true;
    eBullets.forEach(b => { b.piercing = true; });
  }
}

// ═══════════════════════════════════════════════════════════
//  COLLISION HELPERS
// ═══════════════════════════════════════════════════════════
const _S = new THREE.Sphere();
const _B = new THREE.Box3();

function hitsWall(p)   { _S.set(p, 0.15); return wallBoxes.some(b  => _S.intersectsBox(b)); }
function hitsPillar(p) { _S.set(p, 0.15); return coverBoxes.some(b => _S.intersectsBox(b)); }

function hitsPlayer(p) {
  _S.set(p, 0.44);
  _B.setFromCenterAndSize(playerObj.position, new THREE.Vector3(0.8, 1.8, 0.8));
  return _S.intersectsBox(_B);
}

function hitsBot(p, bot) {
  if (!bot.alive) return false;
  _S.set(p, 0.46);
  _B.setFromObject(bot.group);
  return _S.intersectsBox(_B);
}

// ═══════════════════════════════════════════════════════════
//  PLAYER SHOOT
// ═══════════════════════════════════════════════════════════
let lastShot = 0;
function doShoot() {
  const now = Date.now();
  if (now - lastShot < 200) return;
  lastShot = now;
  GS.shots++;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const pos = new THREE.Vector3();
  camera.getWorldPosition(pos);
  pos.addScaledVector(dir, 0.6);

  pBullets.push(mkBullet(pos, dir, true));
  muzzleFlash();
  updateHUD();
}

// ═══════════════════════════════════════════════════════════
//  LEVEL MANAGEMENT
// ═══════════════════════════════════════════════════════════
function spawnLevel() {
  const n = GS.level;
  GS.enemyCount = n;

  // Shuffle spawn zones each level (Fisher-Yates)
  const allSpawns = [
    [-16, -16], [16, -16], [-16, 16], [16, 16],
    [0, -20],   [0,  20],  [-20, 0],  [20,  0],
    [-14, -20], [14, -20]
  ];
  for (let s = allSpawns.length - 1; s > 0; s--) {
    const r = Math.floor(Math.random() * (s + 1));
    [allSpawns[s], allSpawns[r]] = [allSpawns[r], allSpawns[s]];
  }

  for (let i = 0; i < n; i++) {
    const sp  = allSpawns[i % allSpawns.length];
    const pos = new THREE.Vector3(
      sp[0] + (Math.random() - 0.5) * 4, 2.4,
      sp[1] + (Math.random() - 0.5) * 4
    );
    enemies.push(new HoverBot(pos));
  }
  updateHUD();
}

function onLevelClear() {
  GS.phase = 'levelclear';
  cleanBullets();
  const ov     = document.getElementById('overlay');
  ov.className = 'vis lvlclear';
  ov.innerHTML = `
    <div class="ovtitle">LEVEL ${GS.level}<br>CLEARED</div>
    <div class="ovsub">KILLS: ${GS.score} &nbsp;|&nbsp; HP: ${GS.hp} &nbsp;|&nbsp; SHOTS: ${GS.shots}</div>
    <div class="diffrow">
      <button class="ovbtn def" onclick="nextLevel()">ADVANCE TO LV ${GS.level + 1} ›</button>
      <button class="ovbtn med" onclick="showMenu()">‹ MAIN MENU</button>
    </div>`;
}

function nextLevel() {
  GS.level++;
  GS.hidingTime = 0; GS.hidingWarn = false; GS.piercing = false;

  // Full cleanup
  enemies.forEach(e => { scene.remove(e.group); scene.remove(e.spotTarget); });
  enemies = [];
  cleanBullets();
  particles.forEach(p => scene.remove(p.mesh));
  particles = [];
  pickups.forEach(p => scene.remove(p));
  pickups = [];

  // Randomise player spawn — one of 8 safe positions facing inward
  const playerSpawns = [
    { x:   0, z:  16, ry:  Math.PI        },
    { x:   0, z: -16, ry:  0              },
    { x:  16, z:   0, ry: -Math.PI / 2    },
    { x: -16, z:   0, ry:  Math.PI / 2    },
    { x:  12, z:  12, ry: -Math.PI * 0.75 },
    { x: -12, z:  12, ry:  Math.PI * 0.75 },
    { x:  12, z: -12, ry: -Math.PI * 0.25 },
    { x: -12, z: -12, ry:  Math.PI * 0.25 },
  ];
  const ps = playerSpawns[Math.floor(Math.random() * playerSpawns.length)];
  playerObj.position.set(ps.x, 1.7, ps.z);
  playerObj.rotation.y = ps.ry;
  camera.position.set(0, 0, 0);
  GS.lastPos.copy(playerObj.position);

  document.getElementById('overlay').className       = '';
  document.getElementById('hidewarn').style.opacity  = '0';

  spawnLevel();
  for (let i = 0; i < 3; i++) spawnPickup();

  GS.phase = 'playing';
  updateHUD();
}

// ═══════════════════════════════════════════════════════════
//  GAME FLOW — Start / Reset / GameOver / Menu
// ═══════════════════════════════════════════════════════════
function fullCleanup() {
  enemies.forEach(e => {
    if (e.alive) scene.remove(e.group);
    scene.remove(e.spotTarget);
  });
  cleanBullets();
  pickups.forEach(p  => scene.remove(p));
  particles.forEach(p => scene.remove(p.mesh));
  enemies = []; pBullets = []; eBullets = []; pickups = []; particles = [];
}

function cleanBullets() {
  [...pBullets, ...eBullets].forEach(b => {
    scene.remove(b.mesh);
    scene.remove(b.trail);
  });
  pBullets = []; eBullets = [];
}

function startGame(diffKey) {
  diff = DIFF[diffKey];
  fullCleanup();

  GS.phase = 'playing'; GS.level = 1; GS.hp = 100;
  GS.score = 0; GS.shots = 0; GS.enemyCount = 0;
  GS.hidingTime = 0; GS.hidingWarn = false; GS.piercing = false;

  playerObj.position.set(0, 1.7, 10);
  playerObj.rotation.y = 0;
  GS.lastPos.copy(playerObj.position);

  spawnLevel();
  for (let i = 0; i < 3; i++) spawnPickup();

  document.getElementById('overlay').className       = '';
  document.getElementById('hidewarn').style.opacity  = '0';
  document.getElementById('hud').style.display       = 'flex';
  document.getElementById('ctrlstrip').style.display = 'block';
  document.getElementById('back-btn').style.display  = 'block';
  document.getElementById('h-diff').textContent      = diff.name;
  document.getElementById('h-diff').style.color      =
    diffKey === 'easy'   ? '#00ff88' :
    diffKey === 'medium' ? '#ffcc00' : '#ff3355';
  updateHUD();
}

function triggerGameOver() {
  GS.phase = 'gameover';
  cleanBullets();
  const ov     = document.getElementById('overlay');
  ov.className = 'vis gameover';
  ov.innerHTML = `
    <div class="ovtitle">ELIMINATED</div>
    <div class="ovsub">LEVEL ${GS.level} &nbsp;|&nbsp; KILLS ${GS.score} &nbsp;|&nbsp; SHOTS ${GS.shots}</div>
    <div class="diffrow">
      <button class="ovbtn def" onclick="showMenu()">MAIN MENU</button>
      <button class="ovbtn ${diff.key}" onclick="startGame('${diff.key}')">RETRY</button>
    </div>`;
}

function showMenu() {
  fullCleanup();
  GS.phase = 'menu';
  document.getElementById('hud').style.display       = 'none';
  document.getElementById('ctrlstrip').style.display = 'none';
  document.getElementById('back-btn').style.display  = 'none';
  document.getElementById('overlay').className       = 'vis menu';
  document.getElementById('overlay').innerHTML       = `
    <div class="ovtitle">NEURAL ARENA</div>
    <div class="ovsub">CYBER COMBAT SIMULATION &nbsp;|&nbsp; SELECT DIFFICULTY</div>
    <div class="diffrow">
      <button class="ovbtn easy" onclick="startGame('easy')">EASY</button>
      <button class="ovbtn med"  onclick="startGame('medium')">MEDIUM</button>
      <button class="ovbtn hard" onclick="startGame('hard')">HARD</button>
    </div>
    <div class="menukeys">
      ↑ ↓ MOVE &nbsp;|&nbsp; ← → ROTATE &nbsp;|&nbsp; SPACE FIRE<br>
      GREEN CROSSES = +20 HP &nbsp;|&nbsp; LEVEL CLEARS SPAWN MORE ENEMIES<br>
      DON'T HIDE BEHIND COVER &gt; 5 SECONDS
    </div>`;
}

// ═══════════════════════════════════════════════════════════
//  HUD UPDATE
// ═══════════════════════════════════════════════════════════
function updateHUD() {
  document.getElementById('h-lvl').textContent     = GS.level;
  document.getElementById('h-score').textContent   = GS.score;
  document.getElementById('h-enemies').textContent = GS.enemyCount;
  document.getElementById('h-hp').textContent      = Math.max(0, GS.hp);
  document.getElementById('h-shots').textContent   = GS.shots;

  const hp = Math.max(0, GS.hp);
  document.getElementById('hpbar').style.width      = hp + '%';
  document.getElementById('hpbar').style.background =
    hp > 60 ? 'linear-gradient(90deg,#00ff66,#00cc44)' :
    hp > 30 ? 'linear-gradient(90deg,#ffcc00,#ff8800)' :
              'linear-gradient(90deg,#ff3355,#cc1133)';
  document.getElementById('h-hp').style.color =
    hp > 60 ? '#00ff88' : hp > 30 ? '#ffcc00' : '#ff3355';
}

let _dmgT = null;
function showDmgFlash() {
  const el = document.getElementById('vignette');
  el.classList.add('hit');
  clearTimeout(_dmgT);
  _dmgT = setTimeout(() => el.classList.remove('hit'), 130);
}

let _pkT = null;
function showPickupFlash() {
  const el = document.getElementById('pkflash');
  el.classList.add('fl');
  clearTimeout(_pkT);
  _pkT = setTimeout(() => el.classList.remove('fl'), 200);
}

// ═══════════════════════════════════════════════════════════
//  MENU CONFIRM DIALOG
// ═══════════════════════════════════════════════════════════
function confirmMenu() {
  if (GS.phase !== 'playing') return;
  GS.phase = 'confirm';
  document.getElementById('confirm-box').classList.add('vis');
}

function confirmYes() {
  document.getElementById('confirm-box').classList.remove('vis');
  showMenu();
}

function confirmNo() {
  document.getElementById('confirm-box').classList.remove('vis');
  GS.phase = 'playing';
}

// ═══════════════════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  GS.keys[e.code] = true;
  if (e.code === 'Space' && GS.phase === 'playing') {
    e.preventDefault();
    doShoot();
  }
  if (e.code === 'Escape') {
    if (GS.phase === 'playing') confirmMenu();
    else if (GS.phase === 'confirm') confirmNo();
  }
});

document.addEventListener('keyup', e => {
  GS.keys[e.code] = false;
});

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════
const clock = new THREE.Clock();

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t  = Date.now() * 0.001;

  // Ambient scene animation (always running)
  ctrLight.intensity = 1.5 + Math.sin(t * 0.9) * 0.35;

  if (GS.phase !== 'playing') {
    renderer.render(scene, camera);
    return;
  }

  // ── Player movement ────────────────────────────────────
  if (GS.keys['ArrowLeft'])  playerObj.rotation.y += ROT_SPEED * dt;
  if (GS.keys['ArrowRight']) playerObj.rotation.y -= ROT_SPEED * dt;

  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();

  let moving = false;
  if (GS.keys['ArrowUp'])   { playerObj.position.addScaledVector(fwd,  P_SPEED * dt); moving = true; }
  if (GS.keys['ArrowDown'])  { playerObj.position.addScaledVector(fwd, -P_SPEED * dt); moving = true; }

  // Clamp to arena bounds
  playerObj.position.x = THREE.MathUtils.clamp(playerObj.position.x, -ARENA + 1.3, ARENA - 1.3);
  playerObj.position.z = THREE.MathUtils.clamp(playerObj.position.z, -ARENA + 1.3, ARENA - 1.3);

  // Head bob
  camera.position.y = moving ? Math.sin(t * 9.5) * 0.042 : camera.position.y * 0.85;

  // ── Systems ────────────────────────────────────────────
  updateHiding(dt);
  enemies.forEach(e => e.update(dt));

  // ── Player bullets ──────────────────────────────────────
  for (let i = pBullets.length - 1; i >= 0; i--) {
    const b = pBullets[i];
    b.mesh.position.addScaledVector(b.dir, b.speed * dt);
    updateTrail(b);

    if (hitsWall(b.mesh.position))   { spawnImpact(b.mesh.position.clone(), 0x88ccff, 6); killBullet(pBullets, i); continue; }
    if (hitsPillar(b.mesh.position)) { spawnImpact(b.mesh.position.clone(), 0x44aaff, 6); killBullet(pBullets, i); continue; }

    let killed = false;
    for (const e of enemies) {
      if (hitsBot(b.mesh.position, e)) {
        spawnImpact(b.mesh.position.clone(), 0xff5500, 10);
        e.takeDamage();
        killBullet(pBullets, i);
        killed = true;
        break;
      }
    }
    if (killed) continue;
    if (b.mesh.position.distanceTo(playerObj.position) > 85) killBullet(pBullets, i);
  }

  // ── Enemy bullets ───────────────────────────────────────
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i];
    b.mesh.position.addScaledVector(b.dir, b.speed * dt);
    updateTrail(b);

    if (hitsWall(b.mesh.position))                    { spawnImpact(b.mesh.position.clone(), 0xff6600, 5); killBullet(eBullets, i); continue; }
    if (!b.piercing && hitsPillar(b.mesh.position))   { spawnImpact(b.mesh.position.clone(), 0xff4400, 5); killBullet(eBullets, i); continue; }

    if (hitsPlayer(b.mesh.position)) {
      spawnImpact(b.mesh.position.clone(), 0xff8800, 8);
      killBullet(eBullets, i);
      GS.hp -= diff.dmg;
      updateHUD();
      showDmgFlash();
      if (GS.hp <= 0) { triggerGameOver(); return; }
      continue;
    }
    if (b.mesh.position.distanceTo(playerObj.position) > 85) killBullet(eBullets, i);
  }

  // ── Pickups & Particles ─────────────────────────────────
  updatePickups(dt);
  updateParticles(dt);

  renderer.render(scene, camera);
}

// ── Resize ──────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Launch ──────────────────────────────────────────────────
loop();
