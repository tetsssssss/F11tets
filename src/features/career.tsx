'use client';
import { PersonPortrait } from '../components/person-portrait';
import { changeSupplier } from '../domain/universe/operations';
import { allDrivers, allEngineers } from '../domain/universe/world';
import { useState } from 'react';
import { useSave, useUniverse } from '../components/save-provider';
import { SectionHead, Badge } from '../components/ui';
import {
  exerciseOption,
  answerInterview,
  contractQuote,
  signContract,
  prepareNextSeason,
  upgradeInfrastructure,
  transact,
} from '../domain/simulation/management';
import { cloneState } from '../domain/simulation/world';
import { controlledIds, acceptOffer } from '../domain/gameplay/career';
import { nextSession } from '../domain/simulation';
import type { Decision } from '../domain/simulation/types';
export function RacePlan() {
  const { save, update, ready } = useSave();
  const { drivers } = useUniverse();
  const own = drivers.filter((d) => controlledIds(save).includes(d.id));
  const [selected, setSelected] = useState('');
  if (!own.length)
    return (
      <section className="panel padded">
        <h2>Acompanhar a sessão</h2>
        <p>
          {save.world.settings.spectator
            ? 'Modo espectador: a IA comanda os carros.'
            : 'Você está sem assento ou cargo ativo. Consulte as propostas na Organização ou no Mercado.'}
        </p>
      </section>
    );
  const id = own.some((d) => d.id === selected) ? selected : own[0].id;
  const d = save.game.decisions[id],
    s = save.game.setups[id];
  const editable = ready && !!nextSession(save) && save.race?.status !== 'RUNNING';
  function change(key: keyof Decision, value: Decision[keyof Decision]) {
    update((old) => {
      const n = cloneState(old);
      n.game.decisions[id] = { ...n.game.decisions[id], [key]: value };
      return n;
    });
  }
  return (
    <section className="panel padded career-panel">
      <SectionHead title="Plano de pista" sub="SUAS DECISÕES · PRÓXIMA SESSÃO" />
      <div className="career-controls">
        <label>
          Piloto
          <select
            aria-label="Piloto do plano"
            value={id}
            onChange={(e) => setSelected(e.target.value)}
          >
            {own.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ['suspension', 'Suspensão', ['Macia', 'Equilibrada', 'Rígida']],
            ['brakes', 'Freios', ['Conservadora', 'Equilibrada', 'Agressiva']],
            ['compound', 'Pneu', ['H', 'M', 'S', 'I', 'W']],
            ['engineMap', 'Mapa V8', ['Economy', 'Race', 'Quali']],
            ['energy', 'Energia', ['Save', 'Race', 'Attack', 'Boost', 'Overtake']],
            ['aero', 'Aerodinâmica', ['Corner', 'Flow', 'Straight', 'Follow']],
            ['pace', 'Ritmo', ['Conservar', 'Equilibrado', 'Atacar']],
          ] as const
        ).map(([key, label, values]) => (
          <label key={key}>
            {label}
            <select
              aria-label={label}
              disabled={!editable}
              value={d[key] ?? 'Equilibrada'}
              onChange={(e) => change(key, e.target.value as Decision[typeof key])}
            >
              {values.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Regeneração
          <select
            aria-label="Regeneração"
            disabled={!editable}
            value={d.regen}
            onChange={(e) => change('regen', Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Asa · {d.wing.toFixed(0)}
          <input
            aria-label="Asa"
            type="range"
            min="0"
            max="100"
            disabled={!editable}
            value={d.wing}
            onChange={(e) => change('wing', Number(e.target.value))}
          />
        </label>
        <label>
          Balanço · {d.balance.toFixed(0)}
          <input
            aria-label="Balanço"
            type="range"
            min="0"
            max="100"
            disabled={!editable}
            value={d.balance}
            onChange={(e) => change('balance', Number(e.target.value))}
          />
        </label>
        <label>
          Volta do pit · 0 = automático
          <input
            aria-label="Volta do pit"
            type="number"
            min="0"
            max={save.game.circuits[Math.min(save.round, save.game.circuits.length) - 1].laps - 1}
            disabled={!editable}
            value={d.pitLap}
            onChange={(e) => change('pitLap', Math.max(0, Math.min(100, Number(e.target.value))))}
          />
        </label>
        <label className="career-check">
          <input
            type="checkbox"
            disabled={!editable}
            checked={d.orders}
            onChange={(e) => change('orders', e.target.checked)}
          />{' '}
          Permitir ordens de equipe
        </label>
      </div>
      <div className="career-footer">
        <p>
          Confiança {s.confidence.toFixed(0)}% · Pneus {s.tyreUnderstanding.toFixed(0)}% · Bateria{' '}
          {s.batteryUnderstanding.toFixed(0)}% · {s.setsUsed} jogos usados
        </p>
        <button
          className="button secondary"
          disabled={!editable || s.setsUsed === 0}
          onClick={() =>
            update((old) => {
              const n = cloneState(old);
              n.game.decisions[id].wing = s.learnedWing;
              n.game.decisions[id].balance = s.learnedBalance;
              return n;
            })
          }
        >
          Aplicar aprendizado dos treinos
        </button>
      </div>
      <p className="micro">
        O plano vale para a próxima sessão. Boxes reagem também à chuva, dano e desgaste crítico.
        Treinos revelam o acerto aos poucos.
      </p>
    </section>
  );
}
export function Postseason() {
  const { save, update } = useSave();
  const { driverById, teamById } = useUniverse();
  if (save.game.phase !== 'postseason') return null;
  return (
    <section className="panel padded career-champion">
      <Badge tone="amber-tag">CAMPEÕES · {save.season}</Badge>
      <h2>{driverById[save.game.champion!].name}</h2>
      <p>{teamById[save.game.constructorChampion!].name} · Mundial de construtores</p>
      <p>
        {save.game.circuits.length} GPs concluídos. Premiações pagas. Ao avançar, resultados ficam no arquivo e pilotos
        evoluem para o novo ano.
      </p>
      <button className="button primary" onClick={() => update(prepareNextSeason)}>
        Preparar temporada {save.season + 1}
      </button>
    </section>
  );
}
export function CareerRole() {
  const { save, update } = useSave(),
    { teamById, driverById } = useUniverse();
  const b = save.career.board;
  return (
    <section className="panel padded career-role">
      <span className="eyebrow">
        {save.career.mode === 'driver' ? 'GRAND PRIX PILOTO' : 'GRAND PRIX CONSTRUTOR'}
      </span>
      {save.career.mode === 'constructor' ? (
        <>
          <h2>CEO / Team Principal contratado</h2>
          <p>
            Conselho: <b>{b.status}</b> · Confiança <b>{b.confidence.toFixed(0)}%</b>
          </p>
          <p>
            Metas anuais: P{b.target} nos construtores · {b.wins} vitórias · {b.podiums} pódios.
            Resultados de cada GP atualizam a confiança.
          </p>
        </>
      ) : (
        <>
          <h2>
            {driverById[save.career.driverId!]?.name} · {teamById[save.managedTeam].name}
          </h2>
          <p>
            Seu contrato acompanha a carreira. Propostas de outras equipes chegam no fim da
            temporada.
          </p>
          {save.career.offers.map((o) => (
            <article className="offer-card" key={o.id}>
              <h3>{teamById[o.teamId].name}</h3>
              <p>
                ${o.salary.toFixed(1)}M / ano · {o.years} anos · {o.status}
              </p>
              {o.status === 'pending' && (
                <div className="button-row">
                  <button
                    className="button primary"
                    onClick={() => update((s) => acceptOffer(s, o.id, true))}
                  >
                    Aceitar proposta
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => update((s) => acceptOffer(s, o.id, false))}
                  >
                    Recusar proposta
                  </button>
                </div>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
export function CareerOffice() {
  const { save, update } = useSave();
  const { teamById, driverById } = useUniverse();
  const g = save.game,
    f = g.finances[save.managedTeam];
  const interviews = g.interviews.filter(
    (i) => !i.answered && driverById[i.driverId].teamId === save.managedTeam,
  );
  return (
    <div className="career-office">
      <Postseason />
      <CareerRole />
      <section className="panel padded">
        <SectionHead
          title={`Operação · ${teamById[save.managedTeam].name}`}
          sub={`GESTÃO DA CARREIRA · ${save.season}`}
        />
        <div className="season-metrics">
          <div>
            <small>CAIXA</small>
            <strong>
              ${f.cash.toFixed(1)}
              <span>M</span>
            </strong>
          </div>
          <div>
            <small>DESPESAS ACUMULADAS</small>
            <strong>
              ${f.expenses.toFixed(1)}
              <span>M</span>
            </strong>
          </div>
          <div>
            <small>ATR</small>
            <strong>{g.atr[save.managedTeam]}%</strong>
          </div>
          <div>
            <small>INFRAESTRUTURA</small>
            <strong>{teamById[save.managedTeam].infrastructure.toFixed(0)}</strong>
          </div>
        </div>
        <button
          className="button secondary"
          disabled={
            save.career.mode === 'driver' ||
            save.race?.status === 'RUNNING' ||
            f.cash < 8 ||
            teamById[save.managedTeam].infrastructure >= 99
          }
          onClick={() => update(upgradeInfrastructure)}
        >
          Ampliar engenharia · $8M
        </button>
        <details className="career-ledger">
          <summary>Extrato financeiro · {f.ledger.length} lançamentos</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ETAPA</th>
                  <th>LANÇAMENTO</th>
                  <th>US$ M</th>
                </tr>
              </thead>
              <tbody>
                {f.ledger
                  .slice(-40)
                  .reverse()
                  .map((l, i) => (
                    <tr key={i}>
                      <td>
                        {l.season} / {l.round}
                      </td>
                      <td>
                        {l.detail} · {l.category}
                      </td>
                      <td className={l.amount > 0 ? 'green' : ''}>{l.amount.toFixed(3)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      {interviews.slice(-2).map((i) => (
        <section key={i.id} className="panel padded">
          <SectionHead
            title={`${driverById[i.driverId].name}, como você avalia a sessão?`}
            sub="COLETIVA DE IMPRENSA"
          />
          <p>Sua resposta altera moral, reputação e relações com o paddock.</p>
          <div className="career-actions">
            {(
              [
                ['team', 'Valorizar a equipe'],
                ['self', 'Assumir responsabilidade'],
                ['rival', 'Criticar os rivais'],
              ] as const
            ).map(([a, label]) => (
              <button
                key={a}
                className="button secondary"
                onClick={() => update((s) => answerInterview(s, i.id, a))}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      ))}
      {g.history.length > 0 && (
        <section className="panel padded">
          <SectionHead title="Arquivo da carreira" sub="TEMPORADAS CONCLUÍDAS" />
          {g.history.map((a) => (
            <details key={a.season} className="career-ledger">
              <summary>
                {a.season} · {driverById[a.driverChampion].name} / {teamById[a.teamChampion].name}
              </summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>PILOTO</th>
                      <th>PONTOS</th>
                      <th>VITÓRIAS</th>
                      <th>PÓDIOS</th>
                      <th>POLES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(a.points)
                      .sort((a, b) => b[1] - a[1])
                      .map(([id, pts]) => (
                        <tr key={id}>
                          <td>{driverById[id].name}</td>
                          <td>{pts}</td>
                          <td>{a.stats[id].wins}</td>
                          <td>{a.stats[id].podiums}</td>
                          <td>{a.stats[id].poles}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
export function ContractMarket() {
  const { save, update, notify, ready } = useSave();
  const { drivers, engineers, teamById } = useUniverse();
  const [kind, setKind] = useState<'driver' | 'engineer'>('driver');
  const [target, setTarget] = useState('');
  const [replace, setReplace] = useState('');
  const [salary, setSalary] = useState(12);
  const [years, setYears] = useState(2);
  const people = kind === 'driver' ? drivers : engineers;
  const own = people.filter((p) => p.teamId === save.managedTeam),
    available = people.filter((p) => p.teamId !== save.managedTeam);
  const id = available.some((p) => p.id === target) ? target : available[0].id;
  const replacement = own.some((p) => p.id === replace) ? replace : own[0].id;
  const quote = contractQuote(save, id, kind, salary);
  const contract = save.game.contracts.find((c) => c.personId === id)!;
  if (save.career.mode === 'driver') return <CareerRole />;
  return (
    <section className="panel padded career-panel">
      <SectionHead title="Mercado de talentos" sub="CONTRATOS · PILOTOS E ENGENHEIROS" />
      <PersonPortrait
        personId={id}
        name={people.find((p) => p.id === id)?.name}
        size={100}
        fictional={kind === 'engineer' || id.startsWith('junior-')}
      />
      <p>
        Negocie uma troca imediata entre equipes. A aceitação considera salário, prestígio,
        potencial, idade, relações, reputação e necessidade esportiva.
      </p>
      <div className="career-controls">
        <label>
          Categoria
          <select
            aria-label="Categoria do contrato"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="driver">Piloto</option>
            <option value="engineer">Engenheiro</option>
          </select>
        </label>
        <label>
          Alvo
          <select
            aria-label="Alvo do contrato"
            value={id}
            onChange={(e) => setTarget(e.target.value)}
          >
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {teamById[p.teamId].name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Oferecer em troca
          <select
            aria-label="Substituir"
            value={replacement}
            onChange={(e) => setReplace(e.target.value)}
          >
            {own.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Salário anual · US$ M
          <input
            aria-label="Salário proposto"
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value))}
          />
        </label>
        <label>
          Anos
          <select
            aria-label="Duração do contrato"
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <p>
        Contrato atual até {contract.until} · salário ${contract.salary.toFixed(1)}M · multa $
        {contract.buyout.toFixed(1)}M. Custo imediato da proposta: ${quote.cost.toFixed(2)}M.
        Aceitação estimada: {quote.chance}%.
      </p>
      <button
        className="button primary"
        disabled={
          !ready ||
          save.race?.status === 'RUNNING' ||
          salary <= 0 ||
          salary > 100 ||
          save.game.finances[save.managedTeam].cash < quote.cost
        }
        onClick={() => {
          const next = signContract(save, id, replacement, kind, years, salary);
          update(() => next);
          notify(
            next === save
              ? 'Proposta recusada. Ajuste os termos ou procure outro alvo.'
              : 'Contrato assinado. Duplas, salários e adaptação atualizados.',
          );
        }}
      >
        Enviar proposta
      </button>
      <p className="micro">
        Repetir os mesmos termos na mesma etapa mantém a resposta. Pontos anteriores continuam com a
        equipe que os conquistou.
      </p>
    </section>
  );
}
export function SupplierContracts() {
  const { save, update, notify } = useSave();
  const { teamById, batteries, tires } = useUniverse();
  const t = teamById[save.managedTeam];
  function setSupplier(kind: 'battery' | 'tires', value: string) {
    const n = changeSupplier(save, kind === 'tires' ? 'tyres' : 'battery', value);
    update(() => n);
    notify(
      n === save
        ? 'Contrato vigente, capacidade preenchida ou operação indisponível.'
        : 'Fornecedor contratado. Custo de adaptação: $2M.',
    );
  }
  return (
    <section className="panel padded career-panel">
      <SectionHead title="Fornecedores da sua garagem" sub="CONTRATOS TÉCNICOS" />
      <div className="career-controls">
        {(
          [
            ['battery', 'Bateria', batteries],
            ['tires', 'Pneus', tires],
          ] as const
        ).map(([key, label, list]) => (
          <label key={key}>
            {label} · troca $2M
            <select
              aria-label={`Fornecedor de ${label}`}
              disabled={
                save.career.mode === 'driver' ||
                save.race?.status === 'RUNNING' ||
                save.game.finances[t.id].cash < 2 ||
                !save.world.ceo.employed ||
                (key === 'tires' && save.world.organizations[t.id].tyreContract.end >= save.season)
              }
              value={t[key] ?? ''}
              onChange={(e) => setSupplier(key, e.target.value)}
            >
              {list.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p>
        Motor {t.engine} · projeto V8 próprio da equipe. Os fornecedores escolhidos entram no
        cálculo de desgaste, aquecimento e energia.
      </p>
      <p>
        Pneus contratados até {save.world.organizations[t.id].tyreContract.end}. Novos contratos:
        mínimo 3 anos, máximo 4 equipes. A distribuição herdada de 2029 tem 5 equipes Michelin e
        será ajustada no vencimento.
      </p>
    </section>
  );
}

export function ActiveContracts() {
  const { save, update } = useSave();
  const { drivers, engineers } = useUniverse();
  const people = [...allDrivers(save), ...allEngineers(save)];
  return (
    <section className="panel padded career-panel">
      <SectionHead title="Contratos da equipe" sub="VIGÊNCIA · OPÇÕES · CLÁUSULAS" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>TALENTO</th>
              <th>VIGÊNCIA</th>
              <th>SALÁRIO / MULTA · US$ M</th>
              <th>CLÁUSULA</th>
              <th>OPÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {save.game.contracts
              .filter((c) => c.teamId === save.managedTeam)
              .map((c) => (
                <tr key={c.id}>
                  <td>
                    {people.find((p) => p.id === c.personId)?.name}
                    <PersonPortrait
                      personId={c.personId}
                      name={people.find((p) => p.id === c.personId)?.name}
                      size={38}
                      fictional={c.kind === 'engineer' || c.personId.startsWith('junior-')}
                    />
                    <small>
                      {' '}
                      · {c.kind === 'driver' ? 'Piloto' : 'Engenheiro'} / {c.status}
                    </small>
                  </td>
                  <td>{c.until}</td>
                  <td>
                    {c.salary.toFixed(1)} / {c.buyout.toFixed(1)}
                  </td>
                  <td>
                    {c.kind === 'driver'
                      ? c.performanceClause
                        ? 'Bônus de 8% ao atingir ' + c.performanceClause + ' pontos'
                        : 'Bônus pago'
                      : 'Contrato técnico'}
                  </td>
                  <td>
                    {c.option ? (
                      <button
                        className="button secondary"
                        disabled={
                          save.career.mode === 'driver' ||
                          save.race?.status === 'RUNNING' ||
                          c.until > save.season + 1 ||
                          save.game.finances[c.teamId].cash < c.salary * 0.2
                        }
                        onClick={() => update((s) => exerciseOption(s, c.id))}
                      >
                        Renovar +1 ano · taxa 20%
                      </button>
                    ) : (
                      'Sem opção'
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="micro">
        A opção fica disponível no último ano do vínculo. Contratos vencidos são renovados
        automaticamente no início do ano para preservar o grid desta versão.
      </p>
    </section>
  );
}
