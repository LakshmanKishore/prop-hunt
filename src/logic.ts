import type { PlayerId, RuneClient } from "rune-sdk"

// Game-specific type overrides
export type PlayerId = string // Use string for player IDs

// Define the structure for a single player
export interface Player {
  id: PlayerId
  position: { x: number; y: number }
  isHunter: boolean
  avatarUrl: string // URL for the player's avatar
  speed: number
}

// Define the structure for a prop
export interface Prop {
  id: number
  name: string // e.g., "chair", "table"
  position: { x: number; y: number }
  rotation: number
  isPlayer: boolean // True if a player is controlling this prop
  playerId?: PlayerId // ID of the player controlling the prop
  isFound?: boolean
  foundAt?: number
}

// Define the overall game state
export interface GameState {
  players: Record<PlayerId, Player>
  props: Prop[]
  gameTime: number // Countdown timer
  phase: "lobby" | "hiding" | "hunting" | "finished"
  winningTeam?: "hunters" | "props"
}

// Define the actions that players can take
export type GameActions = {
  // Action to set a player's position
  setPosition: (position: { x: number; y: number }) => void
  // Action for a hunter to scan the area
  scan: () => void
  // Action to set a player's avatar URL
  setAvatarUrl: (avatarUrl: string) => void
}

// Augment the global scope with the Rune client
declare global {
  const Rune: RuneClient<GameState, GameActions>
}

const availableProps = ["prop1", "prop2", "prop3", "prop4", "prop5"]

Rune.initLogic({
  minPlayers: 2,
  maxPlayers: 6,
  setup: (allPlayerIds) => {
    const initialState: GameState = {
      players: {},
      props: [],
      gameTime: 300, // 5 minutes
      phase: "lobby",
    }

    // Assign roles
    const hunterCount = Math.ceil(allPlayerIds.length / 4)
    const shuffledPlayers = [...allPlayerIds].sort(() => Math.random() - 0.5)

    shuffledPlayers.forEach((playerId, index) => {
      const isHunter = index < hunterCount

      initialState.players[playerId] = {
        id: playerId,
        position: { x: 100, y: 100 },
        isHunter,
        avatarUrl: "", // Will be set by the client
        speed: isHunter ? 5 : 3,
      }

      if (!isHunter) {
        const propName = availableProps[Math.floor(Math.random() * availableProps.length)]
        initialState.props.push({
          id: initialState.props.length,
          name: propName,
          position: { x: 200, y: 200 },
          rotation: 0,
          isPlayer: true,
          playerId: playerId,
        })
      }
    })

    return initialState
  },
  events: {
    playerJoined: (_, { game }) => {
      // Handle player joining during lobby
    },
    playerLeft: (_, { game }) => {
      // Handle player leaving
    },
  },
  update: ({ game }) => {
    const time = Rune.gameTime()

    for (const prop of game.props) {
      if (prop.isFound && prop.foundAt && time - prop.foundAt > 2) {
        prop.isFound = false
      }
    }

    if (game.props.every((prop) => prop.isFound)) {
      game.phase = "finished"
      game.winningTeam = "hunters"
    }

    if (game.phase === "lobby" && time > 5) {
      game.phase = "hiding"
    } else if (game.phase === "hiding" && time > 15) {
      game.phase = "hunting"
    } else if (game.phase === "hunting" && game.gameTime > 0) {
      game.gameTime -= 1 / Rune.updatesPerSecond
    } else if (game.gameTime <= 0 && game.phase === "hunting") {
      game.phase = "finished"
      game.winningTeam = "props"
    }
  },
  actions: {
    setPosition: (position, { game, playerId }) => {
      if (game.players[playerId]) {
        const player = game.players[playerId]
        player.position.x += position.x * player.speed
        player.position.y += position.y * player.speed
      }
    },
    scan: (_, { game, playerId }) => {
      if (game.players[playerId]?.isHunter) {
        const hunter = game.players[playerId]
        for (const prop of game.props) {
          if (prop.isPlayer) {
            const player = game.players[prop.playerId!]
            const distance = Math.sqrt(
              (hunter.position.x - player.position.x) ** 2 +
                (hunter.position.y - player.position.y) ** 2
            )
            if (distance < 50) {
              prop.isFound = true
              prop.foundAt = Rune.gameTime()
            }
          }
        }
      }
    },
    setAvatarUrl: (avatarUrl, { game, playerId }) => {
      if (game.players[playerId]) {
        game.players[playerId].avatarUrl = avatarUrl
      }
    },
  },
})
