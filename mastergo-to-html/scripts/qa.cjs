#!/usr/bin/env node
'use strict';
// Read-only page inspection. Requires an existing Playwright installation.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function run() {
  const configPath = path.resolve(process.argv[2] || '');
  if (!process.argv[2]) throw new Error('Usage: node qa.cjs /absolute/path/qa-config.json');
  const c = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  for (const key of ['page', 'outputDir', 'browserExecutable']) {
    if (typeof c[key] !== 'string' || !path.isAbsolute(c[key])) throw new Error(`${key} must be absolute`);
  }
  if (!fs.statSync(c.page).isFile() || !/\.html?$/i.test(c.page)) throw new Error('page must be a local HTML file');
  if (!/^[a-z0-9-]{1,40}$/.test(c.phase || '')) throw new Error('phase must be a short lowercase slug');
  if (!Array.isArray(c.widths)) throw new Error('widths must be an array');
  const widths = [...new Set(c.widths)];
  if (!widths.length || widths.length > 12 || widths.some(w => !Number.isInteger(w) || w < 240 || w > 2560)) throw new Error('Invalid widths');
  if (!widths.includes(c.baselineWidth)) throw new Error('widths must include baselineWidth');
  const shots = c.screenshotWidths || [c.baselineWidth, Math.min(...widths)];
  if (!Array.isArray(shots) || shots.some(w => !widths.includes(w))) throw new Error('Invalid screenshotWidths');
  const samples = c.fontSamples || [];
  if (!Array.isArray(samples) || samples.length > 30 || samples.some(s => typeof s.selector !== 'string' || !s.selector || s.selector.length > 500 || typeof s.expectedPostScriptName !== 'string')) throw new Error('Invalid fontSamples');
  if (samples.some(s => s.expectedWeight !== undefined && (typeof s.expectedWeight !== 'string' || !/^\d{1,4}$/.test(s.expectedWeight) || +s.expectedWeight < 1 || +s.expectedWeight > 1000))) throw new Error('Invalid expectedWeight');
  const fontCheckWidths = c.fontCheckWidths || [c.baselineWidth];
  if (!Array.isArray(fontCheckWidths) || !fontCheckWidths.includes(c.baselineWidth) || fontCheckWidths.some(w => !widths.includes(w))) throw new Error('Invalid fontCheckWidths');
  const fillWidths = c.fillWidths || [];
  if (!Array.isArray(fillWidths) || fillWidths.some(w => !widths.includes(w))) throw new Error('fillWidths must be included in widths');
  if (c.pageSelector !== undefined && (typeof c.pageSelector !== 'string' || !c.pageSelector || c.pageSelector.length > 500)) throw new Error('Invalid pageSelector');
  if (fillWidths.length && !c.pageSelector) throw new Error('fillWidths requires pageSelector');
  for (const key of ['scrollSelectors', 'textSelectors']) {
    if (c[key] !== undefined && (!Array.isArray(c[key]) || c[key].length > 30 || c[key].some(s => typeof s !== 'string' || !s || s.length > 500))) throw new Error(`Invalid ${key}`);
  }
  const viewportHeight = c.viewportHeight ?? 900;
  if (!Number.isInteger(viewportHeight) || viewportHeight < 240 || viewportHeight > 4000) throw new Error('Invalid viewportHeight');
  const { chromium } = require('playwright');
  fs.mkdirSync(c.outputDir, { recursive: true });
  const reportPath = path.join(c.outputDir, `${c.phase}.json`);
  const result = { startedAt: new Date().toISOString(), page: c.page, baselineWidth: c.baselineWidth, dpr: 1, visualVerdict: 'not-reviewed', checks: [] };
  let browser;
  try {
    browser = await chromium.launch({ executablePath: c.browserExecutable, headless: true, timeout: 25000 });
    result.browserVersion = browser.version();
    const context = await browser.newContext({ deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    const errors = [];
    page.on('pageerror', e => errors.push({ type: 'page', message: e.message }));
    page.on('console', m => { if (m.type() === 'error') errors.push({ type: 'console', message: m.text() }); });
    page.on('requestfailed', r => errors.push({ type: 'request', url: r.url(), message: r.failure()?.errorText }));
    page.on('response', r => { if (r.status() >= 400) errors.push({ type: 'http', status: r.status(), url: r.url() }); });
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    for (const width of widths) {
      errors.length = 0;
      await page.setViewportSize({ width, height: viewportHeight });
      await page.goto(pathToFileURL(c.page).href, { waitUntil: 'load', timeout: 25000 });
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      const readiness = await page.evaluate(async () => {
        let timer;
        const ready = Promise.all([document.fonts.ready, ...Array.from(document.images, im => {
          im.loading = 'eager';
          return im.complete ? Promise.resolve() : new Promise(resolve => {
            im.addEventListener('load', resolve, { once: true });
            im.addEventListener('error', resolve, { once: true });
          });
        })]).then(() => 'ready');
        const status = await Promise.race([ready, new Promise(resolve => { timer = setTimeout(() => resolve('timeout'), 10000); })]);
        clearTimeout(timer);
        return status;
      });
      const metrics = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        missingImages: Array.from(document.images).filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')),
        missingAlt: document.querySelectorAll('img:not([alt])').length,
        headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'), h => ({ level: h.tagName, text: h.textContent.trim() })),
      }));
      const layout = await page.evaluate(({ pageSelector, fill, scrollSelectors, textSelectors }) => {
        const label = el => el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${Array.from(el.classList).slice(0, 3).join('.')}`;
        const missingSelectors = [];
        let pageFill = { status: 'not-checked' };
        if (pageSelector) {
          const elements = document.querySelectorAll(pageSelector);
          if (elements.length !== 1) pageFill = { status: 'invalid-selector-count', count: elements.length };
          else {
            const rect = elements[0].getBoundingClientRect();
            const available = document.documentElement.clientWidth;
            pageFill = { left: rect.left, right: rect.right, width: rect.width, availableWidth: available,
              status: fill ? (Math.abs(rect.left) <= 1 && Math.abs(rect.right - available) <= 1 ? 'passed' : 'failed') : 'recorded' };
          }
        }
        const scroll = [];
        for (const selector of scrollSelectors) {
          const elements = document.querySelectorAll(selector);
          if (!elements.length) missingSelectors.push(selector);
          for (const el of elements) {
            const style = getComputedStyle(el);
            const x = el.scrollLeft, y = el.scrollTop;
            const behavior = el.style.getPropertyValue('scroll-behavior');
            const priority = el.style.getPropertyPriority('scroll-behavior');
            el.style.setProperty('scroll-behavior', 'auto', 'important');
            const maxX = Math.max(0, el.scrollWidth - el.clientWidth), maxY = Math.max(0, el.scrollHeight - el.clientHeight);
            el.scrollLeft = style.direction === 'rtl' ? -maxX : maxX;
            el.scrollTop = maxY;
            const horizontal = maxX <= 1 || (['auto', 'scroll', 'overlay'].includes(style.overflowX) && Math.abs(Math.abs(el.scrollLeft) - maxX) <= 1);
            const vertical = maxY <= 1 || (['auto', 'scroll', 'overlay'].includes(style.overflowY) && Math.abs(el.scrollTop - maxY) <= 1);
            scroll.push({ selector, element: label(el), maxX, maxY, horizontalEnd: horizontal, verticalEnd: vertical });
            el.scrollLeft = x; el.scrollTop = y;
            if (behavior) el.style.setProperty('scroll-behavior', behavior, priority); else el.style.removeProperty('scroll-behavior');
          }
        }
        const textOverflow = [];
        for (const selector of textSelectors) {
          const elements = document.querySelectorAll(selector);
          if (!elements.length) missingSelectors.push(selector);
          for (const el of elements) {
            if (!el.getClientRects().length) continue;
            const range = document.createRange(); range.selectNodeContents(el);
            const content = range.getBoundingClientRect(), box = el.getBoundingClientRect();
            if (content.left < box.left - 1 || content.right > box.right + 1 || (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)) textOverflow.push({ selector, element: label(el), text: el.textContent.trim().slice(0, 160) });
          }
        }
        return { pageFill, scroll, textOverflow, missingSelectors };
      }, { pageSelector: c.pageSelector, fill: fillWidths.includes(width), scrollSelectors: c.scrollSelectors || [], textSelectors: c.textSelectors || [] });
      const fonts = [];
      if (fontCheckWidths.includes(width)) {
        const { root } = await cdp.send('DOM.getDocument');
        for (const sample of samples) {
          const count = await page.locator(sample.selector).count();
          if (count !== 1) { fonts.push({ ...sample, status: 'invalid-selector-count', count }); continue; }
          const computed = await page.locator(sample.selector).evaluate(el => {
            const s = getComputedStyle(el);
            return { text: el.textContent, family: s.fontFamily, weight: s.fontWeight, size: s.fontSize, lineHeight: s.lineHeight };
          });
          const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sample.selector });
          const actual = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
          const faceMatches = !sample.expectedPostScriptName || actual.fonts.some(f => f.postScriptName === sample.expectedPostScriptName && f.glyphCount > 0);
          const weightMatches = sample.expectedWeight === undefined || computed.weight === sample.expectedWeight;
          fonts.push({ ...sample, computed, actual: actual.fonts, weightMatches, status: !faceMatches || !weightMatches ? 'mismatch' : sample.expectedPostScriptName ? 'expected-face-present' : 'needs-design-comparison' });
        }
      }
      const check = { width, readiness, ...metrics, layout, fonts, errors: [...errors] };
      check.technicalStatus = readiness !== 'ready' || metrics.missingImages.length || errors.length || fonts.some(f => ['mismatch', 'invalid-selector-count'].includes(f.status)) || ['failed', 'invalid-selector-count'].includes(layout.pageFill.status) || layout.missingSelectors.length || layout.scroll.some(s => !s.horizontalEnd || !s.verticalEnd) ? 'failed' : metrics.documentWidth > width || metrics.missingAlt || layout.textOverflow.length ? 'needs-review' : 'passed';
      if (shots.includes(width)) {
        check.screenshot = `${c.phase}-${width}.png`;
        await page.screenshot({ path: path.join(c.outputDir, check.screenshot), fullPage: true, timeout: 25000 });
      }
      result.checks.push(check);
    }
  } catch (e) {
    result.error = e.message;
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n');
  }
  if (result.checks.some(c => c.technicalStatus === 'failed')) process.exitCode = 1;
  console.log(JSON.stringify({ report: reportPath, error: result.error, checks: result.checks.map(c => ({ width: c.width, status: c.technicalStatus })), visualVerdict: result.visualVerdict }));
}
run().catch(e => { console.error(e.message); process.exitCode = 1; });
