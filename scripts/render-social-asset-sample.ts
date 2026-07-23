import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderSocialAssetImage } from '../src/lib/social/assets';

async function main() {
  const outputDirectory = join(process.cwd(), 'tmp', 'visuals');
  await mkdir(outputDirectory, { recursive: true });
  const image = await renderSocialAssetImage(
    1200,
    630,
    'Український weekly AI-дайджест: п’ять новин тижня',
    'Тижневий дайджест',
    null,
    {
      footer: 'aitodaybrief.com',
    },
  );
  const outputPath = join(outputDirectory, 'social-uk.jpg');
  await writeFile(outputPath, image);
  process.stdout.write(`${outputPath}\n`);
}

void main();
