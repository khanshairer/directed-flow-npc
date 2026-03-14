import * as THREE from 'three';
import * as Setup from './setup.js';
import { InputHandler } from './input/InputHandler.js';
import { TileMap } from './maps/TileMap.js';
import { TileMapRenderer } from './renderers/TileMapRenderer.js';
import { DynamicEntity } from './entities/DynamicEntity.js';
import { DebugVisuals } from './debug/DebugVisuals.js';
import { Dijkstra } from './ai/pathfinding/Dijkstra.js';

import { GLTFLoader } from 'three/examples/jsm/Addons.js';

/**
 * World class holds all information about our game's world
 */
export class World {

  // Creates a world instance
  constructor() {
    this.scene = Setup.createScene();
    this.camera = Setup.createCamera();
    this.renderer = Setup.createRenderer();
    
    this.clock = new THREE.Clock();

    this.inputHandler = new InputHandler(this.camera);

    this.entities = [];
    
    // added ................
    this.goals = [];
    this.npcs = [];
    this.mixers = [];   
    this.Pathfinder = new Dijkstra();    
    // Debug visuals for arrows
    this.debugVisuals = new DebugVisuals(this.scene);
    
    // Add loading tracking
    this.modelsLoading = 0;
    this.modelsLoaded = 0;
    this.loadingComplete = false;
  }

  // Initialize objects in our world
  init() {
    this.map = new TileMap(2);
    Setup.createLight(this.scene);
    Setup.showHelpers(this.scene, this.camera, this.renderer, this.map);

    this.tileMapRenderer = new TileMapRenderer(this.map);
    this.tileMapRenderer.render(this.scene);
      
    // Create npc2 on the ground
    this.npc2 = new DynamicEntity({
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        color: 0x3333ff,
        scale: new THREE.Vector3(1, 1, 1)
    });

    this.addEntityToWorld(this.npc2);

    // Create ocean wave with animations
    this.createOceanWave();

    // debug arrow visuals for walkable tiles
    this.createGoals(7);
    
    // Create NPCs with loading feedback
    this.createNPCs(15);
    
    this.buildCostFieldForAllGoals();
    this.allTileArrows();
    
    // Add loading indicator
    this.createLoadingIndicator();
  }
  
  // Create ocean wave with animations
  createOceanWave() {
    console.log('Creating ocean wave...');
    
    // Load the ocean wave model
    const loader = new GLTFLoader();
    loader.load(
      './ocean_wave/scene.gltf', // Adjust path based on your structure
      (gltf) => {
        console.log('✅ Ocean wave loaded!', gltf);
        
        const model = gltf.scene;
        
        // Scale the wave to cover the map
        // Your map is 25x25, so scale accordingly
        model.scale.set(30, 30, 30);
        model.position.set(0, -0.2, 0); // Slightly below ground level
        
        // Add to scene directly
        this.scene.add(model);
        
        // Handle animations
        if (gltf.animations && gltf.animations.length > 0) {
          console.log('Wave animations found:', gltf.animations.map(a => a.name));
          
          const mixer = new THREE.AnimationMixer(model);
          
          // Play all animations
          gltf.animations.forEach((clip, index) => {
            const action = mixer.clipAction(clip);
            action.play();
            console.log(`Playing wave animation ${index}: ${clip.name}`);
          });
          
          this.mixers.push(mixer);
        } else {
          console.log('No animations found in ocean wave model');
        }
      },
      (progress) => {
        console.log(`Loading ocean wave: ${(progress.loaded / progress.total * 100).toFixed(1)}%`);
      },
      (error) => {
        console.error('❌ Error loading ocean wave:', error);
        
        // Create a fallback ocean plane if model fails to load
        this.createFallbackOcean();
      }
    );
  }
  
  // Create a fallback ocean plane
  createFallbackOcean() {
    console.log('Creating fallback ocean plane...');
    
    // Create a large plane with wave animation
    const geometry = new THREE.PlaneGeometry(50, 50, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      color: 0x1a4d8c,
      emissive: 0x0a2351,
      transparent: true,
      opacity: 0.9,
      wireframe: false,
      side: THREE.DoubleSide
    });
    
    const ocean = new THREE.Mesh(geometry, material);
    ocean.rotation.x = -Math.PI / 2; // Lay flat
    ocean.position.y = 1.4;
    
    // Store original vertices for animation
    const positions = geometry.attributes.position.array;
    const originalY = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) {
      originalY[i] = positions[i];
    }
    
    // Add custom wave animation
    ocean.userData = {
      time: 0,
      animate: (dt) => {
        ocean.userData.time += dt;
        const positions = geometry.attributes.position.array;
        
        for (let i = 2; i < positions.length; i += 3) {
          const x = positions[i-2];
          const z = positions[i-1];
          // Simple wave formula
          positions[i] = originalY[i] + 
            Math.sin(x * 0.3 + ocean.userData.time * 2) * 0.2 + 
            Math.cos(z * 0.3 + ocean.userData.time * 1.5) * 0.2;
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
      }
    };
    
    this.scene.add(ocean);
    this.oceanWave = ocean; // Store reference for animation
  }
  
  // Create a loading indicator in the scene
  createLoadingIndicator() {
    // Create a text sprite or simple indicator
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Loading boats...', 10, 50);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    this.loadingSprite = new THREE.Sprite(material);
    this.loadingSprite.position.set(0, 5, 0);
    this.loadingSprite.scale.set(5, 2.5, 1);
    this.scene.add(this.loadingSprite);
  }
  
  // Update loading indicator
  updateLoadingIndicator() {
    if (this.loadingComplete) return;
    
    const progress = (this.modelsLoaded / this.modelsLoading) * 100;
    
    // Update canvas text
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Loading: ${Math.round(progress)}%`, 10, 50);
    
    // Draw progress bar
    ctx.fillStyle = '#333';
    ctx.fillRect(10, 70, 200, 20);
    ctx.fillStyle = '#0f0';
    ctx.fillRect(10, 70, 200 * (progress/100), 20);
    
    const texture = new THREE.CanvasTexture(canvas);
    this.loadingSprite.material.map = texture;
    this.loadingSprite.material.needsUpdate = true;
    
    if (this.modelsLoaded === this.modelsLoading && this.modelsLoading > 0) {
      this.loadingComplete = true;
      setTimeout(() => {
        this.scene.remove(this.loadingSprite);
      }, 2000);
    }
  }

  // create 5 random goal in the world 
  // create goals in the world with pier models
createGoals(numGoals = 5) {
  console.log(`Creating ${numGoals} pier goals...`);
  
  var goalCount = 0;
  var maxAttempts = 1000;
  var attempts = 0;
  
  // Store pier entities for loading tracking
  this.piers = [];
  this.piersLoading = numGoals;
  this.piersLoaded = 0;
  
  while (goalCount < numGoals && attempts < maxAttempts) {
    attempts++;
    
    let randomTile = this.map.walkableTiles[Math.floor(Math.random() * this.map.walkableTiles.length)];
    
    if (this.goals.some(g => g.row === randomTile.row && g.col === randomTile.col)) {
      continue;
    }
    
    // Check all 8 adjacent directions for existing goals
    let isAdjacentToGoal = this.goals.some(goal => {
      let rowDiff = Math.abs(goal.row - randomTile.row);
      let colDiff = Math.abs(goal.col - randomTile.col);
      
      return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
    });
    
    if (!isAdjacentToGoal) {
      // Get position for this goal
      let position = this.map.localize(randomTile);
      
      // Create a temporary visual marker (colored cube) while pier loads
      const tempGeometry = new THREE.BoxGeometry(2, 2, 2);
      const tempMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffdd44,
        emissive: 0x442200,
        transparent: true,
        opacity: 0.8
      });
      const tempMarker = new THREE.Mesh(tempGeometry, tempMaterial);
      tempMarker.position.copy(position);
      tempMarker.position.y = 1;
      this.scene.add(tempMarker);
      
      // Load pier model
      const loader = new GLTFLoader();
      loader.load(
        './pier/scene.gltf', // Adjust path based on your structure
        (gltf) => {
          console.log(`✅ Pier model loaded for goal ${goalCount}`);
          
          const model = gltf.scene;
          
          // Remove temporary marker
          this.scene.remove(tempMarker);
          
          // Scale and position the pier
          model.scale.set(2, 2, 2); // Adjust scale as needed
          model.position.copy(position);
          model.position.y = 0; // Ground level
          
          // Center the pier on ground
          const box = new THREE.Box3().setFromObject(model);
          model.position.y = -box.min.y;
          
          // Add random rotation for variety
          model.rotation.y = Math.random() * Math.PI * 2;
          
          // Add to scene
          this.scene.add(model);
          
          // Store reference
          this.piers.push({
            mesh: model,
            tile: randomTile,
            position: position
          });
          
          // Track loading progress
          this.piersLoaded++;
          console.log(`Loaded ${this.piersLoaded}/${this.piersLoading} piers`);
        },
        (progress) => {
          // Optional progress
        },
        (error) => {
          console.error(`❌ Error loading pier model:`, error);
          
          // Keep temporary marker as fallback but make it solid
          tempMarker.material.wireframe = false;
          tempMarker.material.color.setHex(0xffaa00);
          tempMarker.material.emissive.setHex(0x332200);
          tempMarker.material.transparent = false;
          
          // Still store as goal
          this.piers.push({
            mesh: tempMarker,
            tile: randomTile,
            position: position
          });
          
          this.piersLoaded++;
        }
      );
      
      // Mark this tile as a goal
      this.goals.push(randomTile);
      goalCount++;
    }
  }
  
  if (goalCount < numGoals) {
    console.warn(`Only able to place ${goalCount} out of ${numGoals} non-adjacent piers`);
  }
}

  // create npcs with visual loading feedback
  createNPCs(numNPCs = 10) {
    console.log(`Creating ${numNPCs} NPCs...`);
    console.log(`Map has ${this.map.walkableTiles.length} walkable tiles`);
    
    this.modelsLoading = numNPCs;
    this.modelsLoaded = 0;
    
    for (let i = 0; i < numNPCs; i++) {
      let randomTile = this.map.walkableTiles[Math.floor(Math.random() * this.map.walkableTiles.length)];
      let position = this.map.localize(randomTile);
      
      console.log(`NPC ${i} placed at tile (${randomTile.row}, ${randomTile.col}) -> position (${position.x}, ${position.y}, ${position.z})`);
      
      // Create NPC entity with a temporary loading cube
      let npc = new DynamicEntity({
        position: position,
        velocity: new THREE.Vector3(0, 0, 0),
        color: 0xffaa33,  // Orange color for loading
        scale: new THREE.Vector3(1, 1, 1)
      });

      

      // Add a flag to indicate if boat is loaded
      npc.boatLoaded = false;

      // Add a temporary cube that shows it's loading
      const tempGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const tempMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffaa33,
        emissive: 0x442200,
        transparent: true,
        opacity: 0.7
      });
      const tempCube = new THREE.Mesh(tempGeometry, tempMaterial);
      tempCube.position.set(0, 0.75, 0);
      npc.mesh.add(tempCube);
      
      // Add a spinning indicator
      const indicatorGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
      const indicatorMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
      const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
      indicator.position.set(0, 1.8, 0);
      indicator.userData = { spinSpeed: 0.1 };
      npc.mesh.add(indicator);
      npc.loadingIndicator = indicator;

      // Load boat model
      const loader = new GLTFLoader();
      loader.load(
        './wooden_boat/scene.gltf',
        (gltf) => {
          console.log(`✅ Boat model loaded for NPC ${i}`, gltf);
          
          const model = gltf.scene;

          // Store position before clearing
          const npcPosition = npc.position.clone();
          
          // Remove temporary loading visuals
          while(npc.mesh.children.length > 0) {
            npc.mesh.remove(npc.mesh.children[0]);
          }

          // Scale and position the boat
          model.scale.set(0.3, 0.3, 0.3);
          model.position.set(0, 0, 0);
          
          // Center the boat on ground
          const box = new THREE.Box3().setFromObject(model);
          model.position.y = -box.min.y;
          
          // Add random rotation
          model.rotation.y = Math.random() * Math.PI * 2;

          // Add the boat model
          npc.mesh.add(model);
          
          // Mark boat as loaded
          npc.boatLoaded = true;
          
          // Update color to final color
          npc.color = 0xff3333;
          
          // Handle animations
          if (gltf.animations && gltf.animations.length > 0) {
            console.log('Animations found:', gltf.animations.map(a => a.name));
            const mixer = new THREE.AnimationMixer(model);
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
            npc.mixer = mixer;
            this.mixers.push(mixer);
          }
          
          // Track loading progress
          this.modelsLoaded++;
          console.log(`Loaded ${this.modelsLoaded}/${this.modelsLoading} boats`);
          
          // Update loading indicator
          this.updateLoadingIndicator();
        },
        (progress) => {
          // Optional: show per-NPC progress
          // console.log(`NPC ${i}: ${Math.round(progress.loaded / progress.total * 100)}%`);
        },
        (error) => {
          console.error(`❌ Error loading boat for NPC ${i}:`, error);
          
          // Make the loading cube red to show error
          if (npc.mesh.children[0]) {
            npc.mesh.children[0].material.color.setHex(0xff0000);
          }
          
          // Mark as loaded (with error) so it can be considered for movement if needed
          npc.boatLoaded = true;
          npc.loadError = true;
          
          this.modelsLoaded++;
          this.updateLoadingIndicator();
        }
      );
      
      this.npcs.push(npc);
      this.addEntityToWorld(npc);
    }
    
    console.log(`Total entities after creation: ${this.entities.length}`);
    console.log(`Loading ${this.modelsLoading} boats...`);
  }

  // get the path 
  shortestPathCost(start, end) {
    let path = this.Pathfinder.findPath(start, end, this.map);
    if (path.length === 0) {
      return Infinity;
    }
    return this.Pathfinder.totalCost(path);
  }
  
  // build the uniform cost field for all the goals and grids..
  buildCostFieldForAllGoals() {
    // Reset all tiles
    for (let row of this.map.grid) {
      for (let tile of row) {
        tile.pathCost = Infinity;
      }
    }

    // Multi-source Dijkstra
    let open = [];

    for (let goal of this.goals) {
      goal.pathCost = 0;
      open.push(goal);
    }

    while (open.length > 0) {
      open.sort((a, b) => a.pathCost - b.pathCost);
      let current = open.shift();

      let neighbours = this.map.getNeighbours(current);

      for (let neighbor of neighbours) {
        let newCost = current.pathCost + neighbor.cost;

        if (newCost < neighbor.pathCost) {
          neighbor.pathCost = newCost;
          open.push(neighbor);
        }
      }
    }
  }
  
  // return the downhill direction..
  lowerCostNeighborDirection(center, map) {
    let neighbours = map.getNeighbours(center);
    let sum = new THREE.Vector3(0, 0, 0);

    let lowestNeighbor = null;
    let lowestCost = Infinity;

    for (let neighbor of neighbours) {
      let delta = center.pathCost - neighbor.pathCost;

      if (neighbor.pathCost < lowestCost) {
        lowestCost = neighbor.pathCost;
        lowestNeighbor = neighbor;
      }

      if (delta > 0) {
        let dx = neighbor.col - center.col;
        let dz = neighbor.row - center.row;

        let dir = new THREE.Vector3(dx, 0, dz).normalize();
        sum.add(dir.multiplyScalar(delta));
      }
    }

    if (sum.lengthSq() > 0) {
      return sum.normalize();
    }

    if (lowestNeighbor && lowestNeighbor.pathCost < center.pathCost) {
      let dx = lowestNeighbor.col - center.col;
      let dz = lowestNeighbor.row - center.row;
      return new THREE.Vector3(dx, 0, dz).normalize();
    }

    return new THREE.Vector3(0, 0, 0);
  }

  drawArrow(tile, direction, color = 0x000000, length = 0.6) {
    let arrow = this.debugVisuals.createArrow(tile, direction, this.map, color, length);
    
    if (!arrow) return;
    this.scene.add(arrow);
  }

  isGoal(tile) {
    for (let goal of this.goals) {
      if (tile.row === goal.row && tile.col === goal.col) {
        return true;
      }
    }
    return false;
  }

  allTileArrows() {
    for (let row of this.map.grid) {
      for (let tile of row) {
        if (!tile.isWalkable()) continue;

        if (this.isGoal(tile)) {
          tile.flowVector.set(0, 0, 0);
          continue;
        }

        let direction = this.lowerCostNeighborDirection(tile, this.map);
        tile.flowVector.copy(direction);

        if (direction.lengthSq() > 0) {
          this.drawArrow(tile, direction);
        }
      }
    }
  }

  bestNeighbor(center, map) {
    let neighbours = map.getNeighbours(center);
    let bestNeighbor = null;
    let lowestCost = center.pathCost;

    for (let neighbor of neighbours) {
      if (neighbor.pathCost < lowestCost) {
        lowestCost = neighbor.pathCost;
        bestNeighbor = neighbor;
      }
    }

    return bestNeighbor;
  }

  runVectorFieldPathFinding() {
    let speed = 0.5;

    for (let npc of this.npcs) {
      // ONLY move boats that have finished loading
      if (!npc.boatLoaded) {
        // Still loading - just spin the indicator
        if (npc.loadingIndicator) {
          npc.loadingIndicator.rotation.y += 0.1;
        }
        continue; // Skip movement for loading boats
      }

      let currentTile = this.map.quantize(npc.position);
      let oldPosition = npc.position.clone();

      if (this.isGoal(currentTile)) {
        npc.velocity.set(0, 0, 0);
        continue;
      }

      let dir = currentTile.flowVector.clone();

      if (dir.lengthSq() > 0.0001) {
        dir.normalize();
        npc.velocity.copy(dir.multiplyScalar(speed));
        
        // Calculate the rotation angle from velocity
        // For boats/characters, we use atan2(x, z) because rotation is around Y axis
        let angle = Math.atan2(npc.velocity.x, npc.velocity.z);
        
        // Apply smooth rotation (optional - removes snapping)
        // Get current rotation
        let currentAngle = npc.mesh.rotation.y;
        
        // Calculate the shortest angle difference
        let angleDiff = angle - currentAngle;
        
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Smoothly rotate towards target angle (0.1 = rotation speed)
        npc.mesh.rotation.y += angleDiff * 0.1;
        
      } else {
        npc.velocity.set(0, 0, 0);
      }
    }
  }

  // Add an entity to the world
  addEntityToWorld(entity) {
    this.scene.add(entity.mesh);
    this.entities.push(entity);
  }

  // Update our world
  update() {
    let dt = this.clock.getDelta();
    
    // Update animation mixers for loaded boats
    for (let mixer of this.mixers) {
      mixer.update(dt);
    }
    
    // Update custom ocean wave animation if it exists
    if (this.oceanWave && this.oceanWave.userData && this.oceanWave.userData.animate) {
      this.oceanWave.userData.animate(dt);
    }
    
    // ONLY run pathfinding if ALL boats are loaded
    if (this.modelsLoaded === this.modelsLoading && this.modelsLoading > 0) {
      this.runVectorFieldPathFinding();
    } else {
      // While loading, just spin the indicators
      for (let npc of this.npcs) {
        if (npc.loadingIndicator) {
          npc.loadingIndicator.rotation.y += 0.1;
        }
      }
    }

    // Update all entities
    for (let e of this.entities) {
      if (e.update) {
        e.update(dt, this.map);
      }
    }
  }
  
  // Render our world
  render() {
    this.renderer.render(this.scene, this.camera);
  }

}