// scripts/generate-placeholder.cjs

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const width = 960;
const height = 620;

const target = path.join(
  __dirname,
  "..",
  "web",
  "public",
  "placeholder.png"
);

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^
        ((crc & 1) ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);

  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);

  const checksum = Buffer.alloc(4);

  checksum.writeUInt32BE(
    crc32(Buffer.concat([typeBuffer, data]))
  );

  return Buffer.concat([
    size,
    typeBuffer,
    data,
    checksum
  ]);
}

const pixels = Buffer.alloc(
  (width * 4 + 1) * height
);

for (let y = 0; y < height; y += 1) {
  const row = y * (width * 4 + 1);

  pixels[row] = 0;

  for (let x = 0; x < width; x += 1) {
    const nx = x / width;
    const ny = y / height;

    const distance = Math.hypot(
      (nx - 0.72) * 1.5,
      (ny - 0.42) * 1.8
    );

    const glow = Math.max(0, 1 - distance);
    const offset = row + 1 + x * 4;

    pixels[offset] = Math.round(
      27 + nx * 14 + glow * 78
    );

    pixels[offset + 1] = Math.round(
      32 + glow * 32
    );

    pixels[offset + 2] = Math.round(
      43 + glow * 38
    );

    pixels[offset + 3] = 255;
  }
}

const header = Buffer.alloc(13);

header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);

header[8] = 8;
header[9] = 6;

const png = Buffer.concat([
  Buffer.from("89504e470d0a1a0a", "hex"),
  pngChunk("IHDR", header),
  pngChunk("IDAT", zlib.deflateSync(pixels)),
  pngChunk("IEND", Buffer.alloc(0))
]);

fs.mkdirSync(path.dirname(target), {
  recursive: true
});

fs.writeFileSync(target, png);

console.log(
  "[assets] Placeholder image ready."
);