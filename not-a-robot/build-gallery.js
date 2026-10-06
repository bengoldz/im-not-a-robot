// Builds art/gallery.html: every SVG in art/ on one page, grouped by folder.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'art');
const groups = [['cat', 'Cat'], ['robot', 'Robot friend'], ['icons', 'Tile icons'], ['tiles', 'Tile backgrounds'], ['ui', 'HUMANCHECK UI'], ['scene', 'Traffic scene']];
const TOTAL = { cat: 12, robot: 7, icons: 30, tiles: 7, ui: 7, scene: 2 };
let body = '', done = 0, total = 0;
for (const [dir, title] of groups) {
  const d = path.join(root, dir), files = fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.svg')).sort() : [];
  done += files.length; total += TOTAL[dir];
  body += `<section><h2>${title} <span>${files.length} / ${TOTAL[dir]}</span></h2>`;
  if (!files.length) body += '<p class="wait">Still being drawn.</p>';
  body += `<div class="grid ${dir}">` + files.map(f => {
    const svg = fs.readFileSync(path.join(d, f), 'utf8').replace(/<\?xml[^>]*>/, '');
    return `<figure><div class="art">${svg}</div><figcaption>${f.slice(0, -4).replace(/_/g, ' ')}</figcaption></figure>`;
  }).join('') + '</div></section>';
}
const html = `<title>HUMANCHECK Art Pass</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap">
<style>
/* Layout: a sticker-sheet gallery, one section per asset group, on the game's navy */
:root { color-scheme: dark; --navy:#0f1630; --navy2:#1b2547; --card:#f7f9fc; --ink:#1d2433; --grey:#9aa4b8; --blue:#2f6fe4; --cyan:#5ff3ff;
  --font: Fredoka, "Trebuchet MS", system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--navy); color: #eef2fa; font-family: var(--font); padding: 24px 16px 48px; }
header, section { max-width: 1100px; margin: 0 auto; }
header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 16px; margin-bottom: 8px; }
h1 { font-size: clamp(26px, 5vw, 40px); margin: 0; font-weight: 700; text-wrap: balance; }
header p { margin: 0; color: var(--grey); font-size: 15px; }
.badge { background: var(--blue); color: #fff; border-radius: 99px; padding: 3px 12px; font-size: 14px; font-weight: 600; }
h2 { font-size: 20px; font-weight: 600; margin: 32px 0 12px; display: flex; gap: 10px; align-items: baseline; }
h2 span { color: var(--cyan); font-size: 14px; font-variant-numeric: tabular-nums; }
.wait { color: var(--grey); margin: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
.grid.robot, .grid.scene { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
figure { margin: 0; background: var(--card); border-radius: 14px; padding: 10px 10px 6px; color: var(--ink); }
.art { aspect-ratio: 1; display: grid; place-items: center; max-width: 100%; }
.robot .art, .scene .art { aspect-ratio: 3 / 4; }
.art svg { width: 100%; height: 100%; display: block; }
figcaption { text-align: center; font-size: 13px; font-weight: 600; padding-top: 4px; color: #4b5568; }
</style>
<header><h1>I'm Not A Robot: art pass</h1><span class="badge">${done} / ${total} assets</span>
<p>Polished vector art for the jam build. Same style as the prototype, with shading and detail.</p></header>
${body}`;
fs.writeFileSync(path.join(root, 'gallery.html'), html);
console.log('gallery:', done, '/', total);
