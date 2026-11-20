// Run with node --test tests/long-page-browser.cjs after installing Playwright
// and its Chromium, or point PLAYWRIGHT_MODULE at an existing installation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function loadChromium() {
  for (const pkg of [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean)) {
    try { return require(pkg).chromium; }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
}

const chromium = loadChromium();
const browserTest = { skip: !chromium && 'Install Playwright and Chromium to run this browser test' };

async function openReader(t, savedSettings = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1400, height: 760 } });
  page.setDefaultTimeout(6000);
  await page.addInitScript(settings => {
    const listeners = [];
    window.chrome ??= {};
    window.chrome.storage = {
      local: {
        async get(defaults) { return { ...defaults, ...settings }; },
        async set(changes) {
          const notice = {};
          for (const [key, next] of Object.entries(changes)) {
            notice[key] = { oldValue: settings[key], newValue: next };
            settings[key] = next;
          }
          listeners.forEach(fn => fn(notice, 'local'));
        },
      },
      onChanged: { addListener(fn) { listeners.push(fn); } },
    };
  }, savedSettings);
  await page.goto(pathToFileURL(path.join(__dirname, 'fixtures/long-page.html')).href);
  for (const script of require('../manifest.json').content_scripts[0].js) {
    await page.addScriptTag({ path: path.join(__dirname, '..', script) });
  }
  return page;
}

test('a six-page layout scrolls to a clickable native mark and advances without skipping lines', browserTest, async (t) => {
  const page = await openReader(t, { longPageCount: 1 });
  const chapter = page.locator('.readerChapterContent');
  const setting = (values) => page.evaluate(v => chrome.storage.local.set(v), values);
  const capacity = async () => Number(await chapter.getAttribute('data-capacity'));
  await page.waitForFunction(() => document.querySelectorAll('.wr_canvasContainer canvas').length === 1);
  const ordinary = await capacity();
  const ordinaryHeight = await chapter.evaluate(el => el.clientHeight);
  const panel = page.locator('#jujian-native-reader');
  await panel.locator('#fab').click();
  await panel.locator('#page-count').selectOption('6');
  await panel.locator('#close').click();
  await page.waitForFunction(old => Number(document.querySelector('main').dataset.capacity) >= 6 * old, ordinary);
  const combined = await capacity();
  t.diagnostic(`Synthetic 1400 × 760 viewport: ${ordinary} ordinary rows, ${combined} long-page rows.`);
  assert.equal(await chapter.evaluate(el => el.clientHeight), 6 * ordinaryHeight);
  const underline = page.locator('.wr_underline_wrapper');
  const markAtTop = await underline.boundingBox();
  assert.ok(markAtTop.y > 4 * 760, 'final marked line should be well below the viewport');
  await page.mouse.move(markAtTop.x + 30, 440);
  await page.mouse.wheel(0, markAtTop.y);
  await page.waitForFunction(() => scrollY > 3 * 760);
  assert.equal(await chapter.getAttribute('data-first'), '1', 'wheel must scroll without changing the logical page');
  const visibleMark = await underline.boundingBox();
  const clickAt = { x: visibleMark.x + 20, y: visibleMark.y + visibleMark.height / 2 };
  assert.ok(clickAt.y > 0 && clickAt.y < 760, 'the lower mark must be reachable without a scripted scroll');
  await checkNativeOrigin(page);
  await page.mouse.click(clickAt.x, clickAt.y);
  const modal = page.locator('.reviews_panel');
  assert.match(await modal.innerText(), new RegExp('段落 ' + combined + ' 的想法'));
  const bounds = await modal.boundingBox();
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 760, 'native discussion must fit the visible viewport');
  await page.getByRole('button', { name: '关闭想法' }).click();
  await page.getByRole('button', { name: '下一页' }).click();
  assert.equal(Number(await chapter.getAttribute('data-first')), combined + 1);
  await page.waitForFunction(() => scrollY < 2);
  await page.keyboard.press('PageDown');
  await page.waitForFunction(() => scrollY > 100);
  assert.equal(Number(await chapter.getAttribute('data-first')), combined + 1, 'PageDown should scroll inside the new page after a pager click');
  await setting({ longPageCount: 8 });
  await page.waitForFunction(height => document.querySelector('main').clientHeight === height, 8 * ordinaryHeight);
  await setting({ longPageCount: 1 });
  await page.waitForFunction(old => Number(document.querySelector('main').dataset.capacity) === old, ordinary);
  assert.equal(await chapter.locator('canvas').count(), 1);
  await setting({ singlePageEnabled: false });
  await page.waitForFunction(() => document.body.clientWidth === 1400);
});

async function measureInk(page) {
  // Read the rightmost glyph in the final painted line, then project its pixel
  // into viewport coordinates. This catches merely enlarging an empty frame,
  // hiding one canvas, or stretching an unchanged bitmap.
  return page.locator('.wr_canvasContainer').evaluate(layer => {
    const canvases = [...layer.querySelectorAll('canvas')];
    const canvas = canvases[0];
    const context = canvas.getContext('2d');
    const pixels = context.getImageData(0, canvas.height - 28, canvas.width, 28).data;
    let minX = canvas.width, maxX = -1;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 24) continue;
      const x = ((i - 3) / 4) % canvas.width;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    const bounds = canvas.getBoundingClientRect();
    const sheet = layer.closest('.readerChapterContent').getBoundingClientRect();
    return {
      columns: canvases.length,
      paperLeft: sheet.left,
      paperRight: sheet.right,
      inkLeft: minX < canvas.width ? bounds.left + minX : null,
      inkRight: maxX >= 0 ? bounds.left + maxX : null,
      inkWidth: Math.max(0, maxX - minX + 1),
      bitmapWidth: canvas.width,
      displayWidth: bounds.width,
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

test('typography settings reflow the native page and reset to the reader defaults', browserTest, async t => {
  const page = await openReader(t);
  const panel = page.locator('#jujian-native-reader');
  const chapter = page.locator('main');
  await panel.locator('#fab').click();
  const initialCapacity = Number(await chapter.getAttribute('data-capacity'));
  await panel.locator('#readerFontSize').selectOption('24px');
  await panel.locator('#readerLineHeight').selectOption('2.2');
  await panel.locator('#readerFontFamily').selectOption('SimSun,"Songti SC",serif');
  const styles = await page.locator('.preRenderContent p').evaluate(para => {
    const {fontSize, fontFamily, lineHeight} = getComputedStyle(para);
    return {fontSize, fontFamily, lineHeight};
  });
  assert.equal(styles.fontSize, '24px');
  assert.equal(styles.lineHeight, '52.8px');
  assert.match(styles.fontFamily, /SimSun/);
  const reflowedCapacity = Number(await chapter.getAttribute('data-capacity'));
  assert.ok(reflowedCapacity < initialCapacity);
  await panel.locator('#close').click();
  const mark = page.locator('.wr_underline_wrapper');
  await mark.scrollIntoViewIfNeeded();
  await checkNativeOrigin(page);
  await mark.click();
  assert.match(await page.locator('.reviews_panel').innerText(), new RegExp('段落 '+reflowedCapacity+' 的想法'));
  await page.getByRole('button', { name: '关闭想法' }).click();
  await page.evaluate(() => chrome.storage.local.set({readerFontSize:'',readerLineHeight:'',readerFontFamily:''}));
  assert.equal(Number(await chapter.getAttribute('data-capacity')), initialCapacity);
});

test('local wallpaper and colors apply without moving the page or underline', browserTest, async t => {
  const page = await openReader(t);
  const panel = page.locator('#jujian-native-reader');
  const chapter = page.locator('main');
  const underline = page.locator('.wr_underline_wrapper');
  const initialBounds = await underline.boundingBox();
  await panel.locator('#fab').click();
  await panel.locator('summary').click();
  const background = panel.locator('#reader-background');
  await background.selectOption('amber');
  const amber = await chapter.evaluate(node => getComputedStyle(node).backgroundColor);
  await background.selectOption('green');
  assert.notEqual(await chapter.evaluate(node => getComputedStyle(node).backgroundColor), amber);
  const surround = page.locator('.readerChapterContent_container');
  const matchingOuter = await surround.evaluate(node => getComputedStyle(node).backgroundColor);
  await panel.locator('#reader-outer-background').selectOption('native');
  assert.notEqual(await surround.evaluate(node => getComputedStyle(node).backgroundColor), matchingOuter);
  await panel.locator('#reader-outer-background').selectOption('custom');
  await panel.locator('#reader-outer-color').fill('#fcaabb');
  await panel.locator('#reader-outer-color').dispatchEvent('change');
  assert.notEqual(await surround.evaluate(node => getComputedStyle(node).backgroundColor), matchingOuter);
  await panel.locator('#reader-text-color-enabled').check();
  await panel.locator('#reader-text-color').fill('#123456');
  await panel.locator('#reader-text-color').dispatchEvent('change');
  assert.match(await chapter.locator('canvas').first().evaluate(node => getComputedStyle(node).filter), /jujian-text-color-filter/);
  assert.equal(await page.locator('#jujian-text-color-filter feFlood').getAttribute('flood-color'), '#123456');
  await panel.locator('#reader-text-color-enabled').uncheck();
  await background.selectOption('custom');
  assert.ok(await panel.locator('#reader-background-color').isVisible());
  await background.selectOption('wallpaper');
  await panel.locator('#reader-wallpaper').setInputFiles(path.join(__dirname, '../icons/128.png'));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('main')).backgroundImage.includes('data:image/webp'));
  const fit = panel.locator('#reader-wallpaper-fit');
  assert.equal(await fit.inputValue(), 'contain');
  const fitSize = await chapter.evaluate(node => getComputedStyle(node).backgroundSize);
  await fit.selectOption('cover');
  assert.notEqual(await chapter.evaluate(node => getComputedStyle(node).backgroundSize), fitSize);
  const initialPosition = await chapter.evaluate(node => getComputedStyle(node).backgroundPosition);
  const vertical = panel.locator('#reader-wallpaper-y');
  await vertical.fill('100');
  await vertical.dispatchEvent('change');
  assert.notEqual(await chapter.evaluate(node => getComputedStyle(node).backgroundPosition), initialPosition);
  const range = panel.locator('#reader-wallpaper-opacity');
  await range.fill('45');
  await range.dispatchEvent('change');
  await page.waitForFunction(() => document.getElementById('jujian-appearance-style').textContent.includes('55%'));
  assert.equal(await panel.locator('#wallpaper-opacity-value').innerText(), '45%');
  assert.deepEqual(await underline.boundingBox(), initialBounds);
  await panel.locator('#reader-wallpaper-remove').click();
  assert.equal(await chapter.evaluate(node => getComputedStyle(node).backgroundImage), 'none');
  await background.selectOption('native');
  assert.equal(await chapter.evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
});

async function checkNativeOrigin(page) {
  // Native selection reconstructs the page origin using offsetParent geometry
  // and the space left in the document used for calculating the column count.
  const origin = await page.locator('.renderTargetContainer').evaluate(el => {
    const chapter = el.closest('.readerChapterContent');
    const root = document.documentElement, body = document.body;
    const marginX = Math.max(0, (Math.min(root.clientWidth, body.clientWidth) - chapter.clientWidth) / 2);
    const marginY = Math.max(0, (Math.min(root.clientHeight, body.clientHeight) - chapter.clientHeight) / 2);
    const bounds = el.getBoundingClientRect();
    return {
      actualX: bounds.left + scrollX, nativeX: el.offsetLeft + marginX,
      actualY: bounds.top + scrollY, nativeY: el.offsetTop + marginY,
    };
  });
  assert.ok(Math.abs(origin.actualX - origin.nativeX) < 2, `native X should match centered ink: ${JSON.stringify(origin)}`);
  assert.ok(Math.abs(origin.actualY - origin.nativeY) < 2, `native Y should match centered ink: ${JSON.stringify(origin)}`);
  return origin;
}

test('one native column follows scrolling-mode line widths and stays centered at fixed width', browserTest, async t => {
  const page = await openReader(t);
  const setting = values => page.evaluate(v => chrome.storage.local.set(v), values);
  for (const [width, canvasWidth] of [[1400, 800], [1800, 800], [1200, 616], [1000, 488], [760, 620]]) {
    await page.setViewportSize({ width, height: 760 });
    // Wait for native synthetic repagination, including any scheduled resize.
    await page.waitForFunction(() => document.querySelectorAll('.wr_canvasContainer canvas').length === 1);
    await page.waitForFunction(({ width, canvasWidth }) =>
      document.querySelector('.wr_horizontalReader').clientWidth === width &&
      document.querySelector('canvas')?.width === canvasWidth,
    { width, canvasWidth });
    const ink = await measureInk(page);
    assert.equal(ink.columns, 1);
    const rightMargin = ink.viewport - ink.paperRight;
    assert.ok(Math.abs(ink.paperLeft - rightMargin) < 2, `sheet should be centered: ${JSON.stringify(ink)}`);
    assert.equal(ink.paperRight - ink.paperLeft, canvasWidth + 140);
    assert.ok(Math.abs(ink.inkLeft - ink.paperLeft - 70) <= 2, 'canvas should align with the native inner margin');
    assert.ok(ink.paperRight - ink.inkRight >= 70 && ink.paperRight - ink.inkRight <= 90, 'the last rendered glyph should reach the native right margin');
    assert.equal(ink.bitmapWidth, ink.displayWidth, 'glyph sizes should not depend on horizontal bitmap stretching');
    assert.ok(ink.inkLeft >= 0 && ink.inkRight < ink.viewport, 'the first and final glyph must both be on screen');
    assert.ok(ink.scrollWidth <= ink.viewport + 1, 'must fit without horizontal scrolling');
    t.diagnostic(`${ink.viewport}px: sheet margins ${Math.round(ink.paperLeft)}/${Math.round(rightMargin)}px, single-column ink x=${Math.round(ink.inkLeft)}..${Math.round(ink.inkRight)}.`);
    const marked = page.locator('.wr_underline_wrapper');
    await marked.scrollIntoViewIfNeeded();
    await checkNativeOrigin(page);
    const bounds = await marked.boundingBox();
    const x = bounds.x + bounds.width / 2;
    assert.ok(x > ink.paperLeft + (ink.paperRight - ink.paperLeft) * 0.7);
    await page.mouse.click(x, bounds.y + 12);
    assert.match(await page.locator('.reviews_panel').innerText(), new RegExp('段落 ' + await marked.getAttribute('data-line') + ' 的想法'));
    await page.getByRole('button', { name: '关闭想法' }).click();
  }
  await page.setViewportSize({ width: 1600, height: 760 });
  await setting({ singlePageFitWidth: false, singlePageWidth: 820 });
  await page.waitForFunction(() => document.querySelector('canvas').width <= 820);
  const fixed = await measureInk(page);
  const left = fixed.inkLeft, right = fixed.viewport - fixed.inkRight;
  assert.ok(Math.abs(left - right) <= 35, `manual width should center the text: left=${left}, right=${right}`);
  assert.equal(fixed.columns, 1);
  assert.ok(fixed.inkWidth < 820);
  for (const long of [true, false]) {
    await setting({ longPageCount: long ? 6 : 1 });
    await page.waitForFunction(on => (document.querySelector('main').clientHeight > innerHeight) === on, long);
    const origin = await checkNativeOrigin(page);
    t.diagnostic(`Centered 820px ${long ? 'long' : 'short'} page: native origin (${origin.nativeX}, ${origin.nativeY}), rendered (${origin.actualX}, ${origin.actualY}).`);
  }
  await setting({ singlePageFitWidth: true });
  await page.waitForFunction(() => document.querySelector('canvas').width === 800);
  const restored = await measureInk(page);
  assert.ok(restored.inkWidth > fixed.inkWidth + 90);
  await setting({ singlePageEnabled: false });
  await page.waitForFunction(() => document.querySelectorAll('.wr_canvasContainer canvas').length === 2);
});
