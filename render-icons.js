const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function renderCleanSvg() {
  const svgPath = path.join(__dirname, 'ChatGPT Image 2026年8月1日 13_49_28.svg');
  const pngPath = path.join(__dirname, 'ChatGPT Image 2026年8月1日 13_49_28.png');
  const iconsDir = path.join(__dirname, 'public', 'icons');
  const publicDir = path.join(__dirname, 'public');

  // Convert SVG to PNG directly
  const targets = [
    { name: 'icon-192.png', size: 192, dir: iconsDir },
    { name: 'icon-512.png', size: 512, dir: iconsDir },
    { name: 'apple-touch-icon.png', size: 180, dir: iconsDir },
    { name: 'favicon.ico', size: 64, dir: publicDir },
  ];

  // Try rendering SVG first
  try {
    for (const t of targets) {
      const dest = path.join(t.dir, t.name);
      await sharp(svgPath)
        .resize(t.size, t.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(dest);
      console.log(`Rendered SVG -> ${dest}`);
    }
  } catch (err) {
    console.error('SVG render failed, falling back to PNG:', err);
    for (const t of targets) {
      const dest = path.join(t.dir, t.name);
      await sharp(pngPath)
        .resize(t.size, t.size)
        .png()
        .toFile(dest);
      console.log(`Rendered PNG -> ${dest}`);
    }
  }

  // Copy SVG as icon.svg
  fs.copyFileSync(svgPath, path.join(iconsDir, 'icon.svg'));
  console.log('Copied icon.svg');
}

renderCleanSvg().catch(console.error);
