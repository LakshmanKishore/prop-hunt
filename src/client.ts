import "./styles.css"

import { PlayerId } from "rune-sdk"
import { GameState } from "./logic.ts"
import { getImageUrl } from "./getImageUrl.ts"

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
const wallElements: HTMLDivElement[] = []
let uiInitialized = false

let game: GameState | undefined
let yourPlayerId: PlayerId | undefined

function initUI(playerIds: PlayerId[], game: GameState) {
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

  for (const wall of game.mapLayout) {
    const wallElement = document.createElement("div")
    wallElement.classList.add("wall")
    wallElement.style.left = `${wall.x}px`
    wallElement.style.top = `${wall.y}px`
    wallElement.style.width = `${wall.width}px`
    wallElement.style.height = `${wall.height}px`
    gameContainer.appendChild(wallElement)
    wallElements.push(wallElement)
  }

  for (const propId in game.props) {
    const propElement = document.createElement("div")
    propElement.classList.add("prop")
    gameContainer.appendChild(propElement)
    propElements[propId] = propElement
  }

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

    const distance = Math.min(50, Math.sqrt(deltaX * deltaX + deltaY * deltaY))
    const angle = Math.atan2(deltaY, deltaX)

    const handleX = distance * Math.cos(angle)
    const handleY = distance * Math.sin(angle)

    joystickHandle.style.left = `${50 + handleX}px`
    joystickHandle.style.top = `${50 + handleY}px`

    Rune.actions.move({ x: handleX, y: handleY })
  })

  window.addEventListener("touchend", () => {
    joystickActive = false
    joystickHandle.style.left = "50px"
    joystickHandle.style.top = "50px"
    Rune.actions.move({ x: 0, y: 0 })
  })
}

Rune.initClient({
  onChange: ({ game: newGame, yourPlayerId: newYourPlayerId }) => {
    game = newGame
    yourPlayerId = newYourPlayerId
    if (!game) return
    const { players, gameOver, mapLayout } = newGame

    if (!uiInitialized) {
      initUI(Object.keys(players), newGame)

      if (players[yourPlayerId!].isHunter) {
        document.body.appendChild(catchButton)
      }

      uiInitialized = true
    }

    for (const playerId in players) {
      const player = players[playerId]

      const playerElement = playerElements[playerId]

      if (player.isHunter) {
        playerElement.innerHTML = `<img src="${Rune.getPlayerInfo(playerId).avatarUrl}" />`

        playerElement.style.backgroundColor = "red"

        playerElement.style.width = "50px"

        playerElement.style.height = "50px"
      } else {
        playerElement.innerHTML = ""

        playerElement.style.backgroundColor = "transparent"

        playerElement.style.backgroundImage = `url(${getImageUrl(
          player.propType!,
          "props"
        )})`
        const img = new Image()

        img.src = getImageUrl(player.propType!, "props")

        img.onload = () => {
          playerElement.style.width = `${img.width}px`

          playerElement.style.height = `${img.height}px`
        }
      }

      playerElement.style.left = `${player.position.x - 25}px`

      playerElement.style.top = `${player.position.y - 25}px`

      if (player.isCaught) {
        playerElement.style.opacity = "0.5"
      }
    }

    for (const propId in newGame.props) {
      const prop = newGame.props[propId]

      const propElement = propElements[propId]

      if (propElement) {
        propElement.style.backgroundImage = `url(${getImageUrl(
          prop.propType,
          "props"
        )})`
        const img = new Image()
        img.src = getImageUrl(prop.propType, "props")
        img.onload = () => {
          propElement.style.width = `50px`
          propElement.style.height = `50px`
        }

        propElement.style.left = `${prop.position.x}px`

        propElement.style.top = `${prop.position.y}px`

        propElement.style.transform = `rotate(${prop.rotation}deg)`
      }
    }

    // Minimap rendering
    minimap.innerHTML = ""
    for (const wall of mapLayout) {
      const minimapWall = document.createElement("div")
      minimapWall.classList.add("minimap-wall")
      minimapWall.style.left = `${(wall.x / 1000) * 200}px`
      minimapWall.style.top = `${(wall.y / 1000) * 200}px`
      minimapWall.style.width = `${(wall.width / 1000) * 200}px`
      minimapWall.style.height = `${(wall.height / 1000) * 200}px`
      minimap.appendChild(minimapWall)
    }
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
        (p: { isHunter: boolean; isCaught: boolean }) =>
          p.isHunter && !p.isCaught
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

  const joystick = { x: 0, y: 0 }

  switch (e.key) {
    case "ArrowUp":
      joystick.y = -1
      break
    case "ArrowDown":
      joystick.y = 1
      break
    case "ArrowLeft":
      joystick.x = -1
      break
    case "ArrowRight":
      joystick.x = 1
      break
  }

  Rune.actions.move(joystick)
})

document.addEventListener("keyup", (e) => {
  if (!game || !yourPlayerId) return
  const player = game.players[yourPlayerId]
  if (!player || game.gameOver) return

  switch (e.key) {
    case "ArrowUp":
    case "ArrowDown":
    case "ArrowLeft":
    case "ArrowRight":
      Rune.actions.move({ x: 0, y: 0 })
      break
  }
})
