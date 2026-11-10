/** Offline checks for the auto-scan rules (src/services/live-scan.model.ts). Run: npx tsx scripts/live-scan-fixtures.ts */
import {
  autoStatusText,
  emptyStreak,
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

console.log(failed === 0 ? '\nAll live scan checks passed.' : `\n${failed} live scan check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
