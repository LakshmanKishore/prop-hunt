import propCoordinates from "./assets/prop-coordinates.json"





const allPropTypes = Object.entries(propCoordinates).flatMap(
  ([spriteSheet, coordinates]) =>
    coordinates.map((_, index) => `${spriteSheet.replace(".png", "")}_${index}`)
)

if (allPropTypes.length === 0) {
  alert("Prop coordinates loaded, but no prop types were generated. Check prop-coordinates.json.")
}

export function getSpriteInfo(propType: string) {
  const parts = propType.split("_")
  const spriteSheetName = `${parts[0]}.png`
  const spriteIndex = parseInt(parts[1], 10)

  const coordinates = (propCoordinates as any)[spriteSheetName]
  if (!coordinates || !coordinates[spriteIndex]) {
    return null
  }

  const sprite = coordinates[spriteIndex]

  return {
    spriteSheetUrl: new URL(
      `/src/assets/fprops/${spriteSheetName}`,
      import.meta.url
    ).href,
    ...sprite,
  }
}

export const propTypes = allPropTypes
