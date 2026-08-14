// The music career's milestones. Before these, recording was a counter nobody
// acknowledged: a measured route reached 101 songs and the game never said a word.

import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { claimRelease, pendingRelease, releaseTitle } from "./ReleaseSystem";
import { releases } from "../data/releases";
import type { GameState } from "../core/types";

function career(songs = 0): GameState {
  const state = createNewState("Test", 1);
  state.mode = "career";
  state.songs = songs;
  return state;
}

describe("claimRelease", () => {
  it("lands on the song counts the catalogue names, and stays quiet between them", () => {
    for (const release of releases) {
      const state = career(release.songs);
      expect(claimRelease(state).join(" ")).toContain(release.label);
      expect(state.releases).toEqual([release.id]);
    }
    // A song that completes nothing says nothing.
    const between = career(releases[0].songs + 1);
    expect(claimRelease(between)).toEqual([]);
  });

  it("pays fame and fans on top of the song's own reward", () => {
    const state = career(releases[1].songs);
    const before = { fame: state.fame, fans: state.fans };
    claimRelease(state);
    expect(state.fame).toBe(before.fame + releases[1].fame);
    expect(state.fans).toBe(before.fans + releases[1].fans);
  });

  it("never pays the same milestone twice", () => {
    const state = career(releases[0].songs);
    claimRelease(state);
    const fame = state.fame;
    expect(claimRelease(state)).toEqual([]);
    expect(state.fame).toBe(fame);
    expect(state.releases).toEqual([releases[0].id]);
  });

  it("climbs in order and grows: a disco must be worth more than a single", () => {
    for (let i = 1; i < releases.length; i += 1) {
      expect(releases[i].songs).toBeGreaterThan(releases[i - 1].songs);
      expect(releases[i].fame).toBeGreaterThan(releases[i - 1].fame);
      expect(releases[i].fans).toBeGreaterThan(releases[i - 1].fans);
    }
  });
});

describe("what the player is aiming at", () => {
  it("points at the next milestone until there are none left", () => {
    expect(pendingRelease(career(0))?.release.id).toBe(releases[0].id);
    expect(pendingRelease(career(releases[0].songs))?.release.id).toBe(releases[1].id);
    expect(pendingRelease(career(releases[releases.length - 1].songs))).toBeNull();
  });

  it("names the biggest thing released, for the epilogue to use", () => {
    const state = career(0);
    expect(releaseTitle(state)).toBeNull();
    state.songs = releases[0].songs;
    claimRelease(state);
    expect(releaseTitle(state)).toBe(releases[0].label);
    state.songs = releases[2].songs;
    claimRelease(state);
    // The highest reached, not the most recent id pushed.
    expect(releaseTitle(state)).toBe(releases[2].label);
  });
});
