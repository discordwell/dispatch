import type { ShipClass } from '../core/types';

/** Airship classes. Bigger holds = more (and weirder) cargo, but slower to fill. */
export const SHIP_CLASSES: Readonly<Record<string, ShipClass>> = {
  Scout: { name: 'Scout', holdW: 4, holdH: 4 },
  Hauler: { name: 'Hauler', holdW: 5, holdH: 6 },
  Leviathan: { name: 'Leviathan', holdW: 6, holdH: 8 },
};

export function getShipClass(name: string): ShipClass {
  const c = SHIP_CLASSES[name];
  if (!c) throw new Error(`Unknown ship class: ${name}`);
  return c;
}
