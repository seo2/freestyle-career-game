// Night-city UI palette shared by every scene. Visual language reference:
// docs/PANTALLAS.md. Values are the legacy canvas palette, unchanged.

export const palette = {
  ink: "#f3f2e9",
  muted: "#a8a59c",
  black: "#101114",
  panel: "#101735",
  line: "#39428a",
  deep: "#070b22",
  panelAlt: "#172052",
  borderHi: "#6b70c9",
  borderLo: "#20275c",
  yellow: "#e1b84a",
  red: "#f04d3a",
  teal: "#2fa58d",
  blue: "#6e7fe8",
  green: "#77c46b",
  pink: "#d65a8a",
  floor: "#2c2f36",
  room: "#20242d",
} as const;

export function hex(color: string): number {
  return parseInt(color.slice(1), 16);
}
