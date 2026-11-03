export const meta = {
  name: 'pokeworth-phase',
  description: 'Plan, build, review and gate one PokeWorth development phase from docs/dev-phases.md',
  whenToUse: 'Run one development phase (P0-P6) end to end. Args: { phase: "P2", layout?: "r1"|"r2", maxTasks?: 8, reviewRounds?: 1, only?: ["P2.3"], dryRun?: false }',
  phases: [
    { title: 'Plan', detail: 'read the phase spec and the code, return a task list' },
    { title: 'Build', detail: 'one agent per task, sequential on the working tree' },
    { title: 'Review', detail: 'three lenses, each finding checked by a skeptic, then fixed' },
    { title: 'Gate', detail: 'typecheck, lint, smoke and fixture scripts; update docs/status.md' },
  ],
}

/*
 * Args
 *   phase         required. "P0".."P6", a heading id in docs/dev-phases.md.
 *   layout        required for P3: "r1" or "r2" (design/home-spec.md).
 *   maxTasks      cap on planned tasks (default 8). Dropped tasks are logged, never silent.
 *   reviewRounds  review -> fix rounds (default 1, max 3). Stops early when a round confirms nothing.
 *   only          optional list of task ids to build, e.g. ["P2.3", "P2.4"].
 *   dryRun        true = return the plan without editing anything.
 *
 * Safety: agents edit the working tree but never commit, push, or run EAS builds/submits.
 * Run on a feature branch and review the diff afterwards.
 */

const A = args || {}
const PHASE = String(A.phase || '').toUpperCase()
if (!/^P[0-6]$/.test(PHASE)) throw new Error('args.phase must be one of P0..P6, e.g. { "phase": "P1" }')
if (PHASE === 'P3' && !['r1', 'r2'].includes(A.layout)) {
  throw new Error('P3 needs args.layout: "r1" (Pikachu hero, 3 tabs) or "r2" (list rows, 4 tabs + centre Scan button)')
}
const MAX_TASKS = Math.max(1, Math.min(Number(A.maxTasks) || 8, 15))
const ROUNDS = Math.max(0, Math.min(Number(A.reviewRounds ?? 1), 3))
const LAYOUT_NOTE = PHASE === 'P3' ? `\nChosen Home layout: ${A.layout} (see design/home-spec.md section ${A.layout === 'r1' ? '3' : '4'}).` : ''

const RULES = `Project rules for this run:
- The phase spec is the "## ${PHASE}" section of docs/dev-phases.md; its "Conventions" section applies.
- Do NOT commit, push, create branches, or run eas build/submit/update. Edit files only.
- Before using any Expo or React Native API, check the SDK 58 docs (https://docs.expo.dev/versions/v58.0.0/). Install packages only with "npx expo install".
- Keep routes in src/app/ and everything else outside it. Match the surrounding code style.
- Never invent prices or substitute missing artwork.${LAYOUT_NOTE}`

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    blocked: { type: 'boolean', description: 'true if a dependency or decision makes the phase impossible right now' },
    blockedReason: { type: 'string' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'spec id such as P2.3; use P2.3a for a split' },
          title: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
          acceptance: { type: 'array', items: { type: 'string' } },
          alreadyDone: { type: 'boolean', description: 'true if the code already satisfies this task' },
        },
        required: ['id', 'title', 'files', 'steps', 'acceptance', 'alreadyDone'],
      },
    },
    needsHuman: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'blocked', 'tasks', 'needsHuman'],
}
const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['done', 'partial', 'blocked', 'skipped'] },
    filesChanged: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string', description: 'what was done, what is left, and why' },
  },
  required: ['id', 'status', 'filesChanged', 'notes'],
}
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['file', 'severity', 'problem', 'fix'],
      },
    },
  },
  required: ['findings'],
}
const VERDICT_SCHEMA = {
  type: 'object',
  properties: { real: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['real', 'reason'],
}
const FIX_SCHEMA = {
  type: 'object',
  properties: {
    fixed: { type: 'array', items: { type: 'string' } },
    notFixed: { type: 'array', items: { type: 'string' } },
  },
  required: ['fixed', 'notFixed'],
}
const GATE_SCHEMA = {
  type: 'object',
  properties: {
    gates: {
      type: 'array',
      items: {
        type: 'object',
        properties: { command: { type: 'string' }, passed: { type: 'boolean' }, excerpt: { type: 'string' } },
        required: ['command', 'passed', 'excerpt'],
      },
    },
    allPassed: { type: 'boolean' },
    acceptance: {
      type: 'array',
      description: 'one entry per AC-Pn.k of this phase',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          result: { type: 'string', enum: ['met', 'not_met', 'needs_human'] },
          evidence: { type: 'string', description: 'file:line, command output, or why a human is needed' },
        },
        required: ['id', 'result', 'evidence'],
      },
    },
    dodMet: { type: 'boolean', description: 'shared Definition of Done items 1-6 all hold' },
    filesChanged: { type: 'array', items: { type: 'string' }, description: 'from git status, so files created during review are included' },
    statusDocUpdated: { type: 'boolean' },
  },
  required: ['gates', 'allPassed', 'acceptance', 'dodMet', 'filesChanged', 'statusDocUpdated'],
}

// ---------------- Plan ----------------
phase('Plan')
const plan = await agent(
  `You are planning development phase ${PHASE} of the PokeWorth Expo app.
${RULES}

1. Read the "## ${PHASE}" section of docs/dev-phases.md, the Conventions section, and docs/status.md if it exists.
2. Check its depends_on. If a dependency is clearly not met in the code, or a required decision is missing, set blocked=true with the reason.
3. Read every file listed under inputs, and any file you need to judge the current state.
4. Return the phase's tasks in spec order. Keep the spec ids. Split a task (P2.3a, P2.3b) only if it is too large for one focused agent.
   For each task give the files it will touch, concrete steps, and the acceptance criteria it serves: copy the matching AC-${PHASE}.k lines from the spec's acceptance_criteria, ids included.
   Set alreadyDone=true when the current code already meets the task's acceptance.
5. Copy the spec's needs_human items into needsHuman.`,
  { label: `plan ${PHASE}`, schema: PLAN_SCHEMA },
)
if (!plan) throw new Error('Planner returned nothing; rerun the workflow.')
log(`${PHASE} · ${plan.title}: ${plan.tasks.length} tasks planned`)
if (plan.blocked) {
  log(`Blocked: ${plan.blockedReason || 'no reason given'}`)
  return { phase: PHASE, blocked: true, reason: plan.blockedReason, plan }
}

let todo = plan.tasks.filter(t => !t.alreadyDone)
const skippedDone = plan.tasks.filter(t => t.alreadyDone).map(t => t.id)
if (skippedDone.length) log(`Already done, skipping: ${skippedDone.join(', ')}`)
if (Array.isArray(A.only) && A.only.length) {
  const want = new Set(A.only.map(String))
  todo = todo.filter(t => want.has(t.id) || want.has(t.id.replace(/[a-z]$/, '')))
  log(`Limited to: ${todo.map(t => t.id).join(', ') || '(none matched)'}`)
}
if (todo.length > MAX_TASKS) {
  log(`maxTasks=${MAX_TASKS}: not building ${todo.slice(MAX_TASKS).map(t => t.id).join(', ')}`)
  todo = todo.slice(0, MAX_TASKS)
}
if (A.dryRun) return { phase: PHASE, dryRun: true, plan, wouldBuild: todo.map(t => t.id) }

// ---------------- Build ----------------
// Sequential on purpose: tasks share files (layouts, services, types) and run in one working tree.
phase('Build')
const built = []
for (const t of todo) {
  const r = await agent(
    `Implement task ${t.id} of PokeWorth phase ${PHASE}: ${t.title}
${RULES}

Files likely involved: ${t.files.join(', ') || '(decide from the code)'}
Steps:
${t.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
Acceptance:
${t.acceptance.map(s => `- ${s}`).join('\n')}

Earlier tasks in this run already changed: ${built.flatMap(b => b.filesChanged).join(', ') || 'nothing yet'}. Build on those changes; do not undo them.
When finished, run "npx tsc --noEmit" and fix any errors your change introduced.
Return status "blocked" with the reason if the task cannot be done without a human (a decision, an asset, a device, an account).`,
    { label: `build ${t.id}`, phase: 'Build', schema: BUILD_SCHEMA },
  )
  built.push(r || { id: t.id, status: 'blocked', filesChanged: [], notes: 'agent returned nothing' })
  log(`${t.id}: ${built[built.length - 1].status}`)
}
const changed = [...new Set(built.flatMap(b => b.filesChanged))]

// ---------------- Review ----------------
const LENSES = [
  { key: 'correctness', ask: 'bugs: crashes, wrong logic, unhandled promise rejections, race conditions, stale state, wrong navigation params, broken edge cases' },
  { key: 'spec', ask: `whether every acceptance criterion (AC-${PHASE}.k) of the phase and items 1-6 of the shared "Definition of Done" in docs/dev-phases.md are actually met; report each unmet one as a finding${PHASE === 'P3' ? '; compare the Home UI against design/home-spec.md and the chosen reference image in design/v1/reference/' : ''}` },
  { key: 'platform', ask: 'Expo SDK 58 / React Native API misuse (check the versioned docs), iOS vs Android vs web differences, safe areas, accessibility labels and touch targets, performance of lists and images' },
]
const reviewLog = []
for (let round = 1; round <= ROUNDS && changed.length; round++) {
  phase('Review')
  const confirmed = (await pipeline(
    LENSES,
    lens => agent(
      `Review the changes made for PokeWorth phase ${PHASE} through the ${lens.key} lens: ${lens.ask}.
${RULES}
Changed files: ${changed.join(', ')}
Use "git diff" to see the changes. Report only real, specific problems with file and line, and a concrete fix. Return an empty list if you find none.`,
      { label: `review ${lens.key} r${round}`, phase: 'Review', schema: FINDINGS_SCHEMA },
    ),
    (res, lens) => parallel(((res && res.findings) || []).filter(f => f.severity !== 'low').map(f => () =>
      agent(
        `A ${lens.key} reviewer claims this problem in the PokeWorth repo. Try to refute it by reading the code.
File: ${f.file}${f.line ? `:${f.line}` : ''}
Problem: ${f.problem}
Proposed fix: ${f.fix}
Answer real=false if the claim is wrong, already handled, or too vague to act on. If unsure, answer real=false.`,
        { label: `verify ${lens.key}`, phase: 'Review', schema: VERDICT_SCHEMA },
      ).then(v => (v && v.real ? { ...f, lens: lens.key } : null)),
    )),
  )).flat().filter(Boolean)

  log(`Round ${round}: ${confirmed.length} confirmed finding(s)`)
  if (!confirmed.length) { reviewLog.push({ round, confirmed: 0 }); break }
  const fix = await agent(
    `Fix these confirmed review findings for PokeWorth phase ${PHASE}.
${RULES}
${confirmed.map((f, i) => `${i + 1}. [${f.severity}/${f.lens}] ${f.file}${f.line ? `:${f.line}` : ''}: ${f.problem}\n   Fix: ${f.fix}`).join('\n')}
Run "npx tsc --noEmit" afterwards. List each finding as fixed or notFixed (with the reason).`,
    { label: `fix r${round}`, phase: 'Review', schema: FIX_SCHEMA },
  )
  reviewLog.push({ round, confirmed: confirmed.length, findings: confirmed, fix })
}

// ---------------- Gate ----------------
phase('Gate')
const gate = await agent(
  `Run the quality gates for PokeWorth phase ${PHASE} and record the result.
${RULES}
1. Run: npx tsc --noEmit ; npx expo lint ; npx tsx scripts/smoke-test.ts (network; if it fails only for lack of network, mark it passed=false with excerpt "offline") ; and npx tsx scripts/ocr-fixtures.ts if that file exists.
2. If a gate fails because of this phase's changes and the fix is small and obvious, fix it and run the gate again. Do not refactor.
3. Check every acceptance criterion AC-${PHASE}.k in docs/dev-phases.md against the code and gate output: met, not_met, or needs_human (device, real cards, accounts). Give evidence for each.
4. Check items 1-6 of the shared "Definition of Done" and set dodMet.
5. List filesChanged from "git status --short" (include files created during review).
6. Update docs/status.md (create it if missing): add or replace a "## ${PHASE}" section with today's date (use the shell "date" command), the task results below, gate results, an acceptance-criteria table (id, result, evidence), the Definition of Done check, and the human-only items.
Task results:
${built.map(b => `- ${b.id}: ${b.status}. ${b.notes}`).join('\n') || '- none built'}
Already done before this run: ${skippedDone.join(', ') || 'none'}
Human-only items:
${(plan.needsHuman || []).map(h => `- ${h}`).join('\n') || '- none'}`,
  { label: `gate ${PHASE}`, schema: GATE_SCHEMA },
)

return {
  phase: PHASE,
  title: plan.title,
  built: built.map(b => ({ id: b.id, status: b.status, notes: b.notes })),
  alreadyDone: skippedDone,
  filesChanged: changed,
  review: reviewLog.map(r => ({ round: r.round, confirmed: r.confirmed, notFixed: r.fix ? r.fix.notFixed : [] })),
  gates: gate ? gate.gates : 'gate agent returned nothing',
  allGatesPassed: gate ? gate.allPassed : false,
  acceptance: gate ? gate.acceptance : [],
  definitionOfDoneMet: gate ? gate.dodMet : false,
  filesChangedPerGit: gate ? gate.filesChanged : [],
  needsHuman: plan.needsHuman,
}
