import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
await page.waitForTimeout(4000);

const data = await page.evaluate(() => {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const docH = document.documentElement.scrollHeight;
  const bodyH = document.body.scrollHeight;
  const canScroll = docH > vh || bodyH > vh;

  const bottomEls = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.height < 2 || r.width < 10) continue;
    const bottomNear = r.bottom >= vh - 3 && r.top < vh;
    const tallBottomStrip = r.top >= vh * 0.85 && r.height >= 15;
    if (!bottomNear && !tallBottomStrip) continue;
    const s = getComputedStyle(el);
    const bg = s.backgroundColor;
    if (bg === 'rgba(0, 0, 0, 0)' && s.backgroundImage === 'none') continue;
    bottomEls.push({
      tag: el.tagName,
      id: el.id,
      cls: (el.className?.toString?.() || '').slice(0, 100),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      h: Math.round(r.height),
      w: Math.round(r.width),
      bg,
      pos: s.position,
      z: s.zIndex,
      disp: s.display,
    });
  }

  bottomEls.sort((a, b) => b.bottom - a.bottom || b.h - a.h);

  // sample pixel color at bottom center
  let pixel = null;
  try {
    const c = document.elementFromPoint(vw / 2, vh - 5);
    if (c) {
      const s = getComputedStyle(c);
      pixel = { tag: c.tagName, cls: (c.className?.toString?.() || '').slice(0, 80), bg: s.backgroundColor };
    }
  } catch {}

  return {
    url: location.href,
    vh,
    docH,
    bodyH,
    canScroll,
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    pixel,
    bottomEls: bottomEls.slice(0, 25),
  };
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
