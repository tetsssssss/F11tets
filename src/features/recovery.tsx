'use client';
import { useEffect, useState } from 'react';
import { useSave } from '../components/save-provider';
import { readSnapshots, type SaveSnapshot } from '../domain/persistence';
import { parseSave } from '../domain/save';
import { downloadData } from './universe';
export default function Recovery() {
  const { slot, restoreSave, notify } = useSave(),
    [copies, setCopies] = useState<SaveSnapshot[]>([]);
  useEffect(() => {
    readSnapshots(slot)
      .then(setCopies)
      .catch(() => notify('Não foi possível ler os snapshots.'));
  }, [slot, notify]);
  return (
    <section className="panel padded">
      <h2>Recuperação · slot {slot}</h2>
      <p>
        Três snapshots rotativos, criados por mudança de sessão, etapa de preparação ou a cada cinco
        voltas. A restauração valida o arquivo antes de trocar o estado ativo.
      </p>
      <button className="button secondary" onClick={() => readSnapshots(slot).then(setCopies)}>
        Atualizar snapshots
      </button>
      {copies.map((c) => (
        <div className="universe-entry" key={c.created}>
          <p>
            {c.label} · {new Date(c.created).toLocaleString('pt-BR')}
          </p>
          <button
            className="button secondary"
            onClick={async () => {
              const parsed = parseSave(c.raw);
              if (parsed) {
                if (await restoreSave(parsed)) notify('Snapshot restaurado e persistido.');
              } else notify('Snapshot inválido; estado ativo preservado.');
            }}
          >
            Restaurar snapshot
          </button>
          <button
            className="button secondary"
            onClick={() => downloadData(`snapshot-${c.created}.json`, JSON.parse(c.raw))}
          >
            Exportar snapshot
          </button>
        </div>
      ))}
    </section>
  );
}
