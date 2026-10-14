'use client';
import { SaveSlots } from './new-game';
import { UniverseSettings } from './universe';
import Recovery from './recovery';
import { useUniverse } from '../components/save-provider';
import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, Check, Save as SaveIcon } from 'lucide-react';
import { useSave } from '../components/save-provider';
import { PageTitle, SectionHead, Badge } from '../components/ui';

import { createSave, parseSave } from '../domain/save';
import { exportUniverse } from '../domain/export';
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function SettingsPage() {
  const { teams, engineers, circuits, engines, batteries } = useUniverse();
  const { save, update, ready, notify, restoreSave } = useSave();
  const [reset, setReset] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <PageTitle
        eyebrow="PREFERENCES / LOCAL SAVE"
        title="Seu universo. Do seu jeito."
        subtitle="Progresso armazenado neste navegador. Exporte um arquivo para manter uma cópia."
      />
      <SaveSlots />
      <UniverseSettings />
      <Recovery />
      <div className="settings-layout">
        <section className="panel padded">
          <SectionHead title="Garagem & interface" sub="PREFERÊNCIAS" />
          <label className="setting-row">
            <div>
              <strong>Equipe em foco</strong>
              <p>Define sua garagem e o orçamento de referência de P&D.</p>
            </div>
            <select
              aria-label="Equipe em foco"
              value={save.managedTeam}
              disabled={!ready || save.career.started || save.race?.status === 'RUNNING'}
              onChange={(e) => {
                update((s) => ({ ...s, managedTeam: e.target.value }));
                notify('Garagem atualizada.');
              }}
            >
              {teams.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="setting-row">
            <div>
              <strong>Reduzir animações</strong>
              <p>Desativa transições decorativas.</p>
            </div>
            <input
              type="checkbox"
              className="switch"
              aria-label="Reduzir animações"
              checked={save.preferences.reducedMotion}
              onChange={(e) =>
                update((s) => ({
                  ...s,
                  preferences: { ...s.preferences, reducedMotion: e.target.checked },
                }))
              }
            />
          </label>
          <label className="setting-row">
            <div>
              <strong>Tabelas compactas</strong>
              <p>Mais informação por linha no desktop.</p>
            </div>
            <input
              className="switch"
              type="checkbox"
              aria-label="Tabelas compactas"
              checked={save.preferences.compact}
              onChange={(e) =>
                update((s) => ({
                  ...s,
                  preferences: { ...s.preferences, compact: e.target.checked },
                }))
              }
            />
          </label>
          <div className="setting-row">
            <div>
              <strong>Tema paddock</strong>
              <p>Grafite, carbono e cores próprias de cada equipe.</p>
            </div>
            <Badge>DARK MODE</Badge>
          </div>
        </section>
        <section className="panel padded">
          <SectionHead title="Central do save" sub={'TEMPORADA ' + save.season} />
          <div className="save-details">
            <SaveIcon size={30} />
            <div>
              <h3>{save.weekends.length ? 'Temporada em andamento' : 'Pré-temporada'}</h3>
              <p>
                GP {Math.min(save.round, circuits.length)} / {circuits.length} · Schema v{save.version} · IndexedDB · Seed {save.seed}
              </p>
            </div>
          </div>
          <label className="setting-row">
            <div>
              <strong>Histórico e telemetria</strong>
              <p>Completa: registra voltas para replay. Resumida: mantém classificação e incidentes, mas não registra quadros de voltas futuras. Dados já arquivados não são apagados.</p>
            </div>
            <select
              aria-label="Detalhamento da telemetria futura"
              value={save.world.settings.telemetry}
              disabled={!ready || save.race?.status === 'RUNNING'}
              onChange={(e) => update((s) => ({
                ...s,
                world: { ...s.world, settings: { ...s.world.settings, telemetry: e.target.value as 'full' | 'summary' } },
              }))}
            >
              <option value="full">Completa</option>
              <option value="summary">Resumida (menor save)</option>
            </select>
          </label>
          <p className="micro">Histórico: {save.game.history.length} temporada(s) arquivada(s). {save.weekends.length} GP(s) iniciados na temporada atual. Exporte backups regularmente.</p>
          <button
            className="button primary full"
            disabled={!ready}
            onClick={() => {
              download('f1-universe-save-' + save.season + '.json', save);
              notify('Download do save iniciado.');
            }}
          >
            <Download size={17} /> Exportar save
          </button>
          <button
            className="button secondary full"
            disabled={!ready}
            onClick={() => input.current?.click()}
          >
            <Upload size={17} /> Importar save
          </button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            aria-label="Arquivo de save"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 200_000_000) throw new Error('Arquivo grande demais');
                const parsed = parseSave(await file.text());
                if (!parsed) {
                  notify('Arquivo inválido. Seu save atual foi preservado.');
                  return;
                }
                if (await restoreSave(parsed)) notify('Save importado, validado e gravado no slot atual.');
              } catch {
                notify('Não foi possível importar o arquivo. Seu save foi preservado.');
              } finally {
                e.target.value = '';
              }
            }}
          />
          <button
            className="button secondary full"
            disabled={!ready}
            onClick={() => {
              download('f1-universe-2029.json', exportUniverse(save));
              notify('Universo exportado em JSON.');
            }}
          >
            <Download size={17} /> Exportar universo para integração
          </button>
          <p className="micro">
            Drivers, teams, engines, batteries, engineers, circuits, championship e regulamento.
          </p>
        </section>
      </div>
      <section className="panel padded reset-panel">
        <p>Fotos: <a href="/assets/people/PHOTO_SOURCES.json" target="_blank" rel="noreferrer">fontes, autoria, licenças e recortes dos 32 pilotos</a>. Uniformes fotografados pertencem à época da imagem; o grid alternativo de 2029 permanece o definido pelo projeto.</p>
        <div>
          <h3>Recomeçar a pré-temporada</h3>
          <p>
            Remove o progresso deste navegador e retorna todos os pontos a zero. Exporte seu save
            antes de reiniciar.
          </p>
        </div>
        {reset ? (
          <div className="reset-confirm">
            <strong>Apagar o progresso local?</strong>
            <button
              className="button primary"
              onClick={() => {
                update(() => createSave());
                setReset(false);
                notify('Nova pré-temporada criada. Todos os pontos estão zerados.');
              }}
            >
              Confirmar reinício
            </button>
            <button className="button secondary" onClick={() => setReset(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button className="button secondary" disabled={!ready} onClick={() => setReset(true)}>
            <RotateCcw size={16} /> Reiniciar save
          </button>
        )}
      </section>
    </>
  );
}
