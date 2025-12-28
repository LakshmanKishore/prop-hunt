import type { RuneClient } from "rune-sdk"

export interface GameState {
  phase: "LOBBY" | "PLAYING" | "GAME_OVER"
  players: {
    [key: string]: {
      // Lobby fields
      team: "HUNTER" | "PROP"
      isReady: boolean
      
      // Game fields
      position: { x: number; y: number }
      velocity: { x: number; y: number }
      isHunter: boolean // Kept for compatibility, updated on start
      propType?: string
      isCaught: boolean
      health: number
      propChangesRemaining: number
      smokeBombsRemaining: number
      lastHitTime?: number
      rotation?: number
    }
  }

  bullets: {
    [key: string]: {
      position: { x: number; y: number }
      velocity: { x: number; y: number }
      id: string
    }
  }

  smokes: {
    [key: string]: {
      position: { x: number; y: number }
      radius: number
      duration: number
      spawnTime: number
      ownerId: string
    }
  }

  props: {
    [key: string]: {
      position: { x: number; y: number }

      isTaken: boolean
      isHit?: boolean
      propType: string
      rotation: number
      lastHitTime?: number
    }
  }

  gameOver: boolean

  remainingTime: number

  mapLayout: { x: number; y: number; width: number; height: number }[]
  roomLayout: { x: number; y: number; width: number; height: number; colorIndex: number }[]
}

type GameActions = {
  move: (joystick: { x: number; y: number }) => void
  shoot: (position: { x: number; y: number }) => void
  changeProp: () => void
  useSmokeBomb: () => void
  rotateProp: () => void
  setHunterRotation: (rotation: { angle: number }) => void
  setTeam: (team: "HUNTER" | "PROP") => void
  toggleReady: () => void
}

declare global {
  const Rune: RuneClient<GameState, GameActions>
}

import { propTypes } from "./spriteManager.ts"
const ARENA_WIDTH = 2000
const ARENA_HEIGHT = 2000
const PLAYER_RADIUS = 25
const WALL_THICKNESS = 20 // Made thicker for better visuals

const MIN_ROOM_SIZE = 500 // Slightly larger rooms
const MAX_ROOMS = 12
const DOOR_SIZE = 160

function generateMapLayout(): {
  walls: { x: number; y: number; width: number; height: number }[]
  rooms: {
    x: number
    y: number
    width: number
    height: number
    colorIndex: number
  }[]
} {
  const walls: { x: number; y: number; width: number; height: number }[] = []
  const rooms: {
    x: number
    y: number
    width: number
    height: number
    colorIndex: number
  }[] = []
  let roomCount = 0

  function divide(x: number, y: number, width: number, height: number) {
    // Base case: If max rooms reached or space is too small, this is a room
    if (
      roomCount >= MAX_ROOMS ||
      (width < MIN_ROOM_SIZE * 2 && height < MIN_ROOM_SIZE * 2)
    ) {
      rooms.push({
        x,
        y,
        width,
        height,
        colorIndex: Math.floor(Math.random() * 6), // 0-5 for 6 variants
      })
      return
    }

    roomCount++

    // Decide split direction (favor splitting the longer dimension)
    const horizontal = height > width ? true : width > height ? false : Math.random() < 0.5

    if (horizontal) {
        // Split horizontally (line across Y axis)
        // Ensure split is somewhat central to avoid tiny slivers
      const divideAt =
        Math.floor(Math.random() * (height * 0.4)) + Math.floor(height * 0.3)
      const doorAt =
        Math.floor(Math.random() * (width - DOOR_SIZE - 100)) + 50

      walls.push({ x, y: y + divideAt, width: doorAt, height: WALL_THICKNESS })
      walls.push({
        x: x + doorAt + DOOR_SIZE,
        y: y + divideAt,
        width: width - doorAt - DOOR_SIZE,
        height: WALL_THICKNESS,
      })

      divide(x, y, width, divideAt)
      divide(
        x,
        y + divideAt + WALL_THICKNESS,
        width,
        height - divideAt - WALL_THICKNESS
      )
    } else {
        // Split vertically (line across X axis)
      const divideAt =
        Math.floor(Math.random() * (width * 0.4)) + Math.floor(width * 0.3)
      const doorAt =
        Math.floor(Math.random() * (height - DOOR_SIZE - 100)) + 50

      walls.push({ x: x + divideAt, y, width: WALL_THICKNESS, height: doorAt })
      walls.push({
        x: x + divideAt,
        y: y + doorAt + DOOR_SIZE,
        width: WALL_THICKNESS,
        height: height - doorAt - DOOR_SIZE,
      })

      divide(x, y, divideAt, height)
      divide(
        x + divideAt + WALL_THICKNESS,
        y,
        width - divideAt - WALL_THICKNESS,
        height
      )
    }
  }

  // Add outer boundary walls
  walls.push({ x: 0, y: 0, width: ARENA_WIDTH, height: WALL_THICKNESS }) // Top
  walls.push({ x: 0, y: ARENA_HEIGHT - WALL_THICKNESS, width: ARENA_WIDTH, height: WALL_THICKNESS }) // Bottom
  walls.push({ x: 0, y: 0, width: WALL_THICKNESS, height: ARENA_HEIGHT }) // Left
  walls.push({ x: ARENA_WIDTH - WALL_THICKNESS, y: 0, width: WALL_THICKNESS, height: ARENA_HEIGHT }) // Right


  divide(WALL_THICKNESS, WALL_THICKNESS, ARENA_WIDTH - 2 * WALL_THICKNESS, ARENA_HEIGHT - 2 * WALL_THICKNESS)

  return { walls, rooms }
}

function isCollidingWithWall(
  x: number,
  y: number,
  radius: number,
  mapLayout: { x: number; y: number; width: number; height: number }[]
): boolean {
  for (const wall of mapLayout) {
    const closestX = Math.max(wall.x, Math.min(x, wall.x + wall.width))
    const closestY = Math.max(wall.y, Math.min(y, wall.y + wall.height))

    const distanceX = x - closestX
    const distanceY = y - closestY

    if (distanceX * distanceX + distanceY * distanceY < radius * radius) {
      return true
    }
  }
  return false
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = array.slice() // Create a copy
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

function spawnGameEntities(game: GameState) {
    const mapLayout = game.mapLayout

    // Get valid spawn points for players
    const validPlayerSpawnPoints: { x: number; y: number }[] = []
    for (
      let x = PLAYER_RADIUS;
      x < ARENA_WIDTH - PLAYER_RADIUS;
      x += PLAYER_RADIUS * 2
    ) {
      for (
        let y = PLAYER_RADIUS;
        y < ARENA_HEIGHT - PLAYER_RADIUS;
        y += PLAYER_RADIUS * 2
      ) {
        if (!isCollidingWithWall(x, y, PLAYER_RADIUS, mapLayout)) {
          validPlayerSpawnPoints.push({ x, y })
        }
      }
    }

    const shuffledSpawnPoints = shuffleArray(validPlayerSpawnPoints)
    const playerIds = Object.keys(game.players)

    // Assign positions and roles based on team choice
    playerIds.forEach((playerId, index) => {
      const player = game.players[playerId]
      const position = shuffledSpawnPoints[index] || { x: 100, y: 100 }

      player.position = position
      player.velocity = { x: 0, y: 0 }
      player.isHunter = player.team === "HUNTER"
      player.propType = player.isHunter
          ? undefined
          : propTypes[Math.floor(Math.random() * propTypes.length)]
      player.isCaught = false
      player.health = player.isHunter ? 0 : 100
      player.propChangesRemaining = player.isHunter ? 0 : 3
      player.smokeBombsRemaining = player.isHunter ? 0 : 5
      player.rotation = Math.random() * 360
    })

    // Initialize props
    const tempValidSpawnPoints: { x: number; y: number }[] = []
    // Scan the map for valid non-wall positions
    for (let x = 50; x < ARENA_WIDTH - 50; x += 40) {
      for (let y = 50; y < ARENA_HEIGHT - 50; y += 40) {
        if (!isCollidingWithWall(x, y, 30, mapLayout)) {
             tempValidSpawnPoints.push({ x, y })
        }
      }
    }
    const validSpawnPoints = shuffleArray(tempValidSpawnPoints)

    const PROP_COUNT = 100
    game.props = {} // Clear existing props
    for (let i = 0; i < PROP_COUNT; i++) {
      if (i >= validSpawnPoints.length) break

      const { x, y } = validSpawnPoints[i]

      game.props[`prop${i}`] = {
        position: { x, y },
        isTaken: false,
        propType: propTypes[Math.floor(Math.random() * propTypes.length)],
        rotation: Math.random() * 360,
      }
    }
}

Rune.initLogic({
  minPlayers: 1,
  maxPlayers: 6,
  setup: (allPlayerIds) => {
    const { walls: mapLayout, rooms } = generateMapLayout()
    const initialState: GameState = {
      phase: "LOBBY",
      players: {},
      bullets: {},
      smokes: {},
      props: {},
      gameOver: false,
      remainingTime: 300,
      mapLayout,
      roomLayout: rooms,
    }

    for (const playerId of allPlayerIds) {
        initialState.players[playerId] = {
            team: "PROP", // Default team
            isReady: false,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            isHunter: false,
            isCaught: false,
            health: 100,
            propChangesRemaining: 3,
            smokeBombsRemaining: 5
        }
    }

    return initialState
  },
  events: {
    playerJoined: (playerId, { game }) => {
        game.players[playerId] = {
            team: "PROP",
            isReady: false,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            isHunter: false,
            // If game is already playing, join as caught (spectator)
            isCaught: game.phase === "PLAYING",
            health: 100,
            propChangesRemaining: 3,
            smokeBombsRemaining: 5
        }
    },
    playerLeft: (playerId, { game }) => {
        delete game.players[playerId]
    },
  },
  actions: {
    setTeam: (team, { game, playerId }) => {
        if (game.phase !== "LOBBY") return
        if (game.players[playerId]) {
            game.players[playerId].team = team
            game.players[playerId].isReady = false // Reset ready on change
        }
    },
    toggleReady: (_, { game, playerId }) => {
        if (game.phase !== "LOBBY") return
        if (game.players[playerId]) {
            game.players[playerId].isReady = !game.players[playerId].isReady
        }

        // Check if all players are ready
        const allPlayers = Object.values(game.players)
        if (allPlayers.length > 0 && allPlayers.every(p => p.isReady)) {
            // Start Game
            game.phase = "PLAYING"
            spawnGameEntities(game)
        }
    },
    move: ({ x, y }, { game, playerId }) => {
      if (game.phase !== "PLAYING" || game.gameOver) return
      const player = game.players[playerId]
      if (!player || player.isCaught) {
        return
      }

      const magnitude = Math.sqrt(x * x + y * y)
      if (magnitude > 0) {
        const speed = 5
        player.velocity.x = (x / magnitude) * speed
        player.velocity.y = (y / magnitude) * speed
      } else {
        player.velocity.x = 0
        player.velocity.y = 0
      }
    },
    shoot: (position, { game, playerId }) => {
      if (game.phase !== "PLAYING" || game.gameOver) return
      const hunter = game.players[playerId]
      if (!hunter.isHunter) {
        throw Rune.invalidAction()
      }

      const bulletSpeed = 20
      const angle = Math.atan2(
        position.y - hunter.position.y,
        position.x - hunter.position.x
      )
      hunter.rotation = angle * (180 / Math.PI)
      const bulletId = Rune.gameTime().toString() + playerId

      const bulletSpawnOffset = 40
      const bulletSpawnX =
        hunter.position.x + bulletSpawnOffset * Math.cos(angle)
      const bulletSpawnY =
        hunter.position.y + bulletSpawnOffset * Math.sin(angle)

      game.bullets[bulletId] = {
        position: { x: bulletSpawnX, y: bulletSpawnY },
        velocity: {
          x: Math.cos(angle) * bulletSpeed,
          y: Math.sin(angle) * bulletSpeed,
        },
        id: bulletId,
      }
    },
    changeProp: (_, { game, playerId }) => {
      if (game.phase !== "PLAYING") return
      const player = game.players[playerId]
      if (
        !player ||
        player.isHunter ||
        player.isCaught ||
        player.propChangesRemaining <= 0
      ) {
        return
      }

      player.propChangesRemaining--
      player.health = 100

      const newPropTypes = propTypes.filter((p) => p !== player.propType)
      player.propType =
        newPropTypes[Math.floor(Math.random() * newPropTypes.length)]
    },
    useSmokeBomb: (_, { game, playerId }) => {
      if (game.phase !== "PLAYING") return
      const player = game.players[playerId]
      if (
        !player ||
        player.isHunter ||
        player.isCaught ||
        player.smokeBombsRemaining <= 0
      ) {
        return
      }

      player.smokeBombsRemaining--

      const smokeBombId = Rune.gameTime().toString() + playerId
      game.smokes[smokeBombId] = {
        position: { ...player.position },
        radius: 600,
        duration: 10000, // seconds
        spawnTime: Rune.gameTime(),
        ownerId: playerId,
      }
    },
    rotateProp: (_, { game, playerId }) => {
      if (game.phase !== "PLAYING") return
      const player = game.players[playerId]
      if (!player || player.isHunter || player.isCaught) {
        return
      }

      player.rotation = (player.rotation || 0) + 45
      if (player.rotation >= 360) {
        player.rotation = 0
      }
    },
    setHunterRotation: ({ angle }, { game, playerId }) => {
      if (game.phase !== "PLAYING") return
      const player = game.players[playerId]
      if (!player || !player.isHunter) {
        return
      }
      player.rotation = angle
    },
  },
  update: ({ game }) => {
    if (game.phase !== "PLAYING" || game.gameOver) {
      return
    }

    game.remainingTime -= 1 / 30

    if (game.remainingTime <= 0) {
      game.gameOver = true
      const playerStates: { [key: string]: "WON" | "LOST" } = {}
      for (const pId in game.players) {
        playerStates[pId] = game.players[pId].isHunter ? "LOST" : "WON"
      }
      Rune.gameOver({
        players: playerStates,
      })
      return
    }

    for (const playerId in game.players) {
      const player = game.players[playerId]

      const nextX = player.position.x + player.velocity.x
      const nextY = player.position.y + player.velocity.y // Check for collision on X axis
      if (
        !isCollidingWithWall(
          nextX,
          player.position.y,
          PLAYER_RADIUS,
          game.mapLayout
        ) &&
        nextX > PLAYER_RADIUS &&
        nextX < ARENA_WIDTH - PLAYER_RADIUS
      ) {
        player.position.x = nextX
      }

      // Check for collision on Y axis
      if (
        !isCollidingWithWall(
          player.position.x,
          nextY,
          PLAYER_RADIUS,
          game.mapLayout
        ) &&
        nextY > PLAYER_RADIUS &&
        nextY < ARENA_HEIGHT - PLAYER_RADIUS
      ) {
        player.position.y = nextY
      }

      // Update bullets
      for (const bulletId in game.bullets) {
        const bullet = game.bullets[bulletId]
        bullet.position.x += bullet.velocity.x
        bullet.position.y += bullet.velocity.y

        if (
          isCollidingWithWall(
            bullet.position.x,
            bullet.position.y,
            5,
            game.mapLayout
          )
        ) {
          delete game.bullets[bulletId]
          continue
        }

        if (!game.bullets[bulletId]) continue

        // Check for collision with players
        for (const playerId in game.players) {
          const player = game.players[playerId]
          if (player.isHunter || player.isCaught) continue

          const distance = Math.sqrt(
            Math.pow(bullet.position.x - player.position.x, 2) +
              Math.pow(bullet.position.y - player.position.y, 2)
          )

          if (distance < PLAYER_RADIUS) {
            player.health -= 10 // Bullet damage
            player.lastHitTime = Rune.gameTime()
            if (player.health <= 0) {
              player.isCaught = true

              const props = Object.values(game.players).filter(
                (p) => !p.isHunter
              )
              const allPropsCaught = props.every((p) => p.isCaught)

              if (allPropsCaught) {
                game.gameOver = true
                const playerStates: { [key: string]: "WON" | "LOST" } = {}
                for (const pId in game.players) {
                  playerStates[pId] = game.players[pId].isHunter
                    ? "WON"
                    : "LOST"
                }
                Rune.gameOver({
                  players: playerStates,
                })
              }
            }
            delete game.bullets[bulletId] // Remove bullet on hit
            break
          }
        }

        if (!game.bullets[bulletId]) continue

        // Check for collision with props
        /*
        for (const propId in game.props) {
          const prop = game.props[propId]
          const distance = Math.sqrt(
            Math.pow(bullet.position.x - prop.position.x, 2) +
              Math.pow(bullet.position.y - prop.position.y, 2)
          )

          if (distance < PLAYER_RADIUS) {
            prop.isHit = true
            prop.lastHitTime = Rune.gameTime()
            delete game.bullets[bulletId]
            break
          }
        }
        */

        if (!game.bullets[bulletId]) continue

        // Remove bullets that go off-screen
        if (
          bullet.position.x < 0 ||
          bullet.position.x > ARENA_WIDTH ||
          bullet.position.y < 0 ||
          bullet.position.y > ARENA_HEIGHT
        ) {
          delete game.bullets[bulletId]
        }
      }

      // Update props that have been hit
      for (const propId in game.props) {
        const prop = game.props[propId]
        if (prop.isHit && prop.lastHitTime) {
          if (Rune.gameTime() - prop.lastHitTime > 500) {
            prop.isHit = false
          }
        }
      }

      // Update smokes
      for (const smokeId in game.smokes) {
        const smoke = game.smokes[smokeId]
        if (Rune.gameTime() - smoke.spawnTime > smoke.duration) {
          delete game.smokes[smokeId]
        }
      }
    }
  },
  updatesPerSecond: 30,
})
