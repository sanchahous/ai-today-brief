const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3105/ds-catalog');
  
  const headings = await page.evaluate(() => {
    function visible(el) {
      if (!el) return false;
      if (el.matches('[hidden], [aria-hidden="true"], [style*="display: none"]')) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      if (el.parentElement) return visible(el.parentElement);
      return true;
    }
    
    return [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter(visible)
      .map(el => el.tagName + ': ' + el.textContent.trim());
  });
  
  console.log(headings.join('\n'));
  await browser.close();
})();
