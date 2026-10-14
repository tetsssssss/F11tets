import fs from 'node:fs/promises';
import { createSave, parseSave } from '../src/domain/save';
import { runNextSession, advanceRound } from '../src/domain/simulation';
import { prepareNextSeason } from '../src/domain/simulation/management';
let s = createSave(2044);
s.world.settings.spectator = true;
const report: any[] = [];
const started = Date.now();
for (let year = 0; year < 5; year++) {
  while (s.round <= 35) {
    for (let session = 0; session < 8; session++) s = runNextSession(s);
    s = advanceRound(s);
  }
  const problems = [];
  if (s.game.drivers.length !== 32 || new Set(s.game.drivers.map((d) => d.id)).size !== 32)
    problems.push('roster');
  for (const team of s.game.teams)
    if (s.game.drivers.filter((d) => d.teamId === team.id).length !== 2)
      problems.push('seats ' + team.id);
  for (const e of s.game.engineers)
    if (!s.game.drivers.some((d) => d.id === e.driverId && d.teamId === e.teamId))
      problems.push('engineer ' + e.id);
  const negative = s.game.teams.filter((t) => s.game.finances[t.id].cash < 0).map((t) => t.id);
  if (
    JSON.stringify(s).includes(':null') &&
    Object.values(s.driverPoints).some((p) => !Number.isFinite(p))
  )
    problems.push('points');
  const bytes = Buffer.byteLength(JSON.stringify(s));
  if (!parseSave(JSON.stringify(s))) problems.push('save before rollover');
  const season = s.season,
    champion = s.game.champion;
  s = prepareNextSeason(s);
  if (s.season !== season + 1) problems.push('rollover');
  if (!parseSave(JSON.stringify(s))) problems.push('save after rollover');
  report.push({
    season,
    champion,
    saveMegabytes: bytes / 1e6,
    active: s.game.drivers.length,
    pool: s.world.pool.length,
    archives: s.game.history.length,
    negativeCashTeams: negative,
    problems,
    elapsedSeconds: (Date.now() - started) / 1000,
  });
  console.log(JSON.stringify(report.at(-1)));
  await fs.writeFile('docs/soak-v04.json', JSON.stringify(report, null, 2));
  if (problems.length) {
    process.exitCode = 1;
    break;
  }
}
