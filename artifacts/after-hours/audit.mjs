import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root=path.dirname(fileURLToPath(import.meta.url));
const css=await readFile(path.join(root,'tokens.css'),'utf8');
const blocks=css.split(/html\[data-theme\s*=\s*["']day["']\]/);
const parse=block=>Object.fromEntries([...block.matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)].map(m=>[m[1],m[2].trim()]));
const night=parse(blocks[0]);
const day={...night,...parse(blocks[1])};
function resolve(tokens,key){let value=tokens[key];for(let i=0;i<5&&value?.startsWith('var(');i++)value=tokens[value.slice(6,-1)];return value;}
function luminance(hex){const rgb=hex.replace('#','').match(/../g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const pairs=[['text','bg',4.5],['muted','bg',4.5],['text','surface',4.5],['muted','surface',4.5],['accent','bg',4.5],['mint','bg',4.5],['error','bg',4.5],['bg','accent',4.5]];
const contrasts=[];
for(const [theme,tokens] of [['night',night],['day',day]])for(const [fg,bg,min] of pairs){const a=resolve(tokens,fg),b=resolve(tokens,bg);const ratio=contrast(a,b);contrasts.push({theme,foreground:fg,background:bg,colors:[a,b],ratio:+ratio.toFixed(2),minimum:min,pass:ratio>=min});}
const hashes={};
for(const file of ['app.js','workspaces.js','style.css','tokens.css','tokens.json','index.html'])hashes[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
const media=[];
for(const file of (await readdir(path.join(root,'screens'))).filter(f=>f.endsWith('.jpg')||f.endsWith('.png'))){const info=await sharp(path.join(root,'screens',file)).metadata();media.push({file,width:info.width,height:info.height,format:info.format});}
const results={date:'2026-09-05',contrasts,hashes,media,scope:'Static token pairs and exported image integrity. Not a full WCAG or production performance audit.'};
await writeFile(path.join(root,'artifact-audit.json'),JSON.stringify(results,null,2));
process.stdout.write(JSON.stringify({contrastPairs:contrasts.length,contrastFailures:contrasts.filter(c=>!c.pass),images:media.length},null,2)+'\n');
if(contrasts.some(c=>!c.pass))process.exitCode=1;
