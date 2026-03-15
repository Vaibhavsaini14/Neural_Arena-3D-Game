# 🎮 Neural Arena — Browser FPS

A fully playable **3D First-Person Shooter** that runs entirely in a single HTML file. No installs, no build tools, no game engine — just open it in a browser and play.

Built with [Three.js](https://threejs.org/) and vanilla JavaScript.

--

## 📸 Preview

| Main Menu | In-Game | Level Clear |
|-----------|---------|-------------|
| Difficulty selection screen | Cyber-grid arena with Hover-Bots | Score summary between waves |

---

## ✨ Features

### 🌐 Environment
- Dark **cyber-grid arena** with layered neon floor grids
- 4 colored corner accent lights painting the arena dynamically
- 8 neon-edged cover pillars with individual point lights
- Atmospheric exponential fog for depth

### 🤖 Enemy — "Hover-Bot"
- Multi-mesh design: metallic sphere head + icosahedron edge lines + dual torus rings + spinning octahedron energy core
- **3-state AI state machine:**
  - 🟢 `PATROL` — roams waypoints, scanning spotlight sweeps left/right
  - 🟡 `CHASE` — detects player within range and pursues
  - 🔴 `SHOOT` — stops and fires when close enough
- Spotlight changes color per state (Green → Orange → Red)
- HP pip indicators float above each bot
- Full explosion particle effect on death

### 🎯 Player & Combat
- First-person perspective with head-bob on movement
- **Arrow Keys** to move & rotate | **Space** to shoot
- **ESC** or **‹ Main Menu button** to exit mid-game (with confirmation dialog)
- 100 HP with animated health bar (green → yellow → red at low HP)

### 🏆 Leveling System
- Starts at **Level 1** with 1 enemy — each level adds +1 enemy
- Unlimited levels with no hard cap
- Player and enemy **spawn positions randomise every level** (no same layout twice)
- Full scene cleanup between levels — no lag or leftover objects

### 💊 Health Pickups
- Glowing green cross pickups scattered around the arena (+20 HP each)
- Float and rotate; respawn 10 seconds after collection

### ⚠️ Anti-Hiding System
- Stay near cover for **5 seconds** → warning appears
- Stay for **8 seconds** → all enemy bullets become **piercing** (pass through pillars)

### 💥 Visual Effects
| Effect | Description |
|--------|-------------|
| Muzzle Flash | Yellow PointLight + sphere at gun tip, 55ms |
| Bullet Trails | Real-time BufferGeometry line from origin to current position |
| Bullet Lights | Each projectile carries a PointLight illuminating the environment |
| Impact Sparks | Multi-colour particle burst on every hit surface |
| Enemy Death | Large explosion with orange/yellow/white particles + flash light |
| Damage Vignette | Red radial vignette flashes on player hit |
| Pickup Flash | Green screen flash on health collection |

### 🎚️ Difficulty Modes

| Mode | Enemy Speed | Fire Rate | Bullet Spread | Damage/Hit |
|------|-------------|-----------|---------------|------------|
| 🟢 Easy | 3.0 u/s | 3 seconds | High (0.15) | 12 HP |
| 🟡 Medium | 5.0 u/s | 2 seconds | Low (0.07) | 18 HP |
| 🔴 Hard | 7.5 u/s | 1 second | Near-zero (0.02) | 24 HP |

---

## 🎮 Controls

| Key | Action |
|-----|--------|
| `↑` | Move forward |
| `↓` | Move backward |
| `←` | Rotate left |
| `→` | Rotate right |
| `Space` | Shoot |
| `ESC` | Pause / Main Menu |

---


No dependencies to install. No `npm install`. No build step.

---

## 🛠️ Tech Stack

| Technology | Usage |
|------------|-------|
| [Three.js r128](https://threejs.org/) | 3D rendering, scene graph, lighting |
| Vanilla JavaScript (ES6+) | Game logic, state machine, physics |
| HTML5 / CSS3 | HUD, overlays, animations |
| `requestAnimationFrame` | Smooth 60fps game loop |
| `THREE.BufferGeometry` | Efficient bullet trail rendering |
| `THREE.PointLight` | Dynamic per-projectile lighting |
| `THREE.SpotLight` | Enemy scanning/tracking beam |
| `THREE.Box3` / `THREE.Sphere` | Collision detection |

---



## 🙌 Acknowledgements

- [Three.js](https://threejs.org/) — the 3D library powering everything
- [Google Fonts — Orbitron & Share Tech Mono](https://fonts.google.com/) — HUD typography
- Built as a portfolio project demonstrating AI-assisted game development workflow
