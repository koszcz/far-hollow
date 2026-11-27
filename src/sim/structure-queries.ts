// Questions about structures in general: what kind an entity is, where it stands, and what it covers.
// They read only each structure's shape, so the placement rules in every structure's file can ask them.
import { type Entity, type EntityStore } from "./entities";
import { blueprintEntities } from "./entity-queries";
import type { GroundRect, StructureKind } from "./structure-kind";
import { SHAPES } from "./structure-shapes";
import type { FinishedMarker, PlacedStructure, StructureShape } from "./structure-types";

/** Whether a structure is placed freely rather than on the building grid: furniture and the sled. */
export function isPlacedFreely(kind: StructureKind): boolean {
  return SHAPES[kind].placement === "anywhere";
}

/** Whether a structure lies flush on a foundation's deck, so it is never in the way of another structure. Only a floor does. */
export function liesUnderfoot(kind: StructureKind): boolean {
  return SHAPES[kind].placement === "underfoot";
}

/**
 * What kind of structure an entity is: a blueprint of any structure, or a finished campfire, lean-to, foundation,
 * log wall, door frame, roof frame, roof section, fireplace, chimney, woodpile, piece of furniture, work station, or sled. Undefined for anything else.
 */
export function structureKindOf(entity: Entity): StructureKind | undefined {
  if (entity.blueprint !== undefined) return entity.blueprint.structure;
  return Object.values<StructureShape>(SHAPES).find((shape) => isFinishedAs(shape, entity))?.kind;
}

/** Whether an entity is a finished structure of this kind: it has the kind's marker, holding the kind's name where the marker holds a name. */
function isFinishedAs({ kind, finishedAs }: StructureShape, entity: Entity): boolean {
  const marker: unknown = entity[finishedAs];
  return marker !== undefined && (typeof marker !== "string" || marker === kind);
}

/** Every marker component, once each, even where several kinds share one. */
const FINISHED_MARKERS: readonly FinishedMarker[] = [...new Set(Object.values<StructureShape>(SHAPES).map(({ finishedAs }) => finishedAs))];

/** Every finished structure, of every kind, with its kind. Blueprints are not among them. */
export function finishedStructures(entities: EntityStore): { entity: PlacedStructure; kind: StructureKind }[] {
  return FINISHED_MARKERS.flatMap((marker) =>
    [...entities.with(marker, "position")].flatMap((entity) => {
      const kind = structureKindOf(entity);
      return kind === undefined ? [] : [{ entity: entity, kind }];
    }),
  );
}

/** Every blueprint and every finished structure, with its kind. */
export function placedStructures(entities: EntityStore): { entity: PlacedStructure; kind: StructureKind }[] {
  const blueprints = [...blueprintEntities(entities)].map((entity) => ({ entity, kind: entity.blueprint.structure }));
  return [...blueprints, ...finishedStructures(entities)];
}

/** Whether an entity is a blueprint or a finished structure, standing somewhere. */
export function isPlacedStructure(entity: Entity): entity is PlacedStructure {
  return structureKindOf(entity) !== undefined && entity.position !== undefined;
}

/** The ground a blueprint or finished structure covers where it stands, facing the way it faces. */
export function footprintOfEntity(entity: PlacedStructure): GroundRect {
  const kind = structureKindOf(entity);
  if (kind === undefined) throw new Error("Not a structure");
  return SHAPES[kind].footprint({ x: entity.position.x, z: entity.position.z }, entity.facing?.turns ?? 0);
}
