'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSave, useUniverse } from '../components/save-provider';
import { createSave } from '../domain/save';
import { configureCareer } from '../domain/gameplay/career';
import type { CareerMode } from '../domain/gameplay/types';
import { PageTitle, SectionHead } from '../components/ui';
import { PersonPortrait } from '../components/person-portrait';
import { CareerSettingsEditor } from './career-hub';
import { defaultSettings } from '../domain/gameplay/settings';
export function GameModes() {
  const { save, saving, slot } = useSave();
  return (
    <section className="game-launch">
      <div className="mode-cards">
        <Link className="mode-card driver-mode" href="/novo-jogo?modo=piloto">
          <span>01 / SUA CARREIRA</span>
          <h2>
            GRAND PRIX
            <br />
            PILOTO
          </h2>
          <p>Um cockpit. Seu engenheiro. Suas decisões.</p>
          <b>Novo jogo →</b>
        </Link>
        <Link className="mode-card constructor-mode" href="/novo-jogo?modo=construtor">
          <span>02 / COMANDO DA EQUIPE</span>
          <h2>
            GRAND PRIX
            <br />
            CONSTRUTOR
          </h2>
          <p>Dois carros. Cinco comandos. Um objetivo.</p>
          <b>Novo jogo →</b>
        </Link>
      </div>
      <div className="continue-bar">
        <div>
          <strong>{save.career.started ? save.career.name : 'Explore a nova era'}</strong>
          <small>
            Slot {slot} · {save.season} · GP {Math.min(save.game.circuits.length, save.round)} ·{' '}
            {saving ? 'Salvando…' : 'Save local'}
          </small>
        </div>
        <Link
          className="button primary"
          href={save.race?.status === 'RUNNING' ? '/fim-de-semana' : '/temporada'}
        >
          CONTINUAR SAVE →
        </Link>
      </div>
    </section>
  );
}
function NewGameForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { createSlot, slots, ready } = useSave();
  const { drivers, teams } = useUniverse();
  const [mode, setMode] = useState<CareerMode>(
    params.get('modo') === 'piloto' ? 'driver' : 'constructor',
  );
  const [choice, setChoice] = useState('');
  const [slot, setSlot] = useState(2);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(2029);
  const [settings, setSettings] = useState(defaultSettings);
  const initial = createSave(seed);
  const list = mode === 'driver' ? initial.game.drivers : initial.game.teams;
  const selected = list.some((x) => x.id === choice) ? choice : list[0].id;
  const occupied = slots.find((s) => s.slot === slot)?.exists;
  async function start() {
    setBusy(true);
    try {
      await createSlot(configureCareer(createSave(seed), mode, selected, settings), slot);
      router.push('/temporada');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="NOVA ERA / 2029"
        title="Seu próximo capítulo."
        subtitle="Escolha quem você será no paddock."
      />
      <section className="panel padded">
        <SectionHead title="1. Escolha seu modo" />
        <div className="mode-toggle">
          <button
            className={'button ' + (mode === 'driver' ? 'primary' : 'secondary')}
            onClick={() => {
              setMode('driver');
              setChoice('');
            }}
          >
            Grand Prix Piloto
          </button>
          <button
            className={'button ' + (mode === 'constructor' ? 'primary' : 'secondary')}
            onClick={() => {
              setMode('constructor');
              setChoice('');
            }}
          >
            Grand Prix Construtor
          </button>
        </div>
        <div className="career-controls">
          <label>
            2. {mode === 'driver' ? 'Seu piloto' : 'Sua equipe'}
            <select
              aria-label="Escolha da carreira"
              value={selected}
              onChange={(e) => setChoice(e.target.value)}
            >
              {list.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            3. Slot de save
            <select
              aria-label="Slot do novo jogo"
              value={slot}
              onChange={(e) => {
                setSlot(Number(e.target.value));
                setOverwrite(false);
              }}
            >
              {[1, 2, 3].map((id) => (
                <option key={id} value={id}>
                  Slot {id} ·{' '}
                  {slots.find((s) => s.slot === id)?.exists
                    ? slots.find((s) => s.slot === id)!.name
                    : 'Vazio'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Seed
            <input
              aria-label="Seed da carreira"
              type="number"
              min="0"
              max="2147483647"
              value={seed}
              onChange={(e) =>
                setSeed(Math.max(0, Math.min(2147483647, Math.floor(Number(e.target.value)))))
              }
            />
          </label>
        </div>
        <p>
          {mode === 'driver'
            ? 'Você controla um piloto. Mudanças de equipe acontecem por propostas no fim da temporada.'
            : 'Você é o CEO / Team Principal contratado. Responde ao conselho e controla os dois carros.'}
        </p>
        <SectionHead title="4. Como você quer jogar" sub="TUDO PODE SER ALTERADO DEPOIS" />
        <CareerSettingsEditor compact value={settings} onChange={setSettings} />
        {occupied && (
          <label className="overwrite-choice">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />{' '}
            Substituir o save do slot {slot}
          </label>
        )}
        <button
          className="button primary"
          disabled={!ready || busy || (!!occupied && !overwrite)}
          onClick={start}
        >
          {busy ? 'Criando…' : 'INICIAR CARREIRA 2029'}
        </button>
      </section>
    </>
  );
}
export default function NewGamePage() {
  return (
    <Suspense fallback={<p>Preparando novo jogo…</p>}>
      <NewGameForm />
    </Suspense>
  );
}
export function SaveSlots() {
  const { slot, slots, switchSlot, saving, ready } = useSave();
  const { circuits } = useUniverse();
  return (
    <section className="panel padded slot-panel">
      <SectionHead title="Seus três saves" sub={saving ? 'SALVANDO…' : 'ARMAZENAMENTO LOCAL'} />
      <div className="save-slots">
        {[1, 2, 3].map((id) => {
          const row = slots.find((s) => s.slot === id);
          return (
            <article key={id} className={slot === id ? 'current' : ''}>
              <small>
                SLOT {id}
                {slot === id ? ' · ATIVO' : ''}
              </small>
              <div className="slot-identity">
                {row?.exists && row.personId && (
                  <PersonPortrait
                    personId={row.personId}
                    name={row.name}
                    size={56}
                    showTeamAccent={row.teamColor}
                    fictional={row.personId.startsWith('junior-')}
                  />
                )}
                <div>
                  <h3>{row?.exists ? row.name : 'Vazio'}</h3>
                  {row?.exists && row.team && <b style={{ color: row.teamColor }}>{row.team}</b>}
                </div>
              </div>
              <p>
                {row?.exists
                  ? row.season +
                    ' · GP ' +
                    Math.min(row.round, circuits.length) +
                    ' · ' +
                    (row.mode === 'driver' ? 'Piloto' : 'Construtor')
                  : 'Pronto para uma nova carreira'}
              </p>
              {row?.exists && row.position ? (
                <p className="slot-facts">
                  P{row.position} no campeonato · {row.points} pts
                  <br />
                  Último GP: {row.lastGp || '—'} · Próximo: {row.nextGp || '—'}
                  <br />
                  {row.preset}
                </p>
              ) : null}
              {row?.exists && slot === id ? (
                <Link className="button primary" href="/temporada">
                  CONTINUAR
                </Link>
              ) : row?.exists ? (
                <button
                  disabled={!ready || slot === id || saving}
                  className="button secondary"
                  onClick={() => switchSlot(id)}
                >
                  Carregar slot {id}
                </button>
              ) : (
                <Link className="button secondary" href="/novo-jogo">
                  Criar carreira
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
