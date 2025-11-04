import "./styles.css"

import { PlayerId } from "rune-sdk"
import { GameState } from "./logic.ts"

const gameContainer = document.getElementById("game-container")!
const minimap = document.getElementById("minimap")!
const playersSection = document.getElementById("playersSection")!
const joystickHandle = document.getElementById("joystick-handle")!
const catchButton = document.createElement("button")
catchButton.id = "catch-button"
catchButton.innerText = "Catch"
catchButton.addEventListener("click", () => Rune.actions.catch())

const playerElements: { [key: string]: HTMLDivElement } = {}
const propElements: { [key: string]: HTMLDivElement } = {}
let uiInitialized = false

let game: GameState | undefined
let yourPlayerId: PlayerId | undefined

// Interpolation
const playerPositions: { [key: string]: { x: number; y: number } } = {}

function lerp(start: number, end: number, t: number) {
  return start * (1 - t) + end * t
}

function updatePlayerPosition(deltaX: number, deltaY: number) {
  if (!game || !yourPlayerId) return

  const player = game.players[yourPlayerId]
  if (!player || game.gameOver) return

  const newPosition = { ...player.position }
  newPosition.x += deltaX * 0.1
  newPosition.y += deltaY * 0.1
  Rune.actions.move(newPosition)
}

function initUI(playerIds: PlayerId[]) {
  playerIds.forEach((playerId) => {
    const playerInfo = Rune.getPlayerInfo(playerId)
    const playerElement = document.createElement("div")
    playerElement.classList.add("player")
    gameContainer.appendChild(playerElement)
    playerElements[playerId] = playerElement

    const li = document.createElement("li")
    li.innerHTML = `<img src="${playerInfo.avatarUrl}" />
           <span>${playerInfo.displayName}</span>`
    playersSection.appendChild(li)
  })

  let joystickActive = false
  let joystickStartX = 0
  let joystickStartY = 0

  window.addEventListener("touchstart", (e) => {
    joystickActive = true
    const touch = e.touches[0]
    joystickStartX = touch.clientX
    joystickStartY = touch.clientY
  })

  window.addEventListener("touchmove", (e) => {
    if (!joystickActive) return

    const touch = e.touches[0]
    const deltaX = touch.clientX - joystickStartX
    const deltaY = touch.clientY - joystickStartY
    console.log("deltaX", deltaX, "deltaY", deltaY)

    const distance = Math.min(50, Math.sqrt(deltaX * deltaX + deltaY * deltaY))
    const angle = Math.atan2(deltaY, deltaX)

    const handleX = distance * Math.cos(angle)
    const handleY = distance * Math.sin(angle)

    joystickHandle.style.left = `${50 + handleX}px`
    joystickHandle.style.top = `${50 + handleY}px`

    updatePlayerPosition(handleX, handleY)
  })

  window.addEventListener("touchend", () => {
    joystickActive = false
    joystickHandle.style.left = "50px"
    joystickHandle.style.top = "50px"
  })
}

function smoothUpdate() {
  if (!game) return

  for (const playerId in playerPositions) {
    const player = game.players[playerId]
    const playerElement = playerElements[playerId]
    if (player && playerElement) {
      const currentPosition = {
        x: parseFloat(playerElement.style.left || "0"),
        y: parseFloat(playerElement.style.top || "0"),
      }
      const targetPosition = playerPositions[playerId]
      playerElement.style.left = `${lerp(currentPosition.x, targetPosition.x, 0.1)}px`
      playerElement.style.top = `${lerp(currentPosition.y, targetPosition.y, 0.1)}px`
    }
  }
  requestAnimationFrame(smoothUpdate)
}

Rune.initClient({
  onChange: ({ game: newGame, yourPlayerId: newYourPlayerId }) => {
    game = newGame
    yourPlayerId = newYourPlayerId
    if (!game) return
    const { players, props, gameOver } = newGame

    if (!uiInitialized) {
      initUI(Object.keys(players))
      if (players[yourPlayerId!].isHunter) {
        document.body.appendChild(catchButton)
      }
      uiInitialized = true
      smoothUpdate()
    }

    for (const playerId in players) {
      const player = players[playerId]
      playerPositions[playerId] = player.position
      const playerElement = playerElements[playerId]
      if (player.isHunter) {
        playerElement.innerHTML = `<img src="${Rune.getPlayerInfo(playerId).avatarUrl}" />`
        playerElement.style.backgroundColor = "red"
      } else {
        playerElement.innerHTML = ""
        playerElement.style.backgroundColor = "transparent"
        playerElement.style.backgroundImage = `url(./assets/props/${player.propType})`
      }

      if (player.isCaught) {
        playerElement.style.opacity = "0.5"
      }
    }

    for (const propId in props) {
      const prop = props[propId]
      if (!propElements[propId]) {
        const propElement = document.createElement("div")
        propElement.classList.add("prop")
        gameContainer.appendChild(propElement)
        propElements[propId] = propElement
      }
      const propElement = propElements[propId]
      propElement.style.backgroundImage = `url(./assets/props/${prop.propType})`
      propElement.style.left = `${prop.position.x}px`
      propElement.style.top = `${prop.position.y}px`
    }

    // Minimap rendering (simplified)
    minimap.innerHTML = ""
    for (const playerId in players) {
      const player = players[playerId]
      const minimapPlayer = document.createElement("div")
      minimapPlayer.classList.add("minimap-player")
      minimapPlayer.style.left = `${(player.position.x / 1000) * 200}px`
      minimapPlayer.style.top = `${(player.position.y / 1000) * 200}px`
      minimap.appendChild(minimapPlayer)
    }

    // Camera follow
    const yourPlayer = players[yourPlayerId!]
    if (yourPlayer) {
      const cameraX = yourPlayer.position.x - window.innerWidth / 2
      const cameraY = yourPlayer.position.y - window.innerHeight / 2
      gameContainer.style.transform = `translate(${-cameraX}px, ${-cameraY}px)`
    }

    if (gameOver) {
      const message = document.createElement("div")
      message.id = "game-over-message"
      const winner = Object.values(newGame.players).find(
        (p: { isHunter: boolean; isCaught: boolean }) => p.isHunter && !p.isCaught
      )
      if (winner) {
        message.innerText = `Hunter wins!`
      } else {
        message.innerText = `Props win!`
      }
      document.body.appendChild(message)
      catchButton.remove()
    }
  },
})

document.addEventListener("keydown", (e) => {
  if (!game || !yourPlayerId) return
  const player = game.players[yourPlayerId]
  if (!player || game.gameOver) return

  const newPosition = { ...player.position }

  switch (e.key) {
    case "ArrowUp":
      newPosition.y -= 10
      break
    case "ArrowDown":
      newPosition.y += 10
      break
    case "ArrowLeft":
      newPosition.x -= 10
      break
    case "ArrowRight":
      newPosition.x += 10
      break
  }

  Rune.actions.move(newPosition)
})
