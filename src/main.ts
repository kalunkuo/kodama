import 'mapbox-gl/dist/mapbox-gl.css';
import './style.css';

import { EventBus } from './core/EventBus';
import { GameLoop } from './core/GameLoop';
import { GPSService } from './player/GPSService';
import { PlayerController } from './player/PlayerController';
import { MapManager } from './map/MapManager';
import { TerrainLayer } from './map/TerrainLayer';
import { SpiritManager } from './spirits/SpiritManager';
import { SpiritSpawner } from './spirits/SpiritSpawner';
import { HUD } from './ui/HUD';
import { SpiritModal } from './ui/SpiritModal';
import { InventoryScreen } from './ui/InventoryScreen';
import { SpiritRadar } from './ui/SpiritRadar';
import { EnergySystem } from './systems/EnergySystem';
import { ExplorationSystem } from './systems/ExplorationSystem';
import type { Spirit } from './spirits/SpiritManager';
import type { Coordinates } from './player/GPSService';
import * as THREE from 'three';

async function main() {
  const eventBus = new EventBus();
  const gameLoop = new GameLoop();

  const params = new URLSearchParams(window.location.search);
  const isMockMode = params.has('mock') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const gpsService = new GPSService();
  if (isMockMode) {
    gpsService.enableMockMode({ lat: 37.7749, lng: -122.4194 });
    const mockControls = document.getElementById('mock-controls');
    if (mockControls) mockControls.classList.remove('hidden');
  }

  const playerController = new PlayerController(gpsService, eventBus);

  const mapManager = new MapManager('map');

  const spiritManager = new SpiritManager(eventBus);
  const spiritSpawner = new SpiritSpawner(spiritManager);

  const threeScene = new THREE.Scene();
  spiritManager.init(threeScene);

  const hud = new HUD();
  hud.init();
  const spiritModal = new SpiritModal(eventBus);
  spiritModal.init();
  const inventoryScreen = new InventoryScreen();
  inventoryScreen.init();
  const spiritRadar = new SpiritRadar();
  spiritRadar.init();

  const energySystem = new EnergySystem(eventBus);
  const explorationSystem = new ExplorationSystem(eventBus);

  const initialPos = gpsService.getCurrentPosition() ?? { lat: 37.7749, lng: -122.4194 };
  await mapManager.init([initialPos.lng, initialPos.lat]);

  const terrainLayer = new TerrainLayer();
  const map = mapManager.getMap();
  if (map) {
    terrainLayer.init(map);
  }

  playerController.init();

  hud.updateEnergy(energySystem.getEnergy(), energySystem.getMaxEnergy());
  hud.updateLevel(playerController.getLevel());
  hud.updateDistance(explorationSystem.getTotalDistance());
  hud.updateSpiritCount(spiritManager.getCollectedSpirits().length);

  const pos = gpsService.getCurrentPosition();
  if (pos) {
    spiritSpawner.spawnInitial(pos);
  }

  eventBus.on<Coordinates>('player:position', (coords) => {
    mapManager.updatePlayerPosition(coords);
    mapManager.followPlayer(coords);
    explorationSystem.updatePosition(coords);
    terrainLayer.update(coords);

    spiritManager.getActiveSpirits().forEach(spirit => {
      if (!mapManager.hasSpiritMarker(spirit.id)) {
        mapManager.addSpiritMarker(spirit, (id) => {
          const s = spiritManager.getActiveSpirits().find(x => x.id === id);
          if (s) spiritModal.show(s);
        });
      }
    });
  });

  eventBus.on<{ level: number }>('player:levelup', ({ level }) => {
    hud.updateLevel(level);
    if (level > 1) {
      hud.showNotification(`Level Up! You are now Level ${level}! 🎉`, 'success');
    }
  });

  eventBus.on<{ energy: number; maxEnergy: number }>('energy:changed', ({ energy, maxEnergy }) => {
    hud.updateEnergy(energy, maxEnergy);
  });

  eventBus.on<{ totalDistance: number }>('exploration:distance', ({ totalDistance }) => {
    hud.updateDistance(totalDistance);
  });

  eventBus.on<{ badge: string }>('exploration:badge', ({ badge }) => {
    hud.showNotification(`Badge Earned: ${badge}`, 'success');
  });

  eventBus.on<Spirit>('spirit:spawned', (spirit) => {
    const playerPos = gpsService.getCurrentPosition();
    if (playerPos) {
      if (!mapManager.hasSpiritMarker(spirit.id)) {
        mapManager.addSpiritMarker(spirit, (id) => {
          const s = spiritManager.getActiveSpirits().find(x => x.id === id);
          if (s) spiritModal.show(s);
        });
      }
    }
  });

  eventBus.on<Spirit>('spirit:collected', (spirit) => {
    hud.updateSpiritCount(spiritManager.getCollectedSpirits().length);
    energySystem.addEnergy(spirit.type.energyValue);
    playerController.addXP(spirit.type.energyValue);
    hud.showNotification(`${spirit.type.name} collected! +${spirit.type.energyValue}⚡`, 'success');
    mapManager.removeSpiritMarker(spirit.id);
    inventoryScreen.refresh(spiritManager.getCollectedSpirits());
  });

  eventBus.on<string>('spirit:collect', (spiritId) => {
    spiritManager.collectSpirit(spiritId);
  });

  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const screen = (btn as HTMLElement).dataset['screen'];

      document.getElementById('inventory-screen')?.classList.add('hidden');
      document.getElementById('explore-screen')?.classList.add('hidden');
      document.getElementById('profile-screen')?.classList.add('hidden');

      if (screen === 'spirits') {
        inventoryScreen.refresh(spiritManager.getCollectedSpirits());
        inventoryScreen.show();
      } else if (screen === 'explore') {
        showExploreScreen(explorationSystem);
      } else if (screen === 'profile') {
        showProfileScreen(playerController, spiritManager, explorationSystem);
      }
    });
  });

  document.getElementById('explore-close')?.addEventListener('click', () => {
    document.getElementById('explore-screen')?.classList.add('hidden');
  });
  document.getElementById('profile-close')?.addEventListener('click', () => {
    document.getElementById('profile-screen')?.classList.add('hidden');
  });

  const STEP = 0.0001;
  document.getElementById('mock-north')?.addEventListener('click', () => gpsService.moveMockPosition(STEP, 0));
  document.getElementById('mock-south')?.addEventListener('click', () => gpsService.moveMockPosition(-STEP, 0));
  document.getElementById('mock-east')?.addEventListener('click', () => gpsService.moveMockPosition(0, STEP));
  document.getElementById('mock-west')?.addEventListener('click', () => gpsService.moveMockPosition(0, -STEP));
  document.getElementById('mock-center')?.addEventListener('click', () => {
    gpsService.setMockPosition({ lat: 37.7749, lng: -122.4194 });
  });

  if (isMockMode) {
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': gpsService.moveMockPosition(STEP, 0); break;
        case 'ArrowDown': case 's': gpsService.moveMockPosition(-STEP, 0); break;
        case 'ArrowRight': case 'd': gpsService.moveMockPosition(0, STEP); break;
        case 'ArrowLeft': case 'a': gpsService.moveMockPosition(0, -STEP); break;
      }
    });
  }

  gameLoop.addCallback((delta) => {
    energySystem.update(delta);
    spiritManager.update(delta);
    const playerPos = gpsService.getCurrentPosition();
    if (playerPos) {
      spiritSpawner.update(delta, playerPos);
      spiritRadar.update(playerPos, spiritManager.getActiveSpirits());
    }
  });

  gameLoop.start();
  hud.showNotification('Welcome to Kodama! 🌿 Explore to find spirits!', 'info');
}

function showExploreScreen(explorationSystem: ExplorationSystem) {
  const screen = document.getElementById('explore-screen');
  if (!screen) return;
  screen.classList.remove('hidden');
  const content = document.getElementById('explore-content');
  if (!content) return;
  const dist = explorationSystem.getTotalDistance();
  const badges = explorationSystem.getBadges();
  content.innerHTML = `
    <div class="explore-stat">
      <div class="explore-stat-value">${dist >= 1000 ? (dist / 1000).toFixed(2) + 'km' : Math.floor(dist) + 'm'}</div>
      <div class="explore-stat-label">Total Distance</div>
    </div>
    <div class="explore-badges">
      <h3>Badges</h3>
      ${badges.length === 0
        ? '<p class="no-badges">Explore to earn badges!</p>'
        : badges.map(b => `<div class="badge-item">${b}</div>`).join('')
      }
    </div>
  `;
}

function showProfileScreen(
  playerController: PlayerController,
  spiritManager: SpiritManager,
  explorationSystem: ExplorationSystem
) {
  const screen = document.getElementById('profile-screen');
  if (!screen) return;
  screen.classList.remove('hidden');
  const content = document.getElementById('profile-content');
  if (!content) return;
  const level = playerController.getLevel();
  const xp = playerController.getXP();
  const xpNeeded = playerController.getXPForLevel();
  const collected = spiritManager.getCollectedSpirits();
  const dist = explorationSystem.getTotalDistance();
  content.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">🧭</div>
      <div class="profile-info">
        <div class="profile-level">Level ${level} Explorer</div>
        <div class="xp-bar-container">
          <div class="xp-bar" style="width:${Math.min(100, (xp / xpNeeded) * 100)}%"></div>
        </div>
        <div class="xp-text">${xp} / ${xpNeeded} XP</div>
      </div>
    </div>
    <div class="profile-stats">
      <div class="profile-stat"><span class="stat-val">${collected.length}</span><span class="stat-lbl">Spirits</span></div>
      <div class="profile-stat"><span class="stat-val">${dist >= 1000 ? (dist / 1000).toFixed(1) + 'km' : Math.floor(dist) + 'm'}</span><span class="stat-lbl">Explored</span></div>
      <div class="profile-stat"><span class="stat-val">${explorationSystem.getBadges().length}</span><span class="stat-lbl">Badges</span></div>
    </div>
  `;
}

main().catch(console.error);
