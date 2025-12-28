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

// Define a nice palette (Gemini/Modern Dark Mode inspired)
const roomColors = [
  "#1e1f20", // Dark Grey (Base)
  "#252627", // Slightly Lighter
  "#1c222e", // Dark Blue Tint
  "#1f2521", // Dark Green Tint
  "#261e22", // Dark Red/Purple Tint
  "#202022", // Neutral
]

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

  if (game.roomLayout) {
    for (const room of game.roomLayout) {
      const roomElement = document.createElement("div")
      roomElement.classList.add("room")
      roomElement.style.left = `${room.x}px`
      roomElement.style.top = `${room.y}px`
      roomElement.style.width = `${room.width}px`
      roomElement.style.height = `${room.height}px`
      roomElement.style.backgroundColor = roomColors[room.colorIndex % roomColors.length]
      gameContainer.appendChild(roomElement)
    }
  }

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

  gameContainer.addEventListener("mousemove", (e) => {
    if (!game || !yourPlayerId || !game.players[yourPlayerId].isHunter) return

    const rect = gameContainer.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const player = game.players[yourPlayerId!]
    const angle = Math.atan2(y - player.position.y, x - player.position.x)

    Rune.actions.setHunterRotation({ angle: angle * (180 / Math.PI) })
  })

  gameContainer.addEventListener("click", (e) => {
    if (joystickActive) return
    if (!game || !yourPlayerId || !game.players[yourPlayerId].isHunter) return

    const rect = gameContainer.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    Rune.actions.shoot({ x, y })
  })

  let joystickActive = false
  let joystickTouchId: number | null = null
  let joystickStartX = 0
  let joystickStartY = 0
  let moveInterval: number | undefined
  const currentJoystick = { x: 0, y: 0 }

  // Ensure joystick is visible initially
  joystickContainer.style.display = "flex"

  window.addEventListener("touchstart", (e) => {
    for (const touch of e.changedTouches) {
      if (joystickActive) continue
      
      // Ignore touches on buttons or specific UI elements if needed
      if ((touch.target as HTMLElement).closest("button")) continue

      joystickActive = true
      joystickTouchId = touch.identifier
      joystickStartX = touch.clientX
      joystickStartY = touch.clientY

      // We do NOT move the joystick container. It stays fixed at bottom-left.
      // We purely use these coordinates as the "center" for this interaction.

      if (moveInterval) clearInterval(moveInterval)
      moveInterval = setInterval(() => {
        Rune.actions.move({ ...currentJoystick })
      }, 50)
    }
  })

  window.addEventListener("touchmove", (e) => {
    if (!joystickActive) return

    for (const touch of e.changedTouches) {
      if (touch.identifier === joystickTouchId) {
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
      }
    }
  })

  window.addEventListener("touchend", (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === joystickTouchId) {
        joystickActive = false
        joystickTouchId = null
        if (moveInterval) clearInterval(moveInterval)

        // Reset handle position
        joystickHandle.style.left = "50px"
        joystickHandle.style.top = "50px"

        currentJoystick.x = 0
        currentJoystick.y = 0
        Rune.actions.move({ x: 0, y: 0 })
      }
    }
  })
}

const joystickContainer = document.getElementById("joystick-container")!
const spectatorUI = document.createElement("div")
spectatorUI.id = "spectator-ui"
document.body.appendChild(spectatorUI)

// Help Button & Modal
const helpButton = document.createElement("div")
helpButton.id = "help-button"
helpButton.innerHTML = "?"
document.body.appendChild(helpButton)

const modalOverlay = document.createElement("div")
modalOverlay.classList.add("modal-overlay")
modalOverlay.innerHTML = `
  <div class="modal-content">
    <h2>How to Play</h2>
    <p><strong>Hunters:</strong> Find and shoot the disguised players! You have infinite ammo but shooting props reveals your position.</p>
    <p><strong>Props:</strong> Hide! You look like a random object. Use your tools to survive.</p>
    <ul>
      <li><strong>Rotate:</strong> Adjust your angle to blend in.</li>
      <li><strong>Change Prop:</strong> Morph into a new object (Limited uses).</li>
      <li><strong>Smoke Bomb:</strong> Create a cloud to escape (Limited uses).</li>
    </ul>
    <button class="close-modal-btn">Got it!</button>
  </div>
`
document.body.appendChild(modalOverlay)

helpButton.onclick = () => {
  modalOverlay.style.display = "flex"
}

modalOverlay.querySelector(".close-modal-btn")!.addEventListener("click", () => {
  modalOverlay.style.display = "none"
})


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

    // Manage Z-Indices for Smoke Logic
    // If Hunter: Hunter (215) > Props (10) [Looks like static]
    // If Prop: Props (250) > Smoke (220) > Hunter (210) [X-ray]
    const hunterZ = yourPlayer.isHunter ? "215" : "210"
    const propZ = yourPlayer.isHunter ? "10" : "250"

    for (const playerId in players) {
      const el = playerElements[playerId]
      if (el) {
        if (players[playerId].isHunter) {
          el.style.zIndex = hunterZ
        } else {
          el.style.zIndex = propZ
        }
      }
    }

    // Manage Change Prop Button
    let changePropButton = document.getElementById(
      "change-prop-button"
    ) as HTMLButtonElement
    if (!changePropButton) {
      changePropButton = document.createElement("button")
      changePropButton.id = "change-prop-button"
      changePropButton.classList.add("action-btn")
      // Icon: Shuffle / Refresh
      changePropButton.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/></svg>`
      document.body.appendChild(changePropButton)
      changePropButton.onclick = () => {
        if (
          yourPlayerId &&
          !players[yourPlayerId].isHunter &&
          !players[yourPlayerId].isCaught &&
          players[yourPlayerId].propChangesRemaining > 0
        ) {
          Rune.actions.changeProp()
        }
      }
    }

    if (yourPlayer.isHunter || yourPlayer.isCaught) {
      changePropButton.style.display = "none"
    } else {
      changePropButton.style.display = "flex"
      // changePropButton.innerText = `Change Prop (${yourPlayer.propChangesRemaining})` // Removed text
      changePropButton.disabled = yourPlayer.propChangesRemaining <= 0
      if (yourPlayer.propChangesRemaining <= 0) changePropButton.style.opacity = "0.5"
      else changePropButton.style.opacity = "1"

      // Count Badge for Change Prop
      let countBadge = changePropButton.querySelector('.count-badge') as HTMLSpanElement
      if (!countBadge) {
        countBadge = document.createElement('span')
        countBadge.classList.add('count-badge')
        changePropButton.appendChild(countBadge)
      }
      countBadge.innerText = yourPlayer.propChangesRemaining.toString()
    }

    // Manage Smoke Bomb Button
    let smokeBombButton = document.getElementById(
      "smoke-bomb-button"
    ) as HTMLButtonElement
    if (!smokeBombButton) {
      smokeBombButton = document.createElement("button")
      smokeBombButton.id = "smoke-bomb-button"
      smokeBombButton.classList.add("action-btn")
      // Icon: Cloud / Smoke
      smokeBombButton.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>`
      document.body.appendChild(smokeBombButton)
      smokeBombButton.onclick = () => {
        if (
          yourPlayerId &&
          !players[yourPlayerId].isHunter &&
          !players[yourPlayerId].isCaught &&
          players[yourPlayerId].smokeBombsRemaining > 0
        ) {
          Rune.actions.useSmokeBomb()
        }
      }
    }

    if (yourPlayer.isHunter || yourPlayer.isCaught) {
      smokeBombButton.style.display = "none"
    } else {
      smokeBombButton.style.display = "flex"
      // smokeBombButton.innerText = `Smoke Bomb (${yourPlayer.smokeBombsRemaining})` // Removed text
      smokeBombButton.disabled = yourPlayer.propChangesRemaining <= 0
       if (yourPlayer.smokeBombsRemaining <= 0) smokeBombButton.style.opacity = "0.5"
      else smokeBombButton.style.opacity = "1"

      // Count Badge for Smoke Bomb
      let countBadge = smokeBombButton.querySelector('.count-badge') as HTMLSpanElement
      if (!countBadge) {
        countBadge = document.createElement('span')
        countBadge.classList.add('count-badge')
        smokeBombButton.appendChild(countBadge)
      }
      countBadge.innerText = yourPlayer.smokeBombsRemaining.toString()
    }

    // Manage Rotate Prop Button
    let rotatePropButton = document.getElementById(
      "rotate-prop-button"
    ) as HTMLButtonElement
    if (!rotatePropButton) {
      rotatePropButton = document.createElement("button")
      rotatePropButton.id = "rotate-prop-button"
      rotatePropButton.classList.add("action-btn")
      // Icon: Rotate Right
      rotatePropButton.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z"/></svg>`
      document.body.appendChild(rotatePropButton)
      rotatePropButton.onclick = () => {
        if (
          yourPlayerId &&
          !players[yourPlayerId].isHunter &&
          !players[yourPlayerId].isCaught
        ) {
          Rune.actions.rotateProp()
        }
      }
    }

    if (yourPlayer.isHunter || yourPlayer.isCaught) {
      rotatePropButton.style.display = "none"
    } else {
      rotatePropButton.style.display = "flex"
      // rotatePropButton.innerText = "Rotate Prop" // Removed text
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
        }" /><img
            src="/src/assets/gun.svg"
            class="gun"
        />`
        playerElement.style.backgroundColor = "red"
        playerElement.style.width = "50px"
        playerElement.style.height = "50px"
        playerElement.style.border = ""
      } else {
        playerElement.innerHTML = ""
        playerElement.style.backgroundColor = "transparent"
        playerElement.style.border = "none"
        playerElement.classList.add("player")
        playerElement.classList.add("prop")
        const spriteInfo = getSpriteInfo(player.propType!)
        if (spriteInfo) {
          const propElement = document.createElement("div")
          propElement.classList.add("prop")
          propElement.style.backgroundImage = `url(${spriteInfo.spriteSheetUrl})`
          propElement.style.backgroundPosition = `-${spriteInfo.minX}px -${spriteInfo.minY}px`
          propElement.style.width = `${spriteInfo.maxX - spriteInfo.minX}px`
          propElement.style.height = `${spriteInfo.maxY - spriteInfo.minY}px`
          propElement.style.backgroundSize = `${spriteInfo.sheetWidth}px ${spriteInfo.sheetHeight}px`
          playerElement.appendChild(propElement)
        }

        playerElement.onclick = null
      }

      playerElement.style.left = `${player.position.x - 25}px`
      playerElement.style.top = `${player.position.y - 25}px`
      playerElement.style.transform = `rotate(${player.rotation || 0}deg)`

      if (player.isCaught) {
        playerElement.style.opacity = "0.5"
      } else {
        playerElement.style.opacity = "1"
      }

      const gunElement = playerElement.querySelector(".gun") as HTMLImageElement
      if (gunElement) {
        gunElement.style.transform = ``
      }

      const propElement = playerElement.querySelector(".prop") as HTMLDivElement
      if (
        player.lastHitTime &&
        Rune.gameTime() - player.lastHitTime < 500 &&
        !player.isHunter &&
        propElement
      ) {
        propElement.classList.add("player-hit")
      } else if (propElement) {
        propElement.classList.remove("player-hit")
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
        if (prop.isHit) {
          propElement.classList.add("prop-hit")
        } else {
          propElement.classList.remove("prop-hit")
        }
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

      // Smoke Z-index is always 220. Player visibility relative to smoke is handled in the global player loop.
      smokeElement.style.zIndex = "220"
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
    
    if (game.roomLayout) {
      for (const room of game.roomLayout) {
        const minimapRoom = document.createElement("div")
        minimapRoom.style.position = "absolute"
        minimapRoom.style.left = `${(room.x / 2000) * 150}px`
        minimapRoom.style.top = `${(room.y / 2000) * 150}px`
        minimapRoom.style.width = `${(room.width / 2000) * 150}px`
        minimapRoom.style.height = `${(room.height / 2000) * 150}px`
        minimapRoom.style.backgroundColor = roomColors[room.colorIndex % roomColors.length]
        minimapRoom.style.opacity = "0.5" // Slightly transparent on minimap
        minimap.appendChild(minimapRoom)
      }
    }

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
