import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';

const issueDate = '01.09.2026';
const rootDir = 'E:/domains/ai-today-brief';
const issueDir = path.join(rootDir, 'library', issueDate);
const audioDir = path.join(issueDir, 'audio_scenes');
const videoDir = path.join(issueDir, 'video_scenes');
const bgDir = path.join(rootDir, 'library/general_backgrounds');
const musicDir = path.join(rootDir, 'library/music/energetic');
const tempDir = path.join(issueDir, 'temp_render');
const outputVideo = path.join(issueDir, `atb_weekly_digest_${issueDate.replace(/\./g, '_')}.mp4`);

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

function getDuration(file) {
  const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`, { encoding: 'utf8' }).trim();
  return parseFloat(out);
}

// Map scenes to audio and video files
const videoFiles = fs.readdirSync(videoDir);
const findVideo = (prefix) => videoFiles.find(f => f.startsWith(prefix));

const scenes = [
  { id: 'scene_01', audio: 'scene_01_cold_open.mp3', videoPath: path.join(bgDir, 'intro-final.mp4') },
  { id: 'scene_02', audio: 'scene_02_story1_intro.mp3', videoPath: path.join(videoDir, findVideo('1.1')) },
  { id: 'scene_03', audio: 'scene_03_story1_process.mp3', videoPath: path.join(videoDir, findVideo('1.2')) },
  { id: 'scene_04', audio: 'scene_04_story1_details.mp3', videoPath: path.join(videoDir, findVideo('1.3')) },
  { id: 'scene_05', audio: 'scene_05_story1_result.mp3', videoPath: path.join(videoDir, findVideo('1.4')) },
  { id: 'scene_06', audio: 'scene_06_story1_value.mp3', videoPath: path.join(videoDir, findVideo('1.5')) },
  { id: 'scene_07', audio: 'scene_07_story2_intro.mp3', videoPath: path.join(videoDir, findVideo('2.1')) },
  { id: 'scene_08', audio: 'scene_08_story2_process.mp3', videoPath: path.join(videoDir, findVideo('2.2')) },
  { id: 'scene_09', audio: 'scene_09_story2_details.mp3', videoPath: path.join(videoDir, findVideo('2.3')) },
  { id: 'scene_10', audio: 'scene_10_story2_result.mp3', videoPath: path.join(videoDir, findVideo('2.4')) },
  { id: 'scene_11', audio: 'scene_11_story2_value.mp3', videoPath: path.join(videoDir, findVideo('2.5')) },
  { id: 'scene_12', audio: 'scene_12_story3_intro.mp3', videoPath: path.join(videoDir, findVideo('3.1')) },
  { id: 'scene_13', audio: 'scene_13_story3_process.mp3', videoPath: path.join(videoDir, findVideo('3.2')) },
  { id: 'scene_14', audio: 'scene_14_story3_details.mp3', videoPath: path.join(videoDir, findVideo('3.3')) },
  { id: 'scene_15', audio: 'scene_15_story3_result.mp3', videoPath: path.join(videoDir, findVideo('3.4')) },
  { id: 'scene_16', audio: 'scene_16_story3_value.mp3', videoPath: path.join(videoDir, findVideo('3.5')) },
  { id: 'scene_17', audio: 'scene_17_radar.mp3', videoPath: path.join(videoDir, findVideo('4. Radar')) },
  { id: 'scene_18', audio: 'scene_18_outro.mp3', videoPath: path.join(videoDir, findVideo('5. Outro')) }
];

console.log('🚀 Starting video assembly for 18 scenes...\n');

const segmentFiles = [];

scenes.forEach((scene, index) => {
  const audioFile = path.join(audioDir, scene.audio);
  const audioDur = getDuration(audioFile);
  const sceneDur = (audioDur + 0.35).toFixed(3); // slight breathing room at scene end
  const segmentOut = path.join(tempDir, `seg_${String(index + 1).padStart(2, '0')}.mp4`);
  segmentFiles.push(segmentOut);

  console.log(`▶ [${index + 1}/18] Processing ${scene.id} (dur: ${sceneDur}s)...`);

  // Build FFmpeg command to scale to 1920x1080, loop video if needed, pad audio with silence up to sceneDur
  const cmd = [
    '-y',
    '-stream_loop', '-1',
    '-i', scene.videoPath,
    '-i', audioFile,
    '-t', sceneDur,
    '-filter_complex',
    `[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v];[1:a]apad=pad_dur=0.35,aresample=48000[a]`,
    '-map', '[v]',
    '-map', '[a]',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-c:a', 'aac',
    '-b:a', '192k',
    segmentOut
  ];

  const res = spawnSync('ffmpeg', cmd, { stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`FFmpeg failed on scene ${scene.id}`);
  }
});

console.log('\n🔗 Concatenating all 18 segments...');
const concatListPath = path.join(tempDir, 'concat_list.txt');
const listContent = segmentFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
fs.writeFileSync(concatListPath, listContent);

const concatenatedRaw = path.join(tempDir, 'raw_concat.mp4');
execSync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${concatenatedRaw}"`, { stdio: 'inherit' });

console.log('\n🎵 Adding background music bed & mastering audio...');
const totalDuration = getDuration(concatenatedRaw);
const musicTrack = path.join(musicDir, 'Intergalactic - Alex Jones _ Xander Jones.mp3');

// Mix background music: volume 0.08 (~-22dB), with 1.5s fade-in and 2.5s fade-out at end
const fadeOutStart = Math.max(0, totalDuration - 2.5).toFixed(2);
const mixCmd = [
  '-y',
  '-i', concatenatedRaw,
  '-stream_loop', '-1',
  '-i', musicTrack,
  '-t', totalDuration.toFixed(3),
  '-filter_complex',
  `[1:a]volume=0.075,afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutStart}:d=2.5[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
  '-map', '0:v',
  '-map', '[aout]',
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-b:a', '320k',
  outputVideo
];

const mixRes = spawnSync('ffmpeg', mixCmd, { stdio: 'inherit' });
if (mixRes.status !== 0) {
  throw new Error('Failed to mix background music!');
}

console.log('\n🧹 Cleaning up temporary render files...');
fs.rmSync(tempDir, { recursive: true, force: true });

console.log(`\n🎉 SUCCESS! Final video rendered to:`);
console.log(`👉 ${outputVideo}`);
console.log(`📊 Duration: ${totalDuration.toFixed(1)}s (${(totalDuration / 60).toFixed(2)} min)`);
