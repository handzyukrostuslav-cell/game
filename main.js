import { TOOLS, ORDINANCES, ACHIEVEMENTS_DEF, getCityStage } from './config.js';
import { AudioSystem } from './AudioSystem.js';
import { MapSystem } from './MapSystem.js';
import { CitySimulation } from './CitySimulation.js';
import { TrafficSystem } from './TrafficSystem.js';
import { Renderer3D } from './Renderer3D.js';
import { SaveSystem } from './SaveSystem.js';

const canvas = document.getElementById('game-canvas');
const audio = new AudioSystem();

let mapSystem = new MapSystem(34, 'river');
let simulation = new CitySimulation(mapSystem);
let renderer3D = new Renderer3D(canvas, mapSystem, 'auto');
let trafficSystem = new TrafficSystem(renderer3D.scene, mapSystem);

let activeTool = 'SELECT';
let activeCategory = 'general';
let simSpeed = 1;
let hoveredCell = null;
let selectedCell = null;
let photoMode = false;

const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
const keysPressed = {};

// Побудова списку інструментів вибраної категорії
function renderToolsCategory(cat) {
  activeCategory = cat;
  const container = document.getElementById('tools-container');
  const items = Object.values(TOOLS).filter(t => t.cat === cat);

  container.innerHTML = items.map(t => `
    <button class="tool-card ${activeTool === t.id ? 'active' : ''}" data-tool="${t.id}">
      <div class="tool-card-top">
        <span>${t.name}</span>
        <span>${t.cost > 0 ? '$' + t.cost : ''}</span>
      </div>
      <div class="tool-card-desc">${t.desc}</div>
    </button>
  `).join('');

  container.querySelectorAll('.tool-card').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTool = btn.dataset.tool;
      renderToolsCategory(activeCategory);
      // На мобільному закриваємо шухляду після вибору інструмента
      if (window.innerWidth <= 900) {
        document.getElementById('build-drawer').classList.remove('open');
      }
    });
  });
}

document.querySelectorAll('.cat-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderToolsCategory(tab.dataset.cat);
  });
});

renderToolsCategory('general');

// Запуск нового міста
function launchCity(loaded = false) {
  audio.init();
  simulation.onAlertCallback = () => audio.playAlert();

  trafficSystem.clear();
  trafficSystem.map = mapSystem;
  renderer3D.map = mapSystem;
  renderer3D.renderedVersion = -1;
  renderer3D.resetCamera();

  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('game-hud').classList.remove('hidden');
  if (loaded) simulation.logEvent('📂 Місто успішно завантажено.');
  updateHUD();
}

document.getElementById('btn-start-game').addEventListener('click', () => {
  const cityName = document.getElementById('input-city-name').value.trim() || 'Новий Київ';
  const size = parseInt(document.getElementById('select-map-size').value, 10);
  const terrain = document.getElementById('select-terrain').value;
  const mode = document.getElementById('select-mode').value;
  const graphics = document.getElementById('select-graphics').value;

  mapSystem = new MapSystem(size, terrain);
  simulation = new CitySimulation(mapSystem, { cityName, mode });
  renderer3D.setQuality(graphics);
  launchCity(false);
});

document.getElementById('btn-load-menu').addEventListener('click', () => {
  if (SaveSystem.loadLocal(mapSystem, simulation)) launchCity(true);
  else alert('Збереженого міста поки немає.');
});

// Імпорт JSON з меню або з гри
[document.getElementById('input-import-menu'), document.getElementById('input-import-ingame')].forEach(inp => {
  inp.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) SaveSystem.importJSON(file, mapSystem, simulation, () => launchCity(true));
  });
});

// Теплові карти (Overlays)
document.querySelectorAll('.ov-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ov-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderer3D.activeOverlay = btn.dataset.overlay;
    renderer3D.renderedVersion = -1;
  });
});

// Швидкість симуляції
document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    simSpeed = parseInt(btn.dataset.speed, 10);
  });
});

// Undo / Redo
document.getElementById('btn-undo').addEventListener('click', () => {
  if (mapSystem.undo()) audio.playTone(240, 0.08);
});
document.getElementById('btn-redo').addEventListener('click', () => {
  if (mapSystem.redo()) audio.playTone(300, 0.08);
});

// Мобільна шухляда будівництва
document.getElementById('btn-toggle-drawer').addEventListener('click', () => {
  document.getElementById('build-drawer').classList.toggle('open');
});
document.getElementById('btn-close-inspector').addEventListener('click', () => {
  selectedCell = null;
  document.getElementById('inspector-content').innerHTML = '<p class="muted">Виберіть ділянку на карті.</p>';
});

// Звук
document.getElementById('btn-audio-toggle').addEventListener('click', (e) => {
  const on = audio.toggle();
  e.target.textContent = on ? '🔊' : '🔇';
});

// Спецрежими камери: Центр, Прогулянка від 1-ї особи, Фоторежим
document.getElementById('btn-cam-reset').addEventListener('click', () => {
  exitSpecialCameraModes();
  renderer3D.resetCamera();
});

document.getElementById('btn-walk-mode').addEventListener('click', () => {
  renderer3D.walkMode = true;
  renderer3D.followCitizen = null;
  renderer3D.walkPos.set(renderer3D.camTarget.x, 1.35, renderer3D.camTarget.z);
  renderer3D.updateCameraTransform();
  showModeBanner('🚶 Прогулянка вулицями міста (WASD + Поворот екрана)');
});

document.getElementById('btn-photo-mode').addEventListener('click', () => {
  photoMode = true;
  document.getElementById('game-hud').classList.add('hidden');
  showModeBanner('📷 Фоторежим — милуйтеся вашим містом');
});

function showModeBanner(text) {
  document.getElementById('mode-banner-text').textContent = text;
  document.getElementById('mode-banner').classList.remove('hidden');
}

function exitSpecialCameraModes() {
  renderer3D.walkMode = false;
  renderer3D.followCitizen = null;
  if (photoMode) {
    photoMode = false;
    document.getElementById('game-hud').classList.remove('hidden');
  }
  document.getElementById('mode-banner').classList.add('hidden');
  renderer3D.updateCameraTransform();
}

document.getElementById('btn-exit-special-mode').addEventListener('click', exitSpecialCameraModes);

// Модальні вікна (Економіка, Міська рада, Транспорт, Статистика, Налаштування)
document.querySelectorAll('[data-modal]').forEach(el => {
  el.addEventListener('click', () => {
    const id = el.dataset.modal;
    document.getElementById(id).classList.remove('hidden');
    if (id === 'modal-economy') renderEconomyModal();
    if (id === 'modal-council') renderCouncilModal();
    if (id === 'modal-transit') renderTransitModal();
    if (id === 'modal-stats') renderStatsModal();
  });
});

document.querySelectorAll('.close-modal').forEach(btn => {
  btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.add('hidden'));
});

function renderEconomyModal() {
  const l = simulation.ledger;
  document.getElementById('finance-ledger').innerHTML = `
    <p class="pos">+ Податки мешканців і бізнесу: <strong>$${l.taxIncome}</strong>/день</p>
    <p class="pos">+ Громадський транспорт: <strong>$${l.transitIncome}</strong>/день</p>
    <p class="pos">+ Експорт ресурсів і туризм: <strong>$${l.exportIncome}</strong>/день</p>
    <hr style="border-color:rgba(148,163,184,0.2); margin:5px 0;"/>
    <p class="neg">- Утримання доріг і служб: <strong>$${l.upkeepCost}</strong>/день</p>
    <p class="neg">- Міські постанови: <strong>$${l.ordinanceCost}</strong>/день</p>
    <p class="neg">- Відсотки за кредитом: <strong>$${l.loanInterest}</strong>/день</p>
  `;
  document.getElementById('loan-status').textContent = simulation.loanDebt > 0
    ? `Поточний борг: $${simulation.loanDebt.toLocaleString('uk-UA')}`
    : 'Активних кредитів немає.';
}

['res', 'com', 'ind'].forEach(type => {
  const slider = document.getElementById(`slider-tax-${type}`);
  slider.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    document.getElementById(`val-tax-${type}`).textContent = `${val}%`;
    if (type === 'res') simulation.taxRes = val;
    if (type === 'com') simulation.taxCom = val;
    if (type === 'ind') simulation.taxInd = val;
  });
});

document.getElementById('slider-fund-util').addEventListener('input', e => {
  simulation.fundUtil = parseInt(e.target.value, 10);
  document.getElementById('val-fund-util').textContent = `${simulation.fundUtil}%`;
});
document.getElementById('slider-fund-serv').addEventListener('input', e => {
  simulation.fundServ = parseInt(e.target.value, 10);
  document.getElementById('val-fund-serv').textContent = `${simulation.fundServ}%`;
});
document.getElementById('btn-take-loan').addEventListener('click', () => {
  if (simulation.takeLoan()) renderEconomyModal();
});
document.getElementById('btn-repay-loan').addEventListener('click', () => {
  if (simulation.repayLoan()) renderEconomyModal();
});

function renderCouncilModal() {
  const container = document.getElementById('ordinances-list');
  container.innerHTML = ORDINANCES.map(o => {
    const active = simulation.activeOrdinances.has(o.id);
    return `
      <div class="ord-card ${active ? 'enabled' : ''}">
        <strong>${o.title}</strong>
        <span class="muted" style="font-size:11.5px;">${o.desc}</span>
        <button class="${active ? 'btn-primary' : 'btn-secondary'}" data-ord="${o.id}">
          ${active ? '✅ Діє (Скасувати)' : `Ухвалити ($${o.dailyCost}/день)`}
        </button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-ord]').forEach(btn => {
    btn.addEventListener('click', () => {
      simulation.toggleOrdinance(btn.dataset.ord);
      renderCouncilModal();
    });
  });
}

function renderTransitModal() {
  let stops = 0;
  for (let x = 0; x < mapSystem.size; x++) {
    for (let z = 0; z < mapSystem.size; z++) {
      if (mapSystem.grid[x][z].busStop) stops++;
    }
  }
  const buses = trafficSystem.vehicles.filter(v => v.kind === 'BUS').length;
  document.getElementById('transit-summary').innerHTML = `
    <p>🚏 Встановлено зупинок: <strong>${stops}</strong></p>
    <p>🚌 Автобусів на лінії: <strong>${buses}</strong></p>
    <p>💵 Щоденний дохід від квитків: <strong>$${simulation.ledger.transitIncome}</strong></p>
  `;
}

document.getElementById('slider-ticket-price').addEventListener('input', e => {
  simulation.ticketPrice = parseInt(e.target.value, 10);
  document.getElementById('val-ticket-price').textContent = `$${simulation.ticketPrice}`;
});

function renderStatsModal() {
  const c = document.getElementById('stats-chart');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  const pops = simulation.history.pop;
  const maxPop = Math.max(10, ...pops);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  pops.forEach((p, idx) => {
    const x = (idx / Math.max(1, pops.length - 1)) * (c.width - 20) + 10;
    const y = c.height - 15 - (p / maxPop) * (c.height - 30);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  document.getElementById('demographics-box').innerHTML = `
    <p>👥 Населення: <strong>${simulation.population}</strong> | Стан: <strong>${getCityStage(simulation.population)}</strong></p>
    <p>😊 Індекс якості життя: <strong>${simulation.happiness}%</strong></p>
  `;

  document.getElementById('achievements-list').innerHTML = ACHIEVEMENTS_DEF.map(a => {
    const unlocked = simulation.unlockedAchievements.has(a.id);
    return `<li class="${unlocked ? 'unlocked' : ''}">${unlocked ? '🏆' : '🔒'} <strong>${a.title}</strong> — ${a.desc}</li>`;
  }).join('');
}

// Збереження / Налаштування
document.getElementById('runtime-graphics').addEventListener('change', e => renderer3D.setQuality(e.target.value));
document.getElementById('btn-quick-save').addEventListener('click', () => {
  SaveSystem.saveLocal(mapSystem, simulation);
  simulation.logEvent('💾 Швидке збереження виконано.');
  updateHUD();
});
document.getElementById('btn-save-slot1').addEventListener('click', () => {
  SaveSystem.saveLocal(mapSystem, simulation);
  alert('Місто збережено у Слот 1!');
});
document.getElementById('btn-load-slot1').addEventListener('click', () => {
  if (SaveSystem.loadLocal(mapSystem, simulation)) launchCity(true);
});
document.getElementById('btn-export-json').addEventListener('click', () => SaveSystem.exportJSON(mapSystem, simulation));
document.getElementById('btn-back-menu').addEventListener('click', () => {
  document.getElementById('modal-settings').classList.add('hidden');
  document.getElementById('game-hud').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
});

// УНІВЕРСАЛЬНЕ КЕРУВАННЯ МИШЕЮ (ПК) + МУЛЬТИТАЧ (СМАРТФОНИ / ПЛАНШЕТИ)
canvas.addEventListener('contextmenu', e => e.preventDefault());

let isRightDragging = false;
let isLeftPainting = false;
let prevMouse = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return; // Touch обробляється окремо нижче
  prevMouse = { x: e.clientX, y: e.clientY };
  if (e.button === 2) isRightDragging = true;
  else if (e.button === 0) {
    isLeftPainting = true;
    handleTileAction(hoveredCell);
  }
});

window.addEventListener('pointerup', () => {
  isRightDragging = false;
  isLeftPainting = false;
});

canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  if (isRightDragging) {
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    if (renderer3D.walkMode) {
      renderer3D.walkYaw -= dx * 0.006;
    } else {
      renderer3D.camYaw -= dx * 0.007;
      renderer3D.camPitch = Math.max(0.25, Math.min(1.35, renderer3D.camPitch - dy * 0.007));
    }
    renderer3D.updateCameraTransform();
  }
  prevMouse = { x: e.clientX, y: e.clientY };

  updateRay(e.clientX, e.clientY);
  if (isLeftPainting && hoveredCell && (activeTool.startsWith('ROAD') || activeTool.startsWith('ZONE_') || activeTool === 'BULLDOZE')) {
    handleTileAction(hoveredCell);
  }
});

canvas.addEventListener('wheel', e => {
  renderer3D.camDistance = Math.max(7, Math.min(95, renderer3D.camDistance + e.deltaY * 0.025));
  renderer3D.updateCameraTransform();
}, { passive: true });

// Touch-жести для мобільних телефонів (1 палець: дія, 2 пальці: зум + орбіта + переміщення)
let touchState = { count: 0, dist: 0, midX: 0, midY: 0, moved: false };

canvas.addEventListener('touchstart', e => {
  touchState.count = e.touches.length;
  touchState.moved = false;
  if (e.touches.length === 1) {
    touchState.midX = e.touches[0].clientX;
    touchState.midY = e.touches[0].clientY;
    updateRay(touchState.midX, touchState.midY);
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    touchState.dist = Math.hypot(dx, dy);
    touchState.midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    touchState.midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1 && touchState.count === 1) {
    const tx = e.touches[0].clientX;
    const ty = e.touches[0].clientY;
    if (Math.hypot(tx - touchState.midX, ty - touchState.midY) > 10) touchState.moved = true;

    updateRay(tx, ty);
    if (touchState.moved && hoveredCell && (activeTool.startsWith('ROAD') || activeTool.startsWith('ZONE_') || activeTool === 'BULLDOZE')) {
      handleTileAction(hoveredCell);
    }
  } else if (e.touches.length === 2) {
    touchState.moved = true;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const newDist = Math.hypot(dx, dy);
    const newMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const newMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

    // Зум щипком
    const zoomDelta = (touchState.dist - newDist) * 0.08;
    renderer3D.camDistance = Math.max(7, Math.min(95, renderer3D.camDistance + zoomDelta));

    // Обертання та панорамування двома пальцями
    const panX = (newMidX - touchState.midX) * 0.045;
    const panZ = (newMidY - touchState.midY) * 0.045;
    const forward = new THREE.Vector3(-Math.sin(renderer3D.camYaw), 0, -Math.cos(renderer3D.camYaw));
    const right = new THREE.Vector3(Math.cos(renderer3D.camYaw), 0, -Math.sin(renderer3D.camYaw));
    renderer3D.camTarget.addScaledVector(right, -panX);
    renderer3D.camTarget.addScaledVector(forward, panZ);

    touchState.dist = newDist;
    touchState.midX = newMidX;
    touchState.midY = newMidY;
    renderer3D.updateCameraTransform();
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (!touchState.moved && touchState.count === 1 && e.changedTouches.length === 1) {
    updateRay(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    handleTileAction(hoveredCell);
  }
});

window.addEventListener('keydown', e => {
  keysPressed[e.code] = true;
  if (e.ctrlKey && e.code === 'KeyZ') mapSystem.undo();
  if (e.ctrlKey && e.code === 'KeyY') mapSystem.redo();
  if (e.code === 'Escape') exitSpecialCameraModes();
});
window.addEventListener('keyup', e => { keysPressed[e.code] = false; });

function updateRay(clientX, clientY) {
  mouseNDC.x = (clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, renderer3D.camera);
  const hits = raycaster.intersectObjects(renderer3D.tileMeshes);
  if (hits.length > 0) {
    const { cellX, cellZ } = hits[0].object.userData;
    hoveredCell = mapSystem.getCell(cellX, cellZ);
    const toolCfg = TOOLS[activeTool];
    const valid = mapSystem.canApplyTool(cellX, cellZ, activeTool) && simulation.canAfford(toolCfg?.cost || 0);
    renderer3D.setCursor(hoveredCell, valid);
  } else {
    hoveredCell = null;
    renderer3D.setCursor(null, false);
  }
}

function handleTileAction(cell) {
  if (!cell) return;

  if (activeTool === 'SELECT') {
    selectedCell = cell;
    renderInspector(cell);
    return;
  }

  const toolCfg = TOOLS[activeTool];
  const cost = toolCfg ? toolCfg.cost : 0;

  if (!mapSystem.canApplyTool(cell.x, cell.z, activeTool)) return;
  if (!simulation.canAfford(cost)) {
    simulation.logEvent('❌ Недостатньо коштів у бюджеті!');
    updateHUD();
    return;
  }

  if (mapSystem.applyTool(cell.x, cell.z, activeTool)) {
    simulation.spend(cost);
    if (activeTool === 'BULLDOZE') audio.playBulldoze();
    else audio.playBuild();
    selectedCell = cell;
    renderInspector(cell);
    updateHUD();
  }
}

function renderInspector(cell) {
  const el = document.getElementById('inspector-content');
  if (!cell) return;

  let title = 'Вільна земля';
  if (cell.height <= 0) title = 'Водойма';
  else if (cell.roadType) title = `${TOOLS[cell.roadType]?.name || 'Дорога'}${cell.busStop ? ' + 🚏 Зупинка' : ''}`;
  else if (cell.building) {
    const names = {
      RES: `Житловий будинок (Рівень ${cell.level})`,
      COM: `Комерційний об'єкт (Рівень ${cell.level})`,
      IND: `Промисловий завод (Рівень ${cell.level})`,
      AGRI: `Фермерське господарство (Рівень ${cell.level})`,
      TECH: `IT-Технопарк (Рівень ${cell.level})`
    };
    title = names[cell.building] || TOOLS[cell.building]?.name || cell.building;
  } else if (cell.zone) title = `Розмічена зона (${cell.zone})`;
  else if (cell.hasTree) title = 'Лісовий масив';

  let html = `
    <p><strong>Сектор:</strong> [${cell.x}, ${cell.z}] | Висота: ${cell.height} м</p>
    <p><strong>Об'єкт:</strong> ${title}</p>
    <p><strong>Вартість землі:</strong> ${cell.landValue}/100 | <strong>Екологія:</strong> ${100 - cell.pollution}%</p>
  `;

  if (cell.resource) {
    html += `<p><strong>Природний ресурс:</strong> ${cell.resource === 'ORE' ? '⛏️ Поклади руди' : '🌾 Родючий чорнозем'}</p>`;
  }

  if (cell.building) {
    html += `
      <p><strong>Мережі:</strong> ${cell.hasPower ? '⚡' : '❌'} Світло | ${cell.hasWater ? '💧' : '❌'} Вода | ${cell.hasHeat ? '🔥' : '❄️'} Тепло</p>
    `;
    if (cell.residents && cell.residents.length > 0) {
      html += `<p style="margin-top:6px;"><strong>Мешканці (${cell.residents.length}):</strong></p>`;
      cell.residents.forEach((r, idx) => {
        html += `
          <div class="citizen-card">
            <div>
              <strong>${r.name}</strong> (${r.age} р., ${r.education})<br/>
              ${r.profession} • $${r.salary}/міс
            </div>
            <button class="btn-mini follow-btn" data-res-idx="${idx}" title="Стежити камерою">👁️</button>
          </div>
        `;
      });
    }
  }

  el.innerHTML = html;

  el.querySelectorAll('.follow-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const citizen = cell.residents[parseInt(btn.dataset.resIdx, 10)];
      if (citizen) {
        renderer3D.walkMode = false;
        renderer3D.followCitizen = citizen;
        renderer3D.updateCameraTransform();
        showModeBanner(`👁️ Спостереження за мешканцем: ${citizen.name}`);
      }
    });
  });
}

function updateHUD() {
  document.getElementById('hud-city-name').textContent = simulation.cityName;
  document.getElementById('hud-stage').textContent = getCityStage(simulation.population);
  document.getElementById('hud-date').textContent =
    `${String(simulation.day).padStart(2, '0')}.${String(simulation.month).padStart(2, '0')}.${simulation.year}`;

  const hrs = Math.floor(simulation.hour);
  const mins = Math.floor((simulation.hour - hrs) * 60);
  document.getElementById('hud-time').textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

  const seasonNames = { SPRING: '🌱 Весна', SUMMER: '☀️ Літо', AUTUMN: '🍂 Осінь', WINTER: '❄️ Зима' };
  const weatherIcons = { CLEAR: '☀️', RAIN: '🌧️', SNOW: '🌨️' };
  document.getElementById('hud-season').textContent = seasonNames[simulation.season];
  document.getElementById('hud-weather').textContent = `${weatherIcons[simulation.weather]} ${simulation.temperature > 0 ? '+' : ''}${simulation.temperature}°C`;

  document.getElementById('rci-res').style.height = `${simulation.rci.res}%`;
  document.getElementById('rci-com').style.height = `${simulation.rci.com}%`;
  document.getElementById('rci-ind').style.height = `${simulation.rci.ind}%`;

  document.getElementById('hud-pop').textContent = simulation.population.toLocaleString('uk-UA');
  document.getElementById('hud-budget').textContent = simulation.sandbox ? '∞' : Math.round(simulation.budget).toLocaleString('uk-UA');

  const netEl = document.getElementById('hud-net');
  const net = simulation.lastDailyNet;
  netEl.textContent = `(${net >= 0 ? '+' : ''}$${net})`;
  netEl.className = net >= 0 ? 'pos' : 'neg';

  document.getElementById('hud-power').textContent = `${simulation.powerConsumed}/${simulation.powerProduced}`;
  document.getElementById('hud-water').textContent = `${simulation.waterConsumed}/${simulation.waterProduced}`;
  document.getElementById('hud-heat').textContent = `${simulation.heatConsumed}/${simulation.heatProduced}`;
  document.getElementById('hud-happiness').textContent = simulation.happiness;

  const alertsEl = document.getElementById('alerts-list');
  alertsEl.innerHTML = simulation.alerts.length === 0
    ? '<li class="ok">Усі муніципальні системи працюють штатно.</li>'
    : simulation.alerts.map(a => `<li>${a}</li>`).join('');

  const eventsEl = document.getElementById('events-list');
  eventsEl.innerHTML = simulation.events.slice(0, 10).map(ev => `<li>${ev}</li>`).join('');
}

// Головний цикл 60 FPS
let lastTime = performance.now();
let hudTimer = 0;

function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  // Рух камери (WASD / Стрілки) — працює як в огляді, так і в режимі прогулянки від першої особи
  const moveSpeed = (renderer3D.walkMode ? 9 : 24) * dt;
  const yaw = renderer3D.walkMode ? renderer3D.walkYaw : renderer3D.camYaw;
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const targetVec = renderer3D.walkMode ? renderer3D.walkPos : renderer3D.camTarget;

  if (keysPressed['KeyW'] || keysPressed['ArrowUp']) targetVec.addScaledVector(forward, moveSpeed);
  if (keysPressed['KeyS'] || keysPressed['ArrowDown']) targetVec.addScaledVector(forward, -moveSpeed);
  if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) targetVec.addScaledVector(right, -moveSpeed);
  if (keysPressed['KeyD'] || keysPressed['ArrowRight']) targetVec.addScaledVector(right, moveSpeed);
  renderer3D.updateCameraTransform();

  simulation.update(dt, simSpeed);
  trafficSystem.update(dt, simSpeed, simulation.population, renderer3D.quality === 'low');
  renderer3D.render(dt, simulation);
  audio.updateAmbient(renderer3D.camDistance, simulation.population, simulation.weather !== 'CLEAR');

  hudTimer += dt;
  if (hudTimer >= 0.3) {
    hudTimer = 0;
    updateHUD();
  }
}

renderer3D.render(0.016, simulation);
requestAnimationFrame(gameLoop);