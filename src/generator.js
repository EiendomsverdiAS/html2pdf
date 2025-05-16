const puppeteer = require('puppeteer');
const { trackTrace, clock } = require('./telemetry');
const { compressPdfBuffer } = require('./compressutil');

let browser;

async function init()  {
    browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-setuid-sandbox",
            "--no-sandbox",
        ]
    });
}
init();

/**
 * Generates a PDF from a given URL with optional request interception, cookies, and compression.
 * 
 * @param {string} url - The URL of the page to generate the PDF from. If it does not start with "http", "http://" will be prefixed.
 * @param {string} requestId - The unique identifier for the request.
 * @param {number} [timeout=70000] - The timeout for the page navigation and PDF generation.
 * @param {Array} requests - An array of objects containing `apiUrl` and `apiBody` to intercept and mock API requests.
 * @param {Array|null} cookies - An array of cookie objects to set in the browser session, or null if no cookies are needed.
 * @param {string} waitForSelector - A CSS selector to wait for before generating the PDF. Defaults to 'body'.
 * @param {Object|null} pdfOptions - Optional PDF generation options. If provided, it can include:
 *   - `compression` (boolean): Whether to compress the PDF.
 *   - `dpi` (number): The DPI to use for compression. 10 - 600.
 *   - `quality` (number): The quality level for compression. 1 - 100
 * @returns {Promise<Buffer>} - A promise that resolves to a Buffer containing the generated PDF.
 * @throws {Error} - Throws an error if PDF generation fails.
 */
async function generatePdf(url, requestId, timeout = 70000, requests = [], cookies = null, waitForSelector = 'body', pdfOptions = null) {
    var start = clock();
    const page = await browser.newPage();
    trackTrace('launching browser complete', start, requestId);

    try {
        if (cookies) {
            await page.setCookie(...cookies);
            trackTrace('set new cookies', start, requestId);
        }
        if (!!requests?.length) {
            await page.setRequestInterception(true);
    
            page.on('request', interceptedRequest => {
                if (interceptedRequest.isInterceptResolutionHandled()) {
                    return;
                }
    
                const interceptedUrl = interceptedRequest.url();
                const match = requests.find(r => interceptedUrl.includes(r.apiUrl));
    
                if (match) {
                    interceptedRequest.respond({
                        status: 200,
                        contentType: 'application/json; charset=utf-8',
                        body: JSON.stringify(match.apiBody)
                    });
                } else {
                    return interceptedRequest.continue();
                }
            });
        }
    
        if (url.indexOf('http') !== 0) url = `http://${url}`;
    
        await page
            .waitForSelector(waitForSelector)
            .then(() => console.log(`selector ${waitForSelector} found`));
        
        // Wait for images and fonts to load
        trackTrace('goto page ' + url, start, requestId);
        await page.goto(url,  {
            timeout,
            waitUntil: ["networkidle0", "domcontentloaded"]
        });

        trackTrace('generating pdf', start, requestId);
        const pdfBuffer = await page.pdf({printBackground: true, format: 'A4', landscape: false, timeout});
        trackTrace('generating pdf done', start, requestId);

        if(pdfOptions != null && pdfOptions.compression == true) {
            trackTrace(`pdf compression dpi=${pdfOptions.dpi}`, start, requestId);
            const compressedPdfBuffer = await compressPdfBuffer(pdfBuffer, pdfOptions.dpi, pdfOptions.quality);    
            trackTrace('pdf compression done', start, requestId);
            
            await page.close();
            return compressedPdfBuffer;
        } else {
            await page.close();
            return pdfBuffer;
        }
    } catch (ex) {
        await page.close();
        throw ex; 
    }
}

module.exports = { generatePdf };