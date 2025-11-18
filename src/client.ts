import "./styles.css"

import { PlayerId } from "rune-sdk"
import { GameState } from "./logic.ts"
import { getSpriteInfo } from "./spriteManager.ts"

const gameContainer = document.getElementById("game-container")!
const minimap = document.getElementById("minimap")!
const playersSection = document.getElementById("playersSection")!

const joystickHandle = document.getElementById("joystick-handle")!

const playerElements: { [key: string]: HTMLDivElement } = {}
const propElements: { [key: string]: HTMLDivElement } = {}
const bulletElements: { [key: string]: HTMLDivElement } = {}
const smokeElements: { [key: string]: HTMLDivElement } = {}
const wallElements: HTMLDivElement[] = []
let uiInitialized = false


let game: GameState | undefined
let yourPlayerId: PlayerId | undefined
let spectatedPlayerId: PlayerId | undefined

let pingCountdown = 30
let showPropsOnMinimap = false
setInterval(() => {
  pingCountdown--
  if (pingCountdown <= 0) {
    showPropsOnMinimap = true
    setTimeout(() => {
      showPropsOnMinimap = false
    }, 3000)
    pingCountdown = 30
  }

  const pingTimer = document.getElementById("ping-timer")!
  pingTimer.innerText = `Ping in: ${pingCountdown}`
}, 1000)

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

  gameContainer.style.width = `2000px`
  gameContainer.style.height = `2000px`

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

  console.log("game.props", game.props)
  for (const propId in game.props) {
    const prop = game.props[propId]
    const propElement = document.createElement("div")
    propElement.classList.add("prop")
    console.log("prop.propType", prop.propType)
    const spriteInfo = getSpriteInfo(prop.propType)
    console.log("spriteInfo", spriteInfo)
    if (spriteInfo) {
      propElement.style.backgroundImage = `url(${spriteInfo.spriteSheetUrl})`
      propElement.style.backgroundPosition = `-${spriteInfo.minX}px -${spriteInfo.minY}px`
      propElement.style.width = `${spriteInfo.maxX - spriteInfo.minX}px`
      propElement.style.height = `${spriteInfo.maxY - spriteInfo.minY}px`
      propElement.style.backgroundSize = `${spriteInfo.sheetWidth}px ${spriteInfo.sheetHeight}px`
    }
    gameContainer.appendChild(propElement)
    propElements[propId] = propElement
  }

  gameContainer.addEventListener("click", (e) => {
    if (!game || !yourPlayerId || !game.players[yourPlayerId].isHunter) return

    const rect = gameContainer.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    Rune.actions.shoot({ x, y })
  })

  let joystickActive = false
  let joystickStartX = 0
  let joystickStartY = 0
  let moveInterval: number | undefined
  const currentJoystick = { x: 0, y: 0 }

  window.addEventListener("touchstart", (e) => {
    joystickActive = true
    const touch = e.touches[0]
    joystickStartX = touch.clientX
    joystickStartY = touch.clientY

    if (moveInterval) clearInterval(moveInterval)
    moveInterval = setInterval(() => {
      Rune.actions.move({ ...currentJoystick })
    }, 50)
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

    currentJoystick.x = handleX
    currentJoystick.y = handleY
  })

  window.addEventListener("touchend", () => {
    joystickActive = false
    if (moveInterval) clearInterval(moveInterval)
    joystickHandle.style.left = "50px"
    joystickHandle.style.top = "50px"
    currentJoystick.x = 0
    currentJoystick.y = 0
    Rune.actions.move({ x: 0, y: 0 })
  })
}

const joystickContainer = document.getElementById("joystick-container")!
const spectatorUI = document.createElement("div")
spectatorUI.id = "spectator-ui"
document.body.appendChild(spectatorUI)

Rune.initClient({
  onChange: ({ game: newGame, yourPlayerId: newYourPlayerId }) => {
    game = newGame
    yourPlayerId = newYourPlayerId
    if (!game) return
    const { players, mapLayout, remainingTime } = newGame

    // Unconditionally update timers for all players
    const gameTimer = document.getElementById("game-timer")!
    const minutes = Math.floor(remainingTime / 60)
    const seconds = Math.floor(remainingTime % 60)
    gameTimer.innerText = `${minutes}:${seconds.toString().padStart(2, "0")}`

    if (!yourPlayerId || !players[yourPlayerId]) {
      // Player data not available yet, wait for next update
      return
    }

    if (!uiInitialized) {
      initUI(Object.keys(players), newGame)

      uiInitialized = true
    }

    const yourPlayer = players[yourPlayerId!]

    // Manage Change Prop Button
    let changePropButton = document.getElementById("change-prop-button") as HTMLButtonElement
    if (!changePropButton) {
      changePropButton = document.createElement("button")
      changePropButton.id = "change-prop-button"
      document.body.appendChild(changePropButton)
      changePropButton.onclick = () => {
        if (yourPlayerId && !players[yourPlayerId].isHunter && !players[yourPlayerId].isCaught && players[yourPlayerId].propChangesRemaining > 0) {
          Rune.actions.changeProp()
        }
      }
    }

    if (yourPlayer.isHunter || yourPlayer.isCaught) {
      changePropButton.style.display = "none"
    } else {
      changePropButton.style.display = "block"
      changePropButton.innerText = `Change Prop (${yourPlayer.propChangesRemaining})`
      changePropButton.disabled = yourPlayer.propChangesRemaining <= 0
    }

    // Manage Smoke Bomb Button
    let smokeBombButton = document.getElementById("smoke-bomb-button") as HTMLButtonElement
    if (!smokeBombButton) {
      smokeBombButton = document.createElement("button")
      smokeBombButton.id = "smoke-bomb-button"
      document.body.appendChild(smokeBombButton)
      smokeBombButton.onclick = () => {
        if (yourPlayerId && !players[yourPlayerId].isHunter && !players[yourPlayerId].isCaught && players[yourPlayerId].smokeBombsRemaining > 0) {
          Rune.actions.useSmokeBomb()
        }
      }
    }

    if (yourPlayer.isHunter || yourPlayer.isCaught) {
      smokeBombButton.style.display = "none"
    } else {
      smokeBombButton.style.display = "block"
      smokeBombButton.innerText = `Smoke Bomb (${yourPlayer.smokeBombsRemaining})`
      smokeBombButton.disabled = yourPlayer.smokeBombsRemaining <= 0
    }

    if (yourPlayer.isCaught) {
      joystickContainer.style.display = "none"
      spectatorUI.style.display = "flex"
      spectatorUI.innerHTML = ""

      for (const playerId in players) {
        if (players[playerId]) {
          const playerIcon = document.createElement("div")
          playerIcon.classList.add("spectator-player-icon")
          playerIcon.innerHTML = `<img src="${
            Rune.getPlayerInfo(playerId).avatarUrl
          }" />`
          playerIcon.onclick = () => {
            spectatedPlayerId = playerId
          }
          spectatorUI.appendChild(playerIcon)
        }
      }
    } else {
      joystickContainer.style.display = "block"
      spectatorUI.style.display = "none"
    }

    for (const playerId in players) {
      const player = players[playerId]
      const playerElement = playerElements[playerId]

      if (player.isHunter) {
        playerElement.innerHTML = `<img src="${
          Rune.getPlayerInfo(playerId).avatarUrl
        }" />`
        playerElement.style.backgroundColor = "red"
        playerElement.style.width = "50px"
        playerElement.style.height = "50px"
      } else {
        playerElement.innerHTML = ""
        playerElement.style.backgroundColor = "transparent"
        playerElement.classList.remove("player")
        playerElement.classList.add("prop")
        const spriteInfo = getSpriteInfo(player.propType!)
        if (spriteInfo) {
          playerElement.style.backgroundImage = `url(${spriteInfo.spriteSheetUrl})`
          playerElement.style.backgroundPosition = `-${spriteInfo.minX}px -${spriteInfo.minY}px`
          playerElement.style.width = `${spriteInfo.maxX - spriteInfo.minX}px`
          playerElement.style.height = `${spriteInfo.maxY - spriteInfo.minY}px`
          playerElement.style.backgroundSize = `${spriteInfo.sheetWidth}px ${spriteInfo.sheetHeight}px`
        }

        
        playerElement.onclick = null
      }

      playerElement.style.left = `${player.position.x - 25}px`
      playerElement.style.top = `${player.position.y - 25}px`

      if (player.isCaught) {
        playerElement.style.opacity = "0.5"
      } else {
        playerElement.style.opacity = "1"
      }

      if (playerId === yourPlayerId && !player.isHunter) {
        let healthBar = playerElement.querySelector(
          ".health-bar"
        ) as HTMLDivElement
        if (!healthBar) {
          healthBar = document.createElement("div")
          healthBar.classList.add("health-bar")
          const healthBarInner = document.createElement("div")
          healthBarInner.classList.add("health-bar-inner")
          healthBar.appendChild(healthBarInner)
          playerElement.appendChild(healthBar)
        }
        const healthBarInner = healthBar.querySelector(
          ".health-bar-inner"
        ) as HTMLDivElement
        healthBarInner.style.width = `${player.health}%`
      }
    }

    for (const propId in newGame.props) {
      const prop = newGame.props[propId]
      const propElement = propElements[propId]

      if (propElement) {
        propElement.style.left = `${prop.position.x}px`
        propElement.style.top = `${prop.position.y}px`
        propElement.style.transform = `rotate(${prop.rotation}deg)`
      }
    }

    // Render bullets
    for (const bulletId in newGame.bullets) {
      const bullet = newGame.bullets[bulletId]
      let bulletElement = bulletElements[bulletId]

      if (!bulletElement) {
        bulletElement = document.createElement("div")
        bulletElement.classList.add("bullet")
        gameContainer.appendChild(bulletElement)
        bulletElements[bulletId] = bulletElement
      }

      bulletElement.style.left = `${bullet.position.x - 5}px`
      bulletElement.style.top = `${bullet.position.y - 5}px`
    }

    // Remove old bullets
    for (const bulletId in bulletElements) {
      if (!newGame.bullets[bulletId]) {
        bulletElements[bulletId].remove()
        delete bulletElements[bulletId]
      }
    }

    // Render smokes
    for (const smokeId in newGame.smokes) {
      const smoke = newGame.smokes[smokeId]
      let smokeElement = smokeElements[smokeId]

      if (!smokeElement) {
        smokeElement = document.createElement("div")
        smokeElement.classList.add("smoke-bomb")
        gameContainer.appendChild(smokeElement)
        smokeElements[smokeId] = smokeElement
      }

      smokeElement.style.left = `${smoke.position.x - smoke.radius}px`
      smokeElement.style.top = `${smoke.position.y - smoke.radius}px`
      smokeElement.style.width = `${smoke.radius * 2}px`
      smokeElement.style.height = `${smoke.radius * 2}px`

      const yourPlayer = players[yourPlayerId!]
      if (yourPlayer.isHunter) {
        smokeElement.className = "smoke-bomb smoke-bomb-other"
      } else {
        if (smoke.ownerId === yourPlayerId) {
          smokeElement.className = "smoke-bomb smoke-bomb-owner"
        } else {
          smokeElement.className = "smoke-bomb smoke-bomb-other"
        }
      }
    }

    // Remove old smokes
    for (const smokeId in smokeElements) {
      if (!newGame.smokes[smokeId]) {
        smokeElements[smokeId].remove()
        delete smokeElements[smokeId]
      }
    }

    // Minimap rendering
    minimap.innerHTML = ""
    for (const wall of mapLayout) {
      const minimapWall = document.createElement("div")
      minimapWall.classList.add("minimap-wall")
      minimapWall.style.left = `${(wall.x / 2000) * 150}px`
      minimapWall.style.top = `${(wall.y / 2000) * 150}px`
      minimapWall.style.width = `${(wall.width / 2000) * 150}px`
      minimapWall.style.height = `${(wall.height / 2000) * 150}px`
      minimap.appendChild(minimapWall)
    }

    if (yourPlayer) {
      if (yourPlayer.isCaught) {
        for (const playerId in players) {
          const player = players[playerId]
          const minimapPlayer = document.createElement("div")
          minimapPlayer.classList.add("minimap-player")
          minimapPlayer.style.backgroundColor = player.isHunter ? "red" : "blue"
          minimapPlayer.style.left = `${(player.position.x / 2000) * 150}px`
          minimapPlayer.style.top = `${(player.position.y / 2000) * 150}px`
          minimap.appendChild(minimapPlayer)
        }
      } else if (showPropsOnMinimap) {
        for (const playerId in players) {
          const player = players[playerId]
          if (!player.isCaught) {
            const minimapPlayer = document.createElement("div")
            minimapPlayer.classList.add("minimap-player")
            minimapPlayer.style.backgroundColor = player.isHunter
              ? "red"
              : "blue"
            minimapPlayer.style.left = `${(player.position.x / 2000) * 150}px`
            minimapPlayer.style.top = `${(player.position.y / 2000) * 150}px`
            minimap.appendChild(minimapPlayer)
          }
        }
      } else {
        if (yourPlayer.isHunter) {
          const minimapPlayer = document.createElement("div")
          minimapPlayer.classList.add("minimap-player")
          minimapPlayer.style.left = `${(yourPlayer.position.x / 2000) * 150}px`
          minimapPlayer.style.top = `${(yourPlayer.position.y / 2000) * 150}px`
          minimap.appendChild(minimapPlayer)
        } else {
          for (const playerId in players) {
            const player = players[playerId]
            if (!player.isHunter && !player.isCaught) {
              const minimapPlayer = document.createElement("div")
              minimapPlayer.classList.add("minimap-player")
              minimapPlayer.style.backgroundColor = "blue"
              minimapPlayer.style.left = `${(player.position.x / 2000) * 150}px`
              minimapPlayer.style.top = `${(player.position.y / 2000) * 150}px`
              minimap.appendChild(minimapPlayer)
            }
          }
        }
      }
    }

    // Camera follow
    const playerToFollow = spectatedPlayerId
      ? players[spectatedPlayerId]
      : yourPlayer
    if (playerToFollow) {
      const cameraX = playerToFollow.position.x - window.innerWidth / 2
      const cameraY = playerToFollow.position.y - window.innerHeight / 2
      gameContainer.style.transform = `translate(${-cameraX}px, ${-cameraY}px)`
    }

    if (newGame.gameOver) {
      const message = document.createElement("div")
      message.id = "game-over-message"
      if (newGame.players[yourPlayerId!].isHunter) {
        message.innerText = "You Win!"
      } else {
        message.innerText = "You Lose!"
      }
      document.body.appendChild(message)
    }
  },
})

document.addEventListener("keydown", (e) => {
  if (!game || !yourPlayerId) return
  const player = game.players[yourPlayerId]
  if (!player || game.gameOver || player.isCaught) return

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
  if (!player || game.gameOver || player.isCaught) return

  switch (e.key) {
    case "ArrowUp":
    case "ArrowDown":
    case "ArrowLeft":
    case "ArrowRight":
      Rune.actions.move({ x: 0, y: 0 })
      break
  }
})
