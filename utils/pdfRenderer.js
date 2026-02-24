const puppeteer = require('puppeteer');

let browserPromise = null;
let queueTail = Promise.resolve();

function resetBrowserOnDisconnect(browser) {
  browser.once('disconnected', () => {
    browserPromise = null;
  });
  return browser;
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      })
      .then(resetBrowserOnDisconnect)
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }

  return browserPromise;
}

function enqueuePdfJob(job) {
  const run = queueTail.then(job, job);
  queueTail = run.catch(() => {});
  return run;
}

async function renderHtmlToPdf({
  html,
  filePath,
  pdfOptions = {},
  waitUntil = 'networkidle0',
}) {
  return enqueuePdfJob(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil });
      await page.pdf({
        path: filePath,
        ...pdfOptions,
      });
    } finally {
      try {
        await page.close();
      } catch (closeErr) {
        console.error('Failed to close PDF page:', closeErr);
      }
    }
  });
}

module.exports = {
  renderHtmlToPdf,
};
