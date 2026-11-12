// Draws the "sky-lighting" asset listed in asset-manifest.json (approved): sun, moon, sky, shadows, and haze
// over the valley, following the valley's clock. Everything here is built in code with three.js.
//
// - The sun crosses the sky from east to west between morning and nightfall. It turns orange near dawn and dusk.
// - The sun casts soft shadows in a box that follows what the camera looks at.
// - A sky dome shades from the horizon colour up to the zenith colour, with a glow on the sun's side and stars at night.
// - Haze thickens and changes colour with the hour: morning mist, clear midday, golden dusk, blue night.
import * as THREE from "three";
import { MORNING_HOUR, NIGHT_START_HOUR } from "../sim/clock";
import { SHADOW_ONLY_LAYER } from "./culled-batch";
import { daylightAt } from "./daylight";
import { GROUND_COLOUR } from "./valley-meshes";

const DAY_SKY_LIGHT_COLOUR = 0x9cc7e8;
const DAY_SKY_LIGHT_STRENGTH = 1.2;
/** Faint blue light from the night sky. Low enough that the player needs fire, high enough to show shapes. */
const NIGHT_SKY_LIGHT_COLOUR = 0x34456b;
const NIGHT_SKY_LIGHT_STRENGTH = 0.25;

const NOON_SUN_COLOUR = 0xfff4e0;
/** The sun's colour when it is low, near dawn and dusk. */
const LOW_SUN_COLOUR = 0xff9a4a;
const SUN_STRENGTH = 1.6;
/** The sun's highest point above the horizon, at midday, in degrees. */
const SUN_HIGHEST_DEGREES = 62;
/** The sun's path leans this far toward the south, in degrees, so midday shadows still fall to one side. */
const SUN_PATH_LEAN_DEGREES = 25;
const MOON_COLOUR = 0x8fa6d6;
const MOON_STRENGTH = 0.18;
/** Where the moon stands, as a direction from the ground. */
const MOON_DIRECTION = new THREE.Vector3(-20, 50, -30).normalize();

/** The sun's shadows cover a square this many times wider than the camera's distance from what it looks at. */
const SHADOW_BOX_PER_VIEW_METRE = 1.1;
const SHADOW_BOX_MIN_METRES = 24;
const SHADOW_BOX_MAX_METRES = 160;
const SHADOW_MAP_PIXELS = 2048;
/** The light stands this far from the middle of the shadow box. Far enough that tall trees fit inside it. */
const SHADOW_LIGHT_DISTANCE_METRES = 200;

/** Overall brightness after filmic tone mapping. Above 1 keeps midday colours close to how they looked before it. */
const EXPOSURE = 1.15;

/** One moment of the sky's day. Colours are in sRGB. Haze is the fog's thickness per metre. */
interface SkyKey {
  readonly hour: number;
  readonly zenith: number;
  readonly horizon: number;
  readonly haze: number;
}

/** The sky through one day, in hour order from midnight. Hours between two keys blend them. */
const SKY_KEYS: readonly SkyKey[] = [
  { hour: 0, zenith: 0x050a18, horizon: 0x111c33, haze: 0.0009 },
  { hour: MORNING_HOUR - 0.5, zenith: 0x0b1428, horizon: 0x24264a, haze: 0.0011 },
  { hour: MORNING_HOUR + 0.5, zenith: 0x2f4475, horizon: 0xe8a27a, haze: 0.0018 },
  { hour: MORNING_HOUR + 2, zenith: 0x5a8fcb, horizon: 0xcfe0ea, haze: 0.0011 },
  { hour: 12, zenith: 0x4a88d0, horizon: 0xb8d6ec, haze: 0.0005 },
  { hour: NIGHT_START_HOUR - 3, zenith: 0x4a88d0, horizon: 0xbcd6e8, haze: 0.0005 },
  { hour: NIGHT_START_HOUR - 1, zenith: 0x40609c, horizon: 0xf09858, haze: 0.0007 },
  { hour: NIGHT_START_HOUR + 0.5, zenith: 0x121a36, horizon: 0x3d2c48, haze: 0.0008 },
  { hour: NIGHT_START_HOUR + 1.5, zenith: 0x050a18, horizon: 0x111c33, haze: 0.0009 },
  { hour: 24, zenith: 0x050a18, horizon: 0x111c33, haze: 0.0009 },
];

/** Where the camera looks, so the sun's shadows can cover it. */
export interface SkyView {
  readonly focus: { readonly x: number; readonly y: number; readonly z: number };
  /** How far the camera is from the focus, in metres. Shadows cover more ground when it is further away. */
  readonly distance: number;
}

export interface SkyLighting {
  /** Sets the light, sky, and haze for this hour of the day, with its fraction, and centres the shadows on the view. */
  update(hourOfDay: number, view: SkyView): void;
  /**
   * Things that cast shadows and catch them. Solid meshes inside these groups, including ones added later, cast
   * shadows. See-through meshes, such as flames and blueprints, do not.
   */
  addShadowCasters(...groups: THREE.Object3D[]): void;
  /**
   * What the sun's shadow box covers this frame, or null while the sun casts no shadows.
   * Call it after update.
   */
  shadowFrustum(): THREE.Frustum | null;
  /** Things that only catch shadows, such as the ground. */
  addShadowReceivers(...groups: THREE.Object3D[]): void;
  dispose(): void;
}

/** Sets up the renderer's shadows and tone mapping, and adds the lights and sky dome to the scene. */
export function createSkyLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer): SkyLighting {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;

  const zenith = new THREE.Color();
  const horizon = new THREE.Color();
  const fog = new THREE.FogExp2(0x000000, 0);
  scene.fog = fog;
  // The dome covers the background. This colour shows only before the dome first draws.
  scene.background = horizon;

  const daySkyLight = new THREE.Color(DAY_SKY_LIGHT_COLOUR);
  const nightSkyLight = new THREE.Color(NIGHT_SKY_LIGHT_COLOUR);
  const skyLight = new THREE.HemisphereLight(DAY_SKY_LIGHT_COLOUR, GROUND_COLOUR, DAY_SKY_LIGHT_STRENGTH);
  scene.add(skyLight);

  const noonSun = new THREE.Color(NOON_SUN_COLOUR);
  const lowSun = new THREE.Color(LOW_SUN_COLOUR);
  const sun = new THREE.DirectionalLight(NOON_SUN_COLOUR, SUN_STRENGTH);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP_PIXELS, SHADOW_MAP_PIXELS);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = SHADOW_LIGHT_DISTANCE_METRES * 2;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  // Batches that cull their own shadows draw them on this layer, which only the sun's shadow camera sees.
  sun.shadow.camera.layers.enable(SHADOW_ONLY_LAYER);
  scene.add(sun, sun.target);

  const moon = new THREE.DirectionalLight(MOON_COLOUR, 0);
  scene.add(moon, moon.target);

  const dome = createSkyDome();
  scene.add(dome.mesh);

  const casters: THREE.Object3D[] = [];
  const sunDirection = new THREE.Vector3();
  const lightDirection = new THREE.Vector3();
  const highestSunHeight = Math.sin(THREE.MathUtils.degToRad(SUN_HIGHEST_DEGREES));

  function markCasters(): void {
    for (const group of casters) {
      group.traverse((object) => {
        // Culled batches cast shadows from a separate copy. See culled-batch.ts.
        if (!(object instanceof THREE.Mesh) || object.userData.castsShadowSeparately === true) return;
        const solid = materialsOf(object as THREE.Mesh).every((material) => !material.transparent && material.visible);
        object.castShadow = solid;
        object.receiveShadow = solid;
      });
    }
  }

  return {
    update(hourOfDay, view) {
      const daylight = daylightAt(hourOfDay);
      skyAt(hourOfDay, zenith, horizon);
      fog.color.copy(horizon);
      fog.density = hazeAt(hourOfDay);

      skyLight.color.lerpColors(nightSkyLight, daySkyLight, daylight);
      skyLight.intensity = THREE.MathUtils.lerp(NIGHT_SKY_LIGHT_STRENGTH, DAY_SKY_LIGHT_STRENGTH, daylight);

      sunDirectionAt(hourOfDay, sunDirection);
      // Lowness is 1 with the sun on the horizon and 0 once it is halfway up to its highest point.
      const lowness = 1 - THREE.MathUtils.smoothstep(sunDirection.y, 0, highestSunHeight / 2);
      sun.color.lerpColors(noonSun, lowSun, lowness);
      sun.intensity = SUN_STRENGTH * daylight;
      sun.castShadow = daylight > 0;

      const { focus } = view;
      const half = THREE.MathUtils.clamp(view.distance * SHADOW_BOX_PER_VIEW_METRE, SHADOW_BOX_MIN_METRES, SHADOW_BOX_MAX_METRES);
      const box = sun.shadow.camera;
      if (box.right !== half) {
        box.left = -half;
        box.right = half;
        box.top = half;
        box.bottom = -half;
        box.updateProjectionMatrix();
      }
      // A sun below the horizon would light the ground from beneath. Its light is off then, but it stays above.
      lightDirection.copy(sunDirection);
      lightDirection.y = Math.max(lightDirection.y, 0.05);
      lightDirection.normalize();
      sun.target.position.set(focus.x, focus.y, focus.z);
      sun.position.copy(sun.target.position).addScaledVector(lightDirection, SHADOW_LIGHT_DISTANCE_METRES);

      moon.intensity = MOON_STRENGTH * (1 - daylight);
      moon.target.position.set(focus.x, focus.y, focus.z);
      moon.position.copy(moon.target.position).add(MOON_DIRECTION);

      dome.set(zenith, horizon, sunDirection, lowSun, daylight, lowness);
      markCasters();
    },
    shadowFrustum() {
      if (!sun.castShadow) return null;
      sun.updateMatrixWorld();
      sun.target.updateMatrixWorld();
      sun.shadow.updateMatrices(sun);
      return sun.shadow.getFrustum();
    },
    addShadowCasters(...groups) {
      casters.push(...groups);
      markCasters();
    },
    addShadowReceivers(...groups) {
      for (const group of groups) {
        group.traverse((object) => {
          if (object instanceof THREE.Mesh) object.receiveShadow = true;
        });
      }
    },
    dispose() {
      dome.dispose();
      sun.shadow.dispose();
    },
  };
}

/** Where the sun is at this hour, as a direction from the ground. Below the horizon at night. */
export function sunDirectionAt(hourOfDay: number, out: THREE.Vector3): THREE.Vector3 {
  // 0 at morning, 1 at nightfall. Night continues the circle below the horizon.
  const dayFraction = (hourOfDay - MORNING_HOUR) / (NIGHT_START_HOUR - MORNING_HOUR);
  const angle = dayFraction * Math.PI;
  const highest = THREE.MathUtils.degToRad(SUN_HIGHEST_DEGREES);
  const lean = THREE.MathUtils.degToRad(SUN_PATH_LEAN_DEGREES);
  // East is +x. The sun rises there, stands high and a little south at midday, and sets in the west.
  return out.set(Math.cos(angle), Math.sin(angle) * Math.sin(highest), Math.sin(angle) * Math.cos(highest) * Math.sin(lean)).normalize();
}

/** The haze's thickness at this hour, as the fog's thickness per metre. */
export function hazeAt(hourOfDay: number): number {
  const [before, after, t] = keysAround(hourOfDay);
  return THREE.MathUtils.lerp(before.haze, after.haze, t);
}

/** Sets the sky's zenith and horizon colours for this hour. */
function skyAt(hourOfDay: number, zenith: THREE.Color, horizon: THREE.Color): void {
  const [before, after, t] = keysAround(hourOfDay);
  zenith.setHex(before.zenith).lerp(scratch.setHex(after.zenith), t);
  horizon.setHex(before.horizon).lerp(scratch.setHex(after.horizon), t);
}

const scratch = new THREE.Color();

/** The two sky keys on either side of this hour, and how far the hour is from the first to the second. */
function keysAround(hourOfDay: number): [SkyKey, SkyKey, number] {
  const hour = ((hourOfDay % 24) + 24) % 24;
  let before = SKY_KEYS[0] as SkyKey;
  for (const after of SKY_KEYS) {
    if (hour <= after.hour) {
      const span = after.hour - before.hour;
      return [before, after, span > 0 ? (hour - before.hour) / span : 0];
    }
    before = after;
  }
  return [before, before, 0];
}

function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  const material: THREE.Material | THREE.Material[] = mesh.material;
  return Array.isArray(material) ? material : [material];
}

/**
 * A dome drawn around the camera, behind everything else. It is built in a shader, so it costs one draw.
 * Stars come from a hash of the view direction, so they need no texture.
 */
function createSkyDome(): {
  mesh: THREE.Mesh;
  set(zenith: THREE.Color, horizon: THREE.Color, sunDirection: THREE.Vector3, glow: THREE.Color, daylight: number, lowness: number): void;
  dispose(): void;
} {
  const geometry = new THREE.SphereGeometry(1, 32, 16);
  const uniforms = {
    zenith: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    sunDirection: { value: new THREE.Vector3() },
    glow: { value: new THREE.Color() },
    daylight: { value: 1 },
    lowness: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        vec4 clip = projectionMatrix * viewMatrix * vec4(cameraPosition + position * 1000.0, 1.0);
        // Pushed to the back of the depth range, so the dome is behind everything.
        gl_Position = clip;
        gl_Position.z = clip.w * 0.99999;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 sunDirection;
      uniform vec3 glow;
      uniform float daylight;
      uniform float lowness;
      varying vec3 vDirection;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float up = max(direction.y, 0.0);
        vec3 colour = mix(horizon, zenith, pow(up, 0.6));

        // Warm glow around the sun, widest and strongest when the sun is low.
        float towardSun = max(dot(direction, sunDirection), 0.0);
        float glowStrength = lowness * clamp(sunDirection.y * 4.0 + 1.0, 0.0, 1.0);
        colour += glow * (pow(towardSun, 6.0) * 0.55 + pow(towardSun, 64.0) * 0.4) * glowStrength;
        // The sun's disc.
        colour += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, towardSun) * daylight * 2.0;

        // Stars, above the horizon and only at night.
        vec3 cell = floor(direction * 300.0);
        float star = step(0.9975, hash(cell)) * hash(cell + 7.0);
        colour += vec3(star) * pow(1.0 - daylight, 4.0) * smoothstep(0.0, 0.15, direction.y) * 0.9;

        gl_FragColor = vec4(colour, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return {
    mesh,
    set(zenith, horizon, sunDirection, glow, daylight, lowness) {
      uniforms.zenith.value.copy(zenith);
      uniforms.horizon.value.copy(horizon);
      uniforms.sunDirection.value.copy(sunDirection);
      uniforms.glow.value.copy(glow);
      uniforms.daylight.value = daylight;
      uniforms.lowness.value = lowness;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
