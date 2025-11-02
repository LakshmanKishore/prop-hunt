import nipplejs from "nipplejs"

export function setupControls(document: Document) {
  const joystickContainer = document.getElementById("joystick-container")
  if (!joystickContainer) return

  const joystick = nipplejs.create({
    zone: joystickContainer,
    mode: "static",
    position: { left: "50%", top: "50%" },
    color: "white",
  })

  joystick.on("move", (_, data) => {
    const { x, y } = data.vector
    Rune.actions.setPosition({ x, y })
  })

  joystick.on("end", () => {
    Rune.actions.setPosition({ x: 0, y: 0 })
  })
}
