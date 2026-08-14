// Music-career milestones (Fase 10): the road for a player who would rather be a
// recording artist than a battler.
//
// The owner's request was that decisions could lead somewhere other than the
// tarima — "un artista famoso en el rap, no necesariamente en el freestyle". Two
// things were missing for that, and this is the second: the identity axes now move
// with what you DO (DilemmaSystem.driftFromAction), and recording now builds
// something. Before this, `state.songs` only unlocked shows and paid a little more
// at work; a measured route recorded 101 songs and the game never mentioned one.
//
// Pure functions over GameState. No RNG: a release is a fact, not a roll.

import type { GameState } from "../core/types";
import { nextRelease, releaseAt, releases, type ReleaseDef } from "../data/releases";

// Called right after a song is recorded. Returns the lines to show, empty when this
// song did not complete a milestone.
export function claimRelease(state: GameState): string[] {
  const release = releaseAt(state.songs);
  if (!release) return [];
  if (state.releases.includes(release.id)) return [];
  state.releases.push(release.id);
  state.fame += release.fame;
  state.fans += release.fans;
  return [`${release.label}: ${release.line}`, `+${release.fans} fans, +${release.fame} de fama.`];
}

// What the player is working towards on the music side, for the goals panel.
export function pendingRelease(state: GameState): { release: ReleaseDef; songs: number } | null {
  const release = nextRelease(state.songs);
  return release ? { release, songs: state.songs } : null;
}

// The biggest thing this MC has put out, if anything. Read by the epilogue so a
// recording career gets named there too. The catalogue's order is the ladder's, so
// the last one owned is the highest reached.
export function releaseTitle(state: GameState): string | null {
  const owned = releases.filter((release) => state.releases.includes(release.id));
  return owned.length > 0 ? owned[owned.length - 1].label : null;
}
