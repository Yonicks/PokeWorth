/**
 * Offline fixtures for typed network errors (fetch is stubbed, no network).
 * Run: npx tsx scripts/api-error-fixtures.ts
 */
import { ApiError, describeError, fetchWithTimeout, isRetryable, kindForStatus } from '../src/services/api-error';

let total = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = '') {
  total++;
  if (ok) console.log(`PASS  ${label}`);
  else {
    failed++;
    console.log(`FAIL  ${label}${detail ? `: ${detail}` : ''}`);
  }
}

const realFetch = globalThis.fetch;

async function main() {
  check('404 is not-found', kindForStatus(404) === 'not-found');
  check('500 and 503 are server errors', kindForStatus(500) === 'server' && kindForStatus(503) === 'server');

  // A network failure becomes "offline".
  globalThis.fetch = (() => Promise.reject(new TypeError('Network request failed'))) as typeof fetch;
  let err: unknown;
  try {
    await fetchWithTimeout('https://example.test/a');
  } catch (e) {
    err = e;
  }
  check('network failure is offline', err instanceof ApiError && err.kind === 'offline');

  // A request that never answers becomes "timeout" once the signal aborts.
  globalThis.fetch = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })) as typeof fetch;
  err = undefined;
  try {
    await fetchWithTimeout('https://example.test/b', {}, 30);
  } catch (e) {
    err = e;
  }
  check('slow request times out', err instanceof ApiError && err.kind === 'timeout');

  // A good answer passes through untouched.
  globalThis.fetch = (() => Promise.resolve(new Response('{"ok":true}', { status: 200 }))) as typeof fetch;
  const res = await fetchWithTimeout('https://example.test/c');
  check('good response passes through', res.ok && (await res.json()).ok === true);

  check('offline message names the connection', describeError(new ApiError('offline', 'x')).includes('offline'));
  check('timeout message says too long', describeError(new ApiError('timeout', 'x')).includes('too long'));
  check('not-found message names the subject', describeError(new ApiError('not-found', 'x'), 'this card') === 'Could not find this card.');
  check('server and bad-response messages differ', describeError(new ApiError('server', 'x')) !== describeError(new ApiError('bad-response', 'x')));
  check('unknown errors get a neutral message', describeError(new Error('boom')) === 'Something went wrong. Try again.');
  check('raw technical text never shows', !describeError(new ApiError('server', 'TCGdex request failed (500) for /x')).includes('500'));
  check('not-found is not retryable, others are', !isRetryable(new ApiError('not-found', 'x')) && isRetryable(new ApiError('offline', 'x')) && isRetryable(new Error('x')));

  globalThis.fetch = realFetch;
  console.log(`\n${total - failed}/${total} api-error fixtures passed.`);
  if (failed > 0) process.exit(1);
}

main();
