// Sunlight, moonlight, and sky colour, following the valley's clock.
// These are three.js lights and colours, not asset files.
import * as THREE from "three";
import { daylightAt } from "./daylight";
import { GROUND_COLOUR } from "./valley-meshes";

const DAY_SKY_COLOUR = 0x9cc7e8;
const NIGHT_SKY_COLOUR = 0x0a1020;
const DAY_SKY_LIGHT_STRENGTH = 1.2;
/** Faint blue light from the night sky. Low enough that the player needs fire, high enough to show shapes. */
const NIGHT_SKY_LIGHT_COLOUR = 0x34456b;
const NIGHT_SKY_LIGHT_STRENGTH = 0.25;

const SUN_COLOUR = 0xffffff;
const SUN_STRENGTH = 1.5;
const MOON_COLOUR = 0x8fa6d6;
const MOON_STRENGTH = 0.18;

/** Ground beyond the far side of the valley fades into the sky colour between these distances. */
const FOG_START_METRES = 1400;
const FOG_END_METRES = 2600;

export interface SkyLighting {
  /** Sets the light and sky colour for this hour of the day, with its fraction. */
  update(hourOfDay: number): void;
}

export function createSkyLighting(scene: THREE.Scene): SkyLighting {
  const daySky = new THREE.Color(DAY_SKY_COLOUR);
  const nightSky = new THREE.Color(NIGHT_SKY_COLOUR);
  const daySkyLight = new THREE.Color(DAY_SKY_COLOUR);
  const nightSkyLight = new THREE.Color(NIGHT_SKY_LIGHT_COLOUR);

  const background = new THREE.Color(DAY_SKY_COLOUR);
  scene.background = background;
  const fog = new THREE.Fog(DAY_SKY_COLOUR, FOG_START_METRES, FOG_END_METRES);
  scene.fog = fog;

  const skyLight = new THREE.HemisphereLight(DAY_SKY_COLOUR, GROUND_COLOUR, DAY_SKY_LIGHT_STRENGTH);
  scene.add(skyLight);

  const sun = new THREE.DirectionalLight(SUN_COLOUR, SUN_STRENGTH);
  sun.position.set(30, 50, 10);
  scene.add(sun);

  const moon = new THREE.DirectionalLight(MOON_COLOUR, 0);
  moon.position.set(-20, 50, -30);
  scene.add(moon);

  return {
    update(hourOfDay) {
      const daylight = daylightAt(hourOfDay);
      background.lerpColors(nightSky, daySky, daylight);
      fog.color.copy(background);
      skyLight.color.lerpColors(nightSkyLight, daySkyLight, daylight);
      skyLight.intensity = THREE.MathUtils.lerp(NIGHT_SKY_LIGHT_STRENGTH, DAY_SKY_LIGHT_STRENGTH, daylight);
      sun.intensity = SUN_STRENGTH * daylight;
      moon.intensity = MOON_STRENGTH * (1 - daylight);
    },
  };
}
