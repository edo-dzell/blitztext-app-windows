// Erzeugt die zwei Tray-Icons (hell/dunkel) aus dem ORIGINAL `resources/tray.png` — gleiche Form,
// nur umgefärbt (RGB ersetzt, Alpha/Anti-Aliasing erhalten). Kein neues Motiv. Dependency-frei via
// node:zlib (PNG dekodieren + neu kodieren). Aufruf: node scripts/gen-tray-icons.mjs
import { inflateSync, deflateSync, crc32 } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources')

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

// PNG → { width, height, pixels(RGBA) }. Erwartet 8-bit RGBA (color type 6), nicht interlaced.
function decode(buf) {
  let p = 8 // Signatur überspringen
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
    raw[o++] = 0 // Filter None
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

// RGB ersetzen, Alpha (inkl. Anti-Aliasing) erhalten → gleiche Form, andere Farbe.
function umfaerben(img, r, g, b) {
  const px = Buffer.from(img.pixels)
  for (let i = 0; i < px.length; i += 4) {
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
  }
  return encode(img.width, img.height, px)
}

const original = decode(readFileSync(join(dir, 'tray.png')))
writeFileSync(join(dir, 'tray-light.png'), umfaerben(original, 255, 255, 255)) // helles Icon → dunkle Taskleiste
writeFileSync(join(dir, 'tray-dark.png'), umfaerben(original, 26, 26, 26)) // dunkles Icon → helle Taskleiste
console.log(`tray-light.png + tray-dark.png aus Original (${original.width}×${original.height}) umgefärbt.`)
