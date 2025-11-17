export function extractFrame(
  spriteSheetUrl: string,
  frameX: number,
  frameY: number,
  frameWidth: number,
  frameHeight: number
): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = spriteSheetUrl
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = frameWidth
      canvas.height = frameHeight
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(
        img,
        frameX,
        frameY,
        frameWidth,
        frameHeight,
        0,
        0,
        frameWidth,
        frameHeight
      )
      resolve(canvas)
    }
  })
}
