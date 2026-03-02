import * as THREE from 'three';

interface Particle extends THREE.Mesh {
  velocity: THREE.Vector3;
  life: number;
}

export interface GameState {
  score: number;
  coins: number;
  isGameOver: boolean;
  isStarted: boolean;
  isPaused: boolean;
  distance: number;
  isHoverboardActive: boolean;
  hoverboardTimeLeft: number;
}

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  
  private player: THREE.Group;
  private torso: THREE.Mesh;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private playerHat: THREE.Mesh;
  private playerShoes: THREE.Group;
  
  private hoverboardMesh: THREE.Mesh;
  private hoverboardLight: THREE.PointLight;
  private police: THREE.Group;
  private policeLeftLeg: THREE.Mesh;
  private policeRightLeg: THREE.Mesh;
  private policeLeftArm: THREE.Mesh;
  private policeRightArm: THREE.Mesh;
  private playerLane: number = 0; // -1, 0, 1
  private targetLaneX: number = 0;
  private playerY: number = 0;
  private targetY: number = 0;
  
  private isJumping: boolean = false;
  private isRolling: boolean = false;
  private rollTimer: number = 0;
  private jumpVelocity: number = 0;
  private gravity: number = 32;
  private jumpStrength: number = 16;
  private groundY: number = 0;
  
  private obstacles: THREE.Object3D[] = [];
  private coins: THREE.Object3D[] = [];
  private powerups: THREE.Object3D[] = [];
  private tracks: THREE.Mesh[] = [];
  private sideDecorations: THREE.Object3D[] = [];
  private npcs: THREE.Object3D[] = [];
  private bridges: THREE.Object3D[] = [];
  private clouds: THREE.Object3D[] = [];
  private particles: Particle[] = [];
  private gameTime: number = 0;
  
  private audioCtx: AudioContext | null = null;
  
  private laneWidth: number = 3;
  private gameSpeed: number = 15;
  private score: number = 0;
  private collectedCoins: number = 0;
  private isGameOver: boolean = false;
  private isStarted: boolean = false;
  private isPaused: boolean = false;
  
  private isHoverboardActive: boolean = false;
  private hoverboardTimer: number = 0;
  private hoverboardDuration: number = 8;
  
  private onStateChange: (state: GameState) => void;

  constructor(container: HTMLElement, onStateChange: (state: GameState) => void) {
    this.onStateChange = onStateChange;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    this.scene.fog = new THREE.Fog(0x87ceeb, 20, 100);

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 7, 12); // Further back and higher for better perspective
    this.camera.lookAt(0, 1, -5); // Look slightly ahead

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    this.initLights();
    this.initPlayer();
    this.initPolice();
    this.initEnvironment();
    this.initAudio();
    
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('resize', this.handleResize.bind(this, container));

    // Touch support
    let touchStartX = 0;
    let touchStartY = 0;
    container.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) {
          if (dx > 0) this.moveRight();
          else this.moveLeft();
        }
      } else {
        if (Math.abs(dy) > 30) {
          if (dy < 0) this.jump();
          else this.roll();
        }
      }
    }, { passive: true });

    // Start the animation loop immediately to show the initial scene
    this.animate();
  }

  private createNPC(): THREE.Group {
    const group = new THREE.Group();
    
    const bodyGeom = new THREE.BoxGeometry(0.4, 0.6, 0.2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.8;
    group.add(body);
    
    const headGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.25;
    group.add(head);
    
    const legGeom = new THREE.BoxGeometry(0.15, 0.5, 0.15);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    
    const leftLeg = new THREE.Mesh(legGeom, legMat);
    leftLeg.position.set(-0.1, 0.25, 0);
    group.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeom, legMat);
    rightLeg.position.set(0.1, 0.25, 0);
    group.add(rightLeg);
    
    // Store legs for animation
    (group as any).leftLeg = leftLeg;
    (group as any).rightLeg = rightLeg;
    (group as any).walkOffset = Math.random() * Math.PI * 2;
    (group as any).walkSpeed = 1 + Math.random() * 2;
    
    return group;
  }

  private initAudio() {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not supported');
    }
  }

  private playSound(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
  }

  private initLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.6);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(20, 40, 20);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.bias = -0.0001;
    this.scene.add(sunLight);

    // Visual Sun
    const sunGeom = new THREE.SphereGeometry(4, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.position.set(40, 60, -100);
    this.scene.add(sunMesh);
  }

  private initPlayer() {
    this.player = new THREE.Group();
    
    // Torso (Rounded)
    const torsoGeom = new THREE.CapsuleGeometry(0.3, 0.6, 4, 8);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.5 });
    this.torso = new THREE.Mesh(torsoGeom, torsoMat);
    this.torso.position.y = 1.0;
    this.torso.castShadow = true;
    this.player.add(this.torso);

    // Head (Rounded)
    const headGeom = new THREE.SphereGeometry(0.25, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.6;
    head.castShadow = true;
    this.player.add(head);

    // Eyes
    const eyeGeom = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(-0.1, 1.65, -0.2);
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(0.1, 1.65, -0.2);
    this.player.add(leftEye, rightEye);

    // Legs (Rounded)
    const legGeom = new THREE.CapsuleGeometry(0.12, 0.5, 4, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
    
    this.leftLeg = new THREE.Mesh(legGeom, legMat);
    this.leftLeg.position.set(-0.15, 0.4, 0);
    this.leftLeg.castShadow = true;
    this.player.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeom, legMat);
    this.rightLeg.position.set(0.15, 0.4, 0);
    this.rightLeg.castShadow = true;
    this.player.add(this.rightLeg);

    // Arms (Rounded)
    const armGeom = new THREE.CapsuleGeometry(0.08, 0.5, 4, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.5 });
    
    this.leftArm = new THREE.Mesh(armGeom, armMat);
    this.leftArm.position.set(-0.4, 1.0, 0);
    this.leftArm.rotation.z = 0.2;
    this.leftArm.castShadow = true;
    this.player.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeom, armMat);
    this.rightArm.position.set(0.4, 1.0, 0);
    this.rightArm.rotation.z = -0.2;
    this.rightArm.castShadow = true;
    this.player.add(this.rightArm);

    // Accessories
    // Hat
    const hatGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3 });
    this.playerHat = new THREE.Mesh(hatGeom, hatMat);
    this.playerHat.position.y = 1.85;
    this.playerHat.visible = true;
    this.playerHat.castShadow = true;
    this.player.add(this.playerHat);

    // Shoes
    this.playerShoes = new THREE.Group();
    const shoeGeom = new THREE.BoxGeometry(0.2, 0.1, 0.3);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const s1 = new THREE.Mesh(shoeGeom, shoeMat);
    s1.position.set(-0.15, 0.1, 0.1);
    s1.castShadow = true;
    const s2 = new THREE.Mesh(shoeGeom, shoeMat);
    s2.position.set(0.15, 0.1, 0.1);
    s2.castShadow = true;
    this.playerShoes.add(s1, s2);
    this.playerShoes.visible = false;
    this.player.add(this.playerShoes);

    // Hoverboard Mesh (Hidden by default)
    const hbGeom = new THREE.BoxGeometry(1.2, 0.15, 2.5);
    const hbMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.2 });
    this.hoverboardMesh = new THREE.Mesh(hbGeom, hbMat);
    this.hoverboardMesh.position.y = -0.1;
    this.hoverboardMesh.visible = false;
    this.hoverboardMesh.castShadow = true;
    this.player.add(this.hoverboardMesh);

    // Hoverboard Glow Light
    this.hoverboardLight = new THREE.PointLight(0x00ff00, 0, 10);
    this.hoverboardLight.position.y = 1;
    this.player.add(this.hoverboardLight);

    this.scene.add(this.player);
  }

  private initPolice() {
    this.police = new THREE.Group();
    
    // Torso (Rounded - Blue)
    const torsoGeom = new THREE.CapsuleGeometry(0.35, 0.7, 4, 8);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x000088, roughness: 0.4 });
    const torso = new THREE.Mesh(torsoGeom, torsoMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    this.police.add(torso);

    // Head (Rounded)
    const headGeom = new THREE.SphereGeometry(0.25, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.7;
    head.castShadow = true;
    this.police.add(head);

    // Eyes
    const eyeGeom = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(-0.1, 1.75, -0.2);
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(0.1, 1.75, -0.2);
    this.police.add(leftEye, rightEye);

    // Legs (Rounded)
    const legGeom = new THREE.CapsuleGeometry(0.15, 0.5, 4, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x000044, roughness: 0.7 });
    
    this.policeLeftLeg = new THREE.Mesh(legGeom, legMat);
    this.policeLeftLeg.position.set(-0.2, 0.4, 0);
    this.policeLeftLeg.castShadow = true;
    this.police.add(this.policeLeftLeg);

    this.policeRightLeg = new THREE.Mesh(legGeom, legMat);
    this.policeRightLeg.position.set(0.2, 0.4, 0);
    this.policeRightLeg.castShadow = true;
    this.police.add(this.policeRightLeg);

    // Arms (Rounded)
    const armGeom = new THREE.CapsuleGeometry(0.1, 0.5, 4, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x000088, roughness: 0.4 });
    
    this.policeLeftArm = new THREE.Mesh(armGeom, armMat);
    this.policeLeftArm.position.set(-0.45, 1.05, 0);
    this.policeLeftArm.rotation.z = 0.2;
    this.policeLeftArm.castShadow = true;
    this.police.add(this.policeLeftArm);

    this.policeRightArm = new THREE.Mesh(armGeom, armMat);
    this.policeRightArm.position.set(0.45, 1.05, 0);
    this.policeRightArm.rotation.z = -0.2;
    this.policeRightArm.castShadow = true;
    this.police.add(this.policeRightArm);

    // Hat (Rounded)
    const hatGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.15, 16);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x000044, roughness: 0.3 });
    const hat = new THREE.Mesh(hatGeom, hatMat);
    hat.position.y = 1.95;
    hat.castShadow = true;
    this.police.add(hat);

    this.police.position.set(0, 0, 5); // Behind player
    this.scene.add(this.police);
  }

  private initEnvironment() {
    // Initial tracks
    for (let i = 0; i < 5; i++) {
      this.createTrackSegment(i * 40);
    }
  }

  private createTrackSegment(zPos: number) {
    // Road with subtle texture/grid
    const geometry = new THREE.PlaneGeometry(12, 40);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a1a, 
      roughness: 0.7,
      metalness: 0.1
    });
    const track = new THREE.Mesh(geometry, material);
    track.rotation.x = -Math.PI / 2;
    track.position.z = -zPos;
    track.receiveShadow = true;
    this.scene.add(track);
    this.tracks.push(track);

    // Road Lines
    const lineGeom = new THREE.PlaneGeometry(0.2, 2);
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2 });
    for (let i = 0; i < 4; i++) {
      const line1 = new THREE.Mesh(lineGeom, lineMat);
      line1.rotation.x = -Math.PI / 2;
      line1.position.set(-1.5, 0.02, -zPos - 5 + i * 10);
      this.scene.add(line1);
      this.sideDecorations.push(line1);

      const line2 = new THREE.Mesh(lineGeom, lineMat);
      line2.rotation.x = -Math.PI / 2;
      line2.position.set(1.5, 0.02, -zPos - 5 + i * 10);
      this.scene.add(line2);
      this.sideDecorations.push(line2);
    }

    // Sidewalks
    const sideWalkGeom = new THREE.PlaneGeometry(4, 40);
    const sideWalkMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
    
    const leftSW = new THREE.Mesh(sideWalkGeom, sideWalkMat);
    leftSW.rotation.x = -Math.PI / 2;
    leftSW.position.set(-8, 0.01, -zPos);
    leftSW.receiveShadow = true;
    this.scene.add(leftSW);
    this.sideDecorations.push(leftSW);

    const rightSW = new THREE.Mesh(sideWalkGeom, sideWalkMat);
    rightSW.rotation.x = -Math.PI / 2;
    rightSW.position.set(8, 0.01, -zPos);
    rightSW.receiveShadow = true;
    this.scene.add(rightSW);
    this.sideDecorations.push(rightSW);

    // Side Buildings (Simple)
    const buildingColors = [0xdddddd, 0xbbbbbb, 0x999999, 0x777777];
    for (let side = -1; side <= 1; side += 2) {
      if (side === 0) continue;
      const height = 15 + Math.random() * 20;
      const bGeom = new THREE.BoxGeometry(10, height, 40);
      const bMat = new THREE.MeshStandardMaterial({ color: buildingColors[Math.floor(Math.random() * buildingColors.length)] });
      const building = new THREE.Mesh(bGeom, bMat);
      building.position.set(side * 15, height / 2, -zPos);
      building.castShadow = true;
      building.receiveShadow = true;
      this.scene.add(building);
      this.sideDecorations.push(building);

      // Windows
      const winRows = Math.floor(height / 4);
      for (let r = 0; r < winRows; r++) {
        for (let c = 0; c < 3; c++) {
          const winGeom = new THREE.PlaneGeometry(1.5, 2);
          const isLit = Math.random() > 0.7;
          const winMat = new THREE.MeshStandardMaterial({ 
            color: isLit ? 0xffffaa : 0x222222, 
            emissive: isLit ? 0xffffaa : 0x000000, 
            emissiveIntensity: 0.5 
          });
          const win = new THREE.Mesh(winGeom, winMat);
          win.position.set(side * 10.01, 3 + r * 4, -zPos + (c * 10 - 10));
          win.rotation.y = side * Math.PI / 2;
          this.scene.add(win);
          this.sideDecorations.push(win);
        }
      }
    }

    // NPCs (People walking on sidewalks)
    for (let i = 0; i < 3; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const npc = this.createNPC();
      const zOffset = Math.random() * 40 - 20;
      npc.position.set(side * (7 + Math.random() * 2), 0, -zPos + zOffset);
      // Face direction of walking (randomly forward or backward)
      npc.rotation.y = Math.random() > 0.5 ? 0 : Math.PI;
      this.scene.add(npc);
      this.npcs.push(npc);
    }

    // Street Lights
    if (zPos % 40 === 0) {
      const poleGeom = new THREE.CylinderGeometry(0.1, 0.1, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const pole = new THREE.Mesh(poleGeom, poleMat);
      pole.position.set(-6.5, 4, -zPos);
      this.scene.add(pole);
      this.sideDecorations.push(pole);

      const lampGeom = new THREE.BoxGeometry(1, 0.2, 0.5);
      const lamp = new THREE.Mesh(lampGeom, poleMat);
      lamp.position.set(-6, 8, -zPos);
      this.scene.add(lamp);
      this.sideDecorations.push(lamp);

      const light = new THREE.PointLight(0xffffaa, 0.5, 15);
      light.position.set(-5.5, 7.8, -zPos);
      this.scene.add(light);
      this.sideDecorations.push(light);
    }

    // Trees
    if (Math.random() > 0.6) {
      const trunkGeom = new THREE.CylinderGeometry(0.2, 0.3, 2);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d2926 });
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.set(7, 1, -zPos + (Math.random() * 20 - 10));
      this.scene.add(trunk);
      this.sideDecorations.push(trunk);

      const leavesGeom = new THREE.SphereGeometry(1.5, 8, 8);
      const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
      const leaves = new THREE.Mesh(leavesGeom, leavesMat);
      leaves.position.set(trunk.position.x, 2.5, trunk.position.z);
      this.scene.add(leaves);
      this.sideDecorations.push(leaves);
    }

    // Clouds
    if (Math.random() > 0.7) {
      const cloudGroup = new THREE.Group();
      const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
      for (let i = 0; i < 3; i++) {
        const s = 1 + Math.random() * 2;
        const part = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 8), cloudMat);
        part.position.set(i * 1.5, Math.random(), Math.random());
        cloudGroup.add(part);
      }
      cloudGroup.position.set(Math.random() * 40 - 20, 20 + Math.random() * 10, -zPos - 20);
      this.scene.add(cloudGroup);
      this.clouds.push(cloudGroup);
    }

    // Bridges
    if (zPos % 120 === 0 && zPos > 0) {
      const bridgeGroup = new THREE.Group();
      const pillarGeom = new THREE.BoxGeometry(1, 15, 2);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
      
      const p1 = new THREE.Mesh(pillarGeom, pillarMat);
      p1.position.set(-6, 7.5, 0);
      bridgeGroup.add(p1);
      
      const p2 = new THREE.Mesh(pillarGeom, pillarMat);
      p2.position.set(6, 7.5, 0);
      bridgeGroup.add(p2);
      
      const topGeom = new THREE.BoxGeometry(14, 2, 4);
      const top = new THREE.Mesh(topGeom, pillarMat);
      top.position.y = 14;
      bridgeGroup.add(top);
      
      bridgeGroup.position.z = -zPos;
      this.scene.add(bridgeGroup);
      this.bridges.push(bridgeGroup);
    }

    // Add some graffiti to walls
    if (Math.random() > 0.5) {
      const grafGeom = new THREE.PlaneGeometry(5, 5);
      const grafMat = new THREE.MeshStandardMaterial({ 
        color: Math.random() * 0xffffff, 
        transparent: true, 
        opacity: 0.7 
      });
      const graf = new THREE.Mesh(grafGeom, grafMat);
      graf.position.set(6.01, 4, -zPos + (Math.random() * 20 - 10));
      graf.rotation.y = -Math.PI / 2;
      this.scene.add(graf);
      this.sideDecorations.push(graf);
    }

    // Add some rails
    const railGeom = new THREE.BoxGeometry(0.2, 0.1, 40);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x777777 });
    
    [-3, 0, 3].forEach(x => {
      const rail1 = new THREE.Mesh(railGeom, railMat);
      rail1.position.set(x - 0.5, 0.05, -zPos);
      this.scene.add(rail1);
      
      const rail2 = new THREE.Mesh(railGeom, railMat);
      rail2.position.set(x + 0.5, 0.05, -zPos);
      this.scene.add(rail2);
    });

    // Spawn obstacles and coins after a safe distance
    if (zPos > 120) {
      this.spawnObstacles(zPos);
    }
  }

  private createRealisticTrain(x: number, z: number) {
    const trainGroup = new THREE.Group();
    
    // Main Body (Red)
    const bodyGeom = new THREE.BoxGeometry(2.2, 2.8, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: 0xcc0000, 
      metalness: 0.6, 
      roughness: 0.3 
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = -0.2;
    body.castShadow = true;
    body.receiveShadow = true;
    trainGroup.add(body);

    // Rounded Roof (Not square)
    const roofGeom = new THREE.CylinderGeometry(1.1, 1.1, 12, 16, 1, false, 0, Math.PI);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xaa0000 });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 1.2;
    trainGroup.add(roof);

    // Rounded Front (Aerodynamic look)
    const frontGeom = new THREE.SphereGeometry(1.1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const front = new THREE.Mesh(frontGeom, bodyMat);
    front.rotation.x = -Math.PI / 2;
    front.position.set(0, 1.2, -6);
    trainGroup.add(front);

    const frontBottomGeom = new THREE.CylinderGeometry(1.1, 1.1, 2.8, 16, 1, false, 0, Math.PI);
    const frontBottom = new THREE.Mesh(frontBottomGeom, bodyMat);
    frontBottom.rotation.z = Math.PI;
    frontBottom.position.set(0, -0.2, -6);
    trainGroup.add(frontBottom);

    // Small Windows (Dark glass)
    const winGeom = new THREE.PlaneGeometry(0.6, 0.6); // Smaller windows
    const winMat = new THREE.MeshStandardMaterial({ 
      color: 0x111111, 
      metalness: 0.9, 
      roughness: 0.1,
      emissive: 0x111111,
      emissiveIntensity: 0.3
    });

    for (let side = -1; side <= 1; side += 2) {
      if (side === 0) continue;
      for (let i = 0; i < 6; i++) { // More windows because they are smaller
        const win = new THREE.Mesh(winGeom, winMat);
        win.position.set(side * 1.11, 0.6, -4.5 + i * 1.8);
        win.rotation.y = side * Math.PI / 2;
        trainGroup.add(win);
      }
    }

    // Doors
    const doorGeom = new THREE.PlaneGeometry(1.2, 2.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x880000, metalness: 0.4 });
    for (let side = -1; side <= 1; side += 2) {
      if (side === 0) continue;
      const door = new THREE.Mesh(doorGeom, doorMat);
      door.position.set(side * 1.11, -0.5, 0);
      door.rotation.y = side * Math.PI / 2;
      trainGroup.add(door);
    }

    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (let side = -1; side <= 1; side += 2) {
      for (let pos = -1; pos <= 1; pos += 2) {
        const wheel = new THREE.Mesh(wheelGeom, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 0.9, -1.5, pos * 4);
        trainGroup.add(wheel);
      }
    }

    // Headlights (Front)
    const lightGeom = new THREE.CircleGeometry(0.15, 16);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 1.5 });
    const leftLight = new THREE.Mesh(lightGeom, lightMat);
    leftLight.position.set(-0.6, -0.5, -6.5);
    leftLight.rotation.y = Math.PI;
    const rightLight = new THREE.Mesh(lightGeom, lightMat);
    rightLight.position.set(0.6, -0.5, -6.5);
    rightLight.rotation.y = Math.PI;
    trainGroup.add(leftLight, rightLight);

    trainGroup.position.set(x, 1.6, z);
    return trainGroup;
  }

  private spawnObstacles(zPos: number) {
    // No obstacles for the first 5 seconds of gameplay
    if (this.gameTime < 5) return;

    const lanes = [-this.laneWidth, 0, this.laneWidth];
    
    lanes.forEach(x => {
      const rand = Math.random();
      if (rand > 0.7) {
        const type = Math.random() > 0.5 ? 'train' : 'barrier';
        if (type === 'train') {
          const train = this.createRealisticTrain(x, -zPos - (Math.random() * 20));
          this.scene.add(train);
          this.obstacles.push(train);
        } else {
          const isHigh = Math.random() > 0.7;
          const geom = isHigh ? new THREE.BoxGeometry(2.5, 0.5, 0.5) : new THREE.BoxGeometry(2.5, 1, 0.5);
          const mat = new THREE.MeshStandardMaterial({ color: isHigh ? 0xff00ff : 0xffff00 });
          const barrier = new THREE.Mesh(geom, mat);
          barrier.position.set(x, isHigh ? 2.5 : 0.5, -zPos - (Math.random() * 20));
          (barrier as any).isHigh = isHigh;
          barrier.castShadow = true;
          this.scene.add(barrier);
          this.obstacles.push(barrier);
        }
      } else if (rand > 0.4) {
        // Spawn coin
        const geom = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
        const coin = new THREE.Mesh(geom, mat);
        coin.rotation.x = Math.PI / 2;
        coin.position.set(x, 1, -zPos - (Math.random() * 20));
        this.scene.add(coin);
        this.coins.push(coin);
      } else if (rand > 0.35) {
        // Spawn Hoverboard Powerup
        const geom = new THREE.BoxGeometry(1.2, 0.2, 2.5);
        const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.5 });
        const hoverboard = new THREE.Mesh(geom, mat);
        hoverboard.position.set(x, 0.5, -zPos - (Math.random() * 20));
        this.scene.add(hoverboard);
        this.powerups.push(hoverboard);
      }
    });
  }

  private moveLeft() {
    if (!this.isStarted || this.isGameOver || this.isPaused) return;
    this.playerLane = Math.max(-1, this.playerLane - 1);
    this.targetLaneX = this.playerLane * this.laneWidth;
  }

  private moveRight() {
    if (!this.isStarted || this.isGameOver || this.isPaused) return;
    this.playerLane = Math.min(1, this.playerLane + 1);
    this.targetLaneX = this.playerLane * this.laneWidth;
  }

  private jump() {
    if (!this.isStarted || this.isGameOver || this.isPaused) return;
    if (!this.isJumping && !this.isHoverboardActive) {
      this.isJumping = true;
      this.isRolling = false;
      this.rollTimer = 0;
      this.player.scale.y = 1;
      this.jumpVelocity = this.jumpStrength;
      this.playSound(300, 'sine', 0.2, 0.05);
    }
  }

  private roll() {
    if (!this.isStarted || this.isGameOver || this.isPaused) return;
    if (!this.isRolling && !this.isJumping && !this.isHoverboardActive) {
      this.isRolling = true;
      this.rollTimer = 0.8; // 0.8 seconds roll
      this.playSound(200, 'sawtooth', 0.1, 0.1);
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'a') {
      this.moveLeft();
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
      this.moveRight();
    } else if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') ) {
      this.jump();
    } else if (e.key === 'ArrowDown' || e.key === 's') {
      this.roll();
    }
  }

  private handleResize(container: HTMLElement) {
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  public start() {
    this.isStarted = true;
    this.isPaused = false;
    // animate() is already running from constructor
  }

  public pause() {
    if (this.isStarted && !this.isGameOver) {
      this.isPaused = true;
      this.updateState();
    }
  }

  public resume() {
    if (this.isStarted && !this.isGameOver && this.isPaused) {
      this.isPaused = false;
      this.animate();
      this.updateState();
    }
  }

  public setAccessories(hat: boolean, shoes: boolean, shirtColor: number = 0xff4444, hatColor: number = 0x333333, shoeColor: number = 0xffffff, pantsColor: number = 0x333333) {
    this.playerHat.visible = hat;
    this.playerShoes.visible = shoes;
    
    // Update torso and arms color
    (this.torso.material as THREE.MeshStandardMaterial).color.setHex(shirtColor);
    (this.leftArm.material as THREE.MeshStandardMaterial).color.setHex(shirtColor);
    (this.rightArm.material as THREE.MeshStandardMaterial).color.setHex(shirtColor);

    // Update hat color
    (this.playerHat.material as THREE.MeshStandardMaterial).color.setHex(hatColor);

    // Update shoes color
    this.playerShoes.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        (child.material as THREE.MeshStandardMaterial).color.setHex(shoeColor);
      }
    });

    // Update pants (legs) color
    (this.leftLeg.material as THREE.MeshStandardMaterial).color.setHex(pantsColor);
    (this.rightLeg.material as THREE.MeshStandardMaterial).color.setHex(pantsColor);
  }

  public reset() {
    this.isGameOver = false;
    this.isPaused = false;
    this.score = 0;
    this.gameTime = 0;
    this.collectedCoins = 0;
    this.gameSpeed = 15;
    this.playerLane = 0;
    this.targetLaneX = 0;
    this.playerY = 0;
    this.targetY = 0;
    this.groundY = 0;
    this.player.position.set(0, 0, 0);
    this.police.position.set(0, 0, 5);
    this.isHoverboardActive = false;
    this.hoverboardTimer = 0;
    this.hoverboardMesh.visible = false;
    this.hoverboardLight.intensity = 0;
    this.isJumping = false;
    this.jumpVelocity = 0;
    this.playerY = 0;
    this.targetY = 0;
    
    // Clear obstacles, coins, powerups, npcs
    this.obstacles.forEach(o => this.scene.remove(o));
    this.coins.forEach(c => this.scene.remove(c));
    this.powerups.forEach(p => this.scene.remove(p));
    this.npcs.forEach(n => this.scene.remove(n));
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.npcs = [];
    
    this.updateState();
  }

  private createParticles(position: THREE.Vector3, color: number, count: number = 10) {
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const material = new THREE.MeshStandardMaterial({ color });

    for (let i = 0; i < count; i++) {
      const particle = new THREE.Mesh(geometry, material) as unknown as Particle;
      particle.position.copy(position);
      
      particle.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() * 5) + 2,
        (Math.random() - 0.5) * 10
      );
      particle.life = 1.0;
      
      this.scene.add(particle);
      this.particles.push(particle);
    }
  }

  private updateState() {
    this.onStateChange({
      score: Math.floor(this.score),
      coins: this.collectedCoins,
      isGameOver: this.isGameOver,
      isStarted: this.isStarted,
      isPaused: this.isPaused,
      distance: Math.floor(this.score / 10),
      isHoverboardActive: this.isHoverboardActive,
      hoverboardTimeLeft: Math.ceil(this.hoverboardTimer)
    });
  }

  private animate() {
    if (this.isPaused) return;
    requestAnimationFrame(this.animate.bind(this));

    const delta = this.clock.getDelta();
    
    if (this.isStarted && !this.isGameOver) {
      // Game Logic (Physics, Movement, etc.)
      
      // Calculate ground height based on obstacles under player
      this.groundY = 0;
      for (const obstacle of this.obstacles) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacle);
        if (this.player.position.x >= obstacleBox.min.x - 0.2 && this.player.position.x <= obstacleBox.max.x + 0.2) {
          if (0 >= obstacleBox.min.z && 0 <= obstacleBox.max.z) {
            if (this.playerY >= obstacleBox.max.y - 0.5) {
              this.groundY = Math.max(this.groundY, obstacleBox.max.y);
            }
          }
        }
      }

      // Hoverboard logic
      if (this.isHoverboardActive) {
        this.hoverboardTimer -= delta;
        this.targetY = 4;
        this.hoverboardMesh.visible = true;
        this.hoverboardLight.intensity = 2 + Math.sin(this.score * 0.1) * 0.5;
        if (Math.random() > 0.5) {
          this.createParticles(this.player.position.clone().add(new THREE.Vector3(0, -0.2, 1)), 0x00ff00, 2);
        }
        if (this.hoverboardTimer <= 0) {
          this.isHoverboardActive = false;
          this.targetY = this.groundY;
          this.hoverboardMesh.visible = false;
          this.hoverboardLight.intensity = 0;
        }
      } else {
        if (this.isRolling) {
          this.rollTimer -= delta;
          this.player.scale.y = 0.5;
          if (this.rollTimer <= 0) {
            this.isRolling = false;
            this.player.scale.y = 1;
          }
        }

        if (this.isJumping || this.playerY > this.groundY) {
          this.playerY += this.jumpVelocity * delta;
          this.jumpVelocity -= this.gravity * delta;
          if (this.playerY <= this.groundY) {
            this.playerY = this.groundY;
            this.isJumping = false;
            this.jumpVelocity = 0;
          }
        } else {
          this.playerY = this.groundY;
        }
        this.targetY = this.playerY;
      }

      this.player.position.x += (this.targetLaneX - this.player.position.x) * 15 * delta;
      this.player.position.y = this.playerY;

      const runCycle = Math.sin(this.score * 0.8);
      this.leftLeg.rotation.x = runCycle * 0.5;
      this.rightLeg.rotation.x = -runCycle * 0.5;
      this.leftArm.rotation.x = -runCycle * 0.5;
      this.rightArm.rotation.x = runCycle * 0.5;

      const policeTargetX = this.player.position.x;
      const policeTargetZ = (this.isHoverboardActive || this.playerY > 1) ? 10 : 4;
      this.police.position.x += (policeTargetX - this.police.position.x) * 10 * delta;
      this.police.position.z += (policeTargetZ - this.police.position.z) * 2 * delta;
      this.police.position.y = Math.abs(Math.sin(this.score * 0.5)) * 0.2;
      this.policeLeftLeg.rotation.x = -runCycle * 0.5;
      this.policeRightLeg.rotation.x = runCycle * 0.5;
      this.policeLeftArm.rotation.x = runCycle * 0.5;
      this.policeRightArm.rotation.x = -runCycle * 0.5;

      const moveDist = this.gameSpeed * delta;
      this.score += moveDist;
      this.gameSpeed += 0.05 * delta;
      this.gameTime += delta;

      // Update obstacles
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obstacle = this.obstacles[i];
        obstacle.position.z += moveDist;
        if (!this.isHoverboardActive) {
          const playerBox = new THREE.Box3().setFromObject(this.player);
          const obstacleBox = new THREE.Box3().setFromObject(obstacle);
          playerBox.expandByScalar(-0.1);
          
          let isColliding = playerBox.intersectsBox(obstacleBox);
          
          // Special case for high barriers: can roll under them
          if (isColliding && (obstacle as any).isHigh && this.isRolling) {
            isColliding = false;
          }

          if (isColliding && this.playerY < obstacleBox.max.y - 0.2) {
            this.playSound(100, 'sawtooth', 0.5, 0.2);
            this.createParticles(this.player.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff0000, 20);
            this.isGameOver = true;
            this.police.position.set(this.player.position.x, this.player.position.y, this.player.position.z + 1.5);
            this.police.lookAt(this.player.position);
            this.updateState();
            return;
          }
        }
        if (obstacle.position.z > 15) {
          this.scene.remove(obstacle);
          this.obstacles.splice(i, 1);
        }
      }

      // Update coins
      for (let i = this.coins.length - 1; i >= 0; i--) {
        const coin = this.coins[i];
        coin.position.z += moveDist;
        coin.rotation.y += 2 * delta;
        const playerBox = new THREE.Box3().setFromObject(this.player);
        const coinBox = new THREE.Box3().setFromObject(coin);
        if (playerBox.intersectsBox(coinBox)) {
          this.collectedCoins++;
          this.playSound(800, 'sine', 0.1, 0.1);
          this.createParticles(coin.position.clone(), 0xffd700, 12);
          this.scene.remove(coin);
          this.coins.splice(i, 1);
          this.updateState();
          continue;
        }
        if (coin.position.z > 15) {
          this.scene.remove(coin);
          this.coins.splice(i, 1);
        }
      }

      // Update powerups
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const p = this.powerups[i];
        p.position.z += moveDist;
        p.rotation.y += delta;
        const playerBox = new THREE.Box3().setFromObject(this.player);
        const pBox = new THREE.Box3().setFromObject(p);
        if (playerBox.intersectsBox(pBox)) {
          this.isHoverboardActive = true;
          this.hoverboardTimer = this.hoverboardDuration;
          this.playSound(400, 'square', 0.3, 0.1);
          this.createParticles(p.position.clone(), 0x00ff00, 15);
          this.scene.remove(p);
          this.powerups.splice(i, 1);
          this.updateState();
          continue;
        }
        if (p.position.z > 15) {
          this.scene.remove(p);
          this.powerups.splice(i, 1);
        }
      }

      // Update tracks and side decorations
      this.tracks.forEach(track => {
        track.position.z += moveDist;
        if (track.position.z > 40) {
          track.position.z -= 5 * 40;
          this.spawnObstacles(-track.position.z);
        }
      });

      this.sideDecorations.forEach(dec => {
        dec.position.z += moveDist;
        if (dec.position.z > 40) {
          dec.position.z -= 5 * 40;
        }
      });

      this.bridges.forEach(bridge => {
        bridge.position.z += moveDist;
        if (bridge.position.z > 40) {
          bridge.position.z -= 5 * 40;
        }
      });

      // Update NPCs
      for (let i = this.npcs.length - 1; i >= 0; i--) {
        const npc = this.npcs[i] as any;
        npc.position.z += moveDist;
        
        // Walk animation
        const walkCycle = Math.sin(this.score * 0.5 + npc.walkOffset);
        npc.leftLeg.rotation.x = walkCycle * 0.5;
        npc.rightLeg.rotation.x = -walkCycle * 0.5;
        
        // Move NPC slightly forward/backward on sidewalk
        const walkDir = npc.rotation.y === 0 ? 1 : -1;
        npc.position.z += walkDir * npc.walkSpeed * delta;

        if (npc.position.z > 15) {
          this.scene.remove(npc);
          this.npcs.splice(i, 1);
        }
      }

      // Update clouds
      this.clouds.forEach(cloud => {
        cloud.position.z += moveDist * 0.5;
        if (cloud.position.z > 40) {
          cloud.position.z -= 200;
        }
      });
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.position.add(p.velocity.clone().multiplyScalar(delta));
      p.velocity.y -= 9.8 * delta;
      p.life -= delta * 2;
      p.scale.setScalar(p.life);
      if (p.life <= 0) {
        this.scene.remove(p);
        this.particles.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
    if (this.isStarted) this.updateState();
  }
}
