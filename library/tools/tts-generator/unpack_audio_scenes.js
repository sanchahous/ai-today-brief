import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const downloadsDir = path.join(process.env.USERPROFILE || 'C:/Users/Oleksandr', 'Downloads');

// Determine date folder (or accept CLI argument: node unpack_audio_scenes.js 01.09.2026)
const dateArg = process.argv[2];
let targetDateStr;

if (dateArg) {
  targetDateStr = dateArg;
} else {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  targetDateStr = `${dd}.${mm}.${yyyy}`;
}

const targetDir = path.join('E:/domains/ai-today-brief/library', targetDateStr, 'audio_scenes');
fs.mkdirSync(targetDir, { recursive: true });

console.log(`[Unpack Tool] Target Directory: ${targetDir}`);
console.log(`[Unpack Tool] Searching for downloaded ZIP files in: ${downloadsDir}`);

const candidateZips = [
  'ai_today_brief_audio_scenes.zip',
  'ai_today_brief_18_scenes.zip'
];

let foundZip = null;
for (const name of candidateZips) {
  const fullPath = path.join(downloadsDir, name);
  if (fs.existsSync(fullPath)) {
    foundZip = fullPath;
    break;
  }
}

if (!foundZip) {
  console.error(`❌ No ZIP archive found in Downloads. Expected one of: ${candidateZips.join(', ')}`);
  process.exit(1);
}

console.log(`📦 Found: ${foundZip} (${(fs.statSync(foundZip).size / 1024).toFixed(1)} KB)`);
console.log(`🚀 Unpacking into ${targetDir}...`);

try {
  execSync(`powershell -Command "Expand-Archive -Path '${foundZip}' -DestinationPath '${targetDir}' -Force"`);
  fs.unlinkSync(foundZip);
  console.log(`✅ Extracted successfully and cleaned up ZIP!`);

  const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.mp3')).sort();
  console.log(`\n📊 Total MP3 files in ${targetDir}: ${files.length}`);
  files.forEach((f, i) => {
    const stat = fs.statSync(path.join(targetDir, f));
    console.log(`   [${i + 1}] ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  });
} catch (err) {
  console.error('❌ Error during extraction:', err.message);
}
