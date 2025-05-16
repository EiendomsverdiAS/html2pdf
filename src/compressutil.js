const { exec, spawn } = require('child_process');

/**
 * Compresses a PDF buffer using Ghostscript.
 * 
 * This function takes a PDF buffer as input and compresses it by downsampling images
 * and adjusting the resolution and JPEG quality. It uses Ghostscript to perform the
 * compression and returns the compressed PDF as a buffer.
 * 
 * @param {Buffer} pdfBuffer - The input PDF file as a buffer.
 * @param {number} [dpi=150] - The resolution (dots per inch) for downsampling images.
 * @param {number} [jpegQuality=95] - The JPEG quality (1-100) for image compression.
 * @returns {Promise<Buffer>} - A promise that resolves to the compressed PDF buffer.
 * @throws {Error} - Throws an error if Ghostscript fails or the compression process encounters an issue.
 */
async function compressPdfBuffer(pdfBuffer, dpi = 150, jpegQuality = 95) {
    dpi = Math.max(10, Math.min(600, dpi)); // DPI 10 - 600
    jpegQuality = Math.max(1, Math.min(100, jpegQuality)); // JPEG quality 1 - 100
    
    if (!(pdfBuffer instanceof Buffer)) {
        pdfBuffer = Buffer.from(pdfBuffer);
    }

    try {
        const command = 'gs';
        const args = [
            '-q',
            '-dSAFER',
            '-sDEVICE=pdfwrite',
            '-dDetectDuplicateImages=true',
            '-dCompatibilityLevel=1.4',
            '-dEmbedAllFonts=true',
            '-dSubsetFonts=true',
            '-dColorImageDownsampleType=/Bicubic',
            '-dGrayImageDownsampleType=/Bicubic',
            '-dMonoImageDownsampleType=/Bicubic',
            `-dDownsampleColorImages=true`,
            `-dDownsampleGrayImages=true`,
            `-dDownsampleMonoImages=true`,
            `-dColorImageResolution=${dpi}`,
            `-dGrayImageResolution=${dpi}`,
            `-dMonoImageResolution=${dpi}`,
            `-dJPEGQuality=${jpegQuality}`,
            '-dNOPAUSE',
            '-dBATCH',
            '-sOutputFile=-',
            '-'
        ];

        return await new Promise((resolve, reject) => {
            const gsProcess = spawn(command, args);

            const outputChunks = []; 

            gsProcess.stdin.write(pdfBuffer);
            gsProcess.stdin.end();

            gsProcess.stdout.on('data', (chunk) => {
                outputChunks.push(chunk);
            });

            gsProcess.stderr.on('data', (errorData) => {
                console.error(`Ghostscript stderr: ${errorData}`);
            });

            gsProcess.on('error', (error) => {
                console.error(`Ghostscript error: ${error.message}`);
                reject(new Error(`Failed to execute Ghostscript: ${error.message}`));
            });

            gsProcess.on('close', (exitCode) => {
                if (exitCode === 0) {
                    resolve(Buffer.concat(outputChunks));
                } else {
                    reject(new Error(`Ghostscript process exited with code ${exitCode}. Check the input PDF or Ghostscript configuration.`));
                }
            });
        });
    } catch (err) {
        console.error(`Error during compression: ${err.message}`);
        throw err;
    }
}

module.exports = { compressPdfBuffer };
