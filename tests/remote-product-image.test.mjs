import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { loadTypescript } from './helpers/load-typescript.mjs';

const { downloadProductImage, validateRemoteImageBytes, validateRemoteImageUrl, isPublicImageAddress, MAX_REMOTE_IMAGE_BYTES } = loadTypescript('lib/remote-product-image.ts');
const png = await sharp({ create: { width: 3, height: 4, channels: 3, background: '#96b5cd' } }).png().toBuffer();
const response = (values = {}) => ({ status: 200, contentType: 'image/png', body: (async function* () { yield png; })(), close() {}, ...values });
const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];

test('downloads and decodes supported image bytes independent of filename', async () => {
  for (const [format, type] of [['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp'], ['avif', 'image/avif']]) {
    const bytes = await sharp(png)[format]().toBuffer();
    const result = await downloadProductImage('https://images.example.com/no-extension', {
      resolve: publicDns, request: async () => response({ contentType: type, body: (async function* () { yield bytes; })() }),
    });
    assert.equal(result.contentType, type); assert.deepEqual(result.bytes, bytes);
  }
});
test('rejects invalid URL, embedded credentials and nonstandard ports', () => {
  for (const value of ['not a URL', 'file:///tmp/image', 'ftp://images.example.com/x', 'https://user:secret@images.example.com/x', 'https://images.example.com:8080/x']) {
    assert.throws(() => validateRemoteImageUrl(value), /HTTP|URL/);
  }
});
test('blocks private, loopback, mapped IPv6, link-local, metadata and internal URLs', () => {
  for (const host of ['localhost', 'image', 'image.local', 'image.internal', 'metadata.google.internal', 'metadata.goog', '127.1', '2130706433', '0x7f000001', '10.0.0.1', '100.64.0.1', '172.16.0.1', '192.168.2.3', '169.254.169.254', '0.0.0.0', '[::1]', '[fc00::1]', '[fe80::1]', '[::ffff:127.0.0.1]', '[64:ff9b::7f00:1]', '[2002:7f00:1::1]']) {
    assert.throws(() => validateRemoteImageUrl(`https://${host}/image.png`), /private|public|internal/);
  }
  assert.equal(isPublicImageAddress('8.8.8.8'), true);
  assert.equal(isPublicImageAddress('2606:4700:4700::1111'), true);
  assert.equal(isPublicImageAddress('2001:db8::1'), false);
});
test('blocks DNS private addresses and mixed public/private answers before making a request', async () => {
  for (const addresses of [[{ address: '127.0.0.1', family: 4 }], [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]]) {
    await assert.rejects(downloadProductImage('https://images.example.com/x', {
      resolve: async () => addresses, request: async () => assert.fail('Private address reached transport'),
    }), /private|internal/);
  }
});
test('redirects revalidate hostname and DNS, enforce three hops and close each response', async () => {
  let calls = 0; let closed = 0;
  await assert.rejects(downloadProductImage('https://images.example.com/x', {
    resolve: publicDns, request: async () => { calls++; return response({ status: 302, location: 'http://169.254.169.254/latest/meta-data', close() { closed++; } }); },
  }), /private/);
  assert.equal(calls, 1); assert.equal(closed, 1);
  calls = 0;
  await assert.rejects(downloadProductImage('https://images.example.com/x', {
    resolve: publicDns, request: async () => { calls++; return response({ status: 302, location: '/next' }); },
  }), /redirects/);
  assert.equal(calls, 4);
  await assert.rejects(downloadProductImage('https://images.example.com/x', {
    resolve: async host => [{ address: host === 'images.example.com' ? '93.184.216.34' : '10.0.0.1', family: 4 }],
    request: async () => response({ status: 302, location: 'https://private.example.com/x' }),
  }), /private/);
});
test('rejects unsupported, spoofed, empty and truncated image content', async () => {
  for (const [bytes, mime] of [[png, 'image/gif'], [png, 'image/jpeg'], [Buffer.from('<html>not an image</html>'), 'image/png'], [Buffer.alloc(0), 'image/png'], [png.subarray(0, 40), 'image/png']]) {
    await assert.rejects(validateRemoteImageBytes(bytes, mime), /valid|JPEG/);
  }
});
test('enforces the 5 MB limit from headers and streamed bytes without trusting Content-Length', async () => {
  await assert.rejects(validateRemoteImageBytes(Buffer.alloc(MAX_REMOTE_IMAGE_BYTES + 1), 'image/png'), /larger than 5 MB/);
  for (const values of [{ contentLength: String(MAX_REMOTE_IMAGE_BYTES + 1) }, {
    contentLength: '1', body: (async function* () { yield Buffer.alloc(MAX_REMOTE_IMAGE_BYTES); yield Buffer.alloc(1); })(),
  }]) await assert.rejects(downloadProductImage('https://images.example.com/x', { resolve: publicDns, request: async () => response(values) }), /larger than 5 MB/);
});
test('failed request and HTTP errors give safe download messages', async () => {
  await assert.rejects(downloadProductImage('https://images.example.com/x', { resolve: publicDns, request: async () => { throw new Error('raw secret network detail'); } }), error => /could not be downloaded/.test(error.message) && !error.message.includes('secret'));
  await assert.rejects(downloadProductImage('https://images.example.com/x', { resolve: publicDns, request: async () => response({ status: 404 }) }), /could not be downloaded/);
});
test('real transport pins the validated DNS address and sends no credentials', async () => {
  const { EventEmitter } = await import('node:events');
  let options; let connected; let lookups = 0;
  const request = (_url, opts, callback) => {
    options = opts;
    opts.lookup('images.example.com', { all: true }, (_error, addresses) => { connected = addresses; });
    const stream = response().body;
    stream.statusCode = 200; stream.headers = { 'content-type': 'image/png' }; stream.destroy = () => {};
    const emitter = new EventEmitter(); emitter.end = () => callback(stream); return emitter;
  };
  const real = loadTypescript('lib/remote-product-image.ts', {
    'node:dns/promises': { lookup: async () => { lookups++; return [{ address: '93.184.216.34', family: 4 }]; } },
    'node:http': { request }, 'node:https': { request },
  });
  await real.downloadProductImage('https://images.example.com/x');
  assert.equal(lookups, 1); assert.equal(connected[0].address, '93.184.216.34'); assert.equal(options.agent, false);
  assert.deepEqual(Object.keys(options.headers).sort(), ['Accept', 'Accept-Encoding']);
  assert.equal(options.signal instanceof AbortSignal, true);
});
