// Types for the pipeline validator (validate.mjs).
//
// The validator is plain .mjs so the build scripts run under bare node with no
// transpiler, but src/avatar/pipeline.test.ts imports it — so it needs a shape.

export interface Finding {
  level: "error" | "warn";
  check: string;
  message: string;
}

export type Meta = Record<string, unknown> | null;

export const LAYERS: readonly string[];
export const CATEGORIES: readonly string[];
export const RARITIES: readonly string[];
export const UNLOCK_TYPES: readonly string[];
export const TOKENS: readonly string[];
export const CANVAS: { w: number; h: number };
export const LAYERS_FOR_CATEGORY: Record<string, readonly string[]>;

export function checkCanvas(svg: string): Finding[];
export function checkNoRootTransform(svg: string): Finding[];
export function checkNoRaster(svg: string): Finding[];
export function checkWellFormed(svg: string): Finding[];
export function checkTokens(svg: string): { findings: Finding[]; tokens: string[] };
export function checkMetadata(id: string, meta: Meta): Finding[];
export function checkCrossReferences(
  assets: readonly { id: string; meta: Meta }[],
): (Finding & { id: string })[];
export function checkTokenAgreement(meta: Meta, usedTokens: readonly string[]): Finding[];
export function validateAsset(input: { id: string; svg: string; meta: Meta }): {
  id: string;
  findings: Finding[];
  tokens: string[];
};
export function hasErrors(findings: readonly Finding[]): boolean;
