import { TILE_SIZE } from './config.js';

export class Renderer3D {
  constructor(canvas, mapSystem, quality = 'auto') {
    this.canvas = canvas;
    this.map = mapSystem;
    this.renderedVersion = -1;
    this.activeOverlay = 'NONE'; // 'NONE' | 'UTILITIES' | 'LAND_VALUE' | 'POLLUTION' | 'SERVICES' | 'RESOURCES'
    this.season = 'SPRING';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7dd3fc);
    this.scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0075);

    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.3, 320);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.windowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0xfef08a,
      emissiveIntensity: 0.0,
      roughness: 0.2
    });

    this.setupLights();
    this.setupWaterPlane();
    this.setupCursor();
    this.setupWeatherParticles();

    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    this.tileMeshes = [];

    // Камера та режими огляду
    this.camTarget = new THREE.Vector3(0, 0, 0);
    this.camDistance = 36;
    this.camYaw = Math.PI / 4;
    this.camPitch = 0.85;

    this.walkMode = false;
    this.walkPos = new THREE.Vector3(0, 1.35, 8);
    this.walkYaw = 0;
    this.followCitizen = null;

    this.setQuality(quality);
    this.updateCameraTransform();

    window.addEventListener('resize', () => this.onResize());
  }

  setQuality(q) {
    let resolved = q;
    if (q === 'auto') {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 900;
      resolved = isMobile ? 'low' : 'high';
    }
    this.quality = resolved;

    if (resolved === 'low') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      this.renderer.shadowMap.enabled = false;
    } else if (resolved === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.renderedVersion = -1;
  }

  setupLights() {
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.7);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    this.sunLight.position.set(35, 50, 25);
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    const d = 55;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);
  }

  setupWaterPlane() {
    const waterGeo = new THREE.PlaneGeometry(320, 320);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.15,
      metalness: 0.35,
      transparent: true,
      opacity: 0.88
    });
    this.waterPlane = new THREE.Mesh(waterGeo, waterMat);
    this.waterPlane.rotation.x = -Math.PI / 2;
    this.waterPlane.position.y = 0.02;
    this.scene.add(this.waterPlane);
  }

  setupCursor() {
    const geo = new THREE.BoxGeometry(TILE_SIZE * 1.02, 0.25, TILE_SIZE * 1.02);
    this.cursorMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.55 });
    this.cursorMesh = new THREE.Mesh(geo, this.cursorMat);
    this.cursorMesh.visible = false;
    this.scene.add(this.cursorMesh);
  }

  setupWeatherParticles() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = Math.random() * 35;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.weatherMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.75 });
    this.weatherPoints = new THREE.Points(geo, this.weatherMat);
    this.weatherPoints.visible = false;
    this.scene.add(this.weatherPoints);
  }

  updateWeatherFX(dt, weather) {
    if (weather === 'CLEAR' || this.quality === 'low') {
      this.weatherPoints.visible = false;
      return;
    }
    this.weatherPoints.visible = true;
    this.weatherMat.color.setHex(weather === 'SNOW' ? 0xffffff : 0x7dd3fc);
    this.weatherMat.size = weather === 'SNOW' ? 0.28 : 0.16;

    const fallSpeed = weather === 'SNOW' ? 5 : 22;
    const pos = this.weatherPoints.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] -= fallSpeed * dt;
      if (pos[i + 1] < 0) pos[i + 1] = 35;
    }
    this.weatherPoints.geometry.attributes.position.needsUpdate = true;
  }

  setCursor(cell, isValid) {
    if (!cell || this.walkMode) {
      this.cursorMesh.visible = false;
      return;
    }
    const offset = (this.map.size * TILE_SIZE) / 2 - TILE_SIZE / 2;
    this.cursorMesh.position.set(
      cell.x * TILE_SIZE - offset,
      Math.max(0.05, cell.height) + 0.12,
      cell.z * TILE_SIZE - offset
    );
    this.cursorMat.color.setHex(isValid ? 0x22c55e : 0xef4444);
    this.cursorMesh.visible = true;
  }

  updateCameraTransform() {
    if (this.walkMode) {
      this.camera.position.copy(this.walkPos);
      const lookX = this.walkPos.x - Math.sin(this.walkYaw) * 10;
      const lookZ = this.walkPos.z - Math.cos(this.walkYaw) * 10;
      this.camera.lookAt(lookX, this.walkPos.y - 0.3, lookZ);
      return;
    }

    if (this.followCitizen) {
      const offset = (this.map.size * TILE_SIZE) / 2 - TILE_SIZE / 2;
      this.camTarget.set(
        this.followCitizen.homeX * TILE_SIZE - offset,
        0.8,
        this.followCitizen.homeZ * TILE_SIZE - offset
      );
      this.camDistance = 12;
    }

    const x = this.camTarget.x + this.camDistance * Math.sin(this.camPitch) * Math.sin(this.camYaw);
    const y = this.camTarget.y + this.camDistance * Math.cos(this.camPitch);
    const z = this.camTarget.z + this.camDistance * Math.sin(this.camPitch) * Math.cos(this.camYaw);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.camTarget);
  }

  resetCamera() {
    this.walkMode = false;
    this.followCitizen = null;
    this.camTarget.set(0, 0, 0);
    this.camDistance = Math.max(26, this.map.size * 1.15);
    this.camYaw = Math.PI / 4;
    this.camPitch = 0.85;
    this.updateCameraTransform();
  }

  updateDayNight(hour) {
    const sunAngle = ((hour - 6) / 24) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    this.sunLight.position.set(Math.cos(sunAngle) * 45, Math.max(8, sunHeight * 50), 25);

    const isNight = hour < 5.5 || hour > 19.5;
    const isDusk = (hour >= 5.5 && hour <= 7.5) || (hour >= 17.5 && hour <= 19.5);

    if (isNight) {
      this.scene.background.setHex(0x070b14);
      this.scene.fog.color.setHex(0x070b14);
      this.sunLight.intensity = 0.2;
      this.hemiLight.intensity = 0.3;
      this.windowMat.emissiveIntensity = 1.4;
    } else if (isDusk) {
      this.scene.background.setHex(0xfb923c);
      this.scene.fog.color.setHex(0xfb923c);
      this.sunLight.intensity = 0.75;
      this.hemiLight.intensity = 0.45;
      this.windowMat.emissiveIntensity = 0.55;
    } else {
      this.scene.background.setHex(0x7dd3fc);
      this.scene.fog.color.setHex(0x7dd3fc);
      this.sunLight.intensity = 1.25;
      this.hemiLight.intensity = 0.68;
      this.windowMat.emissiveIntensity = 0.0;
    }
  }

  getTileColor(cell) {
    if (this.activeOverlay === 'LAND_VALUE') {
      return cell.landValue > 70 ? 0x22c55e : cell.landValue > 45 ? 0xfacc15 : 0xef4444;
    }
    if (this.activeOverlay === 'POLLUTION') {
      return cell.pollution > 40 ? 0x7e22ce : cell.pollution > 15 ? 0xf97316 : 0x4ade80;
    }
    if (this.activeOverlay === 'SERVICES') {
      return cell.serviceScore > 50 ? 0x0ea5e9 : cell.serviceScore > 20 ? 0x38bdf8 : 0x334155;
    }
    if (this.activeOverlay === 'RESOURCES') {
      if (cell.resource === 'ORE') return 0x64748b;
      if (cell.resource === 'FERTILE') return 0x84cc16;
      return 0x1e293b;
    }
    if (this.activeOverlay === 'UTILITIES') {
      if (cell.building) return cell.hasPower && cell.hasWater ? 0x22c55e : 0xef4444;
      return 0x1e293b;
    }

    // Звичайний вигляд з урахуванням пори року
    if (cell.height <= 0) return 0x0369a1;
    if (this.season === 'WINTER') return cell.height > 1.8 ? 0xe2e8f0 : 0xf8fafc;
    if (this.season === 'AUTUMN') return cell.height > 1.8 ? 0x94a3b8 : 0xd97706;
    if (cell.height < 0.35) return 0xfde047;
    if (cell.height > 1.8) return 0x94a3b8;
    return this.season === 'SUMMER' ? 0x22c55e : 0x4ade80;
  }

  rebuildWorld() {
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]);
    }
    this.tileMeshes = [];

    const offset = (this.map.size * TILE_SIZE) / 2 - TILE_SIZE / 2;
    const castShadows = this.quality !== 'low';
    const treeTransforms = [];

    for (let x = 0; x < this.map.size; x++) {
      for (let z = 0; z < this.map.size; z++) {
        const cell = this.map.grid[x][z];
        const wx = x * TILE_SIZE - offset;
        const wz = z * TILE_SIZE - offset;

        const tileHolder = new THREE.Group();
        tileHolder.position.set(wx, 0, wz);

        const blockHeight = Math.max(0.4, cell.height + 0.8);
        const groundMesh = new THREE.Mesh(
          new THREE.BoxGeometry(TILE_SIZE, blockHeight, TILE_SIZE),
          new THREE.MeshStandardMaterial({ color: this.getTileColor(cell), roughness: 0.85 })
        );
        groundMesh.position.y = cell.height - blockHeight / 2;
        groundMesh.receiveShadow = castShadows;
        groundMesh.userData = { cellX: x, cellZ: z };
        tileHolder.add(groundMesh);
        this.tileMeshes.push(groundMesh);

        const surfaceY = Math.max(0.05, cell.height);

        if (cell.hasTree && cell.height > 0) {
          treeTransforms.push({ x: wx, y: surfaceY, z: wz });
        }

        if (cell.roadType) {
          this.addRoad(tileHolder, x, z, surfaceY, cell);
        }

        if (cell.zone && !cell.building) {
          const zColors = { RES: 0x22c55e, COM: 0x3b82f6, IND: 0xeab308, AGRI: 0x84cc16, TECH: 0x06b6d4 };
          const pad = new THREE.Mesh(
            new THREE.PlaneGeometry(TILE_SIZE * 0.9, TILE_SIZE * 0.9),
            new THREE.MeshBasicMaterial({ color: zColors[cell.zone] || 0x22c55e, transparent: true, opacity: 0.45 })
          );
          pad.rotation.x = -Math.PI / 2;
          pad.position.y = surfaceY + 0.02;
          tileHolder.add(pad);
        }

        if (cell.building) {
          this.addBuilding(tileHolder, cell, surfaceY, castShadows);
        }

        this.worldGroup.add(tileHolder);
      }
    }

    // Оптимізований рендеринг усіх дерев одним InstancedMesh (ідеально для телефонів!)
    if (treeTransforms.length > 0) {
      const crownColor = this.season === 'WINTER' ? 0xe2e8f0 : this.season === 'AUTUMN' ? 0xea580c : 0x15803d;
      const crownGeo = new THREE.ConeGeometry(0.45, 1.15, 6);
      const crownMat = new THREE.MeshStandardMaterial({ color: crownColor, roughness: 0.8 });
      const instancedTrees = new THREE.InstancedMesh(crownGeo, crownMat, treeTransforms.length);
      const dummy = new THREE.Object3D();

      treeTransforms.forEach((t, idx) => {
        dummy.position.set(t.x, t.y + 0.65, t.z);
        dummy.updateMatrix();
        instancedTrees.setMatrixAt(idx, dummy.matrix);
      });
      instancedTrees.instanceMatrix.needsUpdate = true;
      this.worldGroup.add(instancedTrees);
    }

    this.renderedVersion = this.map.version;
  }

  addRoad(parent, x, z, y, cell) {
    const color = cell.roadType === 'ROAD_DIRT' ? 0x92400e : cell.roadType === 'ROAD_AVENUE' ? 0x1e293b : 0x334155;
    const roadMesh = new THREE.Mesh(
      new THREE.BoxGeometry(TILE_SIZE, 0.08, TILE_SIZE),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    roadMesh.position.y = y + 0.03;
    parent.add(roadMesh);

    if (cell.roadType !== 'ROAD_DIRT') {
      const lineMat = new THREE.MeshBasicMaterial({ color: cell.roadType === 'ROAD_AVENUE' ? 0xfacc15 : 0xf8fafc });
      const n = this.map.getCell(x, z - 1)?.roadType;
      const s = this.map.getCell(x, z + 1)?.roadType;
      const e = this.map.getCell(x + 1, z)?.roadType;
      const w = this.map.getCell(x - 1, z)?.roadType;

      if (n || s) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.1, TILE_SIZE * 0.65), lineMat);
        strip.rotation.x = -Math.PI / 2;
        strip.position.y = y + 0.075;
        parent.add(strip);
      }
      if (e || w) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE * 0.65, 0.1), lineMat);
        strip.rotation.x = -Math.PI / 2;
        strip.position.y = y + 0.075;
        parent.add(strip);
      }
    }

    if (cell.busStop) {
      const shelter = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.45, 0.65),
        new THREE.MeshStandardMaterial({ color: 0xfacc15 })
      );
      shelter.position.set(0.75, y + 0.25, 0);
      parent.add(shelter);
    }
  }

  addBuilding(parent, cell, y, castShadows) {
    if (cell.buildProgress < 100) {
      const h = 0.3 + (cell.buildProgress / 100) * 1.2;
      const scaffold = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, h, 1.3),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, wireframe: cell.buildProgress < 65 })
      );
      scaffold.position.y = y + h / 2;
      parent.add(scaffold);
      return;
    }

    const lvl = cell.level || 1;
    const type = cell.building;
    const transparentMode = this.activeOverlay === 'UTILITIES';

    const makeMat = (hex) => new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.55,
      transparent: transparentMode,
      opacity: transparentMode ? 0.35 : 1.0
    });

    if (type === 'RES') {
      const h = lvl === 1 ? 0.9 : lvl === 2 ? 2.2 : 4.2;
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, h, 1.3), makeMat(lvl === 1 ? 0xfef3c7 : lvl === 2 ? 0xfde68a : 0xe2e8f0));
      body.position.y = y + h / 2;
      body.castShadow = castShadows;
      parent.add(body);

      const win = new THREE.Mesh(new THREE.BoxGeometry(1.34, h * 0.65, 1.34), this.windowMat);
      win.position.y = y + h / 2;
      parent.add(win);
    } else if (type === 'COM' || type === 'TECH') {
      const h = lvl === 1 ? 1.2 : lvl === 2 ? 2.6 : 4.8;
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 1.5), makeMat(type === 'TECH' ? 0x06b6d4 : 0x3b82f6));
      body.position.y = y + h / 2;
      body.castShadow = castShadows;
      parent.add(body);

      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.54, h * 0.75, 1.54), this.windowMat);
      glass.position.y = y + h / 2;
      parent.add(glass);
    } else if (type === 'IND' || type === 'WAREHOUSE' || type === 'MINE') {
      const h = 1.2 + lvl * 0.4;
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.4), makeMat(type === 'MINE' ? 0x475569 : 0x64748b));
      box.position.y = y + h / 2;
      parent.add(box);
    } else if (type === 'AGRI') {
      const field = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 1.85), makeMat(0x84cc16));
      field.position.y = y + 0.07;
      const barn = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.8), makeMat(0xb91c1c));
      barn.position.set(-0.4, y + 0.35, -0.4);
      parent.add(field, barn);
    } else if (type === 'POWER_PLANT' || type === 'HEATING_PLANT') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 1.6), makeMat(type === 'HEATING_PLANT' ? 0x9a3412 : 0x475569));
      base.position.y = y + 0.65;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 2.7, 10), makeMat(0xd97706));
      tower.position.set(-0.35, y + 1.35, 0);
      parent.add(base, tower);
    } else if (type === 'SOLAR_PLANT') {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.15, 1.75), makeMat(0x1d4ed8));
      panel.position.y = y + 0.25;
      panel.rotation.x = 0.22;
      parent.add(panel);
    } else if (type === 'WIND_TURBINE') {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 3.2, 8), makeMat(0xf8fafc));
      mast.position.y = y + 1.6;
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), makeMat(0xf8fafc));
      rotor.position.set(0, y + 3.1, 0.14);
      parent.add(mast, rotor);
    } else if (type === 'WATER_TOWER') {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.5, 8), makeMat(0x94a3b8));
      leg.position.y = y + 0.75;
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.9, 10), makeMat(0x0ea5e9));
      tank.position.y = y + 1.8;
      parent.add(leg, tank);
    } else if (['HOSPITAL', 'SCHOOL', 'UNIVERSITY', 'FIRE_STATION', 'POLICE_STATION', 'METRO_STATION', 'RECYCLING', 'STADIUM'].includes(type)) {
      const colors = {
        HOSPITAL: 0xf8fafc,
        SCHOOL: 0xf97316,
        UNIVERSITY: 0x8b5cf6,
        FIRE_STATION: 0xdc2626,
        POLICE_STATION: 0x1d4ed8,
        METRO_STATION: 0x0284c7,
        RECYCLING: 0x16a34a,
        STADIUM: 0x10b981
      };
      const h = type === 'STADIUM' ? 1.1 : type === 'UNIVERSITY' ? 2.1 : 1.5;
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.75, h, 1.6), makeMat(colors[type]));
      b.position.y = y + h / 2;
      parent.add(b);
    } else if (type === 'PARK') {
      const lawn = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.12, 1.85), makeMat(0x16a34a));
      lawn.position.y = y + 0.06;
      parent.add(lawn);
    }

    // Візуальний індикатор пожежі
    if (cell.onFire) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 1.6, 6),
        new THREE.MeshBasicMaterial({ color: 0xf97316 })
      );
      flame.position.y = y + 1.8;
      parent.add(flame);
    }
  }

  render(dt, sim) {
    if (this.season !== sim.season) {
      this.season = sim.season;
      this.renderedVersion = -1;
    }
    if (this.renderedVersion !== this.map.version) {
      this.rebuildWorld();
    }
    this.updateDayNight(sim.hour);
    this.updateWeatherFX(dt, sim.weather);
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}