import type { RuneClient } from "rune-sdk"

export interface GameState {
  players: {
    [key: string]: {
      position: { x: number; y: number }

      velocity: { x: number; y: number }

      isHunter: boolean

      propType?: string

      isCaught: boolean
    }
  }

  props: {
    [key: string]: {
      position: { x: number; y: number }

      isTaken: boolean

      propType: string
      rotation: number
    }
  }

  gameOver: boolean

  mapLayout: { x: number; y: number; width: number; height: number }[]
}

type GameActions = {
  move: (joystick: { x: number; y: number }) => void
  catch: () => void
}

declare global {
  const Rune: RuneClient<GameState, GameActions>
}

import { propTypes } from "./propTypes.ts"
const ARENA_WIDTH = 2000
const ARENA_HEIGHT = 2000
const PLAYER_RADIUS = 25
const WALL_THICKNESS = 10

const MIN_ROOM_SIZE = 400
const MAX_ROOMS = 8
const DOOR_SIZE = 120

function generateMapLayout(): {
  x: number
  y: number
  width: number
  height: number
}[] {
  const walls: { x: number; y: number; width: number; height: number }[] = []
  let roomCount = 0

  function divide(x: number, y: number, width: number, height: number) {
    if (
      roomCount >= MAX_ROOMS ||
      (width < MIN_ROOM_SIZE * 2 && height < MIN_ROOM_SIZE * 2)
    ) {
      return
    }

    roomCount++

    const horizontal = width < height

    if (horizontal) {
      const divideAt =
        Math.floor(Math.random() * (height / 3)) + Math.floor(height / 3)
      const doorAt =
        Math.floor(Math.random() * (width - DOOR_SIZE)) + DOOR_SIZE / 2

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
      const divideAt =
        Math.floor(Math.random() * (width / 3)) + Math.floor(width / 3)
      const doorAt =
        Math.floor(Math.random() * (height - DOOR_SIZE)) + DOOR_SIZE / 2

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

  divide(0, 0, ARENA_WIDTH, ARENA_HEIGHT)

  return walls
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

Rune.initLogic({
  minPlayers: 2,
  maxPlayers: 6,
  setup: (allPlayerIds) => {
    const mapLayout = generateMapLayout()
    const initialState: GameState = {
      players: {},
      props: {},
      gameOver: false,
      mapLayout: mapLayout,
    }

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

    // Initialize players
    allPlayerIds.forEach((playerId, index) => {
      const isHunter = index === 0
      const spawnIndex = Math.floor(
        Math.random() * validPlayerSpawnPoints.length
      )
      const position = validPlayerSpawnPoints.splice(spawnIndex, 1)[0]

      initialState.players[playerId] = {
        position,
        velocity: { x: 0, y: 0 },
        isHunter,
        propType: isHunter
          ? undefined
          : propTypes[Math.floor(Math.random() * propTypes.length)],
        isCaught: false,
      }
    })

    // Initialize props
    const validSpawnPoints: { x: number; y: number }[] = []
    for (let x = 0; x < ARENA_WIDTH; x += 20) {
      for (let y = 0; y < ARENA_HEIGHT; y += 20) {
        if (
          !isCollidingWithWall(x, y, 25, mapLayout) &&
          (isCollidingWithWall(x - 20, y, 25, mapLayout) ||
            isCollidingWithWall(x + 20, y, 25, mapLayout) ||
            isCollidingWithWall(x, y - 20, 25, mapLayout) ||
            isCollidingWithWall(x, y + 20, 25, mapLayout))
        ) {
          validSpawnPoints.push({ x, y })
        }
      }
    }

    for (let i = 0; i < 20; i++) {
      if (validSpawnPoints.length === 0) break

      const spawnIndex = Math.floor(Math.random() * validSpawnPoints.length)
      const { x, y } = validSpawnPoints.splice(spawnIndex, 1)[0]

      initialState.props[`prop${i}`] = {
        position: { x, y },
        isTaken: false,
        propType: propTypes[Math.floor(Math.random() * propTypes.length)],
        rotation: Math.random() * 360,
      }
    }

    return initialState
  },
  actions: {
    move: ({ x, y }, { game, playerId }) => {
      if (game.gameOver) return
      const player = game.players[playerId]
      if (!player || player.isCaught) {
        throw Rune.invalidAction()
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
    catch: (_, { game, playerId }) => {
      if (game.gameOver) return
      const hunter = game.players[playerId]
      if (!hunter.isHunter) {
        throw Rune.invalidAction()
      }

      for (const otherPlayerId in game.players) {
        if (otherPlayerId === playerId) continue
        const otherPlayer = game.players[otherPlayerId]
        if (otherPlayer.isHunter || otherPlayer.isCaught) continue

        const distance = Math.sqrt(
          Math.pow(hunter.position.x - otherPlayer.position.x, 2) +
            Math.pow(hunter.position.y - otherPlayer.position.y, 2)
        )

        if (distance < 50) {
          otherPlayer.isCaught = true

          const props = Object.values(game.players).filter((p) => !p.isHunter)
          const allPropsCaught = props.every((p) => p.isCaught)

          if (allPropsCaught) {
            game.gameOver = true
            const playerStates: { [key: string]: "WON" | "LOST" } = {}
            for (const pId in game.players) {
              playerStates[pId] = game.players[pId].isHunter ? "WON" : "LOST"
            }
            Rune.gameOver({
              players: playerStates,
            })
          }
        }
      }
    },
  },
  update: ({ game }) => {
    for (const playerId in game.players) {
      const player = game.players[playerId]

      const nextX = player.position.x + player.velocity.x
      const nextY = player.position.y + player.velocity.y

      // Check for collision on X axis
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
    }
  },
  updatesPerSecond: 30,
})
