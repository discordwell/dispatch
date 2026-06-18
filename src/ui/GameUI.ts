import type { Store } from '../state/store';
import type { MapRenderer } from '../render/MapRenderer';
import { createGameState } from '../core/setup';
import { screenToWorld } from '../render/viewport';
import { pickAt, type Pick } from '../render/hitTest';
import { beginLoad, bookNpc, cancelLoad, commitLoad, idleShips, reposition } from '../state/actions';
import { compareToBest, loadProgress, recordResult, type BestComparison } from '../state/progress';
import { initAudio, isMuted, resumeAudio, sfx, toggleMute } from '../audio';
import type { GameState, Placement } from '../core/types';
import { Hud } from './Hud';
import { RequestBoard } from './RequestBoard';
import { ShipInspector } from './ShipInspector';
import { PackingOverlay } from './PackingOverlay';
import { ResultOverlay } from './ResultOverlay';
import { TitleScreen } from './TitleScreen';

const MAX_LEVEL = 5;

/**
 * Top-level UI controller. Owns selection + the campaign flow (title → shift → result),
 * mounts every view, routes canvas clicks, and re-syncs from the store each frame.
 */
export class GameUI {
  private selection: Pick | null = null;
  private hud: Hud;
  private board: RequestBoard;
  private inspector: ShipInspector;
  private overlay: PackingOverlay;
  private result: ResultOverlay;
  private title: TitleScreen;
  private begun = false; // false while the title screen is up (sim paused)
  private recorded = false; // guard so a finished shift is persisted once
  // This shift vs. the level's standing record — captured against PRE-shift progress, the moment
  // the shift ends (before recordResult folds it in), so the result screen can celebrate a new best.
  private bestComparison: BestComparison = { previous: null, improved: false };
  private loading: { dockId: string; shipId: string } | null = null;
  private reposExpecting: string | null = null; // shipId awaiting a destination dock (Send-to-dock mode)
  private reposBanner: HTMLElement;

  constructor(
    root: HTMLElement,
    private canvas: HTMLCanvasElement,
    private store: Store,
    private renderer: MapRenderer,
  ) {
    this.hud = new Hud(root);
    this.board = new RequestBoard(root, {
      onLoadDock: (cityId) => this.openLoading(cityId),
      onHire: (offerId) => this.hireCharter(offerId),
    });
    this.inspector = new ShipInspector(root, { onSend: (shipId) => this.beginReposition(shipId) });
    this.overlay = new PackingOverlay(root, {
      onCommit: (shipId, placements) => this.commit(shipId, placements),
      onCancel: (shipId) => this.cancel(shipId),
      onSwitch: (shipId) => this.switchShip(shipId),
    });
    this.result = new ResultOverlay(root, {
      onReplay: () => this.loadLevel(this.store.getState().levelIndex),
      onNext: () => this.loadLevel(Math.min(MAX_LEVEL, this.store.getState().levelIndex + 1)),
      onLevelSelect: () => this.showTitle(),
    });
    this.title = new TitleScreen(root, (idx) => this.loadLevel(idx));

    const mute = document.createElement('button');
    mute.className = 'mute-btn';
    mute.textContent = isMuted() ? '🔇' : '🔊';
    mute.title = 'Toggle sound';
    mute.addEventListener('click', () => {
      const m = toggleMute();
      mute.textContent = m ? '🔇' : '🔊';
      if (!m) {
        initAudio();
        resumeAudio();
      }
    });
    root.appendChild(mute);

    const banner = document.createElement('div');
    banner.className = 'reposition-banner';
    banner.textContent = 'Click a destination dock to send your airship · Esc to cancel';
    root.appendChild(banner);
    this.reposBanner = banner;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.reposExpecting) {
        this.clearRepos();
        this.sync();
      }
    });

    canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    this.showTitle();
  }

  /** Enter Send-to-dock mode for an idle owned ship; the next dock click repositions it. */
  private beginReposition(shipId: string): void {
    const ship = this.store.getState().ships.find((sh) => sh.id === shipId);
    if (!ship || !ship.owned || ship.status !== 'idle') return;
    this.reposExpecting = shipId;
    this.reposBanner.classList.add('show');
  }

  private clearRepos(): void {
    this.reposExpecting = null;
    this.reposBanner.classList.remove('show');
  }

  /** Spawn map feedback + sound for the sim's transient events, then clear them. */
  private drainEvents(s: GameState): void {
    if (s.events.length === 0) return;
    for (const e of s.events) {
      const c = s.cities.find((city) => city.id === e.cityId);
      if (!c) continue;
      if (e.type === 'deliver') {
        this.renderer.effectDeliver(c, e.amount);
        sfx.deliver();
      } else {
        this.renderer.effectExpire(c);
        sfx.expire();
      }
    }
    s.events.length = 0;
  }

  /** The loop advances sim time only while a shift is in progress (not on the title screen). */
  isRunning(): boolean {
    return this.begun;
  }

  private showTitle(): void {
    this.begun = false;
    this.result.hide();
    this.clearRepos();
    if (this.overlay.isOpen()) this.overlay.close();
    this.selection = null;
    this.renderer.setSelection(null);
    this.title.show(loadProgress());
    this.sync();
  }

  private loadLevel(index: number): void {
    initAudio(); // first reaches here via a user click (autoplay policy)
    resumeAudio();
    this.title.hide();
    this.result.hide();
    this.clearRepos();
    this.selection = null;
    this.renderer.setSelection(null);
    this.loading = null;
    this.recorded = false;
    this.begun = true;
    this.store.reset(createGameState(index));
    this.sync();
  }

  private onCanvasClick(e: MouseEvent): void {
    if (!this.begun || this.overlay.isOpen() || this.store.getState().outcome !== 'playing') return;
    const rect = this.canvas.getBoundingClientRect();
    const world = screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, this.renderer.transform);
    const pick = pickAt(this.store.getState(), world);

    if (this.reposExpecting) {
      const shipId = this.reposExpecting;
      this.clearRepos();
      if (pick?.type === 'city') {
        this.store.update((st) => {
          reposition(st, shipId, pick.id);
        });
        this.selection = { type: 'ship', id: shipId }; // keep it selected → inspector shows it heading out
        this.renderer.setSelection(this.selection);
        this.sync();
        return;
      }
      // clicked off a dock → cancel the send and fall through to a normal selection
    }

    this.selection = pick;
    this.renderer.setSelection(this.selection);
    this.sync();
  }

  /**
   * Open the dock's loading puzzle with an idle owned ship: the selected one, else one already
   * at the dock, else any idle owned ship (it deadheads in). Charters go through hireCharter.
   */
  private openLoading(cityId: string): void {
    const s = this.store.getState();
    const idle = idleShips(s).filter((sh) => sh.owned);
    const sel = this.selection;
    const selId = sel && sel.type === 'ship' ? sel.id : null;
    const chosen =
      idle.find((sh) => sh.id === selId) ?? idle.find((sh) => sh.locationId === cityId) ?? idle[0];
    if (!chosen) return;
    let ok = false;
    this.store.update((st) => {
      ok = beginLoad(st, cityId, chosen.id);
    });
    if (ok) {
      this.loading = { dockId: cityId, shipId: chosen.id };
      this.overlay.open(this.store.getState(), cityId, chosen.id);
    }
    this.sync();
  }

  /** Book a specific contract hull (the chosen size, at its dock) and open its loading puzzle. */
  private hireCharter(offerId: string): void {
    const offer = this.store.getState().npcOffers.find((o) => o.id === offerId);
    if (!offer) return;
    const dockId = offer.nearCityId;
    let shipId: string | null = null;
    this.store.update((st) => {
      shipId = bookNpc(st, offerId, dockId);
    });
    if (shipId) {
      this.loading = { dockId, shipId };
      this.overlay.open(this.store.getState(), dockId, shipId);
    }
    this.sync();
  }

  /** Switch which idle owned ship loads at this dock (cancel the reservation + re-reserve). */
  private switchShip(newShipId: string): void {
    if (!this.loading || this.loading.shipId === newShipId) return;
    const { dockId, shipId } = this.loading;
    let ok = false;
    this.store.update((st) => {
      cancelLoad(st, shipId);
      ok = beginLoad(st, dockId, newShipId);
    });
    if (ok) {
      this.loading = { dockId, shipId: newShipId };
      this.overlay.open(this.store.getState(), dockId, newShipId);
    }
    this.sync();
  }

  private commit(shipId: string, placements: Placement[]): void {
    let ok = false;
    this.store.update((st) => {
      ok = commitLoad(st, shipId, placements);
    });
    if (ok) {
      sfx.dispatch();
      // surface the fixed hire fee where a chartered hull launches
      const ship = this.store.getState().ships.find((sh) => sh.id === shipId);
      if (ship && !ship.owned && ship.charterCost > 0 && ship.route) {
        this.renderer.effectCost(ship.route.from, ship.charterCost);
      }
    } else {
      // A failed commit (e.g. every picked order expired mid-pack) must not strand the ship
      // in 'loading' with the overlay closed — return it to idle.
      this.store.update((st) => cancelLoad(st, shipId));
    }
    this.loading = null;
    this.overlay.close();
    this.sync();
  }

  private cancel(shipId: string): void {
    this.store.update((st) => {
      cancelLoad(st, shipId);
    });
    this.loading = null;
    this.overlay.close();
    this.sync();
  }

  /** Pull every view from current state. Called each frame by the loop and after any action. */
  sync(): void {
    const s = this.store.getState();
    this.drainEvents(s);
    this.renderer.render(s);
    this.hud.update(s);

    if (!this.begun) return; // title screen up; map/HUD render behind it

    if (s.outcome !== 'playing') {
      this.clearRepos();
      if (!this.recorded) {
        // Compare against the record as it stood BEFORE this shift, then fold this shift in.
        this.bestComparison = compareToBest(loadProgress(), s.levelIndex, s.earnings);
        recordResult(s.levelIndex, s.earnings, s.outcome === 'won');
        this.recorded = true;
        if (s.outcome === 'won') sfx.win();
        else sfx.lose();
      }
      if (this.overlay.isOpen()) this.overlay.close();
      this.board.hide();
      this.inspector.hide();
      this.result.show(s, {
        hasNext: s.outcome === 'won' && s.levelIndex < MAX_LEVEL,
        campaignComplete: s.outcome === 'won' && s.levelIndex === MAX_LEVEL,
        best: this.bestComparison,
      });
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
