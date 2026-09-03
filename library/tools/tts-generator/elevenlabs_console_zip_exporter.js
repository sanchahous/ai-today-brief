/**
 * =========================================================================
 * AI TODAY BRIEF - ELEVENLABS AUDIO SCENES ZIP EXPORTER
 * =========================================================================
 * 
 * Instructions for Future Generations:
 * 1. Open ElevenLabs Speech Synthesis (https://elevenlabs.io/app/speech-synthesis/text-to-speech)
 * 2. Generate/ensure your voiceover scenes are present in the History panel on the right.
 * 3. Open Developer Tools (F12 -> Console).
 * 4. Paste this script and press Enter.
 * 
 * Result:
 * - Scans all history cards in the right panel.
 * - Matches each card to the scenes list using key phrases.
 * - Extracts and bundles all audio files directly in memory into a single ZIP archive.
 * - Downloads `ai_today_brief_audio_scenes.zip` (no Chrome multi-download blocks).
 * =========================================================================
 */

(async function exportElevenLabsScenesToZip(customScenes) {
  // Default scenes list (or pass a custom array if updated)
  const defaultScenes = [
    { id: "scene_01_cold_open", pattern: "eighty percent of developers" },
    { id: "scene_02_story1_intro", pattern: "massive leap from simple chatbots" },
    { id: "scene_03_story1_process", pattern: "ability not just to answer questions" },
    { id: "scene_04_story1_details", pattern: "context of an entire repository" },
    { id: "scene_05_story1_result", pattern: "time needed to build a working prototype" },
    { id: "scene_06_story1_value", pattern: "likelihood of hallucinations in complex" },
    { id: "scene_07_story2_intro", pattern: "two million tokens in a single prompt" },
    { id: "scene_08_story2_process", pattern: "equivalent of fifty books" },
    { id: "scene_09_story2_details", pattern: "information retrieval speed at the edges" },
    { id: "scene_10_story2_result", pattern: "rely on rag techniques" },
    { id: "scene_11_story2_value", pattern: "prompts with a massive context are tens" },
    { id: "scene_12_story3_intro", pattern: "open 70-billion parameter model" },
    { id: "scene_13_story3_process", pattern: "outperformed proprietary leaders in key" },
    { id: "scene_14_story3_details", pattern: "deploy these models on their own servers" },
    { id: "scene_15_story3_result", pattern: "completely avoid vendor lock-in" },
    { id: "scene_16_story3_value", pattern: "optimized weights, running a model" },
    { id: "scene_17_radar", pattern: "other important news on our radar" },
    { id: "scene_18_outro", pattern: "evolution is accelerating" }
  ];

  const scenes = customScenes || defaultScenes;

  console.log(`🔍 [ElevenLabs Exporter] Scanning History panel for ${scenes.length} scenes...`);

  // Minimal Zero-Dependency Pure JS ZIP Builder (Store mode)
  function createZip(files) {
    let offset = 0;
    const localHeaders = [];
    const centralEntries = [];
    const crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[i] = c;
    }
    function crc32(buf) {
      let crc = 0xffffffff;
      const u8 = new Uint8Array(buf);
      for (let i = 0; i < u8.length; i++) crc = crcTable[(crc ^ u8[i]) & 0xff] ^ (crc >>> 8);
      return (crc ^ 0xffffffff) >>> 0;
    }

    files.forEach(f => {
      const nameBytes = new TextEncoder().encode(f.name);
      const dataBytes = new Uint8Array(f.data);
      const crc = crc32(dataBytes);
      const size = dataBytes.length;

      const lh = new Uint8Array(30 + nameBytes.length + size);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 10, true);
      dv.setUint16(6, 0, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true);
      dv.setUint16(12, 0, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true);
      dv.setUint32(22, size, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      lh.set(nameBytes, 30);
      lh.set(dataBytes, 30 + nameBytes.length);
      localHeaders.push(lh);

      const cd = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(cd.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 10, true);
      cdv.setUint16(8, 0, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, 0, true);
      cdv.setUint16(14, 0, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, size, true);
      cdv.setUint32(24, size, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0, true);
      cdv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      centralEntries.push(cd);

      offset += lh.length;
    });

    const cdStart = offset;
    let cdSize = 0;
    centralEntries.forEach(cd => cdSize += cd.length);

    const eocd = new Uint8Array(22);
    const edv = new DataView(eocd.buffer);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(4, 0, true);
    edv.setUint16(6, 0, true);
    edv.setUint16(8, files.length, true);
    edv.setUint16(10, files.length, true);
    edv.setUint32(12, cdSize, true);
    edv.setUint32(16, cdStart, true);
    edv.setUint16(20, 0, true);

    return new Blob([...localHeaders, ...centralEntries, eocd], { type: "application/zip" });
  }

  const allButtons = Array.from(document.querySelectorAll('button'));
  const playButtons = allButtons.filter(b => {
    const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
    const hasPlaySvg = b.querySelector('svg.lucide-play, svg[data-icon="play"], path[d*="M5 3l14 9-14 9V3z"], polygon[points*="5"]');
    return label.includes('play') || label.includes('відтворити') || hasPlaySvg;
  });

  const matchedCards = [];
  const foundScenes = new Set();

  for (const btn of playButtons) {
    let parent = btn.parentElement;
    let cardText = "";
    for (let depth = 0; depth < 8; depth++) {
      if (!parent) break;
      if (parent.innerText && parent.innerText.length > 20 && parent.innerText.length < 600) {
        cardText = parent.innerText.toLowerCase();
        break;
      }
      parent = parent.parentElement;
    }

    if (!cardText) continue;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (cardText.includes(scene.pattern.toLowerCase()) && !foundScenes.has(scene.id)) {
        matchedCards.push({ index: i, sceneId: scene.id, playBtn: btn, preview: cardText.slice(0, 45) });
        foundScenes.add(scene.id);
        break;
      }
    }
  }

  matchedCards.sort((a, b) => a.index - b.index);
  console.log(`🎯 Matched ${matchedCards.length} scenes in History:`);
  matchedCards.forEach(m => console.log(`   [${m.index + 1}/${scenes.length}] ${m.sceneId}`));

  const collectedFiles = [];

  for (let i = 0; i < matchedCards.length; i++) {
    const item = matchedCards[i];
    console.log(`⏳ [${i + 1}/${matchedCards.length}] Capturing audio for ${item.sceneId}...`);

    item.playBtn.click();
    await new Promise(r => setTimeout(r, 1200));

    const audio = document.querySelector('audio');
    if (audio && audio.src) {
      try {
        const res = await fetch(audio.src);
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength > 1000) {
          collectedFiles.push({ name: `${item.sceneId}.mp3`, data: arrayBuf });
          console.log(`   ✅ Captured ${item.sceneId}.mp3 (${(arrayBuf.byteLength / 1024).toFixed(1)} KB)`);
        }
      } catch (e) {
        console.warn(`   ⚠️ Error capturing ${item.sceneId}:`, e);
      }
    }

    if (audio) audio.pause();
  }

  console.log(`\n📦 Packaging ${collectedFiles.length} MP3 files into a single ZIP...`);
  const zipBlob = createZip(collectedFiles);

  console.log(`💾 Triggering download: ai_today_brief_audio_scenes.zip (${(zipBlob.size / 1024).toFixed(1)} KB)...`);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(zipBlob);
  a.download = 'ai_today_brief_audio_scenes.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  console.log("🎉 ALL DONE! ai_today_brief_audio_scenes.zip is downloaded!");
})();
