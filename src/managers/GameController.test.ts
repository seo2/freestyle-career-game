import { describe, expect, it } from "vitest";
import { GameController } from "./GameController";
import { storeItems } from "../data/items";
import type { StorageLike } from "./SaveManager";

// The controller is exercised through a memory Storage: these tests pin the
// command surface the Crear MC and Tienda scenes call (identity selectors,
// itemized purchases) plus the deterministic render_game_to_text payload.
function createController(): { controller: GameController; map: Map<string, string> } {
  const map = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
  return { controller: new GameController(storage as Storage), map };
}

describe("GameController identity commands", () => {
  it("starts a draft on the config defaults", () => {
    const { controller } = createController();
    controller.newCareerDraft();
    expect(controller.state.nickname).toBe("Freestyler");
    expect(controller.state.look).toBe(1);
    expect(controller.state.skin).toBe(1);
    expect(controller.state.voice).toBe(1);
    expect(controller.state.difficulty).toBe("normal");
    expect(controller.state.items).toEqual([]);
  });

  it("wraps every cosmetic selector inside its option count", () => {
    const { controller } = createController();
    controller.newCareerDraft();
    // 4 looks: 1 -> 4 backwards, 4 -> 1 forwards.
    controller.cycleLook(-1);
    expect(controller.state.look).toBe(4);
    controller.cycleLook(1);
    expect(controller.state.look).toBe(1);
    // 5 skins.
    controller.cycleSkin(-1);
    expect(controller.state.skin).toBe(5);
    controller.cycleSkin(2);
    expect(controller.state.skin).toBe(2);
    // 3 voices.
    controller.cycleVoice(1);
    expect(controller.state.voice).toBe(2);
    controller.cycleVoice(1);
    expect(controller.state.voice).toBe(3);
    controller.cycleVoice(1);
    expect(controller.state.voice).toBe(1);
  });

  it("cycles difficulty through the configured order, both ways", () => {
    const { controller } = createController();
    controller.newCareerDraft();
    controller.cycleDifficulty(1);
    expect(controller.state.difficulty).toBe("dificil");
    controller.cycleDifficulty(1);
    expect(controller.state.difficulty).toBe("facil");
    controller.cycleDifficulty(-1);
    expect(controller.state.difficulty).toBe("dificil");
    controller.cycleDifficulty(-1);
    expect(controller.state.difficulty).toBe("normal");
  });

  it("edits the nickname by set, append and backspace (max 16 chars)", () => {
    const { controller } = createController();
    controller.newCareerDraft();
    controller.setNickname("El Duro");
    expect(controller.state.nickname).toBe("El Duro");
    controller.appendNicknameChar("!"); // rejected character
    expect(controller.state.nickname).toBe("El Duro");
    controller.appendNicknameChar("2");
    expect(controller.state.nickname).toBe("El Duro2");
    controller.backspaceNickname();
    expect(controller.state.nickname).toBe("El Duro");
    controller.setNickname("0123456789ABCDEFGHIJ");
    expect(controller.state.nickname).toBe("0123456789ABCDEF");
  });

  it("carries the identity draft into the new career and saves it", () => {
    const { controller } = createController();
    controller.newCareerDraft();
    controller.appendNameChar("M");
    controller.appendNameChar("C");
    controller.setNickname("El Duro");
    controller.cycleLook(1);
    controller.cycleSkin(2);
    controller.cycleVoice(-1);
    controller.cycleDifficulty(1); // dificil

    controller.startCareerFromMenu();

    expect(controller.state.playerName).toBe("MC");
    expect(controller.state.nickname).toBe("El Duro");
    expect(controller.state.look).toBe(2);
    expect(controller.state.skin).toBe(3);
    expect(controller.state.voice).toBe(3);
    expect(controller.state.difficulty).toBe("dificil");
    // Persisted, so a reload keeps the identity.
    const reloaded = createControllerFromSnapshot(controller);
    expect(reloaded.state.nickname).toBe("El Duro");
    expect(reloaded.state.difficulty).toBe("dificil");
  });
});

// Rebuilds a controller over the same storage blob, like a page reload does.
function createControllerFromSnapshot(source: GameController): GameController {
  const raw = JSON.stringify(source.state);
  const map = new Map<string, string>([["freestyle-career-save-v2", raw]]);
  const storage: StorageLike = {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
  return new GameController(storage as Storage);
}

describe("GameController store commands", () => {
  it("buys an item by id, deducting cash and recording ownership", () => {
    const { controller } = createController();
    controller.newCareerDraft();
    controller.startCareerFromMenu();
    controller.state.cash = 200;

    controller.buyItem("microfono");

    expect(controller.state.items).toEqual(["microfono"]);
    expect(controller.state.cash).toBe(50);
    expect(controller.state.studioLevel).toBe(1);
    expect(controller.state.lastEvent).toContain("Compraste Microfono por $150");
  });

  it("reports the gap instead of buying when cash is short", () => {
    const { controller } = createController();
    controller.newCareerDraft();
    controller.startCareerFromMenu();
    controller.state.cash = 125;

    controller.buyItem("microfono");

    expect(controller.state.items).toEqual([]);
    expect(controller.state.cash).toBe(125);
    expect(controller.state.lastEvent).toContain("Faltan $25 para Microfono.");
  });

  it("buys the cheapest affordable unowned item on the recommended command", () => {
    const { controller } = createController();
    controller.newCareerDraft();
    controller.startCareerFromMenu();
    controller.state.cash = 100;

    controller.buyRecommendedItem();

    expect(controller.state.items).toEqual(["cuaderno"]);
    expect(controller.state.cash).toBe(40);
  });

  it("keeps the legacy U-hotkey name pointing at the recommended purchase", () => {
    const { controller } = createController();
    controller.newCareerDraft();
    controller.startCareerFromMenu();
    controller.state.cash = 100;

    controller.buyRecommendedUpgrade();

    expect(controller.state.items).toEqual(["cuaderno"]);
  });
});

describe("GameController.renderGameToText", () => {
  it("stays JSON-serializable and reports identity, items and the recommendation", () => {
    const { controller } = createController();
    controller.newCareerDraft();
    controller.setNickname("El Duro");
    controller.cycleDifficulty(1);
    controller.startCareerFromMenu();
    controller.state.cash = 200;
    controller.buyItem("cuaderno");

    const payload = JSON.parse(controller.renderGameToText());
    expect(payload.player.nickname).toBe("El Duro");
    expect(payload.player.difficulty).toBe("dificil");
    expect(payload.player.look).toBe(1);
    expect(payload.player.skin).toBe(1);
    expect(payload.player.voice).toBe(1);
    expect(payload.player.items).toEqual(["cuaderno"]);
    // The old nextUpgrade block is gone; the store now recommends an item.
    expect(payload.nextUpgrade).toBeUndefined();
    expect(payload.recommendedItem).toEqual({
      id: "gorra",
      label: "Gorra roja",
      category: "ropa",
      price: 70,
      affordable: true,
    });
  });

  it("reports no recommendation once the catalogue is owned", () => {
    const { controller } = createController();
    controller.newCareerDraft();
    controller.startCareerFromMenu();
    controller.state.items = storeItems.map((item) => item.id);
    expect(JSON.parse(controller.renderGameToText()).recommendedItem).toBeNull();
  });
});
