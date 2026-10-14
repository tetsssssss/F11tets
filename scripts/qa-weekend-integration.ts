/** Short but real simulator pipeline: two complete weekends, points and save roundtrip. */
import { createSave, parseSave } from '../src/domain/save';
import { runNextSession, nextSession, advanceRound } from '../src/domain/simulation';
const rounds = Math.max(1, Math.min(5, Number(process.argv[2] || 2)));
let current = createSave(2029);
current.world.settings.telemetry = 'summary';
let sessions = 0;
for (let round=1;round<=rounds;round++) {
  if (current.round !== round) throw Error(`Wrong round: ${current.round} vs ${round}`);
  let sessionCount=0;
  while (nextSession(current)) {
    const before=JSON.stringify(current.driverPoints);
    current = runNextSession(current);
    sessions++;sessionCount++;
    if (sessionCount>8) throw Error('Session failed to advance');
    if (sessionCount<8 && nextSession(current) && !current.weekends.length) throw Error('Weekend not recorded');
  }
  const weekend=current.weekends.find(w=>w.round===round);
  if (!weekend?.results.GP || weekend.results.GP.length!==32) throw Error(`Invalid results at round ${round}`);
  if (new Set(weekend.results.GP.map(r=>r.driverId)).size!==32) throw Error('Duplicated driver');
  current=advanceRound(current);
  const restored=parseSave(JSON.stringify(current));
  if (!restored) throw Error('Save roundtrip failed');
  current=restored;
  console.log(`ROUND_OK=${round} sessions=${sessionCount} next=${current.round}`);
}
console.log(`INTEGRATION_PASS rounds=${rounds} sessions=${sessions} save_bytes=${Buffer.byteLength(JSON.stringify(current))}`);
