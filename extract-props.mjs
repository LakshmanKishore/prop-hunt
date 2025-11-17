import fs from "fs/promises"
import path from "path"
import zlib from "zlib"

class PngDecoder {
  constructor(byteArray) {
    this.byteArray = byteArray
    this.dataView = new DataView(byteArray.buffer)
    this.offset = 0
    this.chunks = []
    this.width = 0
    this.height = 0
  }

  readBytes(length) {
    const bytes = this.byteArray.slice(this.offset, this.offset + length)
    this.offset += length
    return bytes
  }

  readUint32() {
    const value = this.dataView.getUint32(this.offset, false) // Big-endian
    this.offset += 4
    return value
  }

  readChunkType() {
    const bytes = this.readBytes(4)
    return String.fromCharCode(...bytes)
  }

  decode() {
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
    const fileSignature = this.readBytes(8)

    for (let i = 0; i < pngSignature.length; i++) {
      if (fileSignature[i] !== pngSignature[i]) {
        throw new Error("Invalid PNG signature.")
      }
    }

    while (this.offset < this.byteArray.length) {
      const length = this.readUint32()
      const type = this.readChunkType()
      const data = this.readBytes(length)
      this.readUint32() // CRC

      if (type === "IHDR") {
        this.parseIHDR(data)
      } else if (type === "IDAT") {
        this.chunks.push(data)
      } else if (type === "IEND") {
        break
      }
    }

    const idatData = Buffer.concat(this.chunks.map(chunk => Buffer.from(chunk)))
    const inflated = zlib.inflateSync(idatData)
    const pixels = this.unfilter(inflated)

    return {
      width: this.width,
      height: this.height,
      pixels,
    }
  }

  parseIHDR(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    this.width = view.getUint32(0, false)
    this.height = view.getUint32(4, false)
    this.bitDepth = view.getUint8(8)
    this.colorType = view.getUint8(9)
    this.compressionMethod = view.getUint8(10)
    this.filterMethod = view.getUint8(11)
    this.interlaceMethod = view.getUint8(12)
  }

  unfilter(data) {
    const pixels = Buffer.alloc(this.width * this.height * 4)
    const bpp = 4 // Assuming RGBA
    const stride = this.width * bpp

    let dataOffset = 0
    let pixelsOffset = 0

    for (let y = 0; y < this.height; y++) {
      const filterType = data[dataOffset++]
      const line = data.slice(dataOffset, dataOffset + stride)
      dataOffset += stride

      switch (filterType) {
        case 0: // None
          line.copy(pixels, pixelsOffset)
          break
        case 1: // Sub
          for (let x = 0; x < stride; x++) {
            const left = x >= bpp ? pixels[pixelsOffset + x - bpp] : 0
            pixels[pixelsOffset + x] = (line[x] + left) & 0xff
          }
          break
        case 2: // Up
          for (let x = 0; x < stride; x++) {
            const up = y > 0 ? pixels[pixelsOffset + x - stride] : 0
            pixels[pixelsOffset + x] = (line[x] + up) & 0xff
          }
          break
        case 3: // Average
          for (let x = 0; x < stride; x++) {
            const left = x >= bpp ? pixels[pixelsOffset + x - bpp] : 0
            const up = y > 0 ? pixels[pixelsOffset + x - stride] : 0
            pixels[pixelsOffset + x] = (line[x] + Math.floor((left + up) / 2)) & 0xff
          }
          break
        case 4: // Paeth
          for (let x = 0; x < stride; x++) {
            const left = x >= bpp ? pixels[pixelsOffset + x - bpp] : 0
            const up = y > 0 ? pixels[pixelsOffset + x - stride] : 0
            const upLeft = x >= bpp && y > 0 ? pixels[pixelsOffset + x - stride - bpp] : 0
            const p = left + up - upLeft
            const pa = Math.abs(p - left)
            const pb = Math.abs(p - up)
            const pc = Math.abs(p - upLeft)
            let pr
            if (pa <= pb && pa <= pc) pr = left
            else if (pb <= pc) pr = up
            else pr = upLeft
            pixels[pixelsOffset + x] = (line[x] + pr) & 0xff
          }
          break
        default:
          throw new Error(`Unknown filter type: ${filterType}`)
      }
      pixelsOffset += stride
    }
    return pixels
  }
}

const fpropsDir = path.join(process.cwd(), "src", "assets", "fprops")
const outputFile = path.join(process.cwd(), "src", "assets", "prop-coordinates.json")

async function main() {
  const files = await fs.readdir(fpropsDir)
  const pngFiles = files.filter(file => file.endsWith(".png"))

  const allCoordinates = {}

  for (const file of pngFiles) {
    const filePath = path.join(fpropsDir, file)
    const buffer = await fs.readFile(filePath)
    const decoder = new PngDecoder(buffer)
    const { width, height, pixels } = decoder.decode()

    const coordinates = findBoundingBoxes(width, height, pixels)
    allCoordinates[file] = {
      sheetWidth: width,
      sheetHeight: height,
      sprites: coordinates,
    }
  }

  await fs.writeFile(outputFile, JSON.stringify(allCoordinates, null, 2))
  console.log(`Successfully extracted coordinates to ${outputFile}`)
}

function findBoundingBoxes(width, height, pixels) {
  const visited = new Array(width * height).fill(false)
  const coordinates = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x)
      if (visited[index] || pixels[index * 4 + 3] === 0) {
        continue
      }

      const { box, visited: newVisited } = floodFill(width, height, pixels, x, y)
      newVisited.forEach(i => visited[i] = true)
      coordinates.push(box)
    }
  }

  return coordinates
}

function floodFill(width, height, pixels, startX, startY) {
  const stack = [[startX, startY]]
  const visited = new Set()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  while (stack.length > 0) {
    const [x, y] = stack.pop()
    const index = y * width + x

    if (x < 0 || x >= width || y < 0 || y >= height || visited.has(index) || pixels[index * 4 + 3] === 0) {
      continue
    }

    visited.add(index)

    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)

    stack.push([x + 1, y])
    stack.push([x - 1, y])
    stack.push([x, y + 1])
    stack.push([x, y - 1])
  }

  return {
    box: { minX, minY, maxX, maxY },
    visited: Array.from(visited)
  }
}

main().catch(console.error)
