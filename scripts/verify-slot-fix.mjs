/**
 * Proves the clobber assertion in simulate-bracket.mjs has teeth: replays the
 * slot propagation as it was written BEFORE the fix (one UPDATE writing both
 * columns) and shows it wipes an already-filled slot.
 */

// A next-round match already holding a bye winner in team1.
const target = { round: 2, no: 1, team1: 1, team2: null };

// The other feeder (round 1, match 2) now confirms, occupying slot team2.
const feeder = { round: 1, no: 2, slot: 'team2', winner: 7, next: target };

// BEFORE: a single statement assigning both columns.
target.team1 = feeder.slot === 'team1' ? feeder.winner : null;
target.team2 = feeder.slot === 'team2' ? feeder.winner : null;

console.log('after buggy propagation:', JSON.stringify(target));
const clobbered = target.team1 === null;
console.log(clobbered ? 'REPRODUCED: the bye winner (team 1) was wiped.' : 'not reproduced');

// AFTER: two statements, each gated on its own slot.
const t2 = { round: 2, no: 1, team1: 1, team2: null };
if (feeder.slot === 'team1') t2.team1 = feeder.winner;
if (feeder.slot === 'team2') t2.team2 = feeder.winner;

console.log('after fixed propagation:', JSON.stringify(t2));
const intact = t2.team1 === 1 && t2.team2 === 7;
console.log(intact ? 'FIXED: both slots intact.' : 'fixed version is wrong');

process.exit(clobbered && intact ? 0 : 1);
