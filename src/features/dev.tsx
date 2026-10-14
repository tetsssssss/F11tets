'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSave } from '../components/save-provider';
import { PageTitle } from '../components/ui';
import { devAction } from '../domain/gameplay/dev';
export default function DevPage() {
  const { save, update } = useSave();
  const [id, setId] = useState(save.career.driverId ?? save.game.drivers[0].id);
  const [value, setValue] = useState(50);
  return (
    <>
      <PageTitle
        eyebrow="DEV / ALTERA O SAVE ATIVO"
        title="Direção de prova · laboratório"
        subtitle="Ferramentas de teste. Eventos forçados ficam marcados DEV na corrida."
      />
      <div className="panel padded">
        <p>
          Slot e carreira ativos ·{' '}
          {save.race
            ? save.race.session + ' / volta ' + save.race.lap
            : 'Nenhuma corrida em andamento'}
        </p>
        <div className="career-controls">
          <label>
            Piloto
            <select value={id} onChange={(e) => setId(e.target.value)}>
              {save.game.drivers.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor 0–100
            <input
              type="number"
              min="0"
              max="100"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="career-actions">
          {[
            ['rain', 'Forçar chuva / seco'],
            ['SC', 'Safety Car'],
            ['VSC', 'Virtual Safety Car'],
            ['DNF', 'Forçar DNF'],
            ['battery', 'Definir bateria'],
            ['tyre', 'Definir desgaste'],
            ['gap', 'Criar batalha de freada'],
            ['result', 'Forçar liderança e resultado'],
            ['finish', 'Concluir corrida'],
            ['skip', 'Pular sessão'],
          ].map(([action, label]) => (
            <button
              key={action}
              className="button secondary"
              disabled={action !== 'skip' && save.race?.status !== 'RUNNING'}
              onClick={() => update((s) => devAction(s, action, id, value))}
            >
              {label}
            </button>
          ))}
        </div>
        <p>
          <Link href="/fim-de-semana" className="button primary">
            Voltar para a pista
          </Link>
        </p>
      </div>
    </>
  );
}
