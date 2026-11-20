import { TOOLS, ORDINANCES, ACHIEVEMENTS_DEF, FIRST_NAMES, LAST_NAMES, PROFESSIONS } from './config.js';

export class CitySimulation {
  constructor(mapSystem, options = {}) {
    this.map = mapSystem;
    this.cityName = options.cityName || 'Новий Київ';
    this.mode = options.mode || 'career';
    this.sandbox = this.mode === 'sandbox';

    this.budget = this.mode === 'hard' ? 25000 : 65000;
    this.loanDebt = 0;
    this.lastDailyNet = 0;

    // Окремі податкові ставки та фінансування
    this.taxRes = 10;
    this.taxCom = 11;
    this.taxInd = 12;
    this.fundUtil = 100;
    this.fundServ = 100;
    this.ticketPrice = 2;

    // Показники RCI (0..100)
    this.rci = { res: 75, com: 45, ind: 55 };

    // Комунікації
    this.population = 0;
    this.happiness = 100;
    this.powerProduced = 0;
    this.powerConsumed = 0;
    this.waterProduced = 0;
    this.waterConsumed = 0;
    this.heatProduced = 0;
    this.heatConsumed = 0;

    // Календар, сезони та погода
    this.day = 1;
    this.month = 3; // Березень (Весна)
    this.year = 2026;
    this.hour = 8.0;
    this.season = 'SPRING'; // 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER'
    this.weather = 'CLEAR'; // 'CLEAR' | 'RAIN' | 'SNOW'
    this.temperature = 16;

    // Постанови міської ради та досягнення
    this.activeOrdinances = new Set();
    this.unlockedAchievements = new Set();

    // Історія для графіків
    this.history = {
      pop: [0],
      budget: [this.budget]
    };

    this.ledger = {
      taxIncome: 0,
      transitIncome: 0,
      exportIncome: 0,
      upkeepCost: 0,
      ordinanceCost: 0,
      loanInterest: 0
    };

    this.alerts = [];
    this.events = [];
    this.onAlertCallback = null;
    this.logEvent(`Муніципалітет «${this.cityName}» засновано! Прокладіть дорогу та розмітьте перші зони.`);
  }

  logEvent(text) {
    const d = `${String(this.day).padStart(2, '0')}.${String(this.month).padStart(2, '0')}`;
    this.events.unshift(`[${d}] ${text}`);
    if (this.events.length > 30) this.events.pop();
  }

  canAfford(cost) {
    return this.sandbox || this.budget >= cost;
  }

  spend(cost) {
    if (this.sandbox) return true;
    if (this.budget < cost) return false;
    this.budget -= cost;
    return true;
  }

  takeLoan() {
    if (this.loanDebt >= 100000) return false;
    this.loanDebt += 25000;
    this.budget += 25000;
    this.logEvent('🏦 Отримано муніципальний кредит $25 000 під 2% щоденних.');
    return true;
  }

  repayLoan() {
    if (this.loanDebt <= 0) return false;
    const pay = Math.min(this.loanDebt, 25000);
    if (!this.spend(pay)) return false;
    this.loanDebt -= pay;
    this.logEvent(`✅ Погашено $${pay.toLocaleString('uk-UA')} муніципального кредиту.`);
    return true;
  }

  toggleOrdinance(id) {
    if (this.activeOrdinances.has(id)) {
      this.activeOrdinances.delete(id);
      this.logEvent(`📜 Скасовано постанову міської ради.`);
    } else {
      this.activeOrdinances.add(id);
      const ord = ORDINANCES.find(o => o.id === id);
      this.logEvent(`🏛️ Ухвалено постанову: «${ord ? ord.title : id}».`);
    }
  }

  generateCitizen(x, z) {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const prof = PROFESSIONS[Math.floor(Math.random() * PROFESSIONS.length)];
    return {
      id: Math.random().toString(36).slice(2, 8),
      name: `${first} ${last}`,
      age: 18 + Math.floor(Math.random() * 48),
      profession: prof,
      education: Math.random() > 0.55 ? 'Вища' : 'Середня',
      salary: 900 + Math.floor(Math.random() * 1900),
      homeX: x,
      homeZ: z
    };
  }

  update(dt, speed) {
    if (speed === 0) return;
    const scaledDt = dt * speed;

    this.hour += scaledDt * 0.85;
    if (this.hour >= 24) {
      this.hour -= 24;
      this.advanceDay();
    }

    // Будівництво об'єктів по стадіях
    let mapChanged = false;
    for (let x = 0; x < this.map.size; x++) {
      for (let z = 0; z < this.map.size; z++) {
        const cell = this.map.grid[x][z];
        if (cell.building && cell.buildProgress < 100) {
          const prev = Math.floor(cell.buildProgress / 34);
          cell.buildProgress = Math.min(100, cell.buildProgress + scaledDt * 30);
          if (prev !== Math.floor(cell.buildProgress / 34) || cell.buildProgress === 100) {
            mapChanged = true;
          }
        }
      }
    }
    if (mapChanged) this.map.version++;
  }

  advanceDay() {
    this.day++;
    if (this.day > 30) {
      this.day = 1;
      this.month++;
      if (this.month > 12) {
        this.month = 1;
        this.year++;
      }
      this.updateSeason();
    }

    this.updateWeather();
    this.simulateSystems();
    this.checkAchievements();

    this.history.pop.push(this.population);
    this.history.budget.push(Math.round(this.budget));
    if (this.history.pop.length > 30) {
      this.history.pop.shift();
      this.history.budget.shift();
    }
  }

  updateSeason() {
    if (this.month >= 3 && this.month <= 5) this.season = 'SPRING';
    else if (this.month >= 6 && this.month <= 8) this.season = 'SUMMER';
    else if (this.month >= 9 && this.month <= 11) this.season = 'AUTUMN';
    else this.season = 'WINTER';
    this.map.version++; // Перефарбування землі та дерев під пору року
  }

  updateWeather() {
    const r = Math.random();
    if (this.season === 'WINTER') {
      this.weather = r < 0.42 ? 'SNOW' : 'CLEAR';
      this.temperature = this.weather === 'SNOW' ? -8 : -3;
    } else if (this.season === 'SUMMER') {
      this.weather = r < 0.18 ? 'RAIN' : 'CLEAR';
      this.temperature = this.weather === 'RAIN' ? 21 : 29;
    } else {
      this.weather = r < 0.3 ? 'RAIN' : 'CLEAR';
      this.temperature = this.season === 'SPRING' ? 15 : 11;
    }
  }

  simulateSystems() {
    const utilMult = this.fundUtil / 100;
    const servMult = this.fundServ / 100;
    const greenBonus = this.activeOrdinances.has('green_subsidy') ? 1.25 : 1.0;
    const smartGridMult = this.activeOrdinances.has('smart_grid') ? 0.85 : 1.0;

    let powerProd = 0, powerUse = 0;
    let waterProd = 0, waterUse = 0;
    let heatProd = 0, heatUse = 0;
    let totalUpkeep = 0;
    let serviceHappiness = 0;
    let exportIncome = 0;
    let busStopsCount = 0;

    const serviceSources = [];
    const pollutionSources = [];
    const buildingCells = [];
    const emptyZoneCells = [];

    // 1. Перший прохід: підрахунок ресурсів та збір джерел впливу
    for (let x = 0; x < this.map.size; x++) {
      for (let z = 0; z < this.map.size; z++) {
        const cell = this.map.grid[x][z];

        if (cell.roadType) {
          totalUpkeep += (TOOLS[cell.roadType]?.upkeep || 2) * utilMult;
          if (cell.busStop) {
            busStopsCount++;
            totalUpkeep += TOOLS.BUS_STOP.upkeep;
          }
        }

        if (cell.hasTree) {
          pollutionSources.push({ x, z, val: -4, rad: 4 });
        }

        if (cell.building) {
          buildingCells.push(cell);
          const cfg = TOOLS[cell.building];

          if (cfg) {
            totalUpkeep += (cfg.upkeep || 0) * (cfg.serviceType ? servMult : utilMult);
            if (cell.buildProgress >= 100) {
              let pOut = (cfg.powerOutput || 0) * utilMult;
              if (cell.building === 'SOLAR_PLANT') {
                pOut *= greenBonus * (this.weather === 'CLEAR' ? 1.0 : 0.45);
              }
              if (cell.building === 'WIND_TURBINE') {
                pOut *= greenBonus * (1 + Math.max(0, cell.height - 0.5) * 0.45);
              }

              powerProd += Math.round(pOut);
              waterProd += Math.round((cfg.waterOutput || 0) * utilMult);
              heatProd += Math.round((cfg.heatOutput || 0) * utilMult);

              powerUse += (cfg.powerUse || 0) * smartGridMult;
              waterUse += cfg.waterUse || 0;
              serviceHappiness += (cfg.happinessBonus || 0) * servMult;

              if (cfg.pollution) {
                pollutionSources.push({ x, z, val: cfg.pollution, rad: 7 });
              }
              if (cfg.serviceType) {
                serviceSources.push({ x, z, rad: cfg.radius || 10, bonus: 15 * servMult });
              }
              if (cell.building === 'MINE') {
                exportIncome += cell.resource === 'ORE' ? 240 : 110;
              }
              if (cell.building === 'WAREHOUSE') {
                exportIncome += 140;
              }
              if (cell.building === 'STADIUM') {
                exportIncome += 280;
              }
            }
          } else {
            // Зонові будівлі
            const lvl = cell.level || 1;
            const seasonPowerExtra = this.season === 'SUMMER' ? 1.25 : 1.0;
            powerUse += lvl * 4 * seasonPowerExtra * smartGridMult;
            waterUse += lvl * 3;
            if (this.season === 'WINTER') {
              heatUse += lvl * 5 * smartGridMult;
            }
            if (cell.building === 'IND') {
              pollutionSources.push({ x, z, val: lvl * 12, rad: 6 });
            }
          }
        } else if (cell.zone) {
          emptyZoneCells.push(cell);
        }
      }
    }

    // 2. Розрахунок теплових карт (Вартість землі, Екологія, Покриття служб)
    for (let x = 0; x < this.map.size; x++) {
      for (let z = 0; z < this.map.size; z++) {
        const cell = this.map.grid[x][z];
        let pol = 0;
        for (const src of pollutionSources) {
          const d = Math.hypot(x - src.x, z - src.z);
          if (d <= src.rad) pol += src.val * (1 - d / src.rad);
        }
        if (this.activeOrdinances.has('recycling_law')) pol *= 0.7;
        cell.pollution = Math.max(0, Math.min(100, Math.round(pol)));

        let srv = 0;
        for (const s of serviceSources) {
          const d = Math.hypot(x - s.x, z - s.z);
          if (d <= s.rad) srv += s.bonus * (1 - d / s.rad);
        }
        cell.serviceScore = Math.min(100, Math.round(srv));

        const waterProximity = cell.height > 0 && cell.height < 0.45 ? 18 : 0;
        cell.landValue = Math.max(10, Math.min(100, Math.round(45 + cell.serviceScore * 0.45 + waterProximity - cell.pollution * 0.5)));
      }
    }

    this.powerProduced = Math.round(powerProd);
    this.powerConsumed = Math.round(powerUse);
    this.waterProduced = Math.round(waterProd);
    this.waterConsumed = Math.round(waterUse);
    this.heatProduced = Math.round(heatProd);
    this.heatConsumed = Math.round(heatUse);

    const hasPower = this.powerProduced >= this.powerConsumed && this.powerProduced > 0;
    const hasWater = this.waterProduced >= this.waterConsumed && this.waterProduced > 0;
    const hasHeat = this.season !== 'WINTER' || (this.heatProduced >= this.heatConsumed && this.heatProduced > 0);

    for (const cell of buildingCells) {
      cell.hasPower = hasPower;
      cell.hasWater = hasWater;
      cell.hasHeat = hasHeat;

      // Пожежі та робота пожежних депо
      if (cell.onFire) {
        const fireProtected = serviceSources.some(s => Math.hypot(cell.x - s.x, cell.z - s.z) <= s.rad);
        if (fireProtected) {
          cell.onFire = false;
          this.logEvent(`🚒 Пожежники успішно загасили займання у секторі [${cell.x}, ${cell.z}]!`);
          this.map.version++;
        } else {
          cell.fireHealth -= 35;
          if (cell.fireHealth <= 0) {
            cell.building = null;
            cell.onFire = false;
            cell.residents = [];
            this.logEvent(`🔥 Будівля у секторі [${cell.x}, ${cell.z}] згоріла через відсутність пожежного депо!`);
            this.map.version++;
          }
        }
      }
    }

    // Випадковий ризик пожежі (раз на кілька днів у великому місті)
    if (buildingCells.length > 6 && Math.random() < 0.08) {
      const target = buildingCells[Math.floor(Math.random() * buildingCells.length)];
      if (!target.onFire && target.buildProgress >= 100) {
        target.onFire = true;
        target.fireHealth = 100;
        this.logEvent(`🚨 УВАГА! Пожежа на об'єкті [${target.x}, ${target.z}]!`);
        if (this.onAlertCallback) this.onAlertCallback();
        this.map.version++;
      }
    }

    // 3. Забудова розмічених зон за попитом RCI
    for (const cell of emptyZoneCells) {
      if (this.map.hasRoadAccess(cell.x, cell.z) && hasPower && hasWater && Math.random() < 0.38) {
        cell.building = cell.zone;
        cell.level = 1;
        cell.buildProgress = 0;
        if (cell.zone === 'RES') {
          for (let i = 0; i < 4; i++) cell.residents.push(this.generateCitizen(cell.x, cell.z));
        } else {
          cell.jobs = 10;
        }
        this.map.version++;
      }
    }

    // 4. Розвиток будівель, населення та податки
    let pop = 0;
    let totalJobs = 0;
    let taxIncome = 0;

    for (const cell of buildingCells) {
      if (cell.buildProgress < 100) continue;

      if (cell.building === 'RES') {
        const maxPop = cell.level * 6;
        if (cell.hasPower && cell.hasWater && cell.hasHeat && this.happiness >= 60) {
          if (cell.residents.length < maxPop && Math.random() < 0.55) {
            cell.residents.push(this.generateCitizen(cell.x, cell.z));
          }
          if (cell.level < 3 && cell.residents.length >= maxPop && cell.landValue >= 55 && Math.random() < 0.15) {
            cell.level++;
            this.map.version++;
          }
        } else if ((!cell.hasPower || !cell.hasWater || !cell.hasHeat) && cell.residents.length > 0) {
          cell.residents.pop();
        }
        pop += cell.residents.length;
        taxIncome += cell.residents.length * (this.taxRes * 1.45);
      } else if (['COM', 'IND', 'AGRI', 'TECH'].includes(cell.building)) {
        if (cell.hasPower && cell.hasWater && pop > 0) {
          const rate = cell.building === 'COM' || cell.building === 'TECH' ? this.taxCom : this.taxInd;
          const bonus = cell.building === 'AGRI' && cell.resource === 'FERTILE' ? 1.4 : cell.building === 'TECH' ? 1.8 : 1.0;
          taxIncome += cell.level * (rate * 4.8 * bonus);
          totalJobs += cell.level * 10;
          if (cell.level < 3 && pop > cell.level * 45 && Math.random() < 0.12) {
            cell.level++;
            this.map.version++;
          }
        }
      }
    }

    this.population = pop;

    // 5. Оновлення індикаторів попиту RCI
    this.rci.res = Math.max(10, Math.min(100, Math.round(70 + (totalJobs - pop * 0.6) * 0.8 - (this.taxRes - 10) * 4)));
    this.rci.com = Math.max(10, Math.min(100, Math.round(35 + pop * 0.25 - (this.taxCom - 11) * 4)));
    this.rci.ind = Math.max(10, Math.min(100, Math.round(45 + (pop * 0.6 - totalJobs) * 0.9 - (this.taxInd - 12) * 4)));

    // 6. Щастя та рейтинг мера
    let hap = 74;
    if (!hasPower) hap -= 25;
    if (!hasWater) hap -= 25;
    if (!hasHeat) hap -= 20;
    if (this.taxRes > 13) hap -= (this.taxRes - 13) * 2.5;
    if (this.activeOrdinances.has('free_transit')) hap += 8;
    if (this.activeOrdinances.has('no_heavy_trucks')) hap += 6;
    if (busStopsCount >= 2) hap += 5;
    hap += Math.min(25, serviceHappiness);
    this.happiness = Math.max(0, Math.min(100, Math.round(hap)));

    // 7. Фінансовий звіт
    const transitIncome = this.activeOrdinances.has('free_transit') ? 0 : Math.min(pop, busStopsCount * 25) * this.ticketPrice;
    let ordinanceCost = 0;
    for (const id of this.activeOrdinances) {
      const ord = ORDINANCES.find(o => o.id === id);
      if (ord) ordinanceCost += ord.dailyCost;
    }
    const loanInterest = Math.round(this.loanDebt * 0.02);

    this.ledger = {
      taxIncome: Math.round(taxIncome),
      transitIncome: Math.round(transitIncome),
      exportIncome: Math.round(exportIncome),
      upkeepCost: Math.round(totalUpkeep),
      ordinanceCost: Math.round(ordinanceCost),
      loanInterest
    };

    const net = this.ledger.taxIncome + this.ledger.transitIncome + this.ledger.exportIncome
      - this.ledger.upkeepCost - this.ledger.ordinanceCost - this.ledger.loanInterest;
    this.lastDailyNet = net;
    if (!this.sandbox) this.budget += net;

    // 8. Актуальні попередження диспетчерської
    this.alerts = [];
    const activeFires = buildingCells.filter(c => c.onFire);
    if (activeFires.length > 0) this.alerts.push(`🔥 Активна пожежа (${activeFires.length})! Збудуйте Пожежне депо.`);
    if (!hasPower) this.alerts.push('⚡ Дефіцит електроенергії! Збудуйте ТЕС, СЕС або вітряк.');
    if (!hasWater) this.alerts.push('💧 Нестача питної води! Збудуйте водонапірну башту.');
    if (!hasHeat) this.alerts.push('🥶 Зима без опалення! Збудуйте міську ТЕЦ.');
    if (!this.sandbox && this.budget < 0) this.alerts.push('📉 Дефіцит бюджету! Візьміть кредит або підніміть податки.');
  }

  checkAchievements() {
    const unlock = (id) => {
      if (!this.unlockedAchievements.has(id)) {
        this.unlockedAchievements.add(id);
        const def = ACHIEVEMENTS_DEF.find(a => a.id === id);
        if (def) this.logEvent(`🏆 Досягнення відкрито: «${def.title}»!`);
      }
    };

    if (this.population >= 50) unlock('pop_50');
    if (this.population >= 250) unlock('pop_250');
    if (this.population >= 1000) unlock('pop_1000');
    if (this.budget >= 100000) unlock('budget_100k');

    let stops = 0;
    for (let x = 0; x < this.map.size; x++) {
      for (let z = 0; z < this.map.size; z++) {
        const c = this.map.grid[x][z];
        if (c.busStop) stops++;
        if (c.building === 'SOLAR_PLANT' || c.building === 'WIND_TURBINE') unlock('green_city');
        if (c.building === 'UNIVERSITY') unlock('edu_hub');
      }
    }
    if (stops >= 2) unlock('transit_line');
  }

  serialize() {
    return {
      cityName: this.cityName,
      mode: this.mode,
      sandbox: this.sandbox,
      budget: this.budget,
      loanDebt: this.loanDebt,
      lastDailyNet: this.lastDailyNet,
      taxRes: this.taxRes,
      taxCom: this.taxCom,
      taxInd: this.taxInd,
      fundUtil: this.fundUtil,
      fundServ: this.fundServ,
      ticketPrice: this.ticketPrice,
      population: this.population,
      happiness: this.happiness,
      day: this.day,
      month: this.month,
      year: this.year,
      hour: this.hour,
      season: this.season,
      weather: this.weather,
      temperature: this.temperature,
      activeOrdinances: [...this.activeOrdinances],
      unlockedAchievements: [...this.unlockedAchievements],
      history: this.history,
      events: this.events
    };
  }

  deserialize(data) {
    Object.assign(this, data);
    this.activeOrdinances = new Set(data.activeOrdinances || []);
    this.unlockedAchievements = new Set(data.unlockedAchievements || []);
  }
}