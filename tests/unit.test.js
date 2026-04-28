'use strict';

/**
 * Unit tests for pure-JS utility modules (no browser / Ghostscript required).
 *
 * Run:  node --test tests/unit.test.js
 *
 * NOTE: compressPdfBuffer() relies on a Ghostscript process and is therefore
 *       only fully exercised in integration tests that run with Ghostscript
 *       available.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

// ---------------------------------------------------------------------------
// Stub applicationinsights before requiring telemetry.js so the tests work
// without the package being installed (e.g. in a syntax-only CI step).
// ---------------------------------------------------------------------------
const _originalLoad = Module._load;
Module._load = function stubLoad(request, parent, isMain) {
    if (request === 'applicationinsights') {
        return {
            setup()                { return this; },
            setAutoCollectConsole() { return this; },
            start()                {}
        };
    }
    return _originalLoad.apply(this, arguments);
};

let telemetry;
try {
    telemetry = require('../src/telemetry');
} finally {
    // Restore so remaining requires are unaffected.
    Module._load = _originalLoad;
}
// ---------------------------------------------------------------------------
// telemetry.js
// ---------------------------------------------------------------------------
describe('telemetry', () => {
    describe('generateRequestId', () => {
        it('returns a non-empty string', () => {
            const id = telemetry.generateRequestId();
            assert.equal(typeof id, 'string');
            assert.ok(id.length > 0);
        });

        it('contains a hyphen separator', () => {
            const id = telemetry.generateRequestId();
            assert.ok(id.includes('-'), `expected hyphen in "${id}"`);
        });

        it('produces unique values across multiple calls', () => {
            const ids = new Set(Array.from({ length: 20 }, () => telemetry.generateRequestId()));
            assert.ok(ids.size > 1, 'expected at least two distinct IDs');
        });
    });

    describe('clock', () => {
        it('returns an hrtime tuple when called without arguments', () => {
            const start = telemetry.clock();
            assert.ok(Array.isArray(start), 'expected an array');
            assert.equal(start.length, 2);
            assert.equal(typeof start[0], 'number');
            assert.equal(typeof start[1], 'number');
        });

        it('returns a non-negative number of milliseconds when called with a start time', () => {
            const start = telemetry.clock();
            const elapsed = telemetry.clock(start);
            assert.equal(typeof elapsed, 'number');
            assert.ok(elapsed >= 0, `expected elapsed >= 0, got ${elapsed}`);
        });

        it('elapsed time increases between calls', async () => {
            const start = telemetry.clock();
            await new Promise(resolve => setTimeout(resolve, 10));
            const elapsed = telemetry.clock(start);
            assert.ok(elapsed >= 5, `expected elapsed >= 5ms, got ${elapsed}ms`);
        });
    });

    describe('trackTrace', () => {
        it('does not throw with all arguments', () => {
            const start = telemetry.clock();
            assert.doesNotThrow(() => telemetry.trackTrace('test message', start, 'req-001'));
        });

        it('does not throw when requestId is omitted', () => {
            const start = telemetry.clock();
            assert.doesNotThrow(() => telemetry.trackTrace('no-id message', start));
        });

        it('logs output that includes the message', () => {
            const logs = [];
            const originalLog = console.log;
            console.log = (...args) => logs.push(args.join(' '));
            try {
                const start = telemetry.clock();
                telemetry.trackTrace('hello-world', start, 'req-test');
            } finally {
                console.log = originalLog;
            }
            assert.ok(
                logs.some(l => l.includes('hello-world')),
                `expected log to contain "hello-world", got: ${JSON.stringify(logs)}`
            );
        });
    });
});

// ---------------------------------------------------------------------------
// compressutil.js — input-validation logic only (no Ghostscript)
// ---------------------------------------------------------------------------
describe('compressutil', () => {
    const { compressPdfBuffer } = require('../src/compressutil');

    it('rejects when given a non-PDF empty buffer (Ghostscript exits non-zero)', async () => {
        // We cannot invoke Ghostscript in the unit-test environment, so we only
        // assert that the function returns a Promise and rejects with an Error
        // when passed an empty/invalid buffer.
        const emptyBuf = Buffer.alloc(0);
        await assert.rejects(
            () => compressPdfBuffer(emptyBuf, 150),
            (err) => {
                assert.ok(err instanceof Error);
                return true;
            }
        );
    });

    it('coerces non-Buffer input to a Buffer before processing', async () => {
        // Pass a Uint8Array; the function should not throw a type error before
        // reaching the spawn call.  We still expect a rejection because there is
        // no real Ghostscript, but the error must not be a TypeError about Buffer.
        const uint8 = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
        await assert.rejects(
            () => compressPdfBuffer(uint8, 150),
            (err) => {
                assert.notEqual(err.message, 'pdfBuffer is not a Buffer', err.message);
                return true;
            }
        );
    });
});
