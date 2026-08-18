// The visual identity of the Creador de Avatar design, as tokens.
//
// Neo-brutalist: bone paper, ink borders at a constant 3px, hard offset shadows
// instead of blur, lime for the committing action and cyan for the exploratory one.
// Chivo for text and Chivo Mono for anything the player reads as data.
//
// Written down as tokens because the design uses these same seven values across
// three screens, and a hex typed by hand in forty places is a redesign nobody can
// perform.

export const T = {
  paper: "#F5EFE3",
  paperDim: "#EDE5D6",
  ink: "#12100F",
  inkSoft: "#7A7266",
  inkFaint: "#A79E90",
  lime: "#C6F135",
  cyan: "#00E5FF",
  crimson: "#A81232",
  rule: "#DCD3C2",
  night: "#2A2724",
  nightLine: "#4A453E",
  nightText: "#8A8378",
  border: 3,
  mono: "'Chivo Mono', ui-monospace, monospace",
  sans: "Chivo, system-ui, sans-serif",
} as const;

// Hard shadow, never blurred: it is what makes a card feel like a printed sticker
// rather than a floating panel.
export const drop = (n = 5): string => `${n}px ${n}px 0 ${T.ink}`;
