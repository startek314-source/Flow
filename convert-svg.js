const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function convertSvgToPng() {
  const svgPath = path.join(__dirname, 'public', 'icons', 'icon.svg');
  const iconsDir = path.join(__dirname, 'public', 'icons');
  const publicDir = path.join(__dirname, 'public');

  const sizes = [
    { name: 'icon-192.png', size: 192, dir: iconsDir },
    { name: 'icon-512.png', size: 512, dir: iconsDir },
    { name: 'apple-touch-icon.png', size: 180, dir: iconsDir },
    { name: 'favicon.ico', size: 64, dir: publicDir },
  ];

  for (const item of sizes) {
    const outputPath = path.join(item.dir, item.name);
    await sharp(svgPath)
      .resize(item.size, item.size)
      .png()
      .toFile(outputPath);
    console.log(`✓ Converted SVG -> ${outputPath} (${item.size}x${item.size})`);
  }
}

convertSvgToPng().catch(console.error);
