/**
 * Binder scan accuracy on the owner's three real pages, using the recorded
 * OCR text in scripts/fixtures/binder-ocr.json and the live TCGdex catalog.
 * Needs the network (like smoke-test.ts). Target from the plan: at least 7 of
 * 9 right per page, and never a "Sure" pocket with the wrong card.
 * Run: npx tsx scripts/binder-live-check.ts
 */
import { classifyPocket } from '../src/services/binder-scan.model';
import { matchCard, parseOcrLines } from '../src/services/card-matcher.service';
import { normalize } from '../src/utils/text';

import recorded from './fixtures/binder-ocr.json';

interface Recorded {
  page: string;
  pocket: number;
  expected: string;
  lines: string[];
}

const data = recorded as { pockets: Recorded[] };

async function main() {
  const pages = new Map<string, { right: number; sure: number; sureWrong: number; total: number }>();
  for (const p of data.pockets) {
    const parsed = parseOcrLines(p.lines);
    const outcome = parsed.name || parsed.localId ? await matchCard(parsed) : null;
    const status = classifyPocket(p.lines, outcome);
    const top = outcome?.candidates[0]?.card;
    const right = !!top && normalize(top.name).includes(normalize(p.expected));
    const s = pages.get(p.page) ?? { right: 0, sure: 0, sureWrong: 0, total: 0 };
    s.total++;
    if (right) s.right++;
    if (status === 'sure') s.sure++;
    if (status === 'sure' && !right) s.sureWrong++;
    pages.set(p.page, s);
    console.log(
      `${right ? 'RIGHT' : 'miss '} ${status.padEnd(8)} ${p.page} #${p.pocket} ${p.expected.padEnd(22)} → ${top ? `${top.name} (${top.id})` : '—'}  [name "${outcome?.parsed.name ?? parsed.name ?? ''}", no ${parsed.localId ?? '-'}/${parsed.setTotal ?? '-'}]`,
    );
  }
  let failed = false;
  console.log('');
  for (const [page, s] of pages) {
    const ok = s.right >= 7 && s.sureWrong === 0;
    if (!ok) failed = true;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${page}: ${s.right}/${s.total} right, ${s.sure} Sure, ${s.sureWrong} Sure-but-wrong`);
  }
  const all = [...pages.values()].reduce((a, s) => ({ right: a.right + s.right, total: a.total + s.total, sure: a.sure + s.sure }), { right: 0, total: 0, sure: 0 });
  console.log(`\nAll pages: ${all.right}/${all.total} right, ${all.sure} Sure.`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
