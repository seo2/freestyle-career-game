// The loops are placeholders, but a placeholder that is out of key, out of time or
// silent is worse than no music. These pin the properties that make them listenable.

import { describe, expect, it } from "vitest";
import { loopSeconds, musicTracks, noteHz, stepSeconds, type MusicTrackId } from "./music";

const ids = Object.keys(musicTracks) as MusicTrackId[];

describe("the placeholder loops", () => {
  it("keeps every id matching its definition", () => {
    for (const id of ids) expect(musicTracks[id].id).toBe(id);
  });

  it("loops on a whole number of bars, so the pattern never lands off the beat", () => {
    for (const id of ids) expect(musicTracks[id].steps % 16).toBe(0);
  });

  it("stays at a tempo a head can nod to", () => {
    for (const id of ids) {
      expect(musicTracks[id].bpm).toBeGreaterThanOrEqual(60);
      expect(musicTracks[id].bpm).toBeLessThanOrEqual(110);
    }
  });

  it("keeps a loop short enough to be a loop and long enough not to nag", () => {
    for (const id of ids) {
      const seconds = loopSeconds(musicTracks[id]);
      expect(seconds).toBeGreaterThan(2);
      expect(seconds).toBeLessThan(14);
    }
  });

  it("never places a note outside its own loop", () => {
    for (const id of ids) {
      const track = musicTracks[id];
      for (const [start] of [...track.bass, ...track.keys]) {
        expect(start).toBeGreaterThanOrEqual(0);
        expect(start).toBeLessThan(track.steps);
      }
      for (const steps of Object.values(track.drums)) {
        for (const step of steps) {
          expect(step).toBeGreaterThanOrEqual(0);
          expect(step).toBeLessThan(track.steps);
        }
      }
    }
  });

  it("gives every track a drum, a bass and something on top", () => {
    // A loop missing one of the three reads as broken rather than sparse.
    for (const id of ids) {
      const track = musicTracks[id];
      expect(Object.keys(track.drums).length).toBeGreaterThan(0);
      expect(track.bass.length).toBeGreaterThan(0);
      expect(track.keys.length).toBeGreaterThan(0);
    }
  });

  it("keeps every note inside the range a small speaker can reproduce", () => {
    for (const id of ids) {
      const track = musicTracks[id];
      for (const [, semis] of [...track.bass, ...track.keys]) {
        const hz = noteHz(track, semis);
        expect(hz).toBeGreaterThan(35);
        expect(hz).toBeLessThan(4000);
      }
    }
  });

  it("puts the battle loop above the others in tempo and below them in level", () => {
    // It plays under ten sound effects, so it has to push the pace and get out of
    // the way at the same time.
    expect(musicTracks.battle.bpm).toBeGreaterThan(musicTracks.menu.bpm);
    for (const id of ids) {
      if (id === "battle") continue;
      expect(musicTracks.battle.gain).toBeLessThanOrEqual(musicTracks[id].gain);
    }
  });

  it("derives step and loop length from the tempo, not from a magic number", () => {
    const track = musicTracks.career;
    expect(stepSeconds(track)).toBeCloseTo(60 / track.bpm / 4, 10);
    expect(loopSeconds(track)).toBeCloseTo(stepSeconds(track) * track.steps, 10);
  });
});
