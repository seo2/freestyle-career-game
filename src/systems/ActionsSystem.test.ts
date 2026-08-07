import { describe, expect, it } from "vitest";
import type { GameState } from "../core/types";
import { createNewState } from "../core/state";
import { createSequenceRng, createStateRng } from "../services/RandomService";
import { executeAction, getCareerActions } from "./ActionsSystem";

function freshState(): GameState {
  const state = createNewState("Test", 12345);
  state.mode = "career";
  return state;
}

describe("getCareerActions", () => {
  it("returns the block-model descriptor list, byte-exact, for a fresh state", () => {
    const state = freshState();
    const actions = getCareerActions(state);

    expect(actions).toEqual([
      {
        id: "practice",
        label: "Practicar",
        detail: "Barras frente al espejo y beats en loop.",
        cost: "1 bloque / -16 energia",
        rhythm: "Impulso +8",
        durationBlocks: 1,
        disabledReason: undefined,
      },
      {
        id: "cypher",
        label: "Cypher",
        detail: "Juntarte con amigos a soltar rimas.",
        cost: "1 bloque / -14 energia",
        rhythm: "Impulso +12",
        durationBlocks: 1,
        disabledReason: undefined,
      },
      {
        id: "work",
        label: "Trabajar",
        detail: "Turno corto para financiar micros y estudio.",
        cost: "2 bloques / -20 energia",
        rhythm: "Impulso +1",
        durationBlocks: 2,
        disabledReason: undefined,
      },
      {
        id: "social",
        label: "Subir clip",
        detail: "Publicar freestyle, responder comentarios.",
        cost: "1 bloque / -12 energia",
        rhythm: "Impulso +11",
        durationBlocks: 1,
        disabledReason: undefined,
      },
      {
        id: "write",
        label: "Escribir tema",
        detail: "Convertir barras en una cancion grabable.",
        cost: "1 bloque / -18 energia",
        rhythm: "Impulso +9",
        durationBlocks: 1,
        disabledReason: undefined,
      },
      {
        id: "record",
        label: "Grabar",
        detail: "Pagar estudio y subir una cancion terminada.",
        cost: "1 bloque / $35 / -16 energia",
        rhythm: "Impulso +18",
        durationBlocks: 1,
        disabledReason: "Necesitas 80% de cancion.",
      },
      {
        id: "battle",
        label: "Batalla casera",
        detail: "Pieza / cypher con amigos: ronda por decisiones rapidas.",
        cost: "1 bloque / -22 energia",
        rhythm: "Impulso +16",
        durationBlocks: 1,
        disabledReason: undefined,
      },
      {
        id: "rest",
        label: "Descansar",
        detail: "Recuperar aire y evitar quemarte.",
        cost: "1 bloque / +energia / +salud",
        rhythm: "Impulso +2",
        durationBlocks: 1,
      },
    ]);
  });

  it("does not mutate state and consumes no RNG", () => {
    const state = freshState();
    const before = JSON.stringify(state);
    getCareerActions(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.seed).toBe(12345);
  });

  it("inserts show between battle and rest when songs > 0", () => {
    const state = freshState();
    state.songs = 1;
    const actions = getCareerActions(state);
    expect(actions.map((action) => action.id)).toEqual([
      "practice",
      "cypher",
      "work",
      "social",
      "write",
      "record",
      "battle",
      "show",
      "rest",
    ]);
    const show = actions[7];
    expect(show).toEqual({
      id: "show",
      label: "Show chico",
      detail: "Tocar en vivo, vender merch y probar canciones.",
      cost: "2 bloques / -26 energia",
      rhythm: "Impulso +16",
      durationBlocks: 2,
      disabledReason: undefined,
    });
  });

  it("shows show and scaled battle entry at regional stage even with no songs", () => {
    const state = freshState();
    state.stage = "regional";
    const actions = getCareerActions(state);
    expect(actions.map((action) => action.id)).toContain("show");
    const battle = actions.find((action) => action.id === "battle");
    expect(battle?.label).toBe("Regional");
    expect(battle?.detail).toBe("Escenarios regionales: ronda por decisiones rapidas.");
    expect(battle?.cost).toBe("2 bloques / -28 energia");
    expect(battle?.durationBlocks).toBe(2);
  });

  it("marks tiredness with the exact legacy message when energy is critical", () => {
    const state = freshState();
    state.energy = 10;
    const actions = getCareerActions(state);
    const byId = new Map(actions.map((action) => [action.id, action]));
    for (const id of ["practice", "cypher", "work", "social", "write", "battle"]) {
      expect(byId.get(id)?.disabledReason).toBe("Necesitas descansar.");
    }
    expect(byId.get("record")?.disabledReason).toBe("Necesitas 80% de cancion.");
    expect(byId.get("rest")?.disabledReason).toBeUndefined();
  });

  it("keeps the legacy quirk: energy between 12 and threshold leaves actions enabled", () => {
    const state = freshState();
    state.energy = 15; // below practice's 16 threshold, but tired is undefined at >= 12
    const actions = getCareerActions(state);
    expect(actions.find((action) => action.id === "practice")?.disabledReason).toBeUndefined();
  });

  it("orders record disabled reasons: song progress, then money, then tiredness", () => {
    const state = freshState();
    state.discProgress = 85;
    state.cash = 5;
    let record = getCareerActions(state).find((action) => action.id === "record");
    expect(record?.disabledReason).toBe("Falta dinero.");

    state.cash = 100;
    state.energy = 10;
    record = getCareerActions(state).find((action) => action.id === "record");
    expect(record?.disabledReason).toBe("Necesitas descansar.");

    state.energy = 86;
    record = getCareerActions(state).find((action) => action.id === "record");
    expect(record?.disabledReason).toBeUndefined();
  });
});

describe("executeAction guards", () => {
  it("returns none and leaves state untouched for a disabled action", () => {
    const state = freshState();
    state.energy = 10;
    const before = JSON.stringify(state);
    const result = executeAction(state, createStateRng(state), "practice");
    expect(result).toEqual({ type: "none" });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("returns none for an unknown action id", () => {
    const state = freshState();
    const before = JSON.stringify(state);
    const result = executeAction(state, createStateRng(state), "does-not-exist");
    expect(result).toEqual({ type: "none" });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("practice", () => {
  it("raises flow on a high roll and reports rhythm before time", () => {
    const state = freshState();
    const result = executeAction(state, createSequenceRng([0.6]), "practice");
    expect(result).toEqual({
      type: "event",
      parts: ["Practicaste en la pieza: +1 Flow.", "Impulso +8: Frio."],
      fx: { label: "Practicar", fromBlock: 0, toBlock: 1, blocks: 1, daysPassed: 0 },
    });
    expect(state.stats.flow).toBe(3);
    expect(state.xp).toBe(24);
    expect(state.energy).toBe(70);
    expect(state.block).toBe(1);
    expect(state.momentum).toBe(50);
    expect(state.lastActionId).toBe("practice");
    expect(state.actionStreak).toBe(1);
  });

  it("raises improvisacion on a low roll", () => {
    const state = freshState();
    const result = executeAction(state, createSequenceRng([0.4]), "practice");
    expect(result.type).toBe("event");
    if (result.type !== "event") return;
    expect(result.parts[0]).toBe("Practicaste en la pieza: +1 Impro.");
    expect(state.stats.improvisacion).toBe(3);
  });

  it("places level-up messages after rhythm and before time messages", () => {
    const state = freshState();
    state.xp = 60; // +24 xp crosses the 70 threshold
    const result = executeAction(state, createSequenceRng([0.6]), "practice");
    expect(result).toEqual({
      type: "event",
      parts: [
        "Practicaste en la pieza: +1 Flow.",
        "Impulso +8: Frio.",
        "Subiste a nivel 2: +1 Impro.",
      ],
      fx: { label: "Practicar", fromBlock: 0, toBlock: 1, blocks: 1, daysPassed: 0 },
    });
    expect(state.level).toBe(2);
    expect(state.xp).toBe(14);
    expect(state.xpNext).toBe(103);
    expect(state.energy).toBe(79); // level-up refill to cap 95, then -16
  });
});

describe("cypher", () => {
  it("applies respect, fans and xp with the exact legacy roll order", () => {
    const state = freshState();
    const result = executeAction(state, createSequenceRng([0.6, 0.5, 0.5]), "cypher");
    expect(result).toEqual({
      type: "event",
      parts: ["El cypher te dio respeto local.", "Impulso +12: Frio."],
      fx: { label: "Cypher", fromBlock: 0, toBlock: 1, blocks: 1, daysPassed: 0 },
    });
    expect(state.stats.improvisacion).toBe(3); // 0.6 > 0.58
    expect(state.respect).toBe(6); // 4 + int(0,3) with 0.5 -> 2
    expect(state.fans).toBe(2); // 1 + int(0,2) with 0.5 -> 1
    expect(state.xp).toBe(20);
    expect(state.energy).toBe(72);
  });
});

describe("work", () => {
  it("pays wage from disciplina plus roll and may raise disciplina", () => {
    const state = freshState();
    const result = executeAction(state, createSequenceRng([0.5, 0.9]), "work");
    expect(result).toEqual({
      type: "event",
      parts: ["Trabajaste 2 bloques: +$52.", "Impulso +1: Frio."],
      fx: { label: "Trabajar", fromBlock: 0, toBlock: 2, blocks: 2, daysPassed: 0 },
    });
    expect(state.cash).toBe(77); // 25 + 42 + 1*4 + 6
    expect(state.stats.disciplina).toBe(2); // 0.9 > 0.75
    expect(state.xp).toBe(10);
    expect(state.energy).toBe(66);
    expect(state.momentum).toBe(43);
  });
});

describe("social", () => {
  it("posts a normal clip", () => {
    const state = freshState();
    const result = executeAction(state, createSequenceRng([0.5, 0.5, 0.5]), "social");
    expect(result).toEqual({
      type: "event",
      parts: ["Subiste un clip: +11 fans.", "Impulso +11: Frio."],
      fx: { label: "Redes", fromBlock: 0, toBlock: 1, blocks: 1, daysPassed: 0 },
    });
    expect(state.fans).toBe(11); // carisma 1*4 + int(2,12) with 0.5 -> 7
    expect(state.fame).toBe(1);
    expect(state.health).toBe(86);
    expect(state.stats.carisma).toBe(1); // 0.5 <= 0.68
    expect(state.xp).toBe(18);
  });

  it("goes viral on a high roll", () => {
    const state = freshState();
    const result = executeAction(state, createSequenceRng([0.9, 0.0, 0.9]), "social");
    expect(result).toEqual({
      type: "event",
      parts: ["El clip se movio fuerte: +48 fans.", "Impulso +20: Activo."],
      fx: { label: "Redes", fromBlock: 0, toBlock: 1, blocks: 1, daysPassed: 0 },
    });
    expect(state.fans).toBe(48); // 4 + 2 + 42
    expect(state.fame).toBe(18); // floor(48/8) + 12
    expect(state.health).toBe(83);
    expect(state.stats.carisma).toBe(2);
    expect(state.xp).toBe(36);
  });
});

describe("write", () => {
  it("advances the song and raises metrica or punchline", () => {
    const state = freshState();
    const result = executeAction(state, createSequenceRng([0.999, 0.2]), "write");
    expect(result).toEqual({
      type: "event",
      parts: ["Escribiste: +28% de cancion.", "Impulso +9: Frio."],
      fx: { label: "Escribir", fromBlock: 0, toBlock: 1, blocks: 1, daysPassed: 0 },
    });
    expect(state.discProgress).toBe(28); // 18 + metrica 1*2 + int(0,8) -> 8
    expect(state.stats.punchline).toBe(3); // 0.2 <= 0.5
    expect(state.xp).toBe(22);
    expect(state.energy).toBe(68);
  });
});

describe("record", () => {
  it("spends cash, resets progress and releases the song", () => {
    const state = freshState();
    state.discProgress = 85;
    state.cash = 100;
    const result = executeAction(state, createSequenceRng([0.0]), "record");
    expect(result).toEqual({
      type: "event",
      parts: ["Grabaste la cancion #1: +33 fans.", "Impulso +18: Activo."],
      fx: { label: "Grabar", fromBlock: 0, toBlock: 1, blocks: 1, daysPassed: 0 },
    });
    expect(state.cash).toBe(65); // 100 - recordCost 35
    expect(state.discProgress).toBe(0);
    expect(state.songs).toBe(1);
    expect(state.fans).toBe(33); // 25 + flow 2*3 + carisma 1*2 + int(0,18) -> 0
    expect(state.fame).toBe(8);
    expect(state.respect).toBe(8);
    expect(state.xp).toBe(46);
    expect(state.energy).toBe(70);
  });
});

describe("show", () => {
  it("earns cash and fans from the stage", () => {
    const state = freshState();
    state.songs = 1;
    const result = executeAction(state, createSequenceRng([0.0, 0.0]), "show");
    expect(result).toEqual({
      type: "event",
      parts: ["Hiciste show: +$51, +23 fans.", "Impulso +16: Activo."],
      fx: { label: "Show", fromBlock: 0, toBlock: 2, blocks: 2, daysPassed: 0 },
    });
    expect(state.cash).toBe(76); // 25 + 28 + songs 1*18 + escena 1*5
    expect(state.fans).toBe(23); // 18 + escena 1*5
    expect(state.fame).toBe(7);
    expect(state.stats.escena).toBe(2);
    expect(state.xp).toBe(38);
    expect(state.energy).toBe(60);
  });
});

describe("rest", () => {
  it("recovers energy and health with a mild momentum dip at high energy", () => {
    const state = freshState();
    const result = executeAction(state, createStateRng(state), "rest");
    expect(result).toEqual({
      type: "event",
      parts: ["Descansaste y ordenaste la cabeza.", "Impulso +2: Frio."],
      fx: { label: "Descansar", fromBlock: 0, toBlock: 1, blocks: 1, daysPassed: 0 },
    });
    expect(state.energy).toBe(93); // clamp(86 + 36 + 2, 0, maxEnergy 93)
    expect(state.health).toBe(100);
    expect(state.momentum).toBe(44);
    expect(state.seed).toBe(12345); // rest consumes no RNG
  });

  it("computes the rhythm base from energy before recovery", () => {
    const state = freshState();
    state.energy = 20;
    const result = executeAction(state, createStateRng(state), "rest");
    expect(result.type).toBe("event");
    if (result.type !== "event") return;
    expect(result.parts[1]).toBe("Impulso +14: Activo."); // base 10, not -2
    expect(state.energy).toBe(58); // clamp(20 + 38, 0, 93)
  });

  it("rolls the day over from the night block with the day message last", () => {
    const state = freshState();
    state.block = 2; // rest is exempt from the night penalty
    const result = executeAction(state, createStateRng(state), "rest");
    expect(result).toEqual({
      type: "event",
      parts: ["Descansaste y ordenaste la cabeza.", "Impulso +2: Frio.", "Paso un dia."],
      fx: { label: "Descansar", fromBlock: 2, toBlock: 0, blocks: 1, daysPassed: 1 },
    });
    expect(state.day).toBe(2);
    expect(state.momentum).toBe(41); // 42 + 2 - 3
  });
});

describe("battle", () => {
  it("delegates to BattleSystem.startBattle and reports battle-started", () => {
    const state = freshState();
    const result = executeAction(state, createStateRng(state), "battle");
    expect(result).toEqual({ type: "battle-started" });
    expect(state.mode).toBe("battle");
    expect(state.battle).not.toBeNull();
    expect(state.energy).toBe(64); // 86 - (22 + stageIndex 0 * 3)
  });

  it("returns none when startBattle refuses (energy below cost but above 12)", () => {
    const state = freshState();
    state.energy = 15;
    const result = executeAction(state, createStateRng(state), "battle");
    expect(result).toEqual({ type: "none" });
    expect(state.mode).toBe("career");
    expect(state.battle).toBeNull();
  });
});
