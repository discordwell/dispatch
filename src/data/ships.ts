import type { ShipClass } from '../core/types';

/**
 * Airship classes. Bigger holds = more (and weirder) cargo, but slower to fill — and a
 * bigger hull costs much more to charter, so a contract ship only pays off on a full multi-load.
 */
export const SHIP_CLASSES: Readonly<Record<string, ShipClass>> = {
  Scout: { name: 'Scout', holdW: 4, holdH: 4, charterCost: 350 },
  Hauler: { name: 'Hauler', holdW: 5, holdH: 6, charterCost: 650 },
  Leviathan: { name: 'Leviathan', holdW: 6, holdH: 8, charterCost: 1000 },
};

export function getShipClass(name: string): ShipClass {
  const c = SHIP_CLASSES[name];
  if (!c) throw new Error(`Unknown ship class: ${name}`);
  return c;
}
