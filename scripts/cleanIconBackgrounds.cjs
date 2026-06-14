const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const sourceDir = path.join(__dirname, "..", "src", "assets", "icons");
const outputDir = path.join(sourceDir, "clean");
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

fs.mkdirSync(outputDir, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function parsePng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a PNG file");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth} colorType=${colorType}`);
  }

  return {
    width,
    height,
    colorType,
    data: zlib.inflateSync(Buffer.concat(idat)),
  };
}

function unfilterPng({ width, height, colorType, data }) {
  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = width * channels;
  const pixels = Buffer.alloc(width * height * channels);
  let inputOffset = 0;
  let outputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = data[inputOffset];
    inputOffset += 1;

    for (let x = 0; x < rowBytes; x += 1) {
      const raw = data[inputOffset + x];
      const left = x >= channels ? pixels[outputOffset + x - channels] : 0;
      const up = y > 0 ? pixels[outputOffset + x - rowBytes] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[outputOffset + x - rowBytes - channels] : 0;
      let value;

      if (filter === 0) {
        value = raw;
      } else if (filter === 1) {
        value = raw + left;
      } else if (filter === 2) {
        value = raw + up;
      } else if (filter === 3) {
        value = raw + Math.floor((left + up) / 2);
      } else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = raw + predictor;
      } else {
        throw new Error(`Unsupported PNG filter ${filter}`);
      }

      pixels[outputOffset + x] = value & 255;
    }

    inputOffset += rowBytes;
    outputOffset += rowBytes;
  }

  return { pixels, channels };
}

function backgroundAlpha(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;
  const average = (r + g + b) / 3;

  if (average >= 232 && saturation <= 42) return 0;
  if (average >= 215 && saturation <= 30) return 0;
  if (average >= 198 && saturation <= 18) return 0;

  if (average >= 188 && saturation <= 46) {
    const brightnessFactor = Math.max(0, Math.min(1, (232 - average) / 44));
    const colorFactor = Math.max(0, Math.min(1, (saturation - 18) / 28));
    return Math.max(0, Math.min(220, Math.round(Math.max(brightnessFactor, colorFactor) * 190)));
  }

  return 255;
}

function toRgba({ pixels, channels }) {
  const rgba = Buffer.alloc((pixels.length / channels) * 4);
  let transparent = 0;
  let translucent = 0;

  for (let input = 0, output = 0; input < pixels.length; input += channels, output += 4) {
    const r = pixels[input];
    const g = pixels[input + 1];
    const b = pixels[input + 2];
    const existingAlpha = channels === 4 ? pixels[input + 3] : 255;
    const alpha = channels === 4 ? existingAlpha : backgroundAlpha(r, g, b);

    rgba[output] = r;
    rgba[output + 1] = g;
    rgba[output + 2] = b;
    rgba[output + 3] = alpha;

    if (alpha === 0) transparent += 1;
    else if (alpha < 255) translucent += 1;
  }

  return { rgba, transparent, translucent };
}

function encodeRgbaPng(width, height, rgba) {
  const rowBytes = width * 4;
  const raw = Buffer.alloc(height * (rowBytes + 1));

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const fileName of fs.readdirSync(sourceDir).filter((file) => file.endsWith(".png")).sort()) {
  const inputPath = path.join(sourceDir, fileName);
  const outputPath = path.join(outputDir, fileName);
  const parsed = parsePng(fs.readFileSync(inputPath));
  const decoded = unfilterPng(parsed);
  const { rgba, transparent, translucent } = toRgba(decoded);
  fs.writeFileSync(outputPath, encodeRgbaPng(parsed.width, parsed.height, rgba));

  const mode = parsed.colorType === 6 ? "copied-alpha" : "cleaned";
  console.log(`${mode} ${fileName} transparent=${transparent} translucent=${translucent}`);
}
