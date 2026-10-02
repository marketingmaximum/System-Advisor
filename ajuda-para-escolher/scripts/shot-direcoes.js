// Screenshots das direções da F2 em 1440×900 e 390×844 (primeira dobra + página inteira)
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'screens', 'f2');
const PAGES = ['direcao-a', 'direcao-b'];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const name of PAGES) {
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
      await page.goto('file://' + path.join(ROOT, 'direcoes', name + '.html'), { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      await page.screenshot({ path: path.join(OUT, `${name}-${vpName}-dobra.png`) });
      await page.screenshot({ path: path.join(OUT, `${name}-${vpName}-inteira.png`), fullPage: true });
      console.log(name, vpName, overflow ? 'OVERFLOW' : 'ok');
      await page.close();
    }
  }
  await browser.close();
})();
