// Erzeugt build/icon.ico aus resources/tray.png (Nutzer-Entscheidung: vorhandenes Tray-Zeichen als
// App-Icon, auf 256×256 hochskaliert). electron-builder verlangt ein Icon ≥256×256 — die 36×36-Quelle
// wird daher bilinear hochgerechnet (sichtbar weich, bewusst akzeptiert; für ein scharfes Icon später
// eine größere PNG einsetzen). Dependency-frei via node:zlib. Aufruf: node scripts/gen-app-icon.mjs

import { inflateSync, deflateSync, crc32 } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ZIEL = 256

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

// PNG → { width, height, pixels(RGBA) }. Erwartet 8-bit RGBA (color type 6), nicht interlaced.
function decode(buf) {
  let p = 8
  let width = 0
  let height = 0
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8 || data[9] !== 6) throw new Error('Erwartet 8-bit RGBA tray.png')
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    p += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const bpp = 4
  const stride = width * bpp
  const out = Buffer.alloc(height * stride)
  const prev = Buffer.alloc(stride)
  let ri = 0
  let o = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[ri++]
    const row = Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const rb = raw[ri++]
      const a = x >= bpp ? row[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v
      if (filter === 1) v = rb + a
      else if (filter === 2) v = rb + b
      else if (filter === 3) v = rb + ((a + b) >> 1)
      else if (filter === 4) v = rb + paeth(a, b, c)
      else v = rb
      row[x] = v & 0xff
    }
    row.copy(out, o)
    row.copy(prev, 0)
    o += stride
  }
  return { width, height, pixels: out }
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0)
  return Buffer.concat([len, t, data, crc])
}

function encode(width, height, pixels) {
  const stride = width * 4
  const raw = Buffer.alloc(height * (1 + stride))
  let o = 0
  let pi = 0
  for (let y = 0; y < height; y++) {
    raw[o++] = 0
    for (let x = 0; x < stride; x++) raw[o++] = pixels[pi++]
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// Bilineares Hochskalieren (straight RGBA). Quelle klein → Ergebnis weich, aber ≥256 für electron-builder.
function resize(img, tw, th) {
  const { width: sw, height: sh, pixels: src } = img
  const out = Buffer.alloc(tw * th * 4)
  const sxr = sw > 1 ? (sw - 1) / (tw - 1) : 0
  const syr = sh > 1 ? (sh - 1) / (th - 1) : 0
  for (let ty = 0; ty < th; ty++) {
    const fy = ty * syr
    const y0 = Math.floor(fy)
    const y1 = Math.min(y0 + 1, sh - 1)
    const wy = fy - y0
    for (let tx = 0; tx < tw; tx++) {
      const fx = tx * sxr
      const x0 = Math.floor(fx)
      const x1 = Math.min(x0 + 1, sw - 1)
      const wx = fx - x0
      const o = (ty * tw + tx) * 4
      for (let c = 0; c < 4; c++) {
        const p00 = src[(y0 * sw + x0) * 4 + c]
        const p10 = src[(y0 * sw + x1) * 4 + c]
        const p01 = src[(y1 * sw + x0) * 4 + c]
        const p11 = src[(y1 * sw + x1) * 4 + c]
        const top = p00 + (p10 - p00) * wx
        const bot = p01 + (p11 - p01) * wx
        out[o + c] = Math.round(top + (bot - top) * wy)
      }
    }
  }
  return { width: tw, height: th, pixels: out }
}

const quelle = decode(readFileSync(join(root, 'resources', 'tray.png')))
const gross = resize(quelle, ZIEL, ZIEL)
const png = encode(gross.width, gross.height, gross.pixels)

// ICO-Container mit einem PNG-Eintrag (256 → Breiten/Höhen-Byte = 0).
const dir = Buffer.alloc(6)
dir.writeUInt16LE(0, 0)
dir.writeUInt16LE(1, 2)
dir.writeUInt16LE(1, 4)
const entry = Buffer.alloc(16)
entry.writeUInt8(0, 0) // 0 = 256
entry.writeUInt8(0, 1)
entry.writeUInt8(0, 2)
entry.writeUInt8(0, 3)
entry.writeUInt16LE(1, 4)
entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(png.length, 8)
entry.writeUInt32LE(6 + 16, 12)
writeFileSync(join(root, 'build', 'icon.ico'), Buffer.concat([dir, entry, png]))
console.log(`build/icon.ico geschrieben (${quelle.width}×${quelle.height} → ${ZIEL}×${ZIEL}, PNG ${png.length} B)`)
