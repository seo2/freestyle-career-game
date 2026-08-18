// The compatibility engine (spec §45/§46).
//
// The spec is explicit about the shape this must take:
//
//   Do NOT implement:  if (item === "shoes_023") { ... }
//   Instead, use metadata. The renderer reads the rules dynamically.
//
// So this file knows about `incompatible`, `requires` and `replaces` as concepts,
// and about no individual item. Adding a helmet that hides dreadlocks is a metadata
// edit, not a code change.

import type { AssetId, Category, ItemMeta } from "./types";

export interface Conflict {
  // The item that was dropped, and the one that displaced it.
  dropped: AssetId;
  because: AssetId;
  kind: "incompatible" | "replaces" | "requires";
}

export interface ResolveResult {
  // Ids that survived, in the order they were offered.
  kept: AssetId[];
  conflicts: Conflict[];
}

// Resolves a set of equipped ids against their own rules.
//
// Precedence is by ORDER OFFERED, and the caller decides that order — layer order
// must not double as authority (a hat is not more important than hair because it
// draws later). The creator offers the slot the player just touched first, so the
// thing they chose wins and the thing it conflicts with is what moves.
export function resolveCompatibility(
  offered: readonly AssetId[],
  lookup: (id: AssetId) => ItemMeta | undefined,
): ResolveResult {
  const kept: AssetId[] = [];
  const conflicts: Conflict[] = [];
  const claimedSlots = new Map<Category, AssetId>();

  for (const id of offered) {
    const meta = lookup(id);
    if (!meta) continue;

    // Does anything already kept refuse to sit with this one?
    const blocker = kept.find((keptId) => {
      const other = lookup(keptId);
      return (
        other?.rules?.incompatible?.includes(id) === true ||
        meta.rules?.incompatible?.includes(keptId) === true
      );
    });
    if (blocker !== undefined) {
      conflicts.push({ dropped: id, because: blocker, kind: "incompatible" });
      continue;
    }

    // Has a previously kept item taken over this item's slot? A helmet that
    // `replaces: ["hat"]` means the hat is not drawn at all.
    const usurper = claimedSlots.get(meta.category);
    if (usurper !== undefined && usurper !== id) {
      conflicts.push({ dropped: id, because: usurper, kind: "replaces" });
      continue;
    }

    // Prerequisites have to already be on. Checked against `kept` and not against
    // the whole offer, so a pair that requires each other cannot both slip in.
    const missing = meta.rules?.requires?.find((need) => !kept.includes(need));
    if (missing !== undefined) {
      conflicts.push({ dropped: id, because: missing, kind: "requires" });
      continue;
    }

    kept.push(id);
    for (const slot of meta.rules?.replaces ?? []) claimedSlots.set(slot, id);
  }

  return { kept, conflicts };
}
