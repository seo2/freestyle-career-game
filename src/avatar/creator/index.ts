// Creador de Avatar (implements the `Creador de Avatar.dc.html` design).
//
// Three tabs — Creador, Tienda, Inventario — over the avatar system in ../. This
// file is a CLIENT of that system (spec §79): it never decides what an item does,
// only how it is presented. Every behaviour comes from item metadata through
// `statusOf`/`equip`, which is why there is no `if (item.id === ...)` anywhere here.

import { assetRegistry, starterConfig } from "../registry";
import { renderAvatar } from "../renderer";
import { colorOf, paletteFor } from "../palettes";
import { equip, statusOf, clearSlot, type ItemStatus, type WardrobeState } from "../wardrobe";
import { randomAvatar } from "../generate";
import { createStateRng } from "../../services/RandomService";
import { panels, type Panel } from "./panels";
import { T, drop } from "./theme";
import { button, clear, el, type Style } from "./dom";
import type { AvatarConfig, Category, ItemMeta, Unlock } from "../types";

type Tab = "crear" | "tienda" | "inventario";

interface State {
  tab: Tab;
  panel: number;
  config: AvatarConfig;
  wardrobe: WardrobeState;
  // The career system's answer, faked here to one number. In the game this comes
  // from GameState and the avatar system never learns what it is.
  careerLevel: number;
  showLayers: boolean;
  toast: string;
  scene: number;
}

const SCENES = [
  { name: "La pieza", bg: "#E3D8C3" },
  { name: "El block", bg: "#CFD8CF" },
  { name: "Estudio", bg: "#D6CEEA" },
  { name: "Azotea", bg: "#F0D9B8" },
  { name: "Escenario", bg: "#2A2530" },
] as const;

const money = (n: number): string => n.toLocaleString("es-CL");

export function mountCreator(root: HTMLElement): void {
  const state: State = {
    tab: "crear",
    panel: 0,
    config: starterConfig(),
    wardrobe: { owned: [], wallet: { cash: 46_000 } },
    careerLevel: 7,
    showLayers: false,
    toast: "",
    scene: 0,
  };

  // The career system's gate, as one function. §70: the wardrobe asks, it never
  // computes. Swapping this for the real GameState is a one-line change.
  const satisfied = (unlock: Unlock): boolean => {
    if (unlock.type === "career_level" || unlock.type === "fame_level") {
      return state.careerLevel >= (unlock.value ?? 0);
    }
    return false;
  };

  let toastTimer = 0;
  const say = (message: string): void => {
    state.toast = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      state.toast = "";
      render();
    }, 2600);
    render();
  };

  const choose = (item: ItemMeta): void => {
    const result = equip(item, state.config, state.wardrobe, satisfied);
    state.config = result.config;
    state.wardrobe = result.state;
    if (result.message) say(result.message);
    else render();
  };

  // Randomization lives in the system (../generate.ts), seeded so the same click
  // is reproducible and so the NPC generator can reuse it. The project forbids
  // Math.random outright — every run has to stay replayable.
  const rngHost = { seed: 20260818 };
  const rng = createStateRng(rngHost);
  const randomize = (): void => {
    state.config = randomAvatar(rng, state.config, {
      wardrobe: state.wardrobe,
      satisfied,
    });
    say("Avatar aleatorio");
  };

  const render = (): void => {
    clear(root);
    root.append(header(state, (tab) => { state.tab = tab; render(); }));
    if (state.tab === "crear") root.append(creador(state, { choose, randomize, say, render, satisfied }));
    if (state.tab === "tienda") root.append(tienda(state, { choose, satisfied }));
    if (state.tab === "inventario") root.append(inventario(state, { choose, satisfied }));
  };

  Object.assign(root.style, {
    minHeight: "100vh",
    background: T.paper,
    color: T.ink,
    display: "flex",
    flexDirection: "column",
    fontFamily: T.sans,
  } satisfies Style);
  render();
}

// --- header -----------------------------------------------------------------
function header(state: State, go: (tab: Tab) => void): HTMLElement {
  const tabStyle = (on: boolean): Style => ({
    border: `${T.border}px solid ${on ? T.lime : "transparent"}`,
    background: on ? T.lime : "transparent",
    color: on ? T.ink : "#B8B0A4",
    fontFamily: T.sans,
    fontSize: "13px",
    fontWeight: "700",
    letterSpacing: "0.2px",
    padding: "10px 20px",
  });

  const badge = el(
    "div",
    {
      width: "44px",
      height: "44px",
      border: `${T.border}px solid ${T.lime}`,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: T.mono,
      fontWeight: "700",
      fontSize: "15px",
      color: T.lime,
    },
    "MC",
  );

  const fame = el(
    "div",
    { display: "flex", flexDirection: "column", gap: "5px", width: "168px" },
    el(
      "div",
      { display: "flex", justifyContent: "space-between", fontFamily: T.mono, fontSize: "10px", letterSpacing: "1.2px", color: T.nightText },
      el("span", {}, `FAMA NV ${state.careerLevel}`),
      el("span", {}, "2.4K / 5K"),
    ),
    el(
      "div",
      { height: "8px", background: T.night, border: `1px solid ${T.nightLine}` },
      el("div", { width: "48%", height: "100%", background: T.cyan }),
    ),
  );

  const purse = el(
    "div",
    { display: "flex", alignItems: "center", gap: "8px", border: `${T.border}px solid ${T.lime}`, padding: "7px 14px" },
    el("span", { fontFamily: T.mono, fontSize: "11px", color: T.lime, letterSpacing: "1px" }, "CLP"),
    el("span", { fontFamily: T.mono, fontSize: "17px", fontWeight: "700", color: T.paper }, money(state.wardrobe.wallet.cash)),
  );

  return el(
    "header",
    {
      display: "flex",
      alignItems: "stretch",
      justifyContent: "space-between",
      gap: "24px",
      borderBottom: `${T.border}px solid ${T.ink}`,
      background: T.ink,
      color: T.paper,
      padding: "0 24px",
      height: "76px",
      flexShrink: "0",
    },
    el(
      "div",
      { display: "flex", alignItems: "center", gap: "18px" },
      badge,
      el(
        "div",
        { display: "flex", flexDirection: "column", gap: "2px" },
        el("div", { fontSize: "19px", fontWeight: "900", letterSpacing: "-0.4px", lineHeight: "1" }, "MC Barrio"),
        el(
          "div",
          { fontFamily: T.mono, fontSize: "11px", letterSpacing: "1.4px", color: T.nightText, textTransform: "uppercase" },
          "Sin nombre artistico",
        ),
      ),
    ),
    el(
      "nav",
      { display: "flex", alignItems: "center", gap: "6px" },
      button(tabStyle(state.tab === "crear"), "Creador", () => go("crear")),
      button(tabStyle(state.tab === "tienda"), "Tienda", () => go("tienda")),
      button(tabStyle(state.tab === "inventario"), "Inventario", () => go("inventario")),
    ),
    el("div", { display: "flex", alignItems: "center", gap: "26px" }, fame, purse),
  );
}

interface Actions {
  choose: (item: ItemMeta) => void;
  satisfied: (unlock: Unlock) => boolean;
  randomize?: () => void;
  say?: (m: string) => void;
  render?: () => void;
}

// --- the creator: rail, stage, options --------------------------------------
function creador(state: State, a: Actions): HTMLElement {
  const panel = panels[state.panel];
  return el(
    "div",
    { display: "grid", gridTemplateColumns: "236px minmax(420px, 1fr) 392px", flex: "1", minHeight: "0" },
    rail(state, a),
    stage(state, a),
    options(state, panel, a),
  );
}

function rail(state: State, a: Actions): HTMLElement {
  const list = el("div", {
    flex: "1",
    overflowY: "auto",
    padding: "0 12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  });

  panels.forEach((panel, index) => {
    const on = index === state.panel;
    // The dot says "this panel has something on it", which is how the player finds
    // an empty slot without opening all twelve.
    const filled = panel.categories.some((category) => currentIdOf(state.config, category) !== null);
    list.append(
      button(
        {
          display: "flex",
          alignItems: "center",
          gap: "10px",
          width: "100%",
          border: `${T.border}px solid ${on ? T.ink : "transparent"}`,
          background: on ? T.paper : "transparent",
          color: T.ink,
          fontFamily: T.sans,
          fontSize: "13px",
          fontWeight: on ? "900" : "400",
          padding: "9px 10px",
          textAlign: "left",
        },
        el(
          "span",
          { display: "flex", alignItems: "center", gap: "10px", width: "100%" },
          el("span", { fontFamily: T.mono, fontSize: "10px", color: on ? T.ink : T.inkFaint }, panel.n),
          el("span", { flex: "1", textAlign: "left" }, panel.label),
          el("span", {
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: filled ? T.cyan : T.rule,
            border: `2px solid ${T.ink}`,
          }),
        ),
        () => {
          state.panel = index;
          a.render?.();
        },
      ),
    );
  });

  return el(
    "aside",
    { borderRight: `${T.border}px solid ${T.ink}`, background: T.paperDim, display: "flex", flexDirection: "column", minHeight: "0" },
    el(
      "div",
      { padding: "18px 20px 12px", fontFamily: T.mono, fontSize: "10px", letterSpacing: "1.6px", color: T.inkSoft },
      "CAPAS DEL AVATAR",
    ),
    list,
    el(
      "div",
      { borderTop: `${T.border}px solid ${T.ink}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" },
      button(
        {
          width: "100%",
          border: `${T.border}px solid ${T.ink}`,
          background: T.paper,
          color: T.ink,
          fontFamily: T.sans,
          fontSize: "13px",
          fontWeight: "700",
          padding: "11px",
        },
        "Aleatorio",
        () => a.randomize?.(),
        { background: T.cyan },
      ),
      button(
        { width: "100%", border: "none", background: "transparent", color: T.inkSoft, fontFamily: T.mono, fontSize: "11px", letterSpacing: "1.2px", padding: "4px" },
        "REINICIAR",
        () => {
          state.config = starterConfig();
          a.say?.("Vuelta al punto de partida");
        },
        { color: T.ink },
      ),
    ),
  );
}

function stage(state: State, a: Actions): HTMLElement {
  const scene = SCENES[state.scene];
  const out = renderAvatar(state.config, assetRegistry);

  // Sized to FIT: at 375x600 the shoes fell off the bottom of the stage, and a
  // full-body creator that crops the feet is not doing its one job. The height is
  // capped against the viewport so the figure stays whole on a laptop screen too.
  const H = 520;
  const W = Math.round((H * 500) / 800);
  const figure = el("div", { position: "relative", width: `${W}px`, height: `${H}px`, zIndex: "2", flexShrink: "0" });
  figure.innerHTML = out.svg.replace("<svg ", `<svg width="${W}" height="${H}" `);

  // The design's "Ver capas": the 27-layer order made visible. It is a debugging
  // affordance that belongs in the creator, because a stack you cannot see is a
  // stack you cannot reason about.
  if (state.showLayers) {
    const overlay = el("div", { position: "absolute", inset: "0", pointerEvents: "none" });
    out.used.forEach((id, i) => {
      const meta = assetRegistry.meta(id);
      overlay.append(
        el(
          "div",
          {
            position: "absolute",
            left: "8px",
            top: `${14 + i * 20}px`,
            background: T.cyan,
            border: `2px solid ${T.ink}`,
            fontFamily: T.mono,
            fontSize: "9px",
            letterSpacing: "0.6px",
            padding: "1px 6px",
          },
          `${String(i + 1).padStart(2, "0")} ${meta?.category ?? "?"} · ${id}`,
        ),
      );
    });
    figure.append(overlay);
  }

  const toast = el(
    "div",
    {
      opacity: state.toast ? "1" : "0",
      transition: "opacity .2s",
      border: `${T.border}px solid ${T.ink}`,
      background: T.ink,
      color: T.paper,
      fontFamily: T.mono,
      fontSize: "11.5px",
      letterSpacing: "0.6px",
      padding: "9px 14px",
    },
    state.toast || " ",
  );

  // Conflicts are shown, never swallowed: the compatibility engine dropped
  // something and the player is entitled to know which and why.
  const conflicts = out.conflicts.length
    ? el(
        "div",
        { position: "absolute", bottom: "62px", left: "0", right: "0", display: "flex", justifyContent: "center", zIndex: "3" },
        el(
          "div",
          { border: `${T.border}px solid ${T.crimson}`, background: T.paper, color: T.crimson, fontFamily: T.mono, fontSize: "11px", padding: "7px 12px" },
          out.conflicts
            .map((c) => `${assetRegistry.meta(c.dropped)?.name ?? c.dropped} no entra con ${assetRegistry.meta(c.because)?.name ?? c.because}`)
            .join(" · "),
        ),
      )
    : null;

  return el(
    "main",
    { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", background: T.paper, minHeight: "0" },
    el("div", {
      position: "absolute",
      inset: "0",
      background: scene.bg,
      backgroundImage: "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.55), transparent 62%)",
    }),
    el(
      "div",
      { position: "absolute", top: "20px", left: "24px", display: "flex", flexDirection: "column", gap: "3px", zIndex: "3" },
      el("div", { fontFamily: T.mono, fontSize: "10px", letterSpacing: "1.6px", color: T.inkSoft }, "VISTA PREVIA"),
      button(
        { border: "none", background: "transparent", padding: "0", fontSize: "13px", fontWeight: "700", color: T.ink, textAlign: "left" },
        scene.name,
        () => {
          state.scene = (state.scene + 1) % SCENES.length;
          a.render?.();
        },
      ),
    ),
    button(
      {
        position: "absolute",
        top: "18px",
        right: "24px",
        zIndex: "3",
        border: `${T.border}px solid ${T.ink}`,
        background: state.showLayers ? T.cyan : T.paper,
        color: T.ink,
        fontFamily: T.mono,
        fontSize: "10.5px",
        letterSpacing: "1.2px",
        padding: "8px 12px",
      },
      "Ver capas",
      () => {
        state.showLayers = !state.showLayers;
        a.render?.();
      },
    ),
    figure,
    conflicts,
    el(
      "div",
      { position: "absolute", bottom: "22px", left: "0", right: "0", display: "flex", justifyContent: "center", zIndex: "3" },
      toast,
    ),
  );
}

function options(state: State, panel: Panel, a: Actions): HTMLElement {
  const body = el("div", {
    flex: "1",
    overflowY: "auto",
    padding: "20px 22px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  });

  if (panel.palette) {
    const swatches = el("div", { display: "flex", flexWrap: "wrap", gap: "8px" });
    const token = panel.palette.token;
    paletteFor[token].forEach((hex, i) => {
      const on = (state.config.colors[token] ?? 0) === i;
      swatches.append(
        button(
          {
            width: "34px",
            height: "34px",
            background: hex,
            border: on ? `4px solid ${T.ink}` : "2px solid rgba(18,16,15,0.25)",
            padding: "0",
            borderRadius: token === "skin_primary" ? "50%" : "4px",
          },
          "",
          () => {
            // Skin lives in `appearance`, not in the colour bag: the system treats a
            // tone as part of who the character is (spec §39). The swatch has to
            // write to the right place or the choice silently does nothing.
            state.config =
              token === "skin_primary"
                ? { ...state.config, appearance: { ...state.config.appearance, skin: `skin_0${i + 1}` } }
                : { ...state.config, colors: { ...state.config.colors, [token]: i } };
            a.render?.();
          },
        ),
      );
    });
    const currentSkin = Number(state.config.appearance.skin.slice(-1)) - 1;
    if (token === "skin_primary") {
      [...swatches.children].forEach((child, i) => {
        (child as HTMLElement).style.border = i === currentSkin ? `4px solid ${T.ink}` : "2px solid rgba(18,16,15,0.25)";
      });
    }
    body.append(
      el(
        "div",
        { display: "flex", flexDirection: "column", gap: "10px" },
        el("div", { fontFamily: T.mono, fontSize: "10px", letterSpacing: "1.4px", color: T.inkSoft }, panel.palette.label),
        swatches,
      ),
    );
  }

  for (const category of panel.categories) {
    const items = assetRegistry.itemsOf(category);
    if (items.length === 0) continue;
    const grid = el("div", { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" });
    if (panel.clearable?.includes(category)) {
      grid.append(emptyCard(state, category, a));
    }
    for (const item of items) {
      grid.append(itemCard(item, statusOf(item, state.config, state.wardrobe, a.satisfied), () => a.choose(item)));
    }
    body.append(
      el(
        "div",
        { display: "flex", flexDirection: "column", gap: "10px" },
        el(
          "div",
          { fontFamily: T.mono, fontSize: "10px", letterSpacing: "1.4px", color: T.inkSoft },
          `${category.replace("_", " ").toUpperCase()} · ${items.length}`,
        ),
        grid,
      ),
    );
  }

  const equipped = Object.values(state.config.equipment).filter((v) => v !== null).length;

  return el(
    "aside",
    { borderLeft: `${T.border}px solid ${T.ink}`, background: T.paperDim, display: "flex", flexDirection: "column", minHeight: "0" },
    el(
      "div",
      { borderBottom: `${T.border}px solid ${T.ink}`, padding: "18px 22px 16px", background: T.paper },
      el(
        "div",
        { fontFamily: T.mono, fontSize: "10px", letterSpacing: "1.6px", color: T.inkSoft, marginBottom: "6px" },
        `${panel.n} — CAPA ACTIVA`,
      ),
      el("div", { fontSize: "26px", fontWeight: "900", letterSpacing: "-0.7px", lineHeight: "1" }, panel.label),
      el("div", { fontSize: "12px", color: T.inkSoft, marginTop: "8px", lineHeight: "1.45", maxWidth: "300px" }, panel.hint),
    ),
    body,
    el(
      "div",
      { borderTop: `${T.border}px solid ${T.ink}`, padding: "16px 22px", background: T.paper, display: "flex", flexDirection: "column", gap: "10px" },
      el(
        "div",
        { display: "flex", justifyContent: "space-between", fontFamily: T.mono, fontSize: "11px", color: T.inkSoft },
        el("span", {}, "PIEZAS EQUIPADAS"),
        el("span", { color: T.ink, fontWeight: "700" }, `${equipped} / 12`),
      ),
      button(
        {
          width: "100%",
          border: `${T.border}px solid ${T.ink}`,
          background: T.lime,
          color: T.ink,
          fontFamily: T.sans,
          fontSize: "15px",
          fontWeight: "900",
          letterSpacing: "0.2px",
          padding: "14px",
          boxShadow: drop(),
        },
        "Salir al escenario",
        () => a.say?.("Avatar guardado — listo para el primer show"),
        { background: T.cyan },
      ),
    ),
  );
}

// --- cards ------------------------------------------------------------------
function statusMeta(status: ItemStatus): { text: string; color: string } {
  if (status.kind === "equipped") return { text: "EQUIPADO", color: T.ink };
  if (status.kind === "ready") return { text: "LISTO", color: T.nightText };
  if (status.kind === "buy") return { text: `$${money(status.price)}`, color: T.crimson };
  if (status.kind === "short") return { text: `$${money(status.price)}`, color: T.crimson };
  return { text: status.unlock.value ? `NIVEL ${status.unlock.value}` : "SE GANA", color: T.inkSoft };
}

function itemCard(item: ItemMeta, status: ItemStatus, onClick: () => void, compact = false): HTMLElement {
  const on = status.kind === "equipped";
  const locked = status.kind === "locked";
  const info = statusMeta(status);
  const tint = swatchFor(item);

  return button(
    {
      color: T.ink,
      fontFamily: T.sans,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "7px",
      border: `${T.border}px solid ${on ? T.ink : "rgba(18,16,15,0.18)"}`,
      background: on ? T.lime : locked ? "#E4DCCC" : T.paper,
      padding: compact ? "10px" : "11px 12px 12px",
      cursor: locked ? "not-allowed" : "pointer",
      opacity: locked ? "0.62" : "1",
      textAlign: "left",
      boxShadow: on ? drop(4) : "none",
    },
    el(
      "span",
      { display: "flex", flexDirection: "column", gap: "7px", width: "100%" },
      el(
        "span",
        {
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          width: "100%",
          height: compact ? "44px" : "54px",
          background: tint,
          border: `2px solid ${T.ink}`,
        },
        el("span", { width: "58%", height: "62%", background: "rgba(18,16,15,0.18)", borderRadius: "6px 6px 0 0" }),
      ),
      el("span", { fontSize: compact ? "11px" : "12.5px", fontWeight: "700", lineHeight: "1.2", letterSpacing: "-0.1px" }, item.name),
      el("span", { fontFamily: T.mono, fontSize: "9.5px", letterSpacing: "1px", color: info.color }, info.text),
    ),
    onClick,
  );
}

// A card for "nothing in this slot". The system allows an empty equipment slot, so
// the creator has to offer it — otherwise a hat is a decision you cannot undo.
function emptyCard(state: State, category: Category, a: Actions): HTMLElement {
  const on = currentIdOf(state.config, category) === null;
  return button(
    {
      color: T.ink,
      fontFamily: T.sans,
      display: "flex",
      flexDirection: "column",
      gap: "7px",
      alignItems: "flex-start",
      border: `${T.border}px solid ${on ? T.ink : "rgba(18,16,15,0.18)"}`,
      background: on ? T.lime : T.paper,
      padding: "11px 12px 12px",
      textAlign: "left",
      boxShadow: on ? drop(4) : "none",
    },
    el(
      "span",
      { display: "flex", flexDirection: "column", gap: "7px", width: "100%" },
      el(
        "span",
        { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "54px", background: T.rule, border: `2px dashed ${T.ink}` },
        el("span", { fontFamily: T.mono, fontSize: "18px", color: T.inkSoft }, "—"),
      ),
      el("span", { fontSize: "12.5px", fontWeight: "700" }, "Nada"),
      el("span", { fontFamily: T.mono, fontSize: "9.5px", letterSpacing: "1px", color: T.nightText }, on ? "EQUIPADO" : "LISTO"),
    ),
    () => {
      const appearance = ["hair", "facial_hair"];
      state.config = appearance.includes(category)
        ? { ...state.config, appearance: { ...state.config.appearance, [category]: null } }
        : clearSlot(state.config, category as keyof AvatarConfig["equipment"]);
      a.render?.();
    },
  );
}

// The thumbnail's tint comes from the item's own colour token, so a shoe card
// previews the colour it will actually be.
function swatchFor(item: ItemMeta): string {
  const token = item.colors?.[0];
  if (!token) return T.rule;
  return colorOf(token, 0);
}

function currentIdOf(config: AvatarConfig, category: Category): string | null {
  const appearance = config.appearance as unknown as Record<string, string | null>;
  if (category in appearance) return appearance[category];
  const equipment = config.equipment as unknown as Record<string, string | null>;
  return equipment[category] ?? null;
}

// --- tienda -----------------------------------------------------------------
// Everything with a price or an unlock, in one grid. The copy states the rule the
// design puts on this screen: level-gated pieces are NOT for sale.
function tienda(state: State, a: Actions): HTMLElement {
  // Equipment only. A body type or a face shape can be a career REWARD (the design
  // gates the athletic build at level 6) but it is never a drop, and listing it
  // under "TIENDA / DROPS" reads as if the game sold you a physique. Those show up
  // in the creator with their own NIVEL badge instead.
  const APPEARANCE: Category[] = ["body", "skin", "face", "eyes", "eyebrows", "nose", "mouth"];
  const sellable = assetRegistry
    .all()
    .map((asset) => asset.meta)
    .filter((item) => !APPEARANCE.includes(item.category))
    .filter((item) => item.price !== undefined || item.unlock !== undefined);

  const grid = el("div", { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" });
  for (const item of sellable) {
    const status = statusOf(item, state.config, state.wardrobe, a.satisfied);
    const locked = status.kind === "locked";
    const info = statusMeta(status);
    grid.append(
      el(
        "div",
        { display: "flex", flexDirection: "column", border: `${T.border}px solid ${T.ink}`, background: T.paper, boxShadow: locked ? "none" : drop(6), opacity: locked ? "0.68" : "1" },
        el(
          "div",
          { position: "relative", height: "132px", background: locked ? "#D9D0BE" : swatchFor(item), borderBottom: `${T.border}px solid ${T.ink}`, display: "flex", alignItems: "flex-end", justifyContent: "center" },
          el("div", { width: "46%", height: "64%", background: "rgba(18,16,15,0.2)", borderRadius: "8px 8px 0 0" }),
          el(
            "span",
            { position: "absolute", top: "10px", right: "10px", background: locked ? T.ink : T.lime, color: locked ? T.lime : T.ink, border: `2px solid ${T.ink}`, fontFamily: T.mono, fontSize: "10px", fontWeight: "700", letterSpacing: "1px", padding: "3px 7px" },
            info.text,
          ),
        ),
        el(
          "div",
          { padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: "4px", flex: "1" },
          el("div", { fontFamily: T.mono, fontSize: "10px", letterSpacing: "1.3px", color: T.inkSoft }, item.category.replace("_", " ").toUpperCase()),
          el("div", { fontSize: "16px", fontWeight: "900", letterSpacing: "-0.3px" }, item.name),
          el(
            "div",
            { fontSize: "12px", color: T.inkSoft, lineHeight: "1.4", marginBottom: "10px" },
            locked
              ? "Recompensa de carrera. No esta en venta."
              : status.kind === "buy" || status.kind === "short"
                ? `${item.rarity} · disponible en la tienda.`
                : "Ya esta en tu closet.",
          ),
          button(
            {
              marginTop: "auto",
              width: "100%",
              border: `${T.border}px solid ${T.ink}`,
              background: locked ? "transparent" : status.kind === "buy" || status.kind === "short" ? T.lime : T.paper,
              color: T.ink,
              fontFamily: T.sans,
              fontSize: "12.5px",
              fontWeight: "700",
              padding: "9px",
              cursor: locked ? "not-allowed" : "pointer",
            },
            locked ? "BLOQUEADO" : status.kind === "buy" || status.kind === "short" ? "Comprar" : "Equipar",
            () => a.choose(item),
          ),
        ),
      ),
    );
  }

  return page(
    "TIENDA / DROPS",
    "Lo que se compra y lo que se gana",
    "Las piezas con nivel no se venden. Se desbloquean subiendo fama: shows, batallas y colaboraciones.",
    grid,
  );
}

// --- inventario -------------------------------------------------------------
function inventario(state: State, a: Actions): HTMLElement {
  const groups = el("div", { display: "flex", flexDirection: "column", gap: "30px" });
  let ownedCount = 0;
  let lockedCount = 0;

  for (const category of assetRegistry.categories()) {
    const items = assetRegistry.itemsOf(category);
    const available = items.filter((item) => {
      const s = statusOf(item, state.config, state.wardrobe, a.satisfied);
      if (s.kind === "locked") lockedCount += 1;
      return s.kind !== "buy" && s.kind !== "short" && s.kind !== "locked";
    });
    ownedCount += available.length;
    if (available.length === 0) continue;

    const grid = el("div", { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px" });
    for (const item of available) {
      grid.append(itemCard(item, statusOf(item, state.config, state.wardrobe, a.satisfied), () => a.choose(item), true));
    }
    groups.append(
      el(
        "div",
        { display: "flex", flexDirection: "column", gap: "12px" },
        el(
          "div",
          { display: "flex", alignItems: "center", gap: "12px" },
          el("span", { fontFamily: T.mono, fontSize: "11px", letterSpacing: "1.4px", color: T.ink, fontWeight: "700" }, category.replace("_", " ").toUpperCase()),
          el("span", { flex: "1", height: "3px", background: T.rule }),
          el("span", { fontFamily: T.mono, fontSize: "11px", color: T.inkSoft }, `${available.length} / ${items.length}`),
        ),
        grid,
      ),
    );
  }

  const stats = el(
    "div",
    { display: "flex", gap: "34px" },
    stat(String(ownedCount), "PIEZAS"),
    stat(String(lockedCount), "BLOQUEADAS"),
  );
  return page("CLOSET", "Inventario", stats, groups);
}

function stat(value: string, label: string): HTMLElement {
  return el(
    "div",
    { display: "flex", flexDirection: "column", gap: "4px" },
    el("span", { fontFamily: T.mono, fontSize: "28px", fontWeight: "700" }, value),
    el("span", { fontFamily: T.mono, fontSize: "10px", letterSpacing: "1.4px", color: T.inkSoft }, label),
  );
}

function page(eyebrow: string, title: string, aside: string | HTMLElement, content: HTMLElement): HTMLElement {
  return el(
    "div",
    { flex: "1", overflowY: "auto", padding: "40px 56px 64px", minHeight: "0" },
    el(
      "div",
      { maxWidth: "1180px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" },
      el(
        "div",
        { display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: `${T.border}px solid ${T.ink}`, paddingBottom: "20px", gap: "40px" },
        el(
          "div",
          {},
          el("div", { fontFamily: T.mono, fontSize: "11px", letterSpacing: "1.8px", color: T.inkSoft, marginBottom: "8px" }, eyebrow),
          el("h1", { margin: "0", fontSize: "44px", fontWeight: "900", letterSpacing: "-1.6px", lineHeight: "0.95" }, title),
        ),
        typeof aside === "string"
          ? el("div", { fontSize: "13px", color: T.inkSoft, maxWidth: "300px", lineHeight: "1.5", textAlign: "right" }, aside)
          : aside,
      ),
      content,
    ),
  );
}
