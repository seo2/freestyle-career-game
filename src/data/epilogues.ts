// Arc epilogues (Fase 7): what the chapter you just closed says about you.
//
// The GDD's rule is "destinos como atractores, no rutas escritas": there is no
// menu of endings and no canned ending text. An epilogue is COMPOSED from the
// axes the player actually moved, so two people who reached Plaza in the same
// number of weeks can read different chapters.
//
// Pure data. The composition lives in src/systems/EpilogueSystem.ts.

import type { IdentityAxis, StageId } from "../core/types";

// The chapter's headline, per stage left behind.
export const stageChapters: Partial<Record<StageId, { title: string; opening: string; opens: string }>> = {
  pieza: {
    title: "Se cerro la pieza",
    opening: "Empezaste rapeando contra la pared de tu cuarto. Ya no cabes ahi.",
    opens: "La plaza te abre la puerta: mas gente, mas ruido, y nadie te conoce todavia.",
  },
  plaza: {
    title: "Se cerro la plaza",
    opening: "La plaza ya sabe tu nombre. Los que llegaron despues te miran distinto.",
    opens: "El circuito regional te espera, y ahi el que pierde se vuelve caminando.",
  },
  regional: {
    title: "Se cerro el regional",
    opening: "Dejaste de ser el de tu barrio y pasaste a ser el de tu region.",
    opens: "Lo nacional es otra cosa: camaras, contratos y gente que decide por ti.",
  },
  nacional: {
    title: "Se cerro lo nacional",
    opening: "Tu nombre ya viaja solo. No siempre dice lo que tu querias.",
    opens: "Afuera hay escenarios que no hablan tu idioma y publico que igual te entiende.",
  },
  internacional: {
    title: "Se cerro lo internacional",
    opening: "Rapeaste en ciudades que no conocias y volviste distinto.",
    opens: "El estrellato es una jaula con vista: todos te quieren y nadie te acompaña.",
  },
  estrella: {
    title: "Se cerro el estrellato",
    opening: "Llegaste donde querias llegar. Ahora la pregunta es que dejas.",
    opens: "Lo que viene no se gana: se recuerda.",
  },
};

// What each lean says about the chapter. `low` is the negative end of the axis,
// `high` the positive one — the same ends DilemmaConfig labels.
export const axisChapterLines: Record<IdentityAxis, { low: string; high: string }> = {
  undergroundComercial: {
    low: "No firmaste nada y pagaste cada sesion de tu bolsillo. Tu sonido es tuyo y se escucha.",
    high: "Aceptaste las manos que se ofrecieron. Llegaste mas lejos y mas rapido, con gente opinando de tu sonido.",
  },
  batalleroMusico: {
    low: "Te hiciste un nombre arriba de la tarima: el que no se cae cuando aprieta.",
    high: "Elegiste el estudio antes que la pelea. Tienes temas, no solo rondas.",
  },
  soloCrew: {
    low: "Caminaste solo. Nadie te debe nada y nadie te espera.",
    high: "Nunca soltaste a los tuyos, y eso se nota cuando entras a un lugar.",
  },
  autenticoPolemico: {
    low: "Nunca dijiste algo que no pensabas. Menos ruido, mas respeto.",
    high: "Te fuiste al frente cada vez. La gente habla de ti, y no siempre bien.",
  },
};

// When nothing leaned: an honest line instead of a fake destiny.
export const undecidedLine =
  "Todavia no te definiste. Nadie sabe bien que MC eres, y eso tambien es una posicion.";

// Emerging profiles: the Bible's endings as ATTRACTORS over the axes. Each needs
// its leans to hold; the first that matches wins, so the most specific go first.
// This is a read, never a choice the player makes from a menu.
export interface DestinyAttractor {
  id: string;
  label: string;
  line: string;
  // Every listed axis must lean at least this far in this direction.
  needs: Partial<Record<IdentityAxis, number>>;
}

export const destinyAttractors: DestinyAttractor[] = [
  {
    id: "leyenda-underground",
    label: "Leyenda underground",
    line: "Vas camino a leyenda del underground: sin sello, con la calle de tu lado.",
    needs: { undergroundComercial: -30, soloCrew: 20 },
  },
  {
    id: "campeon",
    label: "Campeon de batallas",
    line: "Vas camino a campeon: la tarima es tu casa y se sabe.",
    // Only the tarima. It used to also demand autenticoPolemico >= 15, and since
    // no ACTION moves that axis, the most battle-hardened MC in the game came out
    // with no destiny at all — measured with scripts/measure-routes.mjs.
    needs: { batalleroMusico: -35 },
  },
  {
    id: "productor",
    label: "Productor",
    line: "Vas camino a productor: cada vez menos rondas, cada vez mas temas, y el sonido es tuyo.",
    // The music side forks (owner request, 2026-08-13: "que algunos caminos lo
    // lleven a ser un artista famoso en el rap, no necesariamente en el
    // freestyle"). A producer records and stays underground.
    needs: { batalleroMusico: 32, undergroundComercial: -12 },
  },
  {
    id: "artista",
    label: "Artista de discos",
    line: "Vas camino a artista: ya no te presentan como freestyler, te presentan por tus temas.",
    // ...and this is the famous rapper: the same studio hours, pointed outward.
    needs: { batalleroMusico: 32, undergroundComercial: 20 },
  },
  {
    id: "estrella-pop",
    label: "Estrella",
    line: "Vas camino a estrella: te escuchan lugares que nunca pisaste.",
    // Fame above everything, whichever way you got it.
    needs: { undergroundComercial: 45 },
  },
  {
    id: "mentor",
    label: "Mentor",
    line: "Vas camino a mentor: la escena crece contigo dentro.",
    needs: { soloCrew: 35 },
  },
  {
    id: "polemico",
    label: "Nombre polemico",
    line: "Vas camino a ser un nombre que incomoda. Eso abre puertas y cierra otras.",
    needs: { autenticoPolemico: 40 },
  },
];
