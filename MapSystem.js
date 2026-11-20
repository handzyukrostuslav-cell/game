import { TOOLS } from './config.js';

export class MapSystem {
  constructor(size = 34, terrainType = 'river') {
    this.size = size;
    this.terrainType = terrainType;
    this.grid = [];
    this.version = 1;
    this.undoStack = [];
    this.redoStack = [];
    this.generate();
  }

  generate() {
    this.grid = [];
    const half = this.size / 2;

    for (let x = 0; x < this.size; x++) {
      const row = [];
      for (let z = 0; z < this.size; z++) {
        let height = 0.6;
        const wave = Math.sin(x * 0.24) * Math.cos(z * 0.24) * 0.45 + Math.sin((x + z) * 0.14) * 0.3;

        if (this.terrainType === 'river') {
          const riverCenter = Math.sin(z * 0.17) * 3.8 + half;
          const dist = Math.abs(x - riverCenter);
          if (dist < 2.2) height = -0.55;
          else if (dist < 3.4) height = 0.22;
          else height = 0.6 + Math.max(0, wave);
        } else if (this.terrainType === 'coast') {
          const shore = this.size * 0.22 + Math.sin(z * 0.2) * 2.0;
          if (x < shore) height = -0.55;
          else if (x < shore + 2.2) height = 0.22;
          else height = 0.6 + Math.max(0, wave * 1.15);
        } else if (this.terrainType === 'hills') {
          height = 0.75 + wave * 1.85;
        } else {
          height = 0.55 + wave * 0.18;
        }

        height = Number(Math.max(-0.6, Math.min(3.2, height)).toFixed(2));
        const hasTree = height > 0.45 && height < 1.95 && Math.random() < 0.15;

        // Генерація природних ресурсів (руда на височинах, родючі ґрунти в низинах)
        let resource = null;
        if (height > 1.35 && Math.random() < 0.28) resource = 'ORE';
        else if (height > 0.35 && height < 0.85 && Math.random() < 0.24) resource = 'FERTILE';

        row.push({
          x,
          z,
          height,
          hasTree,
          resource,
          roadType: null,     // 'ROAD_DIRT' | 'ROAD' | 'ROAD_AVENUE' | null
          busStop: false,
          zone: null,         // 'RES' | 'COM' | 'IND' | 'AGRI' | 'TECH' | null
          building: null,
          level: 0,
          buildProgress: 0,
          hasPower: false,
          hasWater: false,
          hasHeat: false,
          onFire: false,
          fireHealth: 100,
          landValue: 50,
          pollution: 0,
          serviceScore: 0,
          residents: [],
          jobs: 0
        });
      }
      this.grid.push(row);
    }
    this.version++;
  }

  saveSnapshot() {
    this.undoStack.push(JSON.stringify(this.grid));
    if (this.undoStack.length > 20) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(JSON.stringify(this.grid));
    this.grid = JSON.parse(this.undoStack.pop());
    this.version++;
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(JSON.stringify(this.grid));
    this.grid = JSON.parse(this.redoStack.pop());
    this.version++;
    return true;
  }

  getCell(x, z) {
    if (x < 0 || z < 0 || x >= this.size || z >= this.size) return null;
    return this.grid[x][z];
  }

  isWater(cell) {
    return cell.height <= 0;
  }

  hasRoadAccess(x, z) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of dirs) {
      const n = this.getCell(x + dx, z + dz);
      if (n && n.roadType) return true;
    }
    return false;
  }

  canApplyTool(x, z, toolId) {
    const cell = this.getCell(x, z);
    if (!cell) return false;
    if (toolId === 'SELECT') return true;

    if (toolId === 'BULLDOZE') {
      return Boolean(cell.roadType || cell.zone || cell.building || cell.hasTree || cell.busStop);
    }

    if (toolId === 'UPGRADE_ROAD') {
      return cell.roadType === 'ROAD_DIRT' || cell.roadType === 'ROAD';
    }

    if (toolId === 'BUS_STOP') {
      return Boolean(cell.roadType && !cell.busStop);
    }

    if (toolId === 'RAISE_TERRAIN') {
      return !cell.roadType && !cell.building && cell.height < 3.0;
    }

    if (toolId === 'LOWER_TERRAIN') {
      return !cell.roadType && !cell.building && cell.height > -0.5;
    }

    if (toolId === 'PLANT_TREE') {
      return !this.isWater(cell) && !cell.roadType && !cell.building && !cell.zone && !cell.hasTree;
    }

    if (this.isWater(cell) || cell.height > 2.3) return false;
    if (cell.roadType || cell.building) return false;

    if (toolId.startsWith('ROAD')) return !cell.zone;
    if (toolId.startsWith('ZONE_')) return cell.zone !== toolId.replace('ZONE_', '');

    return !cell.zone;
  }

  applyTool(x, z, toolId, recordUndo = true) {
    const cell = this.getCell(x, z);
    if (!cell || !this.canApplyTool(x, z, toolId)) return false;

    if (recordUndo) this.saveSnapshot();

    if (toolId === 'BULLDOZE') {
      cell.roadType = null;
      cell.busStop = false;
      cell.zone = null;
      cell.building = null;
      cell.level = 0;
      cell.buildProgress = 0;
      cell.hasTree = false;
      cell.onFire = false;
      cell.residents = [];
      cell.jobs = 0;
    } else if (toolId === 'UPGRADE_ROAD') {
      if (cell.roadType === 'ROAD_DIRT') cell.roadType = 'ROAD';
      else if (cell.roadType === 'ROAD') cell.roadType = 'ROAD_AVENUE';
    } else if (toolId === 'BUS_STOP') {
      cell.busStop = true;
    } else if (toolId === 'RAISE_TERRAIN') {
      cell.height = Number(Math.min(3.2, cell.height + 0.35).toFixed(2));
      if (this.isWater(cell)) cell.hasTree = false;
    } else if (toolId === 'LOWER_TERRAIN') {
      cell.height = Number(Math.max(-0.6, cell.height - 0.35).toFixed(2));
      if (this.isWater(cell)) cell.hasTree = false;
    } else if (toolId === 'PLANT_TREE') {
      cell.hasTree = true;
    } else if (toolId.startsWith('ROAD')) {
      cell.hasTree = false;
      cell.roadType = toolId;
    } else if (toolId.startsWith('ZONE_')) {
      cell.hasTree = false;
      cell.zone = toolId.replace('ZONE_', '');
    } else if (TOOLS[toolId]) {
      cell.hasTree = false;
      cell.building = toolId;
      cell.level = 1;
      cell.buildProgress = 0;
      cell.jobs = TOOLS[toolId].jobs || 10;
    }

    this.version++;
    return true;
  }

  serialize() {
    return {
      size: this.size,
      terrainType: this.terrainType,
      grid: this.grid
    };
  }

  deserialize(data) {
    this.size = data.size;
    this.terrainType = data.terrainType;
    this.grid = data.grid;
    this.undoStack = [];
    this.redoStack = [];
    this.version++;
  }
}