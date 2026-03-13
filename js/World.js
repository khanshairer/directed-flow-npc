import * as THREE from 'three';
import * as Setup from './setup.js';
import { InputHandler } from './input/InputHandler.js';
import { TileMap } from './maps/TileMap.js';
import { TileMapRenderer } from './renderers/TileMapRenderer.js';
import { DynamicEntity } from './entities/DynamicEntity.js';
import { DebugVisuals } from './debug/DebugVisuals.js';
import { Dijkstra } from './ai/pathfinding/Dijkstra.js';

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
    
    this.Pathfinder = new Dijkstra();    
    // Debug visuals for arrows
    this.debugVisuals = new DebugVisuals(this.scene);
  }

  // Initialize objects in our world
  init() {
    this.map = new TileMap(2);
    Setup.createLight(this.scene);
    Setup.showHelpers(this.scene, this.camera, this.renderer, this.map);

    this.tileMapRenderer = new TileMapRenderer(this.map);
    this.tileMapRenderer.render(this.scene);
    
    // debug arrow visuals for walkable tiles
    // Get a specific tile from the map
    this.createGoals(7);
    this.createNPCs(21);
    
    this.buildCostFieldForAllGoals();
    this.allTileArrows();

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
    
    // Check all 8 adjacent directions (including diagonals) for existing goals
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
    
    // Pass a configuration object
    let npc = new DynamicEntity({
      position: position,
      velocity: new THREE.Vector3(
        0,0,0
      ),
      color: 0xff3333,  
      scale: new THREE.Vector3(1, 1, 1)
    });
    
    this.npcs.push(npc);
    this.addEntityToWorld(npc);
  }
  
  console.log(`Total entities after creation: ${this.entities.length}`);
}

// get the path 
shortestPathCost(start,end){
   let path = this.Pathfinder.findPath(start, end, this.map);
    if (path.length === 0) {
      return Infinity; // No path found
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

    // Track lowest path-cost neighbour as soon in the note..
    if (neighbor.pathCost < lowestCost) {
      lowestCost = neighbor.pathCost;
      lowestNeighbor = neighbor;
    }

    // Downhill contribution
    if (delta > 0) {
      let dx = neighbor.col - center.col;
      let dz = neighbor.row - center.row;

      let dir = new THREE.Vector3(dx, 0, dz).normalize();
      sum.add(dir.multiplyScalar(delta));
    }
  }

  // Normal downhill case
  if (sum.lengthSq() > 0) {
    return sum.normalize();
  }

  // Edge-case: point to lowest-cost neighbour(even if it's not downhill - as mentioned in the note)..
  if (lowestNeighbor && lowestNeighbor.pathCost < center.pathCost) {
    let dx = lowestNeighbor.col - center.col;
    let dz = lowestNeighbor.row - center.row;
    // make the direction vector as grid size by normalizing it
    return new THREE.Vector3(dx, 0, dz).normalize();
  }

  return new THREE.Vector3(0, 0, 0);
}

drawArrow(tile, direction, color=0x000000, length=0.6) {
  let arrow = this.debugVisuals.createArrow(tile, direction, this.map, color, length);
  
  if(!arrow) return; // If arrow creation failed, skip adding to scene
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

// give direction to the npc to move to the best neighbor tile with lowest path cost
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
  let speed = 2;

  for (let npc of this.npcs) {
    let currentTile = this.map.quantize(npc.position);

    if (this.isGoal(currentTile)) {
      npc.velocity.set(0, 0, 0);
      continue;
    }

    let dir = currentTile.flowVector.clone();

    if (dir.lengthSq() > 0.0001) {
      dir.normalize();
      npc.velocity.copy(dir.multiplyScalar(speed));
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
  this.runVectorFieldPathFinding();


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