const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const baseDir = path.resolve(__dirname);
const files = [
  'index.html',
  'style.css',
  'app.js',
  'sw.js',
  'manifest.json',
  'vercel.json',
  'logo-apteka.jpg'
];

const filePayloads = [];
for (const f of files) {
  const fullPath = path.join(baseDir, f);
  if (fs.existsSync(fullPath)) {
    const buf = fs.readFileSync(fullPath);
    const sha = crypto.createHash('sha1').update(buf).digest('hex');
    filePayloads.push({
      file: f,
      sha,
      size: buf.length,
      data: buf.toString('base64'),
      encoding: 'base64'
    });
  }
}

const photosDir = path.join(baseDir, 'photos');
if (fs.existsSync(photosDir)) {
  for (const ph of fs.readdirSync(photosDir)) {
    const fullPath = path.join(photosDir, ph);
    const buf = fs.readFileSync(fullPath);
    const sha = crypto.createHash('sha1').update(buf).digest('hex');
    filePayloads.push({
      file: 'photos/' + ph,
      sha,
      size: buf.length,
      data: buf.toString('base64'),
      encoding: 'base64'
    });
  }
}

fs.writeFileSync(path.join(baseDir, 'deploy_manifest.json'), JSON.stringify(filePayloads, null, 2), 'utf8');
console.log('Successfully prepared ' + filePayloads.length + ' files for deployment');
