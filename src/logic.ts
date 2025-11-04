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
const ARENA_WIDTH = 1000
const ARENA_HEIGHT = 1000
const PLAYER_RADIUS = 25
const WALL_THICKNESS = 10

const MIN_ROOM_SIZE = 200
const MAX_ROOMS = 6
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
      const divideAt = Math.floor(height / 2)
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
      const divideAt = Math.floor(width / 2)
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
  maxPlayers: 4,
  setup: (allPlayerIds) => {
    const mapLayout = generateMapLayout()
    const initialState: GameState = {
      players: {},
      props: {},
      gameOver: false,
      mapLayout: mapLayout,
    }

    // Initialize players
    allPlayerIds.forEach((playerId, index) => {
      const isHunter = index === 0
      initialState.players[playerId] = {
        position: { x: 100, y: 100 },
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
      if (!player) {
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
        if (otherPlayer.isHunter) continue

        const distance = Math.sqrt(
          Math.pow(hunter.position.x - otherPlayer.position.x, 2) +
            Math.pow(hunter.position.y - otherPlayer.position.y, 2)
        )

        if (distance < 50) {
          otherPlayer.isCaught = true
          game.gameOver = true
          Rune.gameOver({
            players: {
              [playerId]: "WON",
              [otherPlayerId]: "LOST",
            },
          })
        }
      }
    },
  },
  update: ({ game }) => {
    for (const playerId in game.players) {
      const player = game.players[playerId]

      const nextX = player.position.x + player.velocity.x
      const nextY = player.position.y + player.velocity.y

      if (
        !isCollidingWithWall(nextX, nextY, PLAYER_RADIUS, game.mapLayout) &&
        nextX > PLAYER_RADIUS &&
        nextX < ARENA_WIDTH - PLAYER_RADIUS &&
        nextY > PLAYER_RADIUS &&
        nextY < ARENA_HEIGHT - PLAYER_RADIUS
      ) {
        player.position.x = nextX
        player.position.y = nextY
      } else {
        player.velocity.x = 0
        player.velocity.y = 0
      }
    }
  },
  updatesPerSecond: 30,
})
