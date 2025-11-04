import type { RuneClient } from "rune-sdk"

export interface GameState {
  players: {
    [key: string]: {
      position: { x: number; y: number }
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
    }
  }
  gameOver: boolean
}

type GameActions = {
  move: (position: { x: number; y: number }) => void
  catch: () => void
}

declare global {
  const Rune: RuneClient<GameState, GameActions>
}

const propTypes = ["bottle.svg", "chair.svg", "lamp.svg"]

Rune.initLogic({
  minPlayers: 2,
  maxPlayers: 4,
  setup: (allPlayerIds) => {
    const initialState: GameState = {
      players: {},
      props: {},
      gameOver: false,
    }

    // Initialize players
    allPlayerIds.forEach((playerId, index) => {
      const isHunter = index === 0
      initialState.players[playerId] = {
        position: { x: 100, y: 100 },
        isHunter,
        propType: isHunter
          ? undefined
          : propTypes[Math.floor(Math.random() * propTypes.length)],
        isCaught: false,
      }
    })

    // Initialize props
    for (let i = 0; i < 10; i++) {
      initialState.props[`prop${i}`] = {
        position: { x: Math.random() * 500, y: Math.random() * 500 },
        isTaken: false,
        propType: propTypes[Math.floor(Math.random() * propTypes.length)],
      }
    }

    return initialState
  },
  actions: {
    move: (position, { game, playerId }) => {
      if (game.gameOver) return
      if (!game.players[playerId]) {
        throw Rune.invalidAction()
      }

      game.players[playerId].position = position
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
})
