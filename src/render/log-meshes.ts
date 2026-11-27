// Draws the logs and debarked logs lying on the ground: the "logs" and "debarked-log" assets (approved) in asset-manifest.json.
// Debarked logs are built from the log shape by debarked-log-shape.ts.
// While the player saws a debarked log into planks, it is drawn lying along the sawhorse beam. Game logic keeps it on the ground.
import * as THREE from "three";
import { MOST_LOGS_PER_TREE } from "../sim/tree-size";
import { logWorkedNow } from "../sim/crafting";
import { quarterTurnsToRadians } from "../sim/quarter-turns";
import { type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { debarkedLogEntities, logEntities, type playerEntities } from "../sim/entity-queries";
import { createDebarkedLogGeometry } from "./debarked-log-shape";
import type { OutlinePart } from "./hover-outline";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";
import { BEAM_TOP_METRES } from "./sawhorse-meshes";

export interface LogMeshes {
  /** The batch of logs, so a ray hit can tell it from the other meshes. */
  readonly logs: THREE.InstancedMesh;
  /** The batch of debarked logs. */
  readonly debarkedLogs: THREE.InstancedMesh;
  /** Redraws the logs that changed since the last call, and moves the log the player saws onto the beam or back. */
  update(): void;
  /** The log drawn at a place in the logs batch, if any. */
  logAt(instanceId: number): Entity | undefined;
  /** The debarked log drawn at a place in the debarked logs batch, if any. */
  debarkedLogAt(instanceId: number): Entity | undefined;
  /** The shape that draws a log, placed in the world. Empty once it is gone. */
  outlineLog(log: Entity): OutlinePart[];
  /** The shape that draws a debarked log, placed in the world. Empty once it is gone. */
  outlineDebarkedLog(log: Entity): OutlinePart[];
  dispose(): void;
}

/**
 * Both batches have room for every log `treeCount` trees can give. `track` disposes what it is given when the forest is disposed.
 * The batches are added to `group`.
 */
export function createLogMeshes(
  entities: EntityStore,
  group: THREE.Group,
  track: <T extends { dispose(): void }>(item: T) => T,
  logShape: LogShape,
  treeCount: number,
  players: ReturnType<typeof playerEntities>,
): LogMeshes {
  // Logs on the ground: one batch, with room for every log the valley's trees can give.
  const logGeometry = track(logShape.geometry);
  const logMaterials = [
    track(new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true })),
    track(
      new THREE.MeshStandardMaterial({
        color: LOG_CUT_COLOUR,
        flatShading: true,
      }),
    ),
  ];
  const logCapacity = Math.max(1, treeCount * MOST_LOGS_PER_TREE);
  const logs = track(new THREE.InstancedMesh(logGeometry, logMaterials, logCapacity));
  logs.count = 0;
  logs.frustumCulled = false;
  group.add(logs);
  let logsDrawn: Entity[] = [];

  // Debarked logs on the ground: the same shape as logs, painted pale, with room for every log the valley's trees can give.
  const debarkedLogGeometry = track(createDebarkedLogGeometry(logShape.geometry));
  const debarkedLogMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      vertexColors: true,
    }),
  );
  const debarkedLogs = track(new THREE.InstancedMesh(debarkedLogGeometry, debarkedLogMaterial, logCapacity));
  debarkedLogs.count = 0;
  debarkedLogs.frustumCulled = false;
  group.add(debarkedLogs);
  let debarkedLogsDrawn: Entity[] = [];

  const logQuery = logEntities(entities).connect();
  const debarkedLogQuery = debarkedLogEntities(entities).connect();
  let logsDirty = true;
  let debarkedLogsDirty = true;
  const markLogs = () => {
    logsDirty = true;
  };
  logQuery.onEntityAdded.subscribe(markLogs);
  logQuery.onEntityRemoved.subscribe(markLogs);
  const markDebarkedLogs = () => {
    debarkedLogsDirty = true;
  };
  debarkedLogQuery.onEntityAdded.subscribe(markDebarkedLogs);
  debarkedLogQuery.onEntityRemoved.subscribe(markDebarkedLogs);

  const matrix = new THREE.Matrix4();
  const logRotation = new THREE.Quaternion();
  const logPosition = new THREE.Vector3();
  const logScale = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  /** Lays each log in `lying` into `batch`, and returns them in instance order. */
  function rebuildLogBatch(batch: THREE.InstancedMesh, lying: Iterable<{ entity: Entity; heading: number; position: Vec3 }>): Entity[] {
    const drawn: Entity[] = [];
    for (const { entity, heading, position } of lying) {
      if (drawn.length >= logCapacity) break;
      logRotation.setFromAxisAngle(up, heading);
      logPosition.set(position.x, position.y + logShape.restHeight, position.z);
      matrix.compose(logPosition, logRotation, logScale);
      batch.setMatrixAt(drawn.length, matrix);
      drawn.push(entity);
    }
    batch.count = drawn.length;
    batch.instanceMatrix.needsUpdate = true;
    // Clicks test this sphere first, so it must cover the logs as they lie now.
    batch.computeBoundingSphere();
    return drawn;
  }

  /** The log the player works on at a work station, as drawn last: lying along the station's beam. */
  let worked: { log: Entity; station: Entity } | undefined;
  /** Where a log lying at `position`, turned `heading`, is drawn: on the sawhorse beam while the player works on it. */
  function lyingSpot(entity: Entity, heading: number, position: Vec3): { entity: Entity; heading: number; position: Vec3 } {
    const station = worked?.log === entity ? worked.station : undefined;
    if (station?.position === undefined) return { entity, heading, position };
    // The beam runs along x when the station faces the default way. The log's length runs along z before it is turned.
    const beamHeading = quarterTurnsToRadians(station.facing?.turns ?? 0) + Math.PI / 2;
    return { entity, heading: beamHeading, position: { ...station.position, y: station.position.y + BEAM_TOP_METRES } };
  }

  /** Notes which log the player works on now. A change redraws the logs, so it moves onto the beam or back to the ground. */
  function updateWorkedLog(): void {
    const player = players.first;
    const now = player === undefined ? undefined : logWorkedNow(entities, player);
    if (now?.log === worked?.log && now?.station === worked?.station) return;
    worked = now;
    logsDirty = true;
    debarkedLogsDirty = true;
  }

  function rebuildLogs(): void {
    logsDrawn = rebuildLogBatch(
      logs,
      [...logQuery].map((log) => lyingSpot(log, log.log.heading, log.position)),
    );
  }

  function rebuildDebarkedLogs(): void {
    debarkedLogsDrawn = rebuildLogBatch(
      debarkedLogs,
      [...debarkedLogQuery].map((log) => lyingSpot(log, log.debarkedLog.heading, log.position)),
    );
  }

  function placed(batch: THREE.InstancedMesh, index: number): THREE.Matrix4 {
    group.updateMatrixWorld();
    batch.getMatrixAt(index, matrix);
    return new THREE.Matrix4().multiplyMatrices(group.matrixWorld, matrix);
  }

  return {
    logs,
    debarkedLogs,
    update() {
      updateWorkedLog();
      if (logsDirty) rebuildLogs();
      if (debarkedLogsDirty) rebuildDebarkedLogs();
      logsDirty = false;
      debarkedLogsDirty = false;
    },
    logAt: (instanceId) => logsDrawn[instanceId],
    debarkedLogAt: (instanceId) => debarkedLogsDrawn[instanceId],
    outlineLog(log) {
      const index = logsDrawn.indexOf(log);
      return index < 0 ? [] : [{ geometry: logGeometry, matrix: placed(logs, index) }];
    },
    outlineDebarkedLog(log) {
      const index = debarkedLogsDrawn.indexOf(log);
      return index < 0 ? [] : [{ geometry: debarkedLogGeometry, matrix: placed(debarkedLogs, index) }];
    },
    dispose() {
      logQuery.disconnect();
      debarkedLogQuery.disconnect();
    },
  };
}
