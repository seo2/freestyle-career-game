// What an action did, said with the numbers themselves (Fase 12 B/C): floating
// deltas from the HUD and the MC, and the centre-screen ribbon for milestones.
// Split out of CareerScene (AGENTS.md 500-line rule). The diff and the curves
// are pure and tested in src/ui/feedback.ts; this only places and animates them.

import type Phaser from "phaser";
import { gameContext } from "../game/context";
import { hex as hexColor, palette } from "../ui/palette";
import { addDisplayText, textStyle } from "../ui/kit";
import { Floater, diffFeedback, feedbackSnapshot } from "../ui/feedback";
import type { FeedbackAnchor, FeedbackDelta, FeedbackSnapshot } from "../ui/feedback";

const W = 960;

// Where each kind of delta is born. HUD resources drop out from under their own
// card (so it works on every screen, the HUD is always there); character gains
// rise from the MC in the room, or from mid-screen inside a sub-view.
const FLOAT_ANCHORS: Record<Exclude<FeedbackAnchor, "mc">, { x: number; y: number }> = {
  energy: { x: 318, y: 90 },
  cash: { x: 431, y: 90 },
  fans: { x: 610, y: 90 },
  respect: { x: 827, y: 90 },
};
const FLOAT_MC = { room: { x: 392, y: 186 }, view: { x: 480, y: 300 } } as const;
const FLOAT = { staggerMs: 170, stackPx: 22, hudSize: 13, mcSize: 15, headlineSize: 19 } as const;

// Milestones (new rank, level-up, finished song) get a ribbon across the middle
// of the screen instead of a floater: the moment the week was for.
const BANNER = { y: 212, h: 70, lifeMs: 2600, popMs: 220, fadeMs: 600, textSize: 28, kickerSize: 11 } as const;


export class CareerFeedback {
  private floaters: { floater: Floater; node: Phaser.GameObjects.Container; x: number; y: number; dir: 1 | -1; anchor: FeedbackAnchor }[] = [];
  private banner: { floater: Floater; node: Phaser.GameObjects.Container } | null = null;
  // Last state the feedback layer saw; diffs against it say what an action did.
  private snapshot: FeedbackSnapshot;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly floatLayer: Phaser.GameObjects.Container,
  ) {
    // Entering the scene (new game, loaded save, back from battle) is not an
    // action: start the diff from here so nothing phantom floats up.
    this.snapshot = feedbackSnapshot(gameContext().controller.state);
  }

  // Diff the state against the last one seen and float up what moved.
  emit(): void {
    const state = gameContext().controller.state;
    const next = feedbackSnapshot(state);
    const prev = this.snapshot;
    this.snapshot = next;
    const deltas = diffFeedback(prev, next);
    const milestones = deltas.filter((delta) => delta.milestone);
    if (milestones.length > 0) this.showBanner(milestones);
    // Stack below whatever is still floating from a previous action on the same
    // anchor, so two quick actions never print over each other.
    const perAnchor = new Map<FeedbackAnchor, number>();
    for (const live of this.floaters) perAnchor.set(live.anchor, Math.min(3, (perAnchor.get(live.anchor) ?? 0) + 1));
    deltas.filter((delta) => !delta.milestone).forEach((delta, index) => {
      const slot = perAnchor.get(delta.anchor) ?? 0;
      perAnchor.set(delta.anchor, slot + 1);
      this.spawnFloater(delta, index, slot);
    });
  }

  private spawnFloater(delta: FeedbackDelta, order: number, slot: number): void {
    const inRoom = gameContext().controller.careerView === "base";
    const isMc = delta.anchor === "mc";
    const origin = isMc ? (inRoom ? FLOAT_MC.room : FLOAT_MC.view) : FLOAT_ANCHORS[delta.anchor as Exclude<FeedbackAnchor, "mc">];
    // Character gains rise; HUD deltas drop out from under their card.
    const dir: 1 | -1 = isMc ? -1 : 1;
    const headline = delta.text.startsWith("¡");
    const size = headline ? FLOAT.headlineSize : isMc ? FLOAT.mcSize : FLOAT.hudSize;
    const text = this.scene.add.text(0, 0, delta.text, textStyle(size, delta.color));
    text.setOrigin(0.5, 0.5);
    // A dark pill behind the number: it has to read over the room art and over
    // a sub-view's rows alike, and a stroke alone does not survive the latter.
    const pill = this.scene.add.rectangle(0, 0, text.width + 10, text.height + 2, hexColor("#03061a"), 0.94);
    const edge = this.scene.add.rectangle(-pill.width / 2, 0, 2, pill.height, hexColor(delta.color));
    const node = this.scene.add.container(0, 0, [pill, edge, text]).setAlpha(0);
    this.floatLayer.add(node);
    this.floaters.push({
      floater: new Floater(order * FLOAT.staggerMs),
      node,
      x: origin.x,
      // Character gains: later deltas are born BEHIND the earlier ones (opposite
      // to their travel), so the first one's head start widens the gap. HUD
      // deltas always stack downward — "behind" them is the HUD itself.
      y: isMc ? origin.y - dir * slot * FLOAT.stackPx : origin.y + slot * FLOAT.stackPx,
      dir,
      anchor: delta.anchor,
    });
  }

  // One ribbon per action: several milestones at once share it, joined.
  private showBanner(milestones: FeedbackDelta[]): void {
    this.banner?.node.destroy();
    const kicker = milestones[0].milestone?.kicker ?? "";
    const title = milestones.map((m) => m.text).join("  ·  ");
    const band = this.scene.add.rectangle(0, 0, W, BANNER.h, hexColor("#050818"), 0.92);
    const top = this.scene.add.rectangle(0, -BANNER.h / 2, W, 3, hexColor(palette.yellow));
    const bottom = this.scene.add.rectangle(0, BANNER.h / 2, W, 3, hexColor(palette.yellow));
    const small = this.scene.add.text(0, -BANNER.h / 2 + 15, kicker, textStyle(BANNER.kickerSize, palette.yellow)).setOrigin(0.5, 0.5);
    const big = addDisplayText(this.scene, this.floatLayer, 0, 0, title, BANNER.textSize, palette.ink);
    this.floatLayer.remove(big);
    big.setOrigin(0.5, 0.5).setPosition(0, 9);
    if (big.width > W - 60) big.setScale((W - 60) / big.width);
    const node = this.scene.add.container(W / 2, BANNER.y, [band, top, bottom, small, big]).setAlpha(0);
    this.floatLayer.add(node);
    this.banner = { floater: new Floater(0, BANNER.lifeMs, 0, BANNER.popMs, BANNER.fadeMs), node };
  }

  private advanceBanner(deltaMs: number): void {
    if (!this.banner) return;
    const { floater, node } = this.banner;
    floater.advance(deltaMs);
    if (floater.done) {
      node.destroy();
      this.banner = null;
      return;
    }
    // The ribbon slams in tall and settles; only its height pops, so the text
    // never slides sideways off the band.
    node.setAlpha(floater.alpha).setScale(1, floater.scale);
  }

  advance(deltaMs: number): void {
    this.advanceBanner(deltaMs);
    if (this.floaters.length === 0) return;
    this.floaters = this.floaters.filter((entry) => {
      entry.floater.advance(deltaMs);
      if (entry.floater.done) {
        entry.node.destroy();
        return false;
      }
      entry.node
        .setPosition(Math.round(entry.x), Math.round(entry.y + entry.dir * entry.floater.rise))
        .setAlpha(entry.floater.alpha)
        .setScale(entry.floater.scale);
      return true;
    });
  }

}
