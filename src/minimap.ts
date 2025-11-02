import { GameState, PlayerId } from "./logic"

const minimapCanvas = document.getElementById("minimap-canvas") as HTMLCanvasElement
const minimapCtx = minimapCanvas.getContext("2d")!

const MAP_WIDTH = 2000
const MAP_HEIGHT = 2000

export function drawMinimap(game: GameState, yourPlayerId: PlayerId) {
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height)

  // Draw map background
  minimapCtx.fillStyle = "#333"
  minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height)

  // Draw player position
  const player = game.players[yourPlayerId]
  if (player) {
    const x = (player.position.x / MAP_WIDTH) * minimapCanvas.width
    const y = (player.position.y / MAP_HEIGHT) * minimapCanvas.height

    minimapCtx.fillStyle = "white"
    minimapCtx.beginPath()
    minimapCtx.arc(x, y, 3, 0, 2 * Math.PI)
    minimapCtx.fill()
  }
}
