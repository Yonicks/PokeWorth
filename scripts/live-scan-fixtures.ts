/** Offline checks for the auto-scan rules (src/services/live-scan.model.ts). Run: npx tsx scripts/live-scan-fixtures.ts */
import {
  autoSettings,
  autoStatusText,
  emptyStreak,
  isRateLimit,
  stopText,
  FRAMES_TO_ACCEPT,
  hasReadableCard,
  isAccepted,
  nextStreak,
  type Streak,
} from '../src/services/live-scan.model';

let failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`PASS  ${label}`);
  else {
    failed++;
    console.log(`FAIL  ${label} ${detail}`);
  }
}

const run = (ids: (string | undefined)[]): Streak => ids.reduce(nextStreak, emptyStreak);

check('one frame is not enough', !isAccepted(run(['a'])));
check(`${FRAMES_TO_ACCEPT} matching frames accept`, isAccepted(run(['a', 'a'])));
check('a different card starts over', !isAccepted(run(['a', 'b'])) && run(['a', 'b']).count === 1);
check('a frame with no match resets the streak', !isAccepted(run(['a', undefined, 'a'])));
check('streak keeps counting', run(['a', 'a', 'a']).count === 3 && isAccepted(run(['a', 'a', 'a'])));
check('nothing seen is never accepted', !isAccepted(emptyStreak) && !isAccepted(run([undefined, undefined])));
check('a higher bar is honoured', !isAccepted(run(['a', 'a']), 3) && isAccepted(run(['a', 'a', 'a']), 3));

check('readable: a name counts', hasReadableCard({ name: 'Pikachu' }));
check('readable: a number counts', hasReadableCard({ localId: '58' }));
check('readable: neither does not', !hasReadableCard({}));

check('status: before the first frame', autoStatusText(emptyStreak, 0).startsWith('Auto-scan on'));
check('status: searching', autoStatusText(emptyStreak, 3) === 'Looking for a card…');
check('status: a candidate card asks to hold still', autoStatusText(run(['a']), 3) === 'Hold still…');

// Pace: the cloud reader has a daily limit, so it is slower and gives up sooner
const device = autoSettings(true);
const cloud = autoSettings(false);
check('pace: cloud frames are at least 5x slower', cloud.gapMs >= device.gapMs * 5);
check('pace: cloud gives up sooner', cloud.timeoutMs < device.timeoutMs);
check('pace: cloud use stays within 500 a day for 60 cards', (cloud.timeoutMs / cloud.gapMs) * 60 <= 500 * 1);
check('limit: HTTP 429 is a rate limit', isRateLimit(new Error('Cloud OCR HTTP 429 retry 662')));
check('limit: other errors are not', !isRateLimit(new Error('Cloud OCR HTTP 500')) && !isRateLimit('timeout'));
check('stop text: limit says so', stopText('limit', false).includes('limit'));
check('stop text: cloud timeout asks to retry', stopText('timeout', false).startsWith('No card found'));

console.log(failed === 0 ? '\nAll live scan checks passed.' : `\n${failed} live scan check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
