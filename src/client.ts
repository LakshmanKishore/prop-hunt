import "./styles.css"
import { GameState, Player, PlayerId } from "./logic"

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement
const ctx = canvas.getContext("2d")!

let players: Record<PlayerId, Player> = {}
let props: any[] = []
let yourPlayerId: PlayerId | undefined

const propImages: Record<string, HTMLImageElement> = {}

const camera = {
  x: 0,
  y: 0,
}

async function loadPropAssets() {
  const propSvgs = {
    prop1: (await import("./assets/prop1.svg?url")).default,
    prop2: (await import("./assets/prop2.svg?url")).default,
    prop3: (await import("./assets/prop3.svg?url")).default,
    prop4: (await import("./assets/prop4.svg?url")).default,
    prop5: (await import("./assets/prop5.svg?url")).default,
  }

  for (const [name, url] of Object.entries(propSvgs)) {
    const img = new Image()
    img.src = url
    propImages[name] = img
  }
}

import { drawMinimap } from "./minimap"

function draw() {
  if (yourPlayerId && players[yourPlayerId]) {
    camera.x = players[yourPlayerId].position.x - canvas.width / 2
    camera.y = players[yourPlayerId].position.y - canvas.height / 2
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(-camera.x, -camera.y)

  for (const player of Object.values(players)) {
    if (player.isHunter) {
      ctx.beginPath()
      ctx.arc(player.position.x, player.position.y, 20, 0, 2 * Math.PI)
      ctx.fillStyle = "blue"
      ctx.fill()
    }
  }

  for (const prop of props) {
    if (prop.isPlayer && prop.playerId) {
      const player = players[prop.playerId]
      if (player && propImages[prop.name]) {
        ctx.save()
        ctx.translate(player.position.x, player.position.y)
        ctx.rotate(prop.rotation)
        const img = propImages[prop.name]
        ctx.drawImage(img, -img.width / 2, -img.height / 2)
        ctx.restore()

        if (prop.isFound) {
          ctx.beginPath()
          ctx.arc(player.position.x, player.position.y, 30, 0, 2 * Math.PI)
          ctx.strokeStyle = "red"
          ctx.lineWidth = 3
          ctx.stroke()
        }
      }
    }
  }

  ctx.restore()

  if (yourPlayerId) {
    drawMinimap({ players, props, gameTime: 0, phase: "hunting" }, yourPlayerId)
  }

  requestAnimationFrame(draw)
}

import { setupControls } from "./controls"

const timerEl = document.getElementById("timer")!
const gameInfoEl = document.getElementById("game-info")!
const scanButton = document.getElementById("scan-button") as HTMLButtonElement

const playersSection = document.getElementById("playersSection")!

scanButton.addEventListener("click", () => {
  Rune.actions.scan()
})

let avatarSet = false

loadPropAssets().then(() => {
  Rune.initClient({
    onChange: ({ game, yourPlayerId: newYourPlayerId }) => {
      players = game.players
      props = game.props
      if (newYourPlayerId) {
        yourPlayerId = newYourPlayerId
        setTimeout(() => {
          const playerInfo = Rune.getPlayerInfo(yourPlayerId)
          if (playerInfo) {
            Rune.actions.setAvatarUrl(playerInfo.avatarUrl)
          }
        }, 100)
      }

      if (yourPlayerId && players[yourPlayerId]?.isHunter) {
        scanButton.style.display = "block"
      } else {
        scanButton.style.display = "none"
      }

      playersSection.innerHTML = ""
      for (const playerId of Object.keys(game.players)) {
        const player = game.players[playerId]
        const playerInfo = Rune.getPlayerInfo(playerId)
        const li = document.createElement("li")
        li.innerHTML = `<img src="${player.avatarUrl}" /><span>${playerInfo.displayName}</span>`
        playersSection.appendChild(li)
      }

      const minutes = Math.floor(game.gameTime / 60)
      const seconds = game.gameTime % 60
      timerEl.innerText = `${minutes}:${seconds.toString().padStart(2, "0")}`

      if (game.phase === "lobby") {
        gameInfoEl.innerText = "Waiting for players..."
      } else if (game.phase === "hiding") {
        gameInfoEl.innerText = "Hiding phase!"
      } else if (game.phase === "hunting") {
        gameInfoEl.innerText = ""
      } else if (game.phase === "finished") {
        gameInfoEl.innerText = `${game.winningTeam?.toUpperCase()} WIN!`
      }
    },
  })

  setupControls(document)

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  draw()
})
