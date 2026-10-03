const fs = require('fs');
let code = fs.readFileSync('src/components/site-header-chrome.tsx', 'utf8');

// just remove all ThemeToggles inside the flex container, then add one at the front
let groupStart = code.indexOf('<div className=\"flex items-center gap-0 tablet:gap-2 shrink-0\">');
let groupEnd = code.indexOf('</div>', groupStart) + 6;

let group = code.substring(groupStart, groupEnd);
group = group.replace(/<ThemeToggle[^>]*\/>/g, '');
group = group.replace('<div className=\"flex items-center gap-0 tablet:gap-2 shrink-0\">', '<div className=\"flex items-center gap-0 tablet:gap-2 shrink-0\">\n            <ThemeToggle dayLabel={t.themeDay} nightLabel={t.themeNight} />');

code = code.substring(0, groupStart) + group + code.substring(groupEnd);
fs.writeFileSync('src/components/site-header-chrome.tsx', code);
console.log('Fixed double theme toggle');
