const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to the test URL (assuming e2e-affected uses 3100 or Next uses 3105)
  const response = await page.goto('http://127.0.0.1:3106/ds-catalog');
  console.log('Status:', response.status());

  const data = await page.evaluate(() => {
    function visible(el) {
      if (!el) return false;
      if (el.matches('[hidden], [aria-hidden="true"], [style*="display: none"]')) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      if (el.parentElement) return visible(el.parentElement);
      return true;
    }
    
    const elements = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
    const levels = elements.map(el => Number(el.tagName[1]));
    
    let skips = 0;
    const skipDetails = [];
    
    levels.reduce((count, level, index, all) => {
      if (index && level > all[index - 1] + 1) {
        skips++;
        skipDetails.push({
          prev: elements[index - 1].tagName + ' ' + elements[index - 1].textContent.trim().substring(0, 30),
          curr: elements[index].tagName + ' ' + elements[index].textContent.trim().substring(0, 30),
        });
        return count + 1;
      }
      return count;
    }, 0);
    
    return {
      levels,
      elements: elements.map(el => el.tagName + ': ' + el.textContent.trim().substring(0, 40)),
      skips,
      skipDetails
    };
  });
  
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
