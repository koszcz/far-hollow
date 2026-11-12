// Builds the code-built "fire-effect" listed in asset-manifest.json (approved): the flames, embers, sparks, and smoke of a lit
// campfire. campfire-meshes.ts adds one to each campfire and owns its lights.
// - Flame tongues are thin, flat-shaded cones. Each one sways, stretches, and twists on its own beat.
// - An ember bed glows on the ground under the flames and pulses slowly.
// - Sparks rise from the flames, drift sideways, and shrink away.
// - Smoke puffs rise above the flames, swell, and thin out.
import * as THREE from "three";

/** One flame tongue: where its foot stands, how big it is, and how far it leans out, in metres and radians. */
interface Tongue {
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly radius: number;
  readonly lean: number;
  /** The direction it leans toward, in radians around the upright. */
  readonly heading: number;
  readonly core: boolean;
}

/** Flames sit low inside the stick teepee, so the sticks stay visible through the gaps. */
const TONGUES: readonly Tongue[] = [
  { x: 0, z: 0, height: 0.9, radius: 0.17, lean: 0.05, heading: 0, core: false },
  { x: 0.12, z: 0.05, height: 0.66, radius: 0.13, lean: 0.25, heading: 1.2, core: false },
  { x: -0.1, z: 0.1, height: 0.72, radius: 0.13, lean: 0.22, heading: 2.6, core: false },
  { x: -0.05, z: -0.12, height: 0.6, radius: 0.12, lean: 0.28, heading: 4.1, core: false },
  { x: 0.09, z: -0.09, height: 0.52, radius: 0.11, lean: 0.3, heading: 5.4, core: false },
  // Bright cores sit inside the bigger tongues.
  { x: 0, z: 0, height: 0.5, radius: 0.08, lean: 0.03, heading: 0.5, core: true },
  { x: 0.06, z: -0.04, height: 0.36, radius: 0.06, lean: 0.15, heading: 3.3, core: true },
];

/** Flame colours from foot to tip, in sRGB. */
const FLAME_FOOT_COLOUR = new THREE.Color(0xffa020);
const FLAME_TIP_COLOUR = new THREE.Color(0xd8300c);
const CORE_FOOT_COLOUR = new THREE.Color(0xffe680);
const CORE_TIP_COLOUR = new THREE.Color(0xffb830);
/** Each facet of a flame is up to this much lighter or darker than its neighbours, so the flat shapes read as low-poly. */
const FACET_SHADE = 0.12;
/** How fast flame tongues sway, stretch, and twist, and by how much. */
const SWAY_PER_SECOND = 5.5;
const SWAY_RADIANS = 0.14;
const STRETCH_AMOUNT = 0.2;
const TWIST_PER_SECOND = 0.6;

const EMBER_COUNT = 9;
const EMBER_BED_RADIUS_METRES = 0.2;
const EMBER_SIZE_METRES = 0.05;
const EMBER_HOT_COLOUR = new THREE.Color(0xff7a1a);
const EMBER_DULL_COLOUR = new THREE.Color(0xa8200c);
const EMBER_PULSE_PER_SECOND = 1.3;

const SPARK_COUNT = 10;
const SPARK_SIZE_METRES = 0.03;
const SPARK_COLOUR = 0xffb040;
/** A spark lives this long, in seconds, and rises this high before it is gone. */
const SPARK_LIFE_SECONDS = 1.6;
const SPARK_RISE_METRES = 1.5;
const SPARK_DRIFT_METRES = 0.25;

const SMOKE_COUNT = 5;
const SMOKE_SIZE_METRES = 0.09;
const SMOKE_COLOUR = 0x6e6a66;
const SMOKE_OPACITY = 0.16;
const SMOKE_LIFE_SECONDS = 4;
/** Smoke starts this high, above the flame tips, and rises this much further. */
const SMOKE_START_METRES = 0.95;
const SMOKE_RISE_METRES = 1.6;
const SMOKE_DRIFT_METRES = 0.35;
/** A puff grows to this many times its starting size before it thins away. */
const SMOKE_GROWTH = 2.5;

/** The parts of one fire, ready to add to a campfire and animate. */
export interface Fire {
  readonly group: THREE.Group;
  /**
   * Moves every part to how it looks at `nowSeconds`. `size` scales the flames, sparks, and smoke, from about 0.3 for
   * a fire nearly out of fuel to 1 for a full one. `seed` keeps neighbouring fires from moving in step.
   */
  animate(nowSeconds: number, size: number, seed: number): void;
}

export interface FireMaker {
  make(): Fire;
  dispose(): void;
}

/** A flame tongue's cone, standing on its foot, with colours fading from foot to tip and facets shaded unevenly. */
function createTongueGeometry(foot: THREE.Color, tip: THREE.Color, seed: number): THREE.BufferGeometry {
  const cone = new THREE.ConeGeometry(1, 1, 5, 2, true);
  cone.translate(0, 0.5, 0);
  const geometry = cone.toNonIndexed();
  cone.dispose();
  const positions = geometry.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const colour = new THREE.Color();
  for (let face = 0; face < positions.count / 3; face += 1) {
    // A repeatable pseudo-random shade for each facet.
    const shade = 1 + FACET_SHADE * Math.sin(face * 12.9898 + seed * 78.233);
    for (let corner = 0; corner < 3; corner += 1) {
      const index = face * 3 + corner;
      colour.copy(foot).lerp(tip, positions.getY(index)).multiplyScalar(shade);
      colour.toArray(colours, index * 3);
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

export function createFireMaker(): FireMaker {
  const flameGeometry = createTongueGeometry(FLAME_FOOT_COLOUR, FLAME_TIP_COLOUR, 1);
  const coreGeometry = createTongueGeometry(CORE_FOOT_COLOUR, CORE_TIP_COLOUR, 2);
  // Flames, embers, and sparks give off their own light, so they ignore the scene's lights and stay bright at night.
  // Their materials count as see-through, even fully opaque ones, so sky-lighting.ts does not let them cast shadows.
  // They skip tone mapping, which would wash their colours out toward white.
  const flameMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    toneMapped: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coreMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, toneMapped: false, side: THREE.DoubleSide });
  const emberGeometry = new THREE.DodecahedronGeometry(EMBER_SIZE_METRES, 0);
  emberGeometry.scale(1, 0.5, 1);
  const sparkGeometry = new THREE.OctahedronGeometry(SPARK_SIZE_METRES, 0);
  const sparkMaterial = new THREE.MeshBasicMaterial({ color: SPARK_COLOUR, transparent: true, toneMapped: false });
  const smokeGeometry = new THREE.DodecahedronGeometry(SMOKE_SIZE_METRES, 0);
  // Smoke catches the scene's light, so it shows grey by day and takes the fire's glow at night.
  const smokeMaterial = new THREE.MeshStandardMaterial({
    color: SMOKE_COLOUR,
    transparent: true,
    opacity: SMOKE_OPACITY,
    depthWrite: false,
    flatShading: true,
  });
  const emberMaterials: THREE.MeshBasicMaterial[] = [];

  function make(): Fire {
    const group = new THREE.Group();
    const flames = new THREE.Group();
    group.add(flames);
    const tongues = TONGUES.map((tongue) => {
      const pivot = new THREE.Group();
      pivot.position.set(tongue.x, 0.04, tongue.z);
      const mesh = new THREE.Mesh(tongue.core ? coreGeometry : flameGeometry, tongue.core ? coreMaterial : flameMaterial);
      mesh.scale.set(tongue.radius, tongue.height, tongue.radius);
      // Cores draw after the see-through flames around them.
      mesh.renderOrder = tongue.core ? 1 : 0;
      pivot.add(mesh);
      flames.add(pivot);
      return { pivot, mesh, tongue };
    });

    // Each fire's embers share one material, so the whole bed pulses together.
    const emberMaterial = new THREE.MeshBasicMaterial({ color: EMBER_HOT_COLOUR, transparent: true, toneMapped: false });
    emberMaterials.push(emberMaterial);
    for (let i = 0; i < EMBER_COUNT; i += 1) {
      const angle = i * 2.4;
      const out = EMBER_BED_RADIUS_METRES * Math.sqrt((i + 0.5) / EMBER_COUNT);
      const ember = new THREE.Mesh(emberGeometry, emberMaterial);
      ember.position.set(Math.sin(angle) * out, EMBER_SIZE_METRES * 0.25, Math.cos(angle) * out);
      ember.rotation.set(0, angle * 3, 0);
      group.add(ember);
    }

    const sparks = Array.from({ length: SPARK_COUNT }, () => {
      const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
      flames.add(spark);
      return spark;
    });
    const puffs = Array.from({ length: SMOKE_COUNT }, () => {
      const puff = new THREE.Mesh(smokeGeometry, smokeMaterial);
      flames.add(puff);
      return puff;
    });

    return {
      group,
      animate(nowSeconds, size, seed) {
        flames.scale.setScalar(size);
        for (const [index, { pivot, mesh, tongue }] of tongues.entries()) {
          const t = nowSeconds * SWAY_PER_SECOND + seed + index * 1.9;
          const swayX = Math.sin(t) * 0.6 + Math.sin(t * 2.7 + 0.4) * 0.4;
          const swayZ = Math.sin(t * 1.3 + 2.1) * 0.6 + Math.sin(t * 3.1) * 0.4;
          pivot.rotation.set(Math.cos(tongue.heading) * tongue.lean + swayX * SWAY_RADIANS, 0, Math.sin(tongue.heading) * tongue.lean + swayZ * SWAY_RADIANS);
          const stretch = 1 + STRETCH_AMOUNT * (Math.sin(t * 1.7 + 0.8) * 0.7 + Math.sin(t * 4.3) * 0.3);
          mesh.scale.y = tongue.height * stretch;
          mesh.rotation.y = nowSeconds * TWIST_PER_SECOND * (index % 2 === 0 ? 1 : -1) + index;
        }

        const pulse = 0.5 + 0.5 * Math.sin(nowSeconds * EMBER_PULSE_PER_SECOND * Math.PI * 2 + seed);
        emberMaterial.color.copy(EMBER_DULL_COLOUR).lerp(EMBER_HOT_COLOUR, 0.4 + 0.6 * pulse);

        for (const [index, spark] of sparks.entries()) {
          const life = (nowSeconds / SPARK_LIFE_SECONDS + index / SPARK_COUNT + seed * 0.37) % 1;
          // Each new life of a spark takes a fresh direction, so the sparks do not repeat one path.
          const round = Math.floor(nowSeconds / SPARK_LIFE_SECONDS + index / SPARK_COUNT + seed * 0.37);
          const heading = index * 2.4 + round * 1.7;
          const drift = SPARK_DRIFT_METRES * life * (0.5 + 0.5 * Math.sin(round + index));
          spark.position.set(Math.sin(heading) * drift + Math.sin(life * 9 + index) * 0.03, 0.25 + life * SPARK_RISE_METRES, Math.cos(heading) * drift);
          spark.scale.setScalar(Math.max(0.01, 1 - life));
          spark.rotation.set(life * 6, life * 4, 0);
        }

        for (const [index, puff] of puffs.entries()) {
          const life = (nowSeconds / SMOKE_LIFE_SECONDS + index / SMOKE_COUNT + seed * 0.21) % 1;
          puff.position.set(
            Math.sin(life * 2.2 + index) * SMOKE_DRIFT_METRES * life,
            SMOKE_START_METRES + life * SMOKE_RISE_METRES,
            Math.cos(life * 1.7 + index * 2) * SMOKE_DRIFT_METRES * life * 0.6,
          );
          // A puff swells as it rises, then shrinks away near the end of its life so it seems to thin out.
          const growth = 1 + (SMOKE_GROWTH - 1) * life;
          const fade = Math.min(1, life * 6) * Math.min(1, (1 - life) * 3);
          puff.scale.setScalar(Math.max(0.01, growth * fade));
          puff.rotation.set(life * 2 + index, life * 3, 0);
        }
      },
    };
  }

  return {
    make,
    dispose() {
      for (const item of [
        flameGeometry,
        coreGeometry,
        flameMaterial,
        coreMaterial,
        emberGeometry,
        sparkGeometry,
        sparkMaterial,
        smokeGeometry,
        smokeMaterial,
        ...emberMaterials,
      ]) {
        item.dispose();
      }
    },
  };
}
