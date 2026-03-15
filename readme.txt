Assignment 4 - Vector Field Pathfinding
Name: Sharier Khan

Overview
This project implements a multi-goal vector field pathfinding system on a randomly generated tile map. The world contains four tile types, including obstacles, and NPC boats move through the environment by following flow vectors stored in each walkable tile. Instead of running a full pathfinding search for every NPC, the vector field is precomputed once and then reused by all entities.

Algorithm Implementation
The algorithm is implemented in two main stages.

1. Multi-goal cost field generation
A modified multi-source Dijkstra approach is used to build a cost field for the entire map. All goal tiles are inserted into the open list at the beginning with pathCost = 0. The algorithm then expands outward from all goals at once. For each neighbor, a new path cost is computed using the current tile cost plus the neighbor terrain cost. If the new value is smaller than the neighbor’s current pathCost, the neighbor is updated and added back into the open list. This continues until the lowest cost to every reachable walkable tile has been found.

2. Vector field generation
After the cost field is built, each walkable tile is assigned a downhill flow vector. For goal tiles, the flow vector is set to zero. For all other walkable tiles, the neighboring tiles are checked and a direction is chosen based on lower path cost. The flow vector points toward a lower-cost neighbor so that NPCs can move step by step toward the nearest goal. If multiple downhill neighbors exist, the direction is computed using weighted cost differences. If no weighted result is available, the steepest descent neighbor is used as a fallback.

3. NPC flow steering
Each NPC determines its current tile by quantizing its world position. It then reads that tile’s flow vector and moves toward the center of the next target tile. This allows all NPCs to share the same vector field and flow naturally through the map without individually running Dijkstra or A*.

Creative Additions
The project also includes several presentation and gameplay improvements:

- Ocean wave GLTF model added to improve the environment
- Fallback animated ocean plane created in case the ocean model fails to load
- Wooden boat GLTF models used for NPCs instead of only primitive meshes
- Loading indicators added while boat models are being loaded
- On-screen loading progress sprite displays current boat loading status
- Pier GLTF models used as goals for better visual presentation
- Temporary markers shown while goal models are loading
- Debug arrow visualization used to display the vector field
- Animation mixers support animated imported models
- Random goal placement and random NPC placement on each refresh

Changes Made to the Starter Code
The following changes were made to the starter code:

1. Added new world state fields
- goals array
- npcs array
- mixers array
- Pathfinder / pathfinder reference using Dijkstra
- debugVisuals
- model loading counters and flags

2. Added goal generation
- Implemented createGoals(numGoals)
- Added random goal placement on valid walkable tiles
- Prevented duplicate and adjacent goals
- Added pier model loading for goal visualization
- Added temporary fallback markers when goal models are loading or fail

3. Added NPC generation
- Implemented createNPCs(numNPCs)
- Spawned multiple NPC boats on random walkable tiles
- Added model loading feedback using temporary cubes and spinning indicators
- Loaded wooden boat GLTF models for NPCs
- Stored boat orientation data for steering rotation

4. Added cost field generation
- Implemented buildCostFieldForAllGoals()
- Used a multi-source Dijkstra expansion from all goals

5. Added vector field generation
- Implemented allTileArrows()
- Implemented isGoal(tile)
- Implemented bestNeighbor(center, map)
- Implemented lowerCostNeighborDirection(center, map)
- Added vector visualization with drawArrow()

6. Added flow steering behavior
- Implemented runVectorFieldPathFinding()
- NPCs follow the flow vector of their current tile
- NPCs move toward target tile centers
- NPCs stop when they reach a goal

7. Added environment visuals
- Implemented createOceanWave()
- Implemented createFallbackOcean()
- Added animated ocean support

8. Added loading UI
- Implemented createLoadingIndicator()
- Implemented updateLoadingIndicator()
- Boats only begin movement after model loading is complete

Files Added or Modified
Modified:
- World.js

Additional Assets Used
- ocean_wave/scene.gltf
- wooden_boat/scene.gltf
- pier/scene.gltf

Notes
The main idea of this implementation is to compute the navigation field once and reuse it for all NPCs. This makes the system more efficient for many moving entities and matches the intended vector field pathfinding approach from class.

How to Run
Open the project as usual and refresh the page to generate a new random map, random goals, and random NPC positions.