import { TILE_SIZE } from './config.js';

export class TrafficSystem {
  constructor(scene, mapSystem) {
    this.scene = scene;
    this.map = mapSystem;
    this.vehicles = [];
    this.pedestrians = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.carColors = [0xef4444, 0x3b82f6, 0xf8fafc, 0x22c55e, 0xa855f7, 0x94a3b8];
  }

  clear() {
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.vehicles = [];
    this.pedestrians = [];
  }

  getRoadTiles() {
    const roads = [];
    const stops = [];
    const fires = [];
    for (let x = 0; x < this.map.size; x++) {
      for (let z = 0; z < this.map.size; z++) {
        const c = this.map.grid[x][z];
        if (c.roadType) roads.push(c);
        if (c.busStop) stops.push(c);
        if (c.onFire) fires.push(c);
      }
    }
    return { roads, stops, fires };
  }

  spawnVehicle(roadTile, kind = 'CAR') {
    const mesh = new THREE.Group();

    if (kind === 'BUS') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.34, 1.05),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 })
      );
      body.position.y = 0.2;
      mesh.add(body);
    } else if (kind === 'FIRE') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.34, 0.95),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
      );
      body.position.y = 0.2;
      const beacon = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.08, 0.14),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      beacon.position.y = 0.4;
      mesh.add(body, beacon);
    } else {
      const color = this.carColors[Math.floor(Math.random() * this.carColors.length)];
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.2, 0.68),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
      );
      body.position.y = 0.14;
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.14, 0.36),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 })
      );
      cabin.position.set(0, 0.26, -0.04);
      mesh.add(body, cabin);
    }

    const pos = this.tileToWorld(roadTile.x, roadTile.z, roadTile.height);
    mesh.position.copy(pos);
    this.group.add(mesh);

    this.vehicles.push({
      kind,
      mesh,
      cx: roadTile.x,
      cz: roadTile.z,
      tx: roadTile.x,
      tz: roadTile.z,
      prevX: -1,
      prevZ: -1,
      progress: 1,
      speed: kind === 'FIRE' ? 2.6 : kind === 'BUS' ? 1.5 : 1.7 + Math.random() * 0.7
    });
  }

  tileToWorld(x, z, height) {
    const offset = (this.map.size * TILE_SIZE) / 2 - TILE_SIZE / 2;
    return new THREE.Vector3(
      x * TILE_SIZE - offset,
      Math.max(0.05, height) + 0.06,
      z * TILE_SIZE - offset
    );
  }

  pickNextRoad(v) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const candidates = [];
    for (const [dx, dz] of dirs) {
      const nx = v.cx + dx;
      const nz = v.cz + dz;
      const cell = this.map.getCell(nx, nz);
      if (cell && cell.roadType) candidates.push({ x: nx, z: nz });
    }
    if (candidates.length === 0) return null;
    const nonBack = candidates.filter(c => c.x !== v.prevX || c.z !== v.prevZ);
    const pool = nonBack.length > 0 ? nonBack : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  update(dt, speed, population, isMobileLow = false) {
    if (speed === 0) return;

    const { roads, stops, fires } = this.getRoadTiles();
    if (roads.length < 2) {
      if (this.vehicles.length > 0) this.clear();
      return;
    }

    const maxVehicles = isMobileLow ? 22 : 55;
    const desiredCars = Math.min(maxVehicles, Math.max(2, Math.floor(population / 7) + Math.floor(roads.length / 8)));
    const desiredBuses = stops.length >= 2 ? Math.min(6, Math.floor(stops.length / 2) + 1) : 0;
    const desiredFire = fires.length > 0 ? Math.min(3, fires.length) : 0;

    // Управління автобусами
    const currentBuses = this.vehicles.filter(v => v.kind === 'BUS').length;
    if (currentBuses < desiredBuses) {
      this.spawnVehicle(stops[0], 'BUS');
    }

    // Управління пожежними машинами
    const currentFire = this.vehicles.filter(v => v.kind === 'FIRE').length;
    if (currentFire < desiredFire) {
      this.spawnVehicle(roads[0], 'FIRE');
    }

    // Приватні авто
    while (this.vehicles.length < desiredCars + desiredBuses + desiredFire) {
      const tile = roads[Math.floor(Math.random() * roads.length)];
      this.spawnVehicle(tile, 'CAR');
    }
    while (this.vehicles.length > desiredCars + desiredBuses + desiredFire) {
      const removed = this.vehicles.pop();
      this.group.remove(removed.mesh);
    }

    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if ((v.kind === 'BUS' && desiredBuses === 0) || (v.kind === 'FIRE' && desiredFire === 0)) {
        this.group.remove(v.mesh);
        this.vehicles.splice(i, 1);
        continue;
      }

      const currCell = this.map.getCell(v.cx, v.cz);
      const targetCell = this.map.getCell(v.tx, v.tz);
      if (!currCell || !currCell.roadType || !targetCell || !targetCell.roadType) {
        this.group.remove(v.mesh);
        this.vehicles.splice(i, 1);
        continue;
      }

      v.progress += dt * speed * v.speed;
      if (v.progress >= 1) {
        v.prevX = v.cx;
        v.prevZ = v.cz;
        v.cx = v.tx;
        v.cz = v.tz;
        const next = this.pickNextRoad(v);
        if (next) {
          v.tx = next.x;
          v.tz = next.z;
          v.progress = 0;
        } else {
          v.progress = 1;
        }
      }

      const startPos = this.tileToWorld(v.cx, v.cz, currCell.height);
      const endPos = this.tileToWorld(v.tx, v.tz, targetCell.height);
      v.mesh.position.lerpVectors(startPos, endPos, Math.min(1, v.progress));

      if (v.tx !== v.cx || v.tz !== v.cz) {
        v.mesh.lookAt(endPos.x, v.mesh.position.y, endPos.z);
      }
    }
  }
}