const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgPath = path.join(__dirname, 'public/icons/icon.svg');
const maskableSvgPath = path.join(__dirname, 'public/icons/icon-maskable.svg');
const outputDir = path.join(__dirname, 'public/icons');

async function generateIcons() {
  const svgBuffer = fs.readFileSync(svgPath);
  const maskableSvgBuffer = fs.readFileSync(maskableSvgPath);

  // Generate regular icons
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: icon-${size}x${size}.png`);
  }

  // Generate maskable icons for Android
  const maskableSizes = [192, 512];
  for (const size of maskableSizes) {
    const outputPath = path.join(outputDir, `icon-maskable-${size}x${size}.png`);
    await sharp(maskableSvgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: icon-maskable-${size}x${size}.png`);
  }

  // Generate favicon
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(outputDir, 'favicon-32x32.png'));
  console.log('Generated: favicon-32x32.png');

  // Generate apple-touch-icon
  const appleTouchPath = path.join(__dirname, 'public/apple-touch-icon.png');
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(appleTouchPath);
  console.log('Generated: apple-touch-icon.png');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
