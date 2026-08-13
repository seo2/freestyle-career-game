// Career view: QUIEN VAS SIENDO — identity axes, the people around you, and the
// rivals who remember you (Fase 7).
//
// No mockup carries this screen: identity, bonds and rivalries are systems that
// arrived after the mockups were drawn. It exists as its OWN screen for two
// reasons, both learned the hard way:
//
//  * It first lived as a panel bolted onto the lower half of the Estadisticas
//    left column, on a band I had assumed was free. It was not: the panel drew
//    over the MC's name, career level and XP bar, so the one screen whose job is
//    to show them was hiding them. A capture showed it; reading the coordinates
//    had not.
//  * The owner's rule for the cypher (2026-08-13) was "si merece pantalla, que
//    tenga la propia". Four axis sliders, two bonds, a rivalry ledger and the
//    decision log do not fit in a borrowed band, and cramming them would have
//    meant shrinking all of them.
//
// Read-only: the only commands it sends are view changes.

import { DilemmaConfig } from "../../data/config/DilemmaConfig";
import { axisLean, identitySummary, recentDecisions } from "../../systems/DilemmaSystem";
import { destinyFor } from "../../systems/EpilogueSystem";
import {
  affinityOf,
  bondTemperature,
  relationshipSummary,
  rivalryLine,
} from "../../systems/RelationshipSystem";
import { bondDefs } from "../../data/bonds";
import { RelationshipConfig } from "../../data/config/RelationshipConfig";
import type { IdentityAxis } from "../../core/types";
import { palette } from "../../ui/palette";
import { addDisplayText, addHitZone, addMeter, addPanel, addText } from "../../ui/kit";
import { line, rect } from "./viewKit";
import type { ViewCtx } from "./viewKit";

const TITLE = { x: 28, y: 92, size: 26 } as const;
const AXES_PANEL = { x: 26, y: 124, w: 302, h: 354 } as const;
const BONDS_PANEL = { x: 336, y: 124, w: 300, h: 168 } as const;
const LOG_PANEL = { x: 336, y: 300, w: 300, h: 178 } as const;
const RIVALS_PANEL = { x: 644, y: 124, w: 290, h: 354 } as const;
const FOOTER = { x: 26, y: 486, w: 908, h: 40 } as const;

const CARD = {
  border: "#272c61",
  fill: "#070e35",
  track: "#050a20",
  tick: "#242a52",
  dim: "#6a6f85",
} as const;

const axisOrder: IdentityAxis[] = [
  "undergroundComercial",
  "batalleroMusico",
  "soloCrew",
  "autenticoPolemico",
];

export function renderIdentity(ctx: ViewCtx): void {
  addDisplayText(ctx.scene, ctx.layer, TITLE.x, TITLE.y, "14. QUIEN VAS SIENDO", TITLE.size, palette.ink);
  statsChip(ctx, 706, 90, 228, 28);

  addPanel(ctx.scene, ctx.layer, AXES_PANEL.x, AXES_PANEL.y, AXES_PANEL.w, AXES_PANEL.h, "#0a1030");
  axesColumn(ctx);

  addPanel(ctx.scene, ctx.layer, BONDS_PANEL.x, BONDS_PANEL.y, BONDS_PANEL.w, BONDS_PANEL.h, "#0a1030");
  bondsColumn(ctx);

  addPanel(ctx.scene, ctx.layer, LOG_PANEL.x, LOG_PANEL.y, LOG_PANEL.w, LOG_PANEL.h, "#0a1030");
  decisionsColumn(ctx);

  addPanel(ctx.scene, ctx.layer, RIVALS_PANEL.x, RIVALS_PANEL.y, RIVALS_PANEL.w, RIVALS_PANEL.h, "#0a1030");
  rivalsColumn(ctx);

  footerBar(ctx);
}

function columnHeader(ctx: ViewCtx, x: number, y: number, w: number, label: string): void {
  rect(ctx, x, y, w, 26, "#050a20");
  rect(ctx, x, y, w, 1, palette.line);
  rect(ctx, x, y + 25, w, 1, CARD.border);
  const text = addText(ctx.scene, ctx.layer, 0, 0, label, 11, palette.muted);
  text.setOrigin(0.5, 0.5).setPosition(x + w / 2, y + 13);
}

// --- Left column: the four axes, full size ----------------------------------

function axesColumn(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  const x = AXES_PANEL.x;
  columnHeader(ctx, x, AXES_PANEL.y, AXES_PANEL.w, "EJES DE IDENTIDAD");

  const trackW = AXES_PANEL.w - 32;
  axisOrder.forEach((axis, index) => {
    const y = AXES_PANEL.y + 44 + index * 56;
    const labels = DilemmaConfig.axes.labels[axis];
    const value = state.axes[axis];
    const lean = axisLean(state.axes, axis);
    const undecided = lean.label === "Sin definir";

    line(ctx, x + 16, y, labels.low.toUpperCase(), 9, palette.muted, trackW / 2 - 4);
    const high = addText(ctx.scene, ctx.layer, 0, y - 9, labels.high.toUpperCase(), 9, palette.muted);
    high.setX(Math.round(x + AXES_PANEL.w - 16 - high.width));

    const trackY = y + 8;
    rect(ctx, x + 16, trackY, trackW, 10, CARD.track);
    rect(ctx, x + 16, trackY, trackW, 1, CARD.border);
    // Centre tick: dead centre is "undecided", and the screen should say so
    // rather than let a needle near the middle read as a position.
    rect(ctx, x + 16 + trackW / 2, trackY, 1, 10, CARD.tick);
    const span = (trackW - 8) / 2;
    const needleX = Math.round(x + 20 + span + (value / DilemmaConfig.axes.max) * span);
    rect(ctx, needleX - 3, trackY - 3, 7, 16, undecided ? CARD.border : palette.yellow);

    line(
      ctx,
      x + 16,
      trackY + 30,
      undecided ? "Sin definir" : `${lean.label} (${value > 0 ? "+" : ""}${value})`,
      10,
      undecided ? CARD.dim : palette.teal,
      trackW,
    );
  });

  // The destiny the axes point at. It is a READ, never a choice: the same line
  // the arc epilogue will use, shown early so the player can see it forming.
  const destiny = destinyFor(state);
  const y = AXES_PANEL.y + AXES_PANEL.h - 74;
  rect(ctx, x + 12, y, AXES_PANEL.w - 24, 58, CARD.fill);
  rect(ctx, x + 12, y, AXES_PANEL.w - 24, 1, CARD.border);
  line(ctx, x + 20, y + 16, "VAS CAMINO A", 9, palette.muted, AXES_PANEL.w - 40);
  line(
    ctx,
    x + 20,
    y + 34,
    destiny?.label ?? "Nada definido todavia",
    14,
    destiny ? palette.yellow : CARD.dim,
    AXES_PANEL.w - 40,
  );
  const leaning = identitySummary(state);
  line(ctx, x + 20, y + 50, leaning.length > 0 ? leaning.join(" · ") : "Ninguna decision grande aun.", 9, palette.muted, AXES_PANEL.w - 40);
}

// --- Middle top: the people who show up -------------------------------------

function bondsColumn(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  const x = BONDS_PANEL.x;
  columnHeader(ctx, x, BONDS_PANEL.y, BONDS_PANEL.w, "QUIEN TE ACOMPAÑA");

  bondDefs.forEach((def, index) => {
    const y = BONDS_PANEL.y + 36 + index * 52;
    const affinity = affinityOf(state, def.id);
    const temp = bondTemperature(state, def.id);
    const color = temp === "warm" ? palette.teal : temp === "cold" ? palette.red : palette.blue;
    line(ctx, x + 14, y + 10, def.label.toUpperCase(), 12, palette.ink, 150);
    const value = addText(ctx.scene, ctx.layer, 0, y, `${Math.round(affinity)}`, 12, color);
    value.setX(Math.round(x + BONDS_PANEL.w - 16 - value.width));
    addMeter(ctx.scene, ctx.layer, x + 14, y + 16, BONDS_PANEL.w - 30, 8, affinity, RelationshipConfig.bonds.max, color);
    // The temperature in words: a bar alone does not say what is happening to
    // the relationship, and the whole point is that neglect is visible.
    line(
      ctx,
      x + 14,
      y + 38,
      temp === "warm" ? def.warmLine : temp === "cold" ? def.coldLine : def.blurb,
      9,
      temp === "cold" ? palette.red : palette.muted,
      BONDS_PANEL.w - 28,
    );
  });

  line(ctx, x + 14, BONDS_PANEL.y + BONDS_PANEL.h - 12, relationshipSummary(state), 10, palette.muted, BONDS_PANEL.w - 28);
}

// --- Middle bottom: the career's memory -------------------------------------

function decisionsColumn(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  const x = LOG_PANEL.x;
  columnHeader(ctx, x, LOG_PANEL.y, LOG_PANEL.w, "LO QUE DECIDISTE");

  const recent = recentDecisions(state, 4);
  if (recent.length === 0) {
    line(ctx, x + 14, LOG_PANEL.y + 50, "Todavia nadie te ha puesto", 10, CARD.dim, LOG_PANEL.w - 28);
    line(ctx, x + 14, LOG_PANEL.y + 66, "contra la pared.", 10, CARD.dim, LOG_PANEL.w - 28);
    return;
  }
  recent.forEach((entry, index) => {
    const y = LOG_PANEL.y + 36 + index * 34;
    rect(ctx, x + 12, y, LOG_PANEL.w - 24, 30, CARD.fill);
    rect(ctx, x + 12, y, 3, 30, palette.teal);
    line(ctx, x + 22, y + 12, entry.choice, 10, palette.ink, LOG_PANEL.w - 44);
    line(ctx, x + 22, y + 26, `Semana ${entry.week}`, 9, palette.muted, LOG_PANEL.w - 44);
  });
}

// --- Right column: who remembers you ----------------------------------------

function rivalsColumn(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  const x = RIVALS_PANEL.x;
  columnHeader(ctx, x, RIVALS_PANEL.y, RIVALS_PANEL.w, "QUIEN TE RECUERDA");

  // Hottest grudge first: the one waiting for you matters more than the one who
  // has moved on.
  const rivalries = [...state.rivalries].sort((a, b) => b.heat - a.heat).slice(0, 5);
  if (rivalries.length === 0) {
    line(ctx, x + 14, RIVALS_PANEL.y + 50, "Nadie te ha visto rapear", 10, CARD.dim, RIVALS_PANEL.w - 28);
    line(ctx, x + 14, RIVALS_PANEL.y + 66, "todavia.", 10, CARD.dim, RIVALS_PANEL.w - 28);
    return;
  }
  rivalries.forEach((rivalry, index) => {
    const y = RIVALS_PANEL.y + 36 + index * 62;
    const hot = rivalry.heat >= RelationshipConfig.rivalry.readableAt;
    rect(ctx, x + 12, y, RIVALS_PANEL.w - 24, 56, CARD.fill);
    rect(ctx, x + 12, y, 3, 56, hot ? palette.red : CARD.border);
    line(ctx, x + 22, y + 14, rivalry.name, 12, palette.ink, RIVALS_PANEL.w - 90);
    const record = addText(ctx.scene, ctx.layer, 0, y + 4, `${rivalry.won}-${rivalry.lost}`, 11, palette.yellow);
    record.setX(Math.round(x + RIVALS_PANEL.w - 22 - record.width));
    // Heat is the grudge, so it gets a bar: the player should be able to see a
    // rematch coming before the battle screen says it out loud.
    addMeter(
      ctx.scene,
      ctx.layer,
      x + 22,
      y + 24,
      RIVALS_PANEL.w - 44,
      6,
      rivalry.heat,
      RelationshipConfig.rivalry.max,
      hot ? palette.red : CARD.border,
    );
    line(
      ctx,
      x + 22,
      y + 46,
      rivalryLine(state, rivalry.name) ?? `${rivalry.faced} ${rivalry.faced === 1 ? "cruce" : "cruces"}`,
      9,
      hot ? palette.red : palette.muted,
      RIVALS_PANEL.w - 44,
    );
  });
}

// --- chrome -----------------------------------------------------------------

// Pointer route to the numbers screen, mirroring the chip Estadisticas shows to
// come here. Keyboard has S / I; a mouse-only player needs both doors drawn.
function statsChip(ctx: ViewCtx, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, CARD.border);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, "#101740");
  rect(ctx, x + 8, y + 6, 26, h - 12, "#0a0f26");
  const key = addText(ctx.scene, ctx.layer, 0, 0, "S", 10, palette.muted);
  key.setOrigin(0.5, 0.5).setPosition(x + 21, y + h / 2);
  const label = addText(ctx.scene, ctx.layer, 0, 0, "ESTADISTICAS", 11, palette.ink);
  label.setOrigin(0, 0.5).setPosition(x + 44, y + h / 2);
  addHitZone(ctx.scene, ctx.layer, x, y, w, h, () => ctx.controller.setCareerView("stats"));
}

function footerBar(ctx: ViewCtx): void {
  rect(ctx, FOOTER.x, FOOTER.y, FOOTER.w, FOOTER.h, "#050a20");
  rect(ctx, FOOTER.x, FOOTER.y, FOOTER.w, 1, palette.line);
  rect(ctx, FOOTER.x, FOOTER.y + FOOTER.h - 1, FOOTER.w, 1, CARD.border);
  line(
    ctx,
    38,
    506,
    "Los ejes se mueven con lo que decides. Los lazos, con las veces que apareces.",
    10,
    palette.muted,
    720,
  );
  backChip(ctx, 790, 493, 128, 26);
}

function backChip(ctx: ViewCtx, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, palette.borderHi);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, "#2a3480");
  rect(ctx, x + 8, y + 6, 36, h - 12, "#0a0f26");
  const esc = addText(ctx.scene, ctx.layer, 0, 0, "ESC", 9, palette.muted);
  esc.setOrigin(0.5, 0.5).setPosition(x + 26, y + h / 2);
  const label = addText(ctx.scene, ctx.layer, 0, 0, "VOLVER", 13, palette.ink);
  label.setOrigin(0.5, 0.5).setPosition(x + 84, y + h / 2);
  addHitZone(ctx.scene, ctx.layer, x, y, w, h, () => ctx.controller.setCareerView("base"));
}
