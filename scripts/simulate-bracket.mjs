/**
 * Mirrors public.generate_bracket(), and the confirm/dispute propagation,
 * from supabase/phase3_tournaments.sql so the bracket can be verified
 * without a database.
 *
 *   node scripts/simulate-bracket.mjs
 */

/** Standard seeding: [1,2] -> [1,4,2,3] -> [1,8,4,5,2,7,3,6] */
function seedOrder(size) {
  let order = [1, 2];
  let n = 2;
  while (n < size) {
    const next = [];
    for (let i = 1; i <= n; i++) {
      next.push(order[i - 1]);
      next.push(n * 2 + 1 - order[i - 1]);
    }
    order = next;
    n = n * 2;
  }
  return order;
}

function labelFor(entering) {
  if (entering === 2) return 'Final';
  if (entering === 4) return 'Semifinal';
  if (entering === 8) return 'Quarterfinal';
  return `Round of ${entering}`;
}

function build(teamCount) {
  let size = 2;
  while (size < teamCount) size *= 2;

  let rounds = 0;
  for (let i = size; i > 1; i /= 2) rounds++;

  const order = seedOrder(size);
  const byRound = [];

  for (let r = 1; r <= rounds; r++) {
    const entering = size / Math.pow(2, r - 1);
    const count = entering / 2;
    const label = labelFor(entering);
    const row = [];
    for (let i = 1; i <= count; i++) {
      const m = { round: r, no: i, label, team1: null, team2: null, winner: null, status: 'pending' };
      if (r === 1) {
        if (order[i * 2 - 2] <= teamCount) m.team1 = order[i * 2 - 2];
        if (order[i * 2 - 1] <= teamCount) m.team2 = order[i * 2 - 1];
      }
      row.push(m);
    }
    byRound.push(row);
  }

  // link feeders forward
  for (let r = 1; r < byRound.length; r++) {
    byRound[r].forEach((m, idx) => {
      const i = idx + 1;
      const feeders = [byRound[r - 1][i * 2 - 2], byRound[r - 1][i * 2 - 1]];
      feeders.forEach((f, k) => {
        if (!f) throw new Error(`round ${r} match ${i} is missing a feeder`);
        f.next = m;
        f.slot = k === 0 ? 'team1' : 'team2';
      });
    });
  }

  return { size, rounds, byRound };
}

/**
 * Writes one winner into its slot using TWO separate statements, exactly as
 * the SQL does after the fix. Returns the target so the caller can assert the
 * other slot was left intact.
 */
function advance(m, winner) {
  if (!m.next) return null;
  const target = m.next;
  const otherSlot = m.slot === 'team1' ? 'team2' : 'team1';
  const otherBefore = target[otherSlot];

  if (m.slot === 'team1') target.team1 = winner;
  else target.team2 = winner;

  if (target[otherSlot] !== otherBefore) {
    throw new Error(
      `CLOBBER: advancing round ${m.round} match ${m.no} via slot ${m.slot} wiped the ` +
        `${otherSlot} of round ${target.round} match ${target.no}`
    );
  }
  return target;
}

let failures = 0;
const check = (cond, msg) => {
  if (!cond) {
    failures++;
    console.error(`  FAIL  ${msg}`);
  }
};

for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 16, 17, 31, 32]) {
  const { size, rounds, byRound } = build(n);
  const labels = byRound.map((row) => `${row[0].label} (${row.length})`).join(' > ');
  console.log(`teams=${String(n).padStart(2)}  field=${String(size).padStart(2)}  ${labels}`);

  // --- structure -------------------------------------------------------
  check(byRound.length === rounds, `teams=${n}: round count mismatch`);
  check(byRound[rounds - 1].length === 1, `teams=${n}: last round is not a single Final`);
  check(byRound[0].length === size / 2, `teams=${n}: round 1 match count is wrong`);

  const seeds = byRound[0].flatMap((m) => [m.team1, m.team2]).filter((t) => t !== null);
  check(new Set(seeds).size === seeds.length, `teams=${n}: a team appears twice in round 1`);
  check(Math.max(...seeds) <= n, `teams=${n}: a bye slot was filled with a team`);

  const placed = new Set(seeds);
  for (let s = 1; s <= n; s++) {
    check(placed.has(s), `teams=${n}: seed ${s} was never placed in round 1`);
  }

  // top seeds must sit in opposite halves
  const half = byRound[0].length / 2;
  const posOf = (s) => byRound[0].findIndex((m) => m.team1 === s || m.team2 === s);
  if (n >= 4) {
    const [p1, p2] = [posOf(1), posOf(2)];
    check((p1 < half) !== (p2 < half), `teams=${n}: seeds 1 and 2 share a half`);
  }

  // --- byes advance on generation -------------------------------------
  for (const m of byRound[0]) {
    const empty = m.team1 === null || m.team2 === null;
    if (empty) {
      const winner = m.team1 ?? m.team2;
      check(winner != null, `teams=${n}: round-1 match has neither team`);
      m.winner = winner;
      m.status = 'confirmed';
      advance(m, winner);
    }
  }

  // --- play it out, confirming in round order --------------------------
  let confirmed = 0;
  for (const row of byRound) {
    for (const m of row) {
      if (m.status === 'confirmed') continue;
      if (m.team1 === null || m.team2 === null) {
        // reached a match whose feeder has not finished; play feeders first
        continue;
      }
      m.winner = m.team1; // deterministic: team1 always wins
      m.status = 'confirmed';
      advance(m, m.winner);
      confirmed++;
    }
  }

  const final = byRound[rounds - 1][0];
  check(final.team1 !== null, `teams=${n}: Final is missing team1`);
  check(final.team2 !== null, `teams=${n}: Final is missing team2`);
  check(
    final.team1 !== final.team2,
    `teams=${n}: Final pairs a team against itself (${final.team1})`
  );

  const champion = final.winner ?? final.team1;
  check(
    champion >= 1 && champion <= n,
    `teams=${n}: champion ${champion} is not a real seed`
  );

  // nobody should have been dropped along the way
  const reached = new Set();
  for (const row of byRound) for (const m of row) {
    if (m.team1 !== null) reached.add(m.team1);
    if (m.team2 !== null) reached.add(m.team2);
  }
  check(reached.size === n, `teams=${n}: only ${reached.size}/${n} teams ever took a slot`);
}

console.log(failures === 0 ? '\nAll bracket checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
