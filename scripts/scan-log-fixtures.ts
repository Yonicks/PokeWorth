/** Offline checks for the scan log rules (src/services/scan-log.model.ts). Run: npx tsx scripts/scan-log-fixtures.ts */
import {
  addEntry,
  countStatuses,
  formatMs,
  MAX_LOG_ENTRIES,
  median,
  parseScanLog,
  patchEntry,
  timingText,
  toReport,
  typicalTimings,
  verdictOf,
  type ScanLogEntry,
} from '../src/services/scan-log.model';

let failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`PASS  ${label}`);
  else {
    failed++;
    console.log(`FAIL  ${label} ${detail}`);
  }
}

const entry = (id: string, extra: Partial<ScanLogEntry> = {}): ScanLogEntry => ({
  id,
  at: '2026-11-10T10:00:00.000Z',
  kind: 'card',
  lines: ['Pikachu', '58/102'],
  ...extra,
});

// Storage
check('parse: nothing stored gives an empty log', parseScanLog(undefined).length === 0 && parseScanLog('').length === 0);
check('parse: broken JSON gives an empty log', parseScanLog('{nope').length === 0);
check('parse: a non-array gives an empty log', parseScanLog('{"a":1}').length === 0);
check(
  'parse: broken entries are dropped, good ones kept',
  parseScanLog(JSON.stringify([entry('a'), { id: 'b' }, null, 5, entry('c')])).map((e) => e.id).join() === 'a,c',
);

// Adding and patching
const log = [entry('a'), entry('b')];
check('add: newest first', addEntry(log, entry('c'))[0].id === 'c');
check('add: the same id is replaced, not duplicated', addEntry(log, entry('a', { name: 'X' })).filter((e) => e.id === 'a').length === 1);
const many = Array.from({ length: MAX_LOG_ENTRIES + 5 }, (_, i) => entry(`e${i}`));
check('add: the log is capped at the newest entries', addEntry(many, entry('new')).length === MAX_LOG_ENTRIES && addEntry(many, entry('new'))[0].id === 'new');
check('patch: merges fields into one entry', patchEntry(log, 'b', { topCardId: 'base1-58' })[1].topCardId === 'base1-58');
check('patch: an unknown id changes nothing', JSON.stringify(patchEntry(log, 'zzz', { name: 'X' })) === JSON.stringify(log));

// Times
check('time: under a second in ms', formatMs(850) === '850 ms');
check('time: seconds with one decimal', formatMs(1800) === '1.8 s');
check('time: ten seconds or more is whole', formatMs(12400) === '12 s');
check('time: nonsense shows a dash', formatMs(-1) === '—' && formatMs(NaN) === '—');
check(
  'timing text: steps in order, missing steps left out',
  timingText(entry('a', { readMs: 1800, matchMs: 900 })) === 'read 1.8 s · match 900 ms',
);
check('timing text: all steps', timingText(entry('a', { photoMs: 400, readMs: 1800, matchMs: 900 })) === 'photo 400 ms · read 1.8 s · match 900 ms');
check('timing text: binder labels per pocket', timingText(entry('p', { kind: 'binder', readMs: 1000, matchMs: 500, totalMs: 15000 })) === 'read per pocket 1.0 s · match per pocket 500 ms · page total 15 s');
check('timing text: nothing measured', timingText(entry('a')) === 'no timings');
check('median: odd, even, empty', median([3, 1, 2]) === 2 && median([1, 2, 3, 4]) === 2.5 && median([]) === undefined);
const typical = typicalTimings([
  entry('a', { readMs: 1000, matchMs: 500 }),
  entry('b', { readMs: 3000, matchMs: 700 }),
  entry('c', { readMs: 2000 }),
  entry('p', { kind: 'binder', readMs: 99999 }),
]);
check('typical: medians over card scans only', typical.readMs === 2000 && typical.matchMs === 600 && typical.count === 3 && typical.photoMs === undefined);

// How a scan ended
check('verdict: nothing opened', verdictOf(entry('a', { topCardId: 'x' })) === 'unconfirmed');
check('verdict: opened the top card', verdictOf(entry('a', { topCardId: 'x', openedCardId: 'x' })) === 'matched');
check('verdict: opened another candidate', verdictOf(entry('a', { topCardId: 'x', openedCardId: 'y' })) === 'picked-other');
check('verdict: wrong card, nothing else opened', verdictOf(entry('a', { topCardId: 'x', openedCardId: 'x', wrongCardId: 'x' })) === 'wrong');
check('verdict: wrong card, then a different one', verdictOf(entry('a', { topCardId: 'x', openedCardId: 'y', wrongCardId: 'x' })) === 'fixed');

// Binder and report
check('statuses: counted per status', JSON.stringify(countStatuses(['sure', 'check', 'sure', 'empty'])) === '{"sure":2,"check":1,"empty":1}');
check('report: valid JSON that parses back', parseScanLog(toReport(log)).length === 2);

if (failed > 0) {
  console.log(`\n${failed} scan log check(s) failed.`);
  process.exit(1);
}
console.log('\nAll scan log fixtures passed.');
