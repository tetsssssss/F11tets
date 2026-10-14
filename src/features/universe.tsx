'use client';
import { PersonPortrait } from '../components/person-portrait';
import Link from 'next/link';
import { useState } from 'react';
import { useSave, useUniverse } from '../components/save-provider';
import { PageTitle, SectionHead, Badge, RatingBar } from '../components/ui';
import {
  allDrivers,
  allEngineers,
  potentialEstimate,
  initialTerms,
} from '../domain/universe/world';
import {
  negotiate,
  signNegotiation,
  scoutDriver,
  acceptCounter,
  canManage,
} from '../domain/universe/market';
import { advanceOffseason } from '../domain/universe/seasons';
import { prepareNextSeason } from '../domain/simulation/management';
import { offseasonSteps, type Role, type PromiseKind } from '../domain/universe/types';
import { acceptCEOOffer, boardStatus } from '../domain/universe/board';
import {
  assignRookie,
  researchAllocation,
  replaceComponent,
  rotateCrew,
  privateTest,
  readMessage,
  settings,
} from '../domain/universe/operations';
import { cloneState } from '../domain/simulation/world';
import { controlledIds } from '../domain/gameplay/career';
import { performance, newTyres, setupQuality } from '../domain/simulation/mechanics';
import type { Save } from '../domain/types';
import type { Decision } from '../domain/simulation/types';

export function downloadData(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const statusNames: Record<string, string> = {
  ACTIVE: 'Titular',
  RESERVE: 'Reserva',
  DEVELOPMENT: 'Desenvolvimento',
  'FREE AGENT': 'Livre',
  RETIRED: 'Aposentado',
};
export function UniverseLinks() {
  return (
    <div className="universe-links">
      {[
        ['/historia', 'História'],
        ['/academias', 'Academias'],
        ['/f2', 'Campeonato F2'],
        ['/f3', 'Campeonato F3'],
        ['/substituicoes', 'Assentos F1'],
        ['/silly-season', 'Negociações'],
        ['/organizacao', 'Organização'],
        ['/off-season', 'Entre temporadas'],
        ['/caixa-de-entrada', 'Caixa de entrada'],
        ['/corrida-rapida', 'Corrida rápida'],
      ].map(([href, label]) => (
        <Link className="button secondary" href={href} key={href}>
          {label}
        </Link>
      ))}
    </div>
  );
}

export function HistoryPage() {
  const { save } = useSave();
  const [year, setYear] = useState(0),
    [metric, setMetric] = useState<'wins' | 'poles' | 'podiums' | 'points'>('wins');
  const archives = save.game.history,
    selected = archives.find((a) => a.season === year) ?? archives.at(-1);
  const totals = allDrivers(save)
    .map((d) => ({
      d,
      value:
        archives.reduce((n, a) => n + (a.stats[d.id]?.[metric] ?? 0), 0) +
        (save.game.stats[d.id]?.[metric] ?? 0),
    }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  return (
    <>
      <PageTitle
        eyebrow="MEMÓRIA DO UNIVERSO"
        title="Cada temporada deixa uma história."
        subtitle="Resultados da sua carreira, com os elencos e as regras registrados em cada encerramento."
      />
      <UniverseLinks />
      <div className="two-col">
        <section className="panel padded">
          <SectionHead title="Hall dos campeões" sub="BASE DO UNIVERSO + CARREIRA" />
          {save.game.champions.map((c) => (
            <p key={c.season}>
              <b>{c.season}</b> · {c.driver} · {c.team}{' '}
              <Badge>
                {c.season < 2029 ? 'História definida no universo' : 'Temporada simulada'}
              </Badge>
            </p>
          ))}
        </section>
        <section className="panel padded">
          <SectionHead
            title="Recordes da carreira"
            sub="SOMENTE RESULTADOS SIMULADOS DISPONÍVEIS"
          />
          <select
            aria-label="Métrica histórica"
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
          >
            {Object.entries({
              wins: 'Vitórias',
              poles: 'Poles',
              podiums: 'Pódios',
              points: 'Pontos',
            }).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {totals.slice(0, 8).map((x, i) => (
            <p key={x.d.id}>
              <b>
                {i + 1}. {x.d.name}
              </b>{' '}
              · {x.value}
            </p>
          ))}
          {!totals.length && <p>Os recordes aparecerão após as primeiras sessões pontuadas.</p>}
        </section>
      </div>
      <section className="panel padded">
        <SectionHead title="Arquivo de temporadas" />
        <label>
          Temporada{' '}
          <select
            aria-label="Temporada histórica"
            value={selected?.season ?? ''}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {!archives.length && <option value="">Nenhuma temporada encerrada</option>}
            {archives.map((a) => (
              <option key={a.season}>{a.season}</option>
            ))}
          </select>
        </label>
        {selected && (
          <>
            <p>
              {selected.snapshot
                ? 'Cadastro capturado no encerramento.'
                : 'Save legado: elenco e regulamento históricos indisponíveis.'}
            </p>
            <button
              className="button secondary"
              onClick={() => downloadData(`temporada-${selected.season}.json`, selected)}
            >
              Exportar temporada
            </button>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Piloto</th>
                    <th>Equipe no encerramento</th>
                    <th>Pontos</th>
                    <th>Vitórias</th>
                    <th>Poles</th>
                    <th>Pódios</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(selected.points)
                    .filter(([id, pts]) => pts > 0 || selected.stats[id]?.starts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([id, points]) => {
                      const d = selected.snapshot?.drivers.find((d) => d.id === id),
                        t = selected.snapshot?.teams.find((t) => t.id === d?.teamId),
                        st = selected.stats[id];
                      return (
                        <tr key={id}>
                          <td>
                            {d?.name ?? allDrivers(save).find((d) => d.id === id)?.name ?? id}
                          </td>
                          <td>
                            {t?.name ??
                              (d?.teamId === 'free' ? 'Livre no encerramento' : 'Indisponível')}
                          </td>
                          <td>{points}</td>
                          <td>{st?.wins ?? 0}</td>
                          <td>{st?.poles ?? 0}</td>
                          <td>{st?.podiums ?? 0}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {selected.snapshot && (
              <>
                <h3>{selected.snapshot.regulation.name}</h3>
                <p>
                  {selected.snapshot.contracts.length} contratos ·{' '}
                  {selected.snapshot.calendar.length} GPs · {selected.snapshot.engineers.length}{' '}
                  engenheiros registrados.
                </p>
                {selected.snapshot.awards.map((a) => (
                  <p key={a.name}>
                    <b>{a.name}:</b>{' '}
                    {selected.snapshot!.drivers.find((d) => d.id === a.personId)?.name} · {a.value}{' '}
                    {a.unit}
                  </p>
                ))}
              </>
            )}
            <details>
              <summary>Resultados e equipes por Grande Prêmio</summary>
              {selected.weekends.map((w) => (
                <p key={w.round}>
                  GP{w.round} ·{' '}
                  {w.results.GP?.slice(0, 3)
                    .map(
                      (r) =>
                        `${selected.snapshot?.drivers.find((d) => d.id === r.driverId)?.name ?? r.driverId} (${selected.snapshot?.teams.find((t) => t.id === r.teamId)?.short ?? r.teamId})`,
                    )
                    .join(' · ')}
                </p>
              ))}
            </details>
          </>
        )}
      </section>
    </>
  );
}

export function AcademyPage() {
  const { save, update, notify } = useSave(),
    { teamById } = useUniverse();
  const [team, setTeam] = useState('all'),
    [status, setStatus] = useState('all');
  const list = save.world.pool.filter(
    (d) =>
      (team === 'all' || d.teamId === team) &&
      (status === 'all' || save.world.people[d.id].status === status),
  );
  return (
    <>
      <PageTitle
        eyebrow="ACADEMIAS & FORMAÇÃO"
        title="A próxima geração."
        subtitle="Reservas, desenvolvimento, scouting e categorias de acesso."
      />
      <UniverseLinks />
      <p className="projection-note">
        Cadastro provisório: 48 pilotos de academia e 16 talentos independentes são procedurais. A lista
        nominal mencionada no pedido não foi localizada. Superlicença de 40 pontos e 2 TL1 por
        equipe/ano são parâmetros provisórios.
      </p>
      <div className="career-controls">
        <label>
          Academia
          <select
            aria-label="Filtrar academia"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          >
            <option value="all">Todas</option>
            <option value="free">Sem vínculo</option>
            {save.game.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Situação
          <select
            aria-label="Filtrar situação"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todas</option>
            {Object.entries(statusNames)
              .filter(([k]) => k !== 'ACTIVE')
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>Talento</th>
              <th>Vínculo</th>
              <th>Nível / potencial estimado</th>
              <th>Licença</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => {
              const m = save.world.people[d.id],
                p = potentialEstimate(save, d);
              return (
                <tr key={d.id}>
                  <td>
                    <b>{d.name}</b>
                    <PersonPortrait
                      personId={d.id}
                      name={d.name}
                      size={40}
                      fictional={save.world.people[d.id].provenance === 'PROCEDURAL'}
                    />
                    <small className="block">
                      {d.age} anos ·{' '}
                      {m.provenance === 'PROCEDURAL' ? 'Gerado pelo simulador' : 'Cadastro inicial'}
                    </small>
                  </td>
                  <td>
                    {teamById[d.teamId]?.name ?? 'Livre'}
                    <small className="block">
                      {statusNames[m.status]} · {m.category}
                    </small>
                  </td>
                  <td>
                    {d.rating} / {p.low.toFixed(0)}–{p.high.toFixed(0)}
                    <small className="block">Observação {m.scouting}%</small>
                  </td>
                  <td>
                    {m.licensePoints}/{save.world.league.licenseThreshold}
                  </td>
                  <td>
                    <button
                      className="button secondary"
                      disabled={!canManage(save) || m.scouting >= 100}
                      onClick={() => update((s) => scoutDriver(s, d.id))}
                    >
                      Observar · $0,25M
                    </button>
                    {d.teamId === save.managedTeam && m.status === 'RESERVE' && (
                      <button
                        className="button secondary"
                        disabled={
                          !canManage(save) ||
                          !!save.weekends.find((w) => w.round === save.round)?.results.TL1
                        }
                        onClick={() => {
                          update((s) => assignRookie(s, d.id));
                          notify('Reserva programado para o próximo TL1.');
                        }}
                      >
                        {save.world.rookieAssignments[d.teamId] === d.id
                          ? 'TL1 programado'
                          : 'Escalar no TL1'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="panel padded">
        <h2>Programa da equipe</h2>
        <p>
          TL1 com rookies: {save.world.organizations[save.managedTeam].rookieRuns}/
          {save.world.league.rookiePracticeTarget}. Contrate reservas e agentes livres na{' '}
          <Link href="/silly-season">mesa de negociações</Link>.
        </p>
      </section>
      <section className="panel padded">
        <h2>Categorias de acesso</h2>
        <p>
          A <Link href="/f2">F2 tem seu campeonato próprio</Link>, com Sprint, prova principal e pontuação por fim de semana. <Link href="/f3">A F3 também tem campeonato próprio</Link>. Super Formula, IndyCar, Formula E e WEC ainda têm resultados anuais simplificados. Todas alimentam a superlicença.
        </p>
        {save.world.feederHistory.slice(-6).map((h) => (
          <details key={h.season + h.category}>
            <summary>
              {h.season} · {h.category}
            </summary>
            {h.standings.slice(0, 10).map((r) => (
              <p key={r.id}>
                {r.position}. {allDrivers(save).find((d) => d.id === r.id)?.name} · {r.points}{' '}
                pontos
              </p>
            ))}
          </details>
        ))}
      </section>
    </>
  );
}

export function NegotiationsPage() {
  const { save, update, notify } = useSave();
  const [kind, setKind] = useState<'driver' | 'engineer'>('driver'),
    [target, setTarget] = useState(''),
    [replace, setReplace] = useState(''),
    [salary, setSalary] = useState(8),
    [years, setYears] = useState(2),
    [future, setFuture] = useState(true),
    [role, setRole] = useState<Role>('EQUAL STATUS'),
    [promise, setPromise] = useState<PromiseKind>('igualdade'),
    [bonus, setBonus] = useState(0.08),
    [titleBonus, setTitleBonus] = useState(0.2),
    [clause, setClause] = useState(0);
  const people = kind === 'driver' ? allDrivers(save) : allEngineers(save),
    own = (kind === 'driver' ? save.game.drivers : save.game.engineers).filter(
      (p) => p.teamId === save.managedTeam,
    ),
    available = people.filter((p) => !own.some((d) => d.id === p.id));
  const id = available.some((p) => p.id === target) ? target : available[0]?.id,
    replaceId = own.some((p) => p.id === replace) ? replace : own[0]?.id;
  const contract = save.game.contracts.find((c) => c.personId === id);
  function propose() {
    if (!contract || !id || !replaceId) return;
    const n = negotiate(save, {
      personId: id,
      replaceId,
      teamId: save.managedTeam,
      kind,
      salary,
      years,
      start: save.season + (future ? 1 : 0),
      terms: {
        ...initialTerms(contract, save.season),
        start: save.season + (future ? 1 : 0),
        role,
        performanceBonus: bonus,
        championshipBonus: titleBonus,
        releaseBelow: clause,
        promises: [{ kind: promise, status: 'pending' }],
      },
    });
    update(() => n);
    notify(
      n === save
        ? 'Operação indisponível. Confira os termos e o cargo.'
        : n.world.negotiations[0].response,
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="MERCADO & CONTRATOS"
        title="Construa o próximo elenco."
        subtitle="Propostas, contrapropostas e vínculos futuros preservam os resultados já disputados."
      />
      <UniverseLinks />
      <section className="panel padded">
        <SectionHead title="Mesa de negociações" />
        <div className="career-controls">
          <label>
            Categoria
            <select
              aria-label="Negociar categoria"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="driver">Piloto</option>
              <option value="engineer">Engenheiro</option>
            </select>
          </label>
          <label>
            Talento
            <select
              aria-label="Negociar talento"
              value={id ?? ''}
              onChange={(e) => setTarget(e.target.value)}
            >
              {available.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ·{' '}
                  {d.teamId === 'free'
                    ? 'Livre'
                    : save.game.teams.find((t) => t.id === d.teamId)?.short}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assento
            <select
              aria-label="Assento negociado"
              value={replaceId ?? ''}
              onChange={(e) => setReplace(e.target.value)}
            >
              {own.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Salário US$M
            <input
              aria-label="Salário negociado"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
            />
          </label>
          <label>
            Temporadas
            <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <label>
            Início
            <select
              aria-label="Início do contrato"
              value={future ? 'future' : 'now'}
              onChange={(e) => setFuture(e.target.value === 'future')}
            >
              <option value="future">Próxima temporada</option>
              <option value="now">Imediato, entre GPs</option>
            </select>
          </label>
          <label>
            Papel
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {[
                'FRANCHISE DRIVER',
                'NUMBER ONE',
                'EQUAL STATUS',
                'NUMBER TWO',
                'PROSPECT',
                'RESERVE',
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Promessa
            <select value={promise} onChange={(e) => setPromise(e.target.value as PromiseKind)}>
              {[
                'igualdade',
                'prioridade',
                'carro competitivo',
                'investimento',
                'liberdade esportiva',
              ].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Bônus desempenho (fração)
            <input
              type="number"
              min="0"
              max="2"
              step=".01"
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value))}
            />
          </label>
          <label>
            Bônus título (fração)
            <input
              type="number"
              min="0"
              max="2"
              step=".01"
              value={titleBonus}
              onChange={(e) => setTitleBonus(Number(e.target.value))}
            />
          </label>
          <label>
            Liberar abaixo de P (0 desliga)
            <input
              type="number"
              min="0"
              max="16"
              value={clause}
              onChange={(e) => setClause(Number(e.target.value))}
            />
          </label>
        </div>
        <p>
          Vínculo atual até {contract?.until} · salário ${contract?.salary.toFixed(1)}M · multa $
          {contract?.buyout.toFixed(1)}M. A assinatura cobra a multa aplicável e 15% do salário como
          taxa.
        </p>
        <button className="button primary" disabled={!canManage(save)} onClick={propose}>
          Enviar proposta
        </button>
        {!canManage(save) && (
          <p>Negociações disponíveis para um CEO empregado, fora de uma sessão ativa.</p>
        )}
      </section>
      <section className="panel padded">
        <SectionHead title="Respostas & acordos" />
        {save.world.negotiations
          .filter((n) => n.teamId === save.managedTeam)
          .slice(0, 20)
          .map((n) => (
            <article className="universe-entry" key={n.id}>
              <Badge>{n.status}</Badge>
              <PersonPortrait
                personId={n.personId}
                size={56}
                fictional={n.kind === 'engineer' || n.personId.startsWith('junior-')}
              />
              <h3>
                {
                  [...allDrivers(save), ...allEngineers(save)].find((p) => p.id === n.personId)
                    ?.name
                }
              </h3>
              <p>{n.response}</p>
              <p>
                ${n.salary.toFixed(1)}M · {n.years} temporadas · início {n.start} · {n.terms.role}
              </p>
              {n.status === 'counter' && (
                <button
                  className="button secondary"
                  disabled={!canManage(save)}
                  onClick={() => update((s) => acceptCounter(s, n.id))}
                >
                  Aceitar contraproposta
                </button>
              )}
              {n.status === 'accepted' && (
                <button
                  className="button primary"
                  disabled={!canManage(save)}
                  onClick={() => {
                    const next = signNegotiation(save, n.id);
                    update(() => next);
                    notify(
                      next === save
                        ? 'Assinatura indisponível: saldo, assento reservado ou fim de semana em curso.'
                        : 'Contrato assinado.',
                    );
                  }}
                >
                  Assinar contrato
                </button>
              )}
            </article>
          ))}
        {!save.world.negotiations.some((n) => n.teamId === save.managedTeam) && (
          <p>Envie uma proposta para receber a avaliação do talento.</p>
        )}
      </section>
      <section className="panel padded">
        <h2>Movimentações confirmadas</h2>
        {save.world.transfers
          .slice(-20)
          .reverse()
          .map((t) => (
            <p key={t.id}>
              {t.season} / GP{t.round} ·{' '}
              {[...allDrivers(save), ...allEngineers(save)].find((p) => p.id === t.personId)?.name}{' '}
              · {t.from} → {t.to} · {t.detail}
            </p>
          ))}
      </section>
    </>
  );
}

export function OrganizationPage() {
  const { save, update } = useSave(),
    { teamById } = useUniverse();
  const o = save.world.organizations[save.managedTeam],
    era = save.world.regulations.find((e) => e.id === save.world.activeEra)!;
  return (
    <>
      <PageTitle
        eyebrow="DIRETORIA & OPERAÇÕES"
        title={teamById[save.managedTeam].name}
        subtitle="Você é o CEO contratado. O proprietário avalia objetivos, resultados e confiança."
      />
      <UniverseLinks />
      <div className="two-col">
        <section className="panel padded">
          <h2>{save.world.ceo.employed ? 'Mandato em andamento' : 'Contrato encerrado'}</h2>
          <RatingBar label={boardStatus(o.confidence)} value={o.confidence} />
          {o.targets.map((g) => (
            <p key={g.level}>
              {g.level}: {g.metric} · {g.target}
            </p>
          ))}
          {Object.entries(o.owner).map(([k, v]) => (
            <RatingBar key={k} label={k} value={v} />
          ))}
          {save.world.ceo.offers
            .filter((x) => x.status === 'pending')
            .map((f) => (
              <p key={f.teamId}>
                <button
                  className="button primary"
                  onClick={() => update((s) => acceptCEOOffer(s, f.teamId))}
                >
                  Assumir {teamById[f.teamId].name} · ${f.salary.toFixed(1)}M
                </button>
              </p>
            ))}
        </section>
        <section className="panel padded">
          <h2>Reputação do CEO</h2>
          {Object.entries(save.world.ceo.reputation).map(([k, v]) => (
            <RatingBar key={k} label={k} value={v} />
          ))}
          <p>Pressão da mídia: {save.world.ceo.mediaPressure.toFixed(0)}%</p>
          <h3>{era.name}</h3>
          <p>{era.description}</p>
        </section>
      </div>
      <div className="two-col">
        <section className="panel padded">
          <h2>Financeiro · US$ milhões</h2>
          <p>
            Caixa: <b>${save.game.finances[save.managedTeam].cash.toFixed(2)}M</b>
          </p>
          <RatingBar
            label={`Teto operacional: ${o.accounts.capSpent.toFixed(1)} / ${era.costCap}M`}
            value={(o.accounts.capSpent / era.costCap) * 100}
          />
          {Object.entries(o.accounts).map(([k, v]) => (
            <p key={k}>
              {k}: ${v.toFixed(2)}M
            </p>
          ))}
          <p>
            Salários de pilotos e engenheiros, multas contratuais e bônus são contabilizados fora do
            teto operacional. Teto de fabricantes e peso mínimo permanecem sem valor definido.
          </p>
        </section>
        <section className="panel padded">
          <h2>Preparação técnica</h2>
          <label>
            Pesquisa para a próxima era: {o.researchAllocation}%
            <input
              aria-label="Pesquisa futura"
              type="range"
              min="0"
              max="100"
              disabled={!canManage(save)}
              value={o.researchAllocation}
              onChange={(e) => update((s) => researchAllocation(s, Number(e.target.value)))}
            />
          </label>
          <p>
            Pesquisa acumulada: ${o.futureResearch.toFixed(2)}M. A alocação afeta os novos projetos
            e reduz seu ganho imediato.
          </p>
          {save.world.regulations
            .filter((e) => e.effective > save.season)
            .map((e) => (
              <p key={e.id}>
                <b>{e.name}</b> · vigência {e.effective}
              </p>
            ))}
          <p>
            Equipe de boxes {o.crew.rotation} · fadiga {o.crew.fatigue.toFixed(0)}%
          </p>
          <button
            className="button secondary"
            disabled={!canManage(save)}
            onClick={() => update(rotateCrew)}
          >
            Rotacionar equipe · $0,3M
          </button>
          <button
            className="button secondary"
            disabled={!canManage(save) || o.privateTests >= 3}
            onClick={() => update(privateTest)}
          >
            Teste privado · $2M ({o.privateTests}/3)
          </button>
          <p>Limite de testes provisório: 3 por ano.</p>
        </section>
      </div>
      <section className="panel padded">
        <h2>Componentes</h2>
        <p>
          Alocação provisória: {save.world.league.componentAllocation} unidades por componente;
          extras custam {save.world.league.extraComponentGridPenalty} posições no grid.
        </p>
        {save.game.drivers
          .filter((d) => d.teamId === save.managedTeam)
          .map((d) => (
            <article className="universe-entry" key={d.id}>
              <h3>{d.name}</h3>
              <p>{save.world.components[d.id].km.toFixed(0)} km acumulados</p>
              <div className="career-controls">
                {(['engine', 'turbo', 'battery', 'gearbox'] as const).map((p) => (
                  <button
                    key={p}
                    className="button secondary"
                    disabled={!canManage(save)}
                    onClick={() => update((s) => replaceComponent(s, d.id, p))}
                  >
                    {p} · unidade {save.world.components[d.id][p]} · trocar
                  </button>
                ))}
              </div>
            </article>
          ))}
      </section>
      <section className="panel padded">
        <h2>Contratos dos circuitos</h2>
        <p>
          Os {save.game.circuits.length} GPs do calendário são preservados. Renovações são registradas; substituições de
          circuitos ainda não são simuladas.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Circuito</th>
                <th>Até</th>
                <th>Taxa</th>
                <th>Popularidade</th>
                <th>Segurança</th>
              </tr>
            </thead>
            <tbody>
              {save.game.circuits.map((c) => {
                const x = save.world.circuitContracts[c.id];
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{x.end}</td>
                    <td>${x.fee}M</td>
                    <td>{x.popularity}</td>
                    <td>{x.safety}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function OffseasonPage() {
  const { save, update } = useSave(),
    o = save.world.offseason;
  return (
    <>
      <PageTitle
        eyebrow="TRANSIÇÃO DE TEMPORADA"
        title={`Preparar ${save.season + 1}.`}
        subtitle="O fechamento registra a temporada antes das movimentações de mercado."
      />
      <UniverseLinks />
      {save.game.phase !== 'postseason' ? (
        <section className="panel padded">
          <h2>A temporada ainda está em andamento.</h2>
          <p>Conclua os {save.game.circuits.length} Grandes Prêmios para iniciar o mercado de fim de ano.</p>
          <Link className="button primary" href="/fim-de-semana">
            Continuar temporada
          </Link>
        </section>
      ) : (
        <section className="panel padded">
          <ol className="offseason-steps">
            {offseasonSteps.map((label, i) => (
              <li key={label} aria-current={i === (o?.step ?? 0) ? 'step' : undefined}>
                <b>{label}</b> ·{' '}
                {i < (o?.step ?? 0)
                  ? 'Concluído'
                  : i === (o?.step ?? 0)
                    ? 'Etapa atual'
                    : 'Pendente'}
              </li>
            ))}
          </ol>
          <p>
            Contratos futuros aguardando ativação: {save.world.pending.length}. Promessas são
            avaliadas pelos resultados e pelas decisões da temporada.
          </p>
          {(o?.step ?? 0) < 8 ? (
            <button className="button primary" onClick={() => update(advanceOffseason)}>
              Concluir etapa: {offseasonSteps[o?.step ?? 0]}
            </button>
          ) : (
            <button className="button primary" onClick={() => update(prepareNextSeason)}>
              Iniciar temporada {save.season + 1}
            </button>
          )}
          <Link className="button secondary" href="/silly-season">
            Revisar mercado
          </Link>
        </section>
      )}
    </>
  );
}

export function InboxPage() {
  const { save, update } = useSave();
  return (
    <>
      <PageTitle
        eyebrow="PADDOCK / CAIXA DE ENTRADA"
        title="Decisões e acontecimentos."
        subtitle={`${save.world.inbox.filter((m) => !m.read).length} mensagens não lidas`}
      />
      <UniverseLinks />
      {!save.world.inbox.length && (
        <section className="panel padded">
          <p>As primeiras mensagens chegam durante os treinos, GPs e movimentações de mercado.</p>
        </section>
      )}
      {save.world.inbox.slice(0, 100).map((m) => (
        <article className="panel padded universe-entry" key={m.id}>
          <Badge>{m.type}</Badge>
          <small>
            {' '}
            {m.season} · GP{m.round} · {m.read ? 'Lida' : 'Nova'}
          </small>
          <h2>{m.title}</h2>
          <p>{m.body}</p>
          <Link
            className="button secondary"
            href={m.href}
            onClick={() => update((s) => readMessage(s, m.id))}
          >
            Abrir assunto
          </Link>
          {!m.read && (
            <button
              className="button secondary"
              onClick={() => update((s) => readMessage(s, m.id))}
            >
              Marcar como lida
            </button>
          )}
        </article>
      ))}
    </>
  );
}

export function UniverseSettings() {
  const { save, update } = useSave(),
    s = save.world.settings;
  return (
    <section className="panel padded">
      <SectionHead title="Assistência & acessibilidade" />
      <div className="career-controls">
        <label>
          Assistência
          <select
            aria-label="Nível de assistência"
            value={s.difficulty}
            onChange={(e) =>
              update((n) => settings(n, { difficulty: e.target.value as typeof s.difficulty }))
            }
          >
            {['Casual', 'Standard', 'Simulation'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Tamanho do texto: {s.fontSize}%
          <input
            aria-label="Tamanho do texto"
            type="range"
            min="85"
            max="140"
            value={s.fontSize}
            onChange={(e) => update((n) => settings(n, { fontSize: Number(e.target.value) }))}
          />
        </label>
        {(
          [
            ['autoPit', 'Estratégia automática de boxes'],
            ['autoTyre', 'Pneu inicial adequado ao clima'],
            ['highContrast', 'Alto contraste'],
            ['colorblind', 'Cores acessíveis'],
            ['spectator', 'Espectador: IA controla todo o grid'],
          ] as const
        ).map(([k, label]) => (
          <label key={k}>
            <input
              type="checkbox"
              checked={s[k]}
              onChange={(e) => update((n) => settings(n, { [k]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
      </div>
      <p>
        Os níveis mudam a assistência ao jogador. A física e os atributos da IA são os mesmos.
        Idioma atual: PT-BR.
      </p>
      <button
        className="button secondary"
        onClick={() =>
          downloadData(`diagnostico-${save.season}-gp${save.round}.json`, {
            format: 'F1_UNIVERSE_BUG_V4',
            save,
            events: save.race?.events ?? [],
            userAgent: navigator.userAgent,
          })
        }
      >
        Exportar diagnóstico completo
      </button>
    </section>
  );
}

export function AdvancedSetup() {
  const { save, update } = useSave();
  const c = save.game.circuits[Math.min(save.round, save.game.circuits.length) - 1];
  const ids = controlledIds(save);
  function set(id: string, p: Partial<Decision>) {
    if (save.race?.status === 'RUNNING') return;
    update((s) => {
      const n = cloneState(s);
      Object.assign(n.game.decisions[id], p);
      return n;
    });
  }
  return (
    <section className="panel padded">
      <SectionHead title="Programa de treino & acerto fino" />
      {ids.map((id) => {
        const d = save.game.drivers.find((d) => d.id === id)!;
        const dec = save.game.decisions[id],
          preview = performance(save, d, c, save.game.weather, dec, newTyres(dec.compound), 0.45);
        return (
          <details key={id}>
            <summary>
              {d.name} · adequação do acerto {setupQuality(c, dec).toFixed(0)}%
            </summary>
            <div className="career-controls">
              <label>
                Programa
                <select
                  value={dec.practiceFocus ?? 'Long Run'}
                  onChange={(e) =>
                    set(id, { practiceFocus: e.target.value as Decision['practiceFocus'] })
                  }
                >
                  {['Long Run', 'Qualifying', 'Tyres', 'Battery', 'Aero', 'Setup', 'Rookie'].map(
                    (p) => (
                      <option key={p}>{p}</option>
                    ),
                  )}
                </select>
              </label>
              {(
                [
                  ['frontWing', 'Asa dianteira', c.aero],
                  ['rearWing', 'Asa traseira', c.aero],
                  ['rideHeight', 'Altura', 50],
                  ['differential', 'Diferencial', c.traction],
                  ['brakeMigration', 'Migração de freio', c.braking],
                  ['cooling', 'Refrigeração', c.temperature * 2],
                ] as const
              ).map(([key, label, base]) => (
                <label key={key}>
                  {label}: {(dec[key] ?? base).toFixed(0)}
                  <input
                    aria-label={`${label} ${d.name}`}
                    type="range"
                    min="0"
                    max="100"
                    value={dec[key] ?? base}
                    disabled={save.race?.status === 'RUNNING'}
                    onChange={(e) => set(id, { [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
            <p>
              Prévia de engenharia, sem tráfego: {preview.lap.toFixed(3)} s. Carro{' '}
              {preview.layers.car.toFixed(2)} s · adaptação {preview.layers.adaptation.toFixed(2)} s
              · acerto {preview.layers.setup.toFixed(2)} s. Valores são contribuições ao tempo de
              referência do circuito.
            </p>
          </details>
        );
      })}
    </section>
  );
}
