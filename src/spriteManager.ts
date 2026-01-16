import propCoordinates from "./assets/prop-coordinates.json"

interface SheetData {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface Coordinates {
  [key: string]: {
    sheetWidth: number
    sheetHeight: number
    sprites: SheetData[]
  }
}

export function getSpriteInfo(propType: string) {
  const parts = propType.split("_")
  const spriteSheetName = `${parts[0]}.png`
  const spriteIndex = parseInt(parts[1], 10)

  const {
    sheetWidth,
    sheetHeight,
    sprites = [],
  } = (propCoordinates as Coordinates)[spriteSheetName] || {}

  if (!sprites[spriteIndex]) {
    return null
  }

  const sprite = sprites[spriteIndex]

  return {
    spriteSheetUrl: new URL(
      `./assets/fprops/${spriteSheetName}`,
      import.meta.url
    ).href,
    ...sprite,
    sheetWidth,
    sheetHeight,
  }
}
