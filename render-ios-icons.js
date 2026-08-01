const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function renderIosIcons() {
  const svgPath = path.join(__dirname, 'ChatGPT Image 2026年8月1日 13_49_28.svg');
  const iconsDir = path.join(__dirname, 'public', 'icons');
  const publicDir = path.join(__dirname, 'public');

  // iOS Safari touch icons must be square PNGs with NO transparency (solid background)
  // Apple recommends 180x180 filled icon with background
  const iosSizes = [
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'apple-touch-icon-precomposed.png', size: 180 },
    { name: 'apple-touch-icon-180x180.png', size: 180 },
    { name: 'apple-touch-icon-152x152.png', size: 152 },
    { name: 'apple-touch-icon-167x167.png', size: 167 },
  ];

  for (const item of iosSizes) {
    const dest = path.join(iconsDir, item.name);
    // Flatten against white background so iOS doesn't render transparent black/dark square
    await sharp(svgPath)
      .resize(item.size, item.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toFile(dest);
    console.log(`Rendered iOS Icon -> ${dest}`);
  }

  // Also put apple-touch-icon.png in root public for fallback
  fs.copyFileSync(path.join(iconsDir, 'apple-touch-icon.png'), path.join(publicDir, 'apple-touch-icon.png'));
  fs.copyFileSync(path.join(iconsDir, 'apple-touch-icon-precomposed.png'), path.join(publicDir, 'apple-touch-icon-precomposed.png'));
  console.log('Copied root apple-touch-icon.png');
}

renderIosIcons().catch(console.error);
