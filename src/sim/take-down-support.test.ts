import { describe, expect, it } from "bun:test";
import { BACKPACK_WEIGHT_LIMIT_KG, CONTENT_WEIGHT_KG } from "./backpack";
import { createGame } from "./game";
import { FOUNDATION_BUILD_SECONDS, LOG_WALL_BUILD_SECONDS, ROOF_PLANK_COST, roofFrameOn } from "./structure-cabin-shell";
import { edgePieceOn } from "./edge-pieces";
import { cabinRoofOn } from "./roofs";
import {
  finishedPieceAt,
  finishedRoofAt,
  walkTo,
  fillBackpackUntilFree,
  debarkedLogsOnGround,
  finishedFoundationAt,
  openSquareNearPlayer,
  place,
  onlyBlueprint,
  send,
  stepUntil,
  runSeconds,
  onlyPlayer,
  idOf,
} from "./take-down-test-helpers";

describe("what holds up what", () => {
  it("keeps a foundation while a log wall or door frame stands on its edge, and lets it come down once the wall is gone", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    const wall = finishedPieceAt(game, "doorFrame", square, 0);

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    expect(game.client.getView().notice?.kind).toBe("holdsUpPiece");
    runSeconds(game, FOUNDATION_BUILD_SECONDS);
    expect(game.entities.has(foundation)).toBe(true);

    send(game, { type: "takeDown", pieceId: idOf(game, wall) });
    stepUntil(game, () => !game.entities.has(wall));
    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    stepUntil(game, () => !game.entities.has(foundation));
  });

  it("keeps a foundation while a wall blueprint is placed on its edge", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    send(game, place("logWall", square, 1));

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    runSeconds(game, FOUNDATION_BUILD_SECONDS);

    expect(game.entities.has(foundation)).toBe(true);
  });

  it("keeps a foundation while a campfire stands on its square", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    game.entities.add({ campfire: { lit: false, fuelMinutes: 0 }, position: { ...foundation.position, x: square.x + 0.2 } });

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    runSeconds(game, FOUNDATION_BUILD_SECONDS);

    expect(game.entities.has(foundation)).toBe(true);
  });

  it("keeps a wall while a roof frame rests on it, and lets it come down once the frame is gone", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const wall = finishedPieceAt(game, "logWall", square, 2);
    send(game, place("roofFrame", square, 0));
    const frame = onlyBlueprint(game);

    // Even a frame that is still a blueprint rests on the wall.
    send(game, { type: "takeDown", pieceId: idOf(game, wall) });
    expect(game.client.getView().notice?.kind).toBe("holdsUpPiece");
    runSeconds(game, LOG_WALL_BUILD_SECONDS);
    expect(game.entities.has(wall)).toBe(true);

    send(game, { type: "takeDown", pieceId: idOf(game, frame) });
    stepUntil(game, () => !game.entities.has(frame));
    send(game, { type: "takeDown", pieceId: idOf(game, wall) });
    stepUntil(game, () => !game.entities.has(wall));
  });

  it("lets a roof come down, giving back its planks and leaving its frame", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 2);
    const roof = finishedRoofAt(game, square);
    const logsBefore = debarkedLogsOnGround(game);

    send(game, { type: "takeDown", pieceId: idOf(game, roof) });
    stepUntil(game, () => !game.entities.has(roof));

    expect(debarkedLogsOnGround(game)).toBe(logsBefore);
    expect(onlyPlayer(game).backpack.contents.plank).toBe(ROOF_PLANK_COST);
    expect(roofFrameOn(game.entities, square)).toBeDefined();
    expect(cabinRoofOn(game.entities, square)).toBeUndefined();
  });

  it("lays the planks that do not fit in the backpack on the ground as one pile", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 2);
    const roof = finishedRoofAt(game, square);
    // Room for two planks only.
    fillBackpackUntilFree(game, BACKPACK_WEIGHT_LIMIT_KG - 2 * CONTENT_WEIGHT_KG.plank);

    send(game, { type: "takeDown", pieceId: idOf(game, roof) });
    stepUntil(game, () => !game.entities.has(roof));

    expect(onlyPlayer(game).backpack.contents.plank).toBe(2);
    expect(game.entities.with("pile").entities.map(({ pile }) => pile)).toEqual([{ content: "plank", count: ROOF_PLANK_COST - 2 }]);
  });

  it("frees the edge a log wall blocked", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, { x: square.x, z: square.z + 1 });
    const wall = finishedPieceAt(game, "logWall", square, 0);
    expect(edgePieceOn(game.entities, square, 0)).toBe("logWall");

    send(game, { type: "takeDown", pieceId: idOf(game, wall) });
    stepUntil(game, () => !game.entities.has(wall));

    expect(edgePieceOn(game.entities, square, 0)).toBeUndefined();
    walkTo(game, square);
    walkTo(game, { x: square.x, z: square.z + 1 });
    expect(onlyPlayer(game).position.z).toBeCloseTo(square.z + 1, 0);
  });
});
