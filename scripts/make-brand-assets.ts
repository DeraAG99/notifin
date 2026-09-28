/**
 * Generates the SI-MPOK NORI brand assets from the source logo in `ui-mpoknori/`.
 *
 * The source is a 1024x1024 JPEG on an opaque white background. This script
 * removes that background with a flood fill seeded from the image border, so
 * light pixels *inside* the mark survive — a global brightness threshold would
 * punch holes in them. The resulting alpha is then trimmed to the mark's
 * bounding box so the asset can be laid out at any size without dead padding.
 *
 * Run: bun run scripts/make-brand-assets.ts
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Jimp } from "jimp";

const SOURCE = resolve("ui-mpoknori/WhatsApp Image 2026-09-26 at 21.45.43.jpeg");
const OUT_DIR = resolve("public/brand");
const LOGO_SIZE = 512;
const ICON_SIZE = 192;
const ALPHA_CUTOFF = 8;

/** Max per-channel RGB distance from the seed colour still treated as background. */
const TOLERANCE = 24;
/** Looser second pass to also clear the anti-aliased fringe left by JPEG compression. */
const FRINGE_TOLERANCE = 90;

function distance(
  data: Buffer,
  offset: number,
  r: number,
  g: number,
  b: number,
): number {
  return (
    Math.abs(data[offset] - r) +
    Math.abs(data[offset + 1] - g) +
    Math.abs(data[offset + 2] - b)
  );
}

function printPreview(data: Buffer, width: number, height: number) {
  const COLS = 56;
  const ROWS = 28;
  const ramp = " .:-=+*#%@";
  const cells = new Float64Array(COLS * ROWS);

  for (let y = 0; y < height; y++) {
    const row = Math.floor((y / height) * ROWS);
    for (let x = 0; x < width; x++) {
      cells[row * COLS + Math.floor((x / width) * COLS)] +=
        data[(y * width + x) * 4 + 3];
    }
  }

  const max = Math.max(...cells);
  let art = "";
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const step = Math.round(
        (cells[row * COLS + col] / max) * (ramp.length - 1),
      );
      art += ramp[Math.min(ramp.length - 1, step)];
    }
    art += "\n";
  }
  return art;
}

async function main() {
  const image = await Jimp.read(SOURCE);
  const { width, height } = image;
  const data = image.bitmap.data;

  // The border is uniformly white in the source, so the top-left pixel is a
  // valid reference for "background".
  const [seedR, seedG, seedB] = [data[0], data[1], data[2]];
  console.log(`source ${width}x${height}  seed rgb(${seedR}, ${seedG}, ${seedB})`);

  const background = new Uint8Array(width * height);
  const queue: number[] = [];

  const visit = (x: number, y: number, tolerance: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (background[index]) return;
    if (distance(data, index * 4, seedR, seedG, seedB) > tolerance) return;
    background[index] = 1;
    queue.push(index);
  };

  for (const tolerance of [TOLERANCE, FRINGE_TOLERANCE]) {
    for (let x = 0; x < width; x++) {
      visit(x, 0, tolerance);
      visit(x, height - 1, tolerance);
    }
    for (let y = 0; y < height; y++) {
      visit(0, y, tolerance);
      visit(width - 1, y, tolerance);
    }
    while (queue.length > 0) {
      const index = queue.pop()!;
      const x = index % width;
      const y = (index - x) / width;
      visit(x - 1, y, tolerance);
      visit(x + 1, y, tolerance);
      visit(x, y - 1, tolerance);
      visit(x, y + 1, tolerance);
    }
  }

  let removed = 0;
  for (let index = 0; index < width * height; index++) {
    if (background[index]) {
      data[index * 4 + 3] = 0;
      removed++;
    }
  }
  const keptPct = 100 - (removed / (width * height)) * 100;
  console.log(`background removed ${(100 - keptPct).toFixed(1)}%  mark kept ${keptPct.toFixed(1)}%`);

  console.log("\nalpha preview (0 = transparent, @ = solid mark):\n");
  console.log(printPreview(data, width, height));

  // Trim to the mark's bounding box.
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_CUTOFF) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("background removal ate the whole mark");

  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  console.log(
    `trim box ${boxWidth}x${boxHeight} at (${minX}, ${minY})  canvas ${width}x${height}`,
  );

  const logo = image
    .crop({ x: minX, y: minY, w: boxWidth, h: boxHeight })
    .resize({ w: LOGO_SIZE });
  mkdirSync(OUT_DIR, { recursive: true });

  const logoPath = resolve(OUT_DIR, "si-mpok-nori-logo.png") as `${string}.png`;
  const iconPath = resolve(OUT_DIR, "icon.png") as `${string}.png`;
  await logo.write(logoPath);
  await logo.clone().resize({ w: ICON_SIZE }).write(iconPath);

  console.log(`\nwrote ${logoPath}`);
  console.log(`wrote ${iconPath}`);
}

await main();
