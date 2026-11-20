export const TILE_SIZE = 2;

export const TOOLS = {
  // Загальні
  SELECT: { id: 'SELECT', cat: 'general', name: '🔍 Інспектор GIS', cost: 0, desc: 'Перегляд мешканців, бюджету та мереж об’єкта' },
  BULLDOZE: { id: 'BULLDOZE', cat: 'general', name: '🚜 Знесення', cost: 15, desc: 'Демонтаж будівель, доріг або вирубка лісу' },
  UPGRADE_ROAD: { id: 'UPGRADE_ROAD', cat: 'general', name: '⬆️ Модернізація дороги', cost: 80, desc: 'Розширити ґрунтову дорогу до шосе чи проспекту' },

  // Дороги та транспорт
  ROAD_DIRT: { id: 'ROAD_DIRT', cat: 'roads', name: '🛤️ Ґрунтова дорога', cost: 25, upkeep: 1, lanes: 1, speedMult: 0.7, desc: 'Дешева дорога для сіл і ферм' },
  ROAD: { id: 'ROAD', cat: 'roads', name: '🛣️ Міська вулиця (2 смуги)', cost: 50, upkeep: 2, lanes: 2, speedMult: 1.0, desc: 'Базова асфальтова дорога з освітленням' },
  ROAD_AVENUE: { id: 'ROAD_AVENUE', cat: 'roads', name: '🏙️ Проспект (4 смуги)', cost: 120, upkeep: 5, lanes: 4, speedMult: 1.35, desc: 'Висока пропускна здатність для центру' },
  BUS_STOP: { id: 'BUS_STOP', cat: 'roads', name: '🚏 Автобусна зупинка', cost: 150, upkeep: 6, desc: 'Встановлюється на дорозі; запускає автобусний маршрут' },
  METRO_STATION: { id: 'METRO_STATION', cat: 'roads', name: '🚇 Станція метро', cost: 2500, upkeep: 60, powerUse: 25, happinessBonus: 12, desc: 'Швидкий підземний транспорт, різко знижує затори' },

  // Зонування
  ZONE_RES: { id: 'ZONE_RES', cat: 'zones', name: '🏠 Житлова зона (R)', cost: 20, desc: 'Приватні будинки, ЖК та хмарочоси' },
  ZONE_COM: { id: 'ZONE_COM', cat: 'zones', name: '🏪 Комерційна зона (C)', cost: 30, desc: 'Магазини, супермаркети, ресторани, офіси' },
  ZONE_IND: { id: 'ZONE_IND', cat: 'zones', name: '🏭 Промислова зона (I)', cost: 40, desc: 'Заводи, склади, виробництво товарів' },
  ZONE_AGRI: { id: 'ZONE_AGRI', cat: 'zones', name: '🌾 Аграрна зона', cost: 25, desc: 'Ферми та теплиці (краще на родючих землях)' },
  ZONE_TECH: { id: 'ZONE_TECH', cat: 'zones', name: '💻 IT / Технопарк', cost: 60, desc: 'Високоприбуткові офіси без забруднення (потрібен ВНЗ)' },

  // Енергетика, вода, тепло
  POWER_PLANT: { id: 'POWER_PLANT', cat: 'utilities', name: '🏭 ТЕС (Вугільна)', cost: 1400, upkeep: 45, powerOutput: 130, waterUse: 15, pollution: 32, desc: 'Потужна генерація, але забруднює повітря' },
  SOLAR_PLANT: { id: 'SOLAR_PLANT', cat: 'utilities', name: '☀️ Сонячна станція', cost: 1800, upkeep: 25, powerOutput: 85, pollution: 0, desc: 'Екологічна енергія (залежить від сонця та погоди)' },
  WIND_TURBINE: { id: 'WIND_TURBINE', cat: 'utilities', name: '🌬️ Вітрогенератор', cost: 900, upkeep: 15, powerOutput: 45, pollution: 0, desc: 'Ефективніший на пагорбах і височинах' },
  WATER_TOWER: { id: 'WATER_TOWER', cat: 'utilities', name: '💧 Водонапірна башта', cost: 800, upkeep: 20, waterOutput: 130, powerUse: 10, desc: 'Забезпечує місто питною водою' },
  HEATING_PLANT: { id: 'HEATING_PLANT', cat: 'utilities', name: '🔥 Міська ТЕЦ (Опалення)', cost: 1300, upkeep: 35, heatOutput: 140, powerUse: 12, pollution: 14, desc: 'Критично важлива взимку для обігріву будинків' },
  RECYCLING: { id: 'RECYCLING', cat: 'utilities', name: '♻️ Сміттєпереробний завод', cost: 1600, upkeep: 35, powerUse: 15, pollution: -20, desc: 'Переробляє відходи та очищує екологію' },

  // Міські служби, освіта, медицина, культура
  FIRE_STATION: { id: 'FIRE_STATION', cat: 'services', name: '🚒 Пожежне депо', cost: 1100, upkeep: 35, powerUse: 10, waterUse: 10, serviceType: 'fire', radius: 11, desc: 'Виїжджає на пожежі та захищає квартали' },
  POLICE_STATION: { id: 'POLICE_STATION', cat: 'services', name: '🚓 Поліцейський відділок', cost: 1100, upkeep: 35, powerUse: 10, waterUse: 5, serviceType: 'police', radius: 11, desc: 'Знижує злочинність і підвищує вартість землі' },
  HOSPITAL: { id: 'HOSPITAL', cat: 'services', name: '🏥 Міська лікарня', cost: 2000, upkeep: 55, powerUse: 20, waterUse: 15, serviceType: 'health', radius: 13, happinessBonus: 10, desc: 'Лікує мешканців і збільшує тривалість життя' },
  SCHOOL: { id: 'SCHOOL', cat: 'services', name: '🏫 Загальноосвітня школа', cost: 1200, upkeep: 35, powerUse: 12, waterUse: 8, serviceType: 'edu', radius: 11, happinessBonus: 7, desc: 'Підвищує рівень освіти мешканців' },
  UNIVERSITY: { id: 'UNIVERSITY', cat: 'services', name: '🎓 Університетський кампус', cost: 3200, upkeep: 85, powerUse: 30, waterUse: 20, serviceType: 'edu', radius: 18, happinessBonus: 14, desc: 'Готує інженерів та відкриває IT-технопарки' },
  PARK: { id: 'PARK', cat: 'services', name: '🌳 Міський парк', cost: 300, upkeep: 8, waterUse: 4, pollution: -10, happinessBonus: 6, desc: 'Підвищує вартість землі та щастя жителів' },
  STADIUM: { id: 'STADIUM', cat: 'services', name: '🏟️ Міський стадіон', cost: 3500, upkeep: 90, powerUse: 35, waterUse: 25, happinessBonus: 18, desc: 'Приваблює туристів і приносить дохід від матчів' },

  // Промисловість і видобуток
  MINE: { id: 'MINE', cat: 'industry', name: '⛏️ Шахта / Видобуток', cost: 1500, upkeep: 40, powerUse: 20, pollution: 28, jobs: 30, desc: 'Видобуває руду та вугілля на родовищах' },
  WAREHOUSE: { id: 'WAREHOUSE', cat: 'industry', name: '📦 Логістичний хаб', cost: 1000, upkeep: 25, powerUse: 10, jobs: 20, desc: 'Прискорює експорт товарів і прибуток заводів' },

  // Рельєф
  RAISE_TERRAIN: { id: 'RAISE_TERRAIN', cat: 'terrain', name: '⛰️ Підняти землю', cost: 30, desc: 'Формування пагорбів і захисних дамб' },
  LOWER_TERRAIN: { id: 'LOWER_TERRAIN', cat: 'terrain', name: '🕳️ Опустити землю', cost: 30, desc: 'Створення водойм і каналів' },
  PLANT_TREE: { id: 'PLANT_TREE', cat: 'terrain', name: '🌲 Висадити ліс', cost: 15, desc: 'Зменшує шум і забруднення повітря' }
};

export const ORDINANCES = [
  {
    id: 'free_transit',
    title: '🚌 Безкоштовний громадський транспорт',
    desc: 'Мешканці масово пересідають на автобуси та метро (-25% заторів, +8% щастя, витрати $120/день).',
    dailyCost: 120
  },
  {
    id: 'recycling_law',
    title: '♻️ Обов’язкове сортування сміття',
    desc: 'Зменшує забруднення міста на 30% та додає дохід від вторсировини ($60/день).',
    dailyCost: 60
  },
  {
    id: 'green_subsidy',
    title: '☀️ Субсидії на зелену енергетику',
    desc: 'Підвищує ефективність сонячних та вітрових станцій на 25% ($90/день).',
    dailyCost: 90
  },
  {
    id: 'no_heavy_trucks',
    title: '🚫 Заборона фурам у житлових зонах',
    desc: 'Знижує шум у спальних районах (+6% щастя, витрати $40/день).',
    dailyCost: 40
  },
  {
    id: 'smart_grid',
    title: '⚡ Розумна електромережа (Smart Grid)',
    desc: 'Автоматично оптимізує споживання струму та тепла на 15% ($80/день).',
    dailyCost: 80
  },
  {
    id: 'tourism_promo',
    title: '✈️ Міжнародна туристична кампанія',
    desc: 'Збільшує потік туристів у готелі, парки та на стадіон ($110/день).',
    dailyCost: 110
  }
];

export const ACHIEVEMENTS_DEF = [
  { id: 'pop_50', title: 'Перші квартали', desc: 'Досягти населення 50 мешканців' },
  { id: 'pop_250', title: 'Зростаюче містечко', desc: 'Досягти населення 250 мешканців' },
  { id: 'pop_1000', title: 'Справжнє місто', desc: 'Досягти населення 1 000 мешканців' },
  { id: 'budget_100k', title: 'Профіцитний мер', desc: 'Накопичити $100 000 у міському бюджеті' },
  { id: 'transit_line', title: 'Транспортна мережа', desc: 'Запустити автобусний маршрут (мінімум 2 зупинки)' },
  { id: 'green_city', title: 'Еко-столиця', desc: 'Побудувати сонячну або вітрову електростанцію' },
  { id: 'edu_hub', title: 'Центр науки', desc: 'Відкрити Університетський кампус' }
];

export const FIRST_NAMES = [
  'Олександр', 'Ірина', 'Максим', 'Олена', 'Дмитро', 'Наталія',
  'Артем', 'Софія', 'Богдан', 'Марія', 'Тарас', 'Катерина',
  'Андрій', 'Вікторія', 'Денис', 'Юлія', 'Владислав', 'Анна'
];

export const LAST_NAMES = [
  'Коваленко', 'Бондаренко', 'Ткаченко', 'Шевченко', 'Кравченко',
  'Олійник', 'Мельник', 'Савченко', 'Руденко', 'Мороз', 'Лисенко', 'Павленко'
];

export const PROFESSIONS = [
  'Інженер-енергетик', 'Вчитель', 'Лікар-хірург', 'IT-архітектор', 'Урбаніст',
  'Бариста', 'Водій автобуса', 'Фермер', 'Технолог виробництва', 'Еколог'
];

export function getCityStage(population) {
  if (population < 50) return 'Поселення';
  if (population < 200) return 'Селище';
  if (population < 600) return 'Мале місто';
  if (population < 1500) return 'Середнє місто';
  if (population < 4000) return 'Велике місто';
  return 'Мегаполіс';
}