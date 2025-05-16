const express = require('express');
const { generatePdf } = require('./generator');
const { initAppInsights, generateRequestId, trackTrace, clock } = require('./telemetry');
const { compressPdfBuffer } = require('./compressutil');
const { Writable } = require('stream');

const PORT = process.env.PORT || 3000;
const KEEPALIVETIMEOUT = 60000; // 60 seconds

initAppInsights();

const app = express();
app.use(express.json({limit: '50mb'}));
app.keepAliveTimeout = KEEPALIVETIMEOUT;

app.use((req, res, next) => {
    req.requestId = generateRequestId();
    next();
});

app.get('/', (req, res) => {
    return res.send('OK');
});

/**
 * Generates a PDF from the specified URL.
 * 
 * Request Parameters:
 * - `url` (string): The URL of the page to generate the PDF from.
 * 
 * Response:
 * - Returns the generated PDF as a binary stream with `Content-Type: application/pdf`.
 * - Responds with a 500 status code if PDF generation fails.
 */
app.get('/generateReport/:url', async (req, res) => {
    const url = req.params.url;

    try {
        const stream = await generatePdf(url, req.requestId);
        res.set('Content-Type', 'application/pdf');
        return res.send(stream);
    } catch (err) {
        console.error('Error generating PDF:', err.message);
        return res.status(500).send('Failed to generate PDF');
    }
});

/**
 * Generates a PDF from a given URL with optional request interception, cookies, and compression.
 * 
 * Request Body:
 * - `url` (string, required): The URL of the page to generate the PDF from.
 * - `intercept` (Array, optional): An array of objects containing `apiUrl` and `apiBody` to intercept and mock API requests.
 * - `cookies` (Array, optional): An array of cookie objects to set in the browser session.
 * - `waitForSelector` (string, optional): A CSS selector to wait for before generating the PDF.
 * - `compression` (boolean, optional): Whether to compress the PDF.
 * - `dpi` (number, optional): The DPI to use for compression.
 * - `quality` (number, optional): The quality level for jpeg image compression.
 * -  timeout (number, optional): The timeout for the page navigation and PDF generation.
 * Response:
 * - Returns the generated PDF as a binary stream with `Content-Type: application/pdf`.
 * - Responds with a 400 status code if the `url` is missing in the request body.
 * - Responds with a 500 status code if PDF generation fails.
 */
app.post('/generateReport', async (req, res) => {
    trackTrace('Request body: ' + JSON.stringify(req.body), process.hrtime(), req.requestId);
    const { url, intercept, cookies, waitForSelector, compression, dpi, quality, timeout } = req.body;
    const pdfOptions = { compression, dpi, quality };
    
    if (!url) {
        return res.status(400).send('Missing "url" in request body');
    }

    try {
        const stream = await generatePdf(url, req.requestId, timeout, intercept, cookies, waitForSelector, pdfOptions);    
        res.set('Content-Type', 'application/pdf');
        return res.send(stream);
    } catch(err) {
        console.error('Error generating PDF:', err.message);
        return res.status(500).send('Failed to generate PDF');
    }
});

/**
 * Compresses a PDF file using Ghostscript.
 * Uses native Node.js streams to handle the PDF file upload and compression.
 * ex: curl -X POST -H "Content-Type: application/pdf" --data-binary "@<your file>" http://localhost:3000/compressPdf/150 --output outputfile.pdf
 */
app.post('/compressPdf/:dpi', async (req, res) => {
    var start = clock();
    
    try {
        const chunks = [];
        const writable = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk);
                callback();
            }
        });

        req.pipe(writable).on('finish', async () => {
            const pdfBuffer = Buffer.concat(chunks);
            chunks.length = 0; // Clear the array to release memory
            const dpi = parseInt(req.params.dpi, 10);

            // Validate file content (basic check for empty buffer)
            if (!pdfBuffer || pdfBuffer.length === 0) {
                return res.status(400).send('No file uploaded or file is empty.');
            }
            const pdfBufferSizeMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);
            trackTrace('Received PDF file size '+ pdfBufferSizeMB  + ' MB', start, req.requestId);

            try {
                const compressedPdfBuffer = await compressPdfBuffer(pdfBuffer, dpi); 
                const compressedSizeMB = (compressedPdfBuffer.length / (1024 * 1024)).toFixed(2);
                trackTrace('Compressed PDF size ' + compressedSizeMB  + ' MB', start, req.requestId);

                res.set('Content-Type', 'application/pdf');

                return res.send(compressedPdfBuffer);
            } catch (err) {
                trackTrace('Error compressing PDF: ' + err.message, start, req.requestId);
                return res.status(500).send('Error compressing PDF');
            }
        });
    } catch (err) {
        trackTrace('Error handling upload: ' + err.message, start, req.requestId);
        return res.status(500).send('Error handling upload');
    }
});

app.get('/evwebpdfhealth', (req, res) => {
    return res.send('OK');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});