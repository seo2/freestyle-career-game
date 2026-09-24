// The battle's living stage (Fase 12 D): the performers, the foreground crowd
// and what the crowd yells. Split out of BattleScene (500-line rule) and kept
// presentation-only: it reads round results the scene hands it and never
// touches GameState.
//
// Everything moves on the frame delta through pure curves (src/ui/battleFeel,
// src/ui/feedback) — never Phaser tweens, which the capture harness freezes.

import Phaser from "phaser";
import { AssetRegistry } from "../game/AssetRegistry";
import { hex, palette } from "../ui/palette";
import { textStyle } from "../ui/kit";
import { Floater, idlePose } from "../ui/feedback";
import { Pulse } from "../ui/fx";
import { crowdBounce, lunge, pickShout } from "../ui/battleFeel";
import { crowdCheers, crowdJeers, crowdVictory } from "../data/crowdShouts";
import type { RoundResult } from "../core/types";

const W = 960;
const H = 540;

// Performers: mockup scale and anchors (MC ~186px tall, feet clear of both the
// card dock and the result panels).
const PERFORMER_SCALE = 0.8;
const PERFORMER_FEET_Y = 262;
const MC_X = 150;
const RIVAL_X = 812;
// The one who lands the round steps into it; the one who took it rocks back.
const LUNGE_PX = 30;
const RECOIL_PX = 12;
const LUNGE_MS = 700;
// The rival's idle runs a little behind the MC's so they never nod as twins.
const RIVAL_IDLE_OFFSET_MS = 310;

// Foreground crowd (cut from the battle mockup by scripts/build-battle-crowd.mjs).
// Its bottom sits past the screen frame so a slice hopping up never shows a gap;
// a dark floor strip under it covers the rest.
const CROWD = { slices: 12, bottomOverhang: 12, floorH: 44, floor: "#04050d" } as const;

// Shouts rise out of the crowd on its flanks, clear of the verdict panels.
const SHOUT_X = [118, 292, 668, 842] as const;
const SHOUT_Y = 454;
const SHOUT_STAGGER_MS = 140;

// A gain this big is worth cheering; a loss this big is worth jeering.
const CHEER_AT = 12;
const JEER_AT = 6;

type Performer = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

export class BattleSpectacle {
  private mc: Performer | null = null;
  private rival: Performer | null = null;
  private mcScale = PERFORMER_SCALE;
  private rivalScale = PERFORMER_SCALE;
  private slices: Phaser.GameObjects.Image[] = [];
  private crowdY = 0;
  private shoutLayer: Phaser.GameObjects.Container | null = null;
  private shouts: { floater: Floater; node: Phaser.GameObjects.Text; x: number }[] = [];
  private clockMs = 0;
  private roar = new Pulse(420);
  private strike = new Pulse(LUNGE_MS);
  // Who struck last: +1 the MC landed it, -1 the rival did.
  private striker: 1 | -1 = 1;
  // After the final verdict the room either keeps jumping or goes quiet.
  private finale: "win" | "lose" | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  // Behind everything but the backdrop: the two MCs on the ground plane.
  buildPerformers(): void {
    this.mc = this.addPerformer(MC_X, "mc");
    this.rival = this.addPerformer(RIVAL_X, "rival");
    this.mcScale = this.mc.scaleX;
    this.rivalScale = this.rival.scaleX;
  }

  // In front of the stage light, behind the UI: the crowd facing the cypher.
  buildCrowd(): void {
    const key = AssetRegistry.scenes.battleCrowd.key;
    if (!this.scene.textures.exists(key)) return;
    this.scene.add.rectangle(0, H - CROWD.floorH, W, CROWD.floorH, hex(CROWD.floor)).setOrigin(0, 0);
    const frame = this.scene.textures.getFrame(key);
    const x0 = Math.round((W - frame.width) / 2);
    this.crowdY = H + CROWD.bottomOverhang - frame.height;
    const sliceW = Math.ceil(frame.width / CROWD.slices);
    for (let i = 0; i < CROWD.slices; i += 1) {
      const slice = this.scene.add.image(x0, this.crowdY, key).setOrigin(0, 0);
      slice.setCrop(i * sliceW, 0, Math.min(sliceW, frame.width - i * sliceW), frame.height);
      this.slices.push(slice);
    }
    this.shoutLayer = this.scene.add.container(0, 0);
  }

  // Shouts must read over the UI too, so their layer is re-raised on top.
  raiseShouts(): void {
    if (this.shoutLayer) this.scene.children.bringToTop(this.shoutLayer);
  }

  // A round resolved: the one who landed it strikes, and the room answers.
  onRound(result: RoundResult): void {
    this.striker = result.playerHypeDelta >= result.rivalHypeDelta ? 1 : -1;
    this.strike.restart();
    if (result.playerHypeDelta >= CHEER_AT) {
      this.roar.restart();
      this.shout(crowdCheers, result.round, 3);
    } else if (result.playerHypeDelta <= -JEER_AT) {
      this.shout(crowdJeers, result.round, 2);
    }
  }

  onFinal(won: boolean): void {
    if (this.finale) return;
    this.finale = won ? "win" : "lose";
    if (won) {
      this.striker = 1;
      this.strike.restart();
      this.roar.restart();
      this.shout(crowdVictory, 1, 4);
    }
  }

  // `hype` is the player's eased meter (0..100): the room follows it.
  update(deltaMs: number, hype: number): void {
    this.clockMs += deltaMs;
    const roar = 1 - this.roar.advance(deltaMs);
    const energy = this.finale === "win" ? 1 : this.finale === "lose" ? 0 : hype / 100;
    this.slices.forEach((slice, i) => slice.setY(this.crowdY + crowdBounce(this.clockMs, i, energy, roar)));

    const move = this.strike.done ? 0 : lunge(this.strikeProgress(deltaMs));
    const mcDx = this.striker === 1 ? move * LUNGE_PX : -move * RECOIL_PX;
    const rivalDx = this.striker === -1 ? -move * LUNGE_PX : move * RECOIL_PX;
    this.pose(this.mc, MC_X + mcDx, this.mcScale, this.clockMs);
    this.pose(this.rival, RIVAL_X + rivalDx, this.rivalScale, this.clockMs + RIVAL_IDLE_OFFSET_MS);
    this.advanceShouts(deltaMs);
  }

  // Pulse.advance eases its output; the lunge curve wants linear time.
  private strikeProgress(deltaMs: number): number {
    this.strike.advance(deltaMs);
    return this.strike.elapsedFraction;
  }

  private pose(target: Performer | null, x: number, scale: number, timeMs: number): void {
    if (!target) return;
    const idle = idlePose(timeMs);
    target.setPosition(Math.round(x), PERFORMER_FEET_Y - idle.dy);
    target.setScale(scale, scale * idle.scaleY);
  }

  private shout(pool: readonly string[], round: number, count: number): void {
    if (!this.shoutLayer) return;
    for (let i = 0; i < count; i += 1) {
      const text = this.scene.add.text(0, 0, pickShout(pool, round, i), textStyle(i === 0 ? 17 : 14, i % 2 ? palette.ink : palette.yellow));
      text.setOrigin(0.5, 0.5).setStroke("#02030a", 4).setAlpha(0);
      this.shoutLayer.add(text);
      this.shouts.push({ floater: new Floater(i * SHOUT_STAGGER_MS, 1400, 24), node: text, x: SHOUT_X[(round + i) % SHOUT_X.length] });
    }
  }

  private advanceShouts(deltaMs: number): void {
    this.shouts = this.shouts.filter((entry) => {
      entry.floater.advance(deltaMs);
      if (entry.floater.done) {
        entry.node.destroy();
        return false;
      }
      entry.node
        .setPosition(entry.x, Math.round(SHOUT_Y - entry.floater.rise))
        .setAlpha(entry.floater.alpha)
        .setScale(entry.floater.scale);
      return true;
    });
  }

  // Performer sprite, or the compact placeholder figure when it is missing.
  private addPerformer(x: number, variant: "mc" | "rival"): Performer {
    const key = variant === "mc" ? AssetRegistry.characters.mcIdle.key : AssetRegistry.characters.rivalIdle.key;
    if (this.scene.textures.exists(key)) {
      return this.scene.add.image(x, PERFORMER_FEET_Y, key).setOrigin(0.5, 1).setScale(PERFORMER_SCALE);
    }
    const container = this.scene.add.container(x, PERFORMER_FEET_Y);
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(hex("#08090d"), 1);
    graphics.fillRoundedRect(-16, -24, 32, 48, 6);
    graphics.fillStyle(hex(variant === "mc" ? palette.teal : palette.pink), 1);
    graphics.fillRoundedRect(-14, -22, 28, 44, 5);
    graphics.fillStyle(hex(variant === "mc" ? palette.red : palette.blue), 1);
    graphics.fillRoundedRect(-12, -28, 24, 8, 3);
    container.add(graphics);
    container.setScale(3.2);
    return container;
  }
}
