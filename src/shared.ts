import propCoordinates from "./assets/prop-coordinates.json"

export const propTypes = Object.entries(propCoordinates).flatMap(
  ([spriteSheet, { sprites }]) =>
    sprites.map((_, index) => `${spriteSheet.replace(".png", "")}_${index}`)
)
