const sharp = require('sharp');
const path = require('path');

async function checkImage() {
  const pngPath = path.join(__dirname, 'ChatGPT Image 2026年8月1日 13_49_28.png');
  const metadata = await sharp(pngPath).metadata();
  console.log('PNG Metadata:', metadata);
}

checkImage();
