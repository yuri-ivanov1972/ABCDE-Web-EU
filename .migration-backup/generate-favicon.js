import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import svg2img from 'svg2img';
import pngToIco from 'png-to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Convert SVG to PNG
svg2img(path.join(__dirname, 'attached_assets/favicon.svg'), { width: 256, height: 256 }, function(error, buffer) {
  if (error) {
    console.error('Error converting SVG to PNG:', error);
    return;
  }

  // Write the PNG to disk temporarily
  const pngPath = path.join(__dirname, 'favicon.png');
  fs.writeFileSync(pngPath, buffer);
  console.log('PNG created successfully.');

  // Convert PNG to ICO
  pngToIco([pngPath])
    .then(buf => {
      // Write the ICO file to public directory
      fs.writeFileSync(path.join(__dirname, 'public/favicon.ico'), buf);
      console.log('Favicon created successfully.');

      // Clean up the temporary PNG file
      fs.unlinkSync(pngPath);
      console.log('Temporary PNG file removed.');
    })
    .catch(err => {
      console.error('Error converting PNG to ICO:', err);
    });
});