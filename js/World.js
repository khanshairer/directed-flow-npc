import * as THREE from 'three';
import * as Setup from './setup.js';
import { InputHandler } from './input/InputHandler.js';
import { TileMap } from './maps/TileMap.js';
import { TileMapRenderer } from './renderers/TileMapRenderer.js';
import { DynamicEntity } from './entities/DynamicEntity.js';


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
  }

  // Initialize objects in our world
  init() {
    this.map = new TileMap(2);
    
    Setup.createLight(this.scene);
    Setup.showHelpers(this.scene, this.camera, this.renderer, this.map);

    this.tileMapRenderer = new TileMapRenderer(this.map);
    this.tileMapRenderer.render(this.scene);
    this.createGoals(5);
    this.createNPCs(10);    
    
}

// create 5 random goal in the world 
 createGoals(numGoals = 5) {
  var goalCount = 0;
  var maxAttempts = 1000;
  var attempts = 0;
  
  while (goalCount < numGoals && attempts < maxAttempts) {
    attempts++;
    
    let randomTile = this.map.walkableTiles[Math.floor(Math.random() * this.map.walkableTiles.length)];
    
    if (this.goals.some(g => g.row === randomTile.row && g.col === randomTile.col)) {
      continue;
    }
    
    // Check all 8 adjacent directions (including diagonals)
    let isAdjacentToGoal = this.goals.some(goal => {
      let rowDiff = Math.abs(goal.row - randomTile.row);
      let colDiff = Math.abs(goal.col - randomTile.col);
      
      // Adjacent if within 1 cell in any direction (including diagonals)
      return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
    });
    
    if (!isAdjacentToGoal) {
      this.tileMapRenderer.setTileColor(randomTile, new THREE.Color('yellow'));
      this.goals.push(randomTile);
      goalCount++;
    }
  }
  
  if (goalCount < numGoals) {
    console.warn(`Only able to place ${goalCount} out of ${numGoals} non-adjacent goals`);
  }
}

// create 10 random npcs in the world 
 createNPCs(numNPCs = 10) {
  console.log(`Creating ${numNPCs} NPCs...`);
  console.log(`Map has ${this.map.walkableTiles.length} walkable tiles`);
  
  for (let i = 0; i < numNPCs; i++) {
    let randomTile = this.map.walkableTiles[Math.floor(Math.random() * this.map.walkableTiles.length)];
    let position = this.map.localize(randomTile);
    
    console.log(`NPC ${i} placed at tile (${randomTile.row}, ${randomTile.col}) -> position (${position.x}, ${position.y}, ${position.z})`);
    
    // FIX: Pass a configuration object, not separate arguments
    let npc = new DynamicEntity({
      position: position,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        0,
        (Math.random() - 0.5) * 2
      ),
      color: 0xff3333,  // Bright red
      scale: new THREE.Vector3(0.5, 0.8, 0.5)
    });
    
    this.npcs.push(npc);
    this.addEntityToWorld(npc);
  }
  
  console.log(`Total entities after creation: ${this.entities.length}`);
}
  // Add an entity to the world
  addEntityToWorld(entity) {
    this.scene.add(entity.mesh);
    this.entities.push(entity);
  }

  // Update our world
  update() {
    let dt = this.clock.getDelta();
    console.log("length of goals : ", this.goals.length);
    for (let e of this.entities) {
      if (e.update)
        e.update(dt, this.map);
    }
  }

  // Render our world
  render() {
    this.renderer.render(this.scene, this.camera);
  }

}