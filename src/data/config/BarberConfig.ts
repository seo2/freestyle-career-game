// Barbershop pricing (Fase 10). Formula shapes live in src/systems/BarberSystem.ts;
// every number they consume lives here.

export const BarberConfig = {
  // A cut costs about a shift and a half of work ($48 a shift), which puts it in
  // the same conversation as a shop item: worth it, never trivial.
  cutPrice: 70,
  beardPrice: 35,
  // Dye is the vain one, so it costs the most.
  colorPrice: 90,
  // Changing back to what you already have is free, and says so instead of
  // charging for nothing.
  freeIfUnchanged: true,
} as const;
