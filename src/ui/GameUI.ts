import type { Store } from '../state/store';
import type { MapRenderer } from '../render/MapRenderer';
import { createGameState } from '../core/setup';
import { screenToWorld } from '../render/viewport';
import { pickAt, type Pick } from '../render/hitTest';
import { beginPack, bookNpc, cancelPack, commitPack, idleShips, npcOfferNear } from '../state/actions';
import type { Placement } from '../core/types';
import { Hud } from './Hud';
import { RequestBoard } from './RequestBoard';
import { ShipInspector } from './ShipInspector';
import { PackingOverlay } from './PackingOverlay';
import { ResultOverlay } from './ResultOverlay';
import { StartOverlay } from './StartOverlay';

const MAX_LEVEL = 5;

/**
 * Top-level UI controller. Owns selection, mounts every view, routes canvas clicks,
 * and re-syncs from the store each frame.
 */
export class GameUI {
  private selection: Pick | null = null;
  private hud: Hud;
  private board: RequestBoard;
  private inspector: ShipInspector;
  private overlay: PackingOverlay;
  private result: ResultOverlay;
  private start: StartOverlay;
  private begun = false;

  constructor(
    root: HTMLElement,
    private canvas: HTMLCanvasElement,
    private store: Store,
    private renderer: MapRenderer,
  ) {
    this.hud = new Hud(root);
    this.board = new RequestBoard(root, (reqId) => this.openPacking(reqId));
    this.inspector = new ShipInspector(root);
    this.overlay = new PackingOverlay(root, {
      onCommit: (reqId, shipId, placements) => this.commit(reqId, shipId, placements),
      onCancel: (reqId, shipId) => this.cancel(reqId, shipId),
    });
    this.result = new ResultOverlay(root, {
      onReplay: () => this.loadLevel(this.store.getState().levelIndex),
      onNext: () => this.loadLevel(Math.min(MAX_LEVEL, this.store.getState().levelIndex + 1)),
    });
    this.start = new StartOverlay(root, () => {
      this.begun = true;
      this.start.hide();
      this.sync();
    });
    this.start.show(this.store.getState());
    canvas.addEventListener('click', (e) => this.onCanvasClick(e));
  }

  /** The loop advances sim time only after the player begins the first shift. */
  isRunning(): boolean {
    return this.begun;
  }

  private onCanvasClick(e: MouseEvent): void {
    if (this.overlay.isOpen() || this.store.getState().outcome !== 'playing') return;
    const rect = this.canvas.getBoundingClientRect();
    const world = screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, this.renderer.transform);
    this.selection = pickAt(this.store.getState(), world);
    this.renderer.setSelection(this.selection);
    this.sync();
  }

  /** Reserve a ship (idle owned, else a charter near the origin) and open the packing puzzle. */
  private openPacking(reqId: string): void {
    const s = this.store.getState();
    const owned = idleShips(s)[0];
    if (owned) {
      let ok = false;
      this.store.update((st) => {
        ok = beginPack(st, reqId, owned.id);
      });
      if (ok) this.overlay.open(this.store.getState(), reqId, owned.id);
      this.sync();
      return;
    }
    const req = s.requests.find((r) => r.id === reqId);
    const offer = req ? npcOfferNear(s, req.originId) : undefined;
    if (offer) {
      let shipId: string | null = null;
      this.store.update((st) => {
        shipId = bookNpc(st, offer.id, reqId);
      });
      if (shipId) this.overlay.open(this.store.getState(), reqId, shipId);
    }
    this.sync();
  }

  private commit(reqId: string, shipId: string, placements: Placement[]): void {
    this.store.update((st) => {
      commitPack(st, reqId, shipId, placements);
    });
    this.overlay.close();
    this.sync();
  }

  private cancel(reqId: string, shipId: string): void {
    this.store.update((st) => {
      cancelPack(st, reqId, shipId);
    });
    this.overlay.close();
    this.sync();
  }

  private loadLevel(index: number): void {
    this.result.hide();
    this.selection = null;
    this.renderer.setSelection(null);
    this.store.reset(createGameState(index));
    this.sync();
  }

  /** Pull every view from current state. Called each frame by the loop and after any action. */
  sync(): void {
    const s = this.store.getState();
    this.renderer.render(s);
    this.hud.update(s);

    if (s.outcome !== 'playing') {
      if (this.overlay.isOpen()) this.overlay.close();
      this.board.hide();
      this.inspector.hide();
      this.result.show(s, s.levelIndex < MAX_LEVEL);
      return;
    }
    this.result.hide();

    if (this.overlay.isOpen()) {
      this.overlay.syncClock(s);
      return;
    }

    const sel = this.selection;
    if (sel?.type === 'city') {
      this.inspector.hide();
      this.board.update(s, sel.id);
    } else if (sel?.type === 'ship') {
      this.board.hide();
      this.inspector.update(s, sel.id);
    } else {
      this.board.hide();
      this.inspector.hide();
    }
  }
}
