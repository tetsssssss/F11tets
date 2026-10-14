'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import type { Save, Team } from '../domain/types';
import { allDrivers } from '../domain/universe/world';
import { createSave, parseSave, SAVE_KEY } from '../domain/save';
import {
  readStoredSave,
  writeStoredSave,
  preserveRejectedSave,
  readActiveSlot,
  readSlot,
  readSlots,
  readSnapshots,
  type SlotSummary,
} from '../domain/persistence';
import { powerScore as score } from '../domain/selectors';
import { SaveWriter } from '../domain/save-writer';
import { orderedStartupSlots, allowLegacyCareer } from '../domain/startup-slots';
import { news as editorialNews } from '../data/editorial';
type Store = {
  save: Save;
  update: (fn: (s: Save) => Save) => void;
  ready: boolean;
  slot: number;
  slots: SlotSummary[];
  saving: boolean;
  switchSlot: (id: number) => Promise<void>;
  createSlot: (save: Save, id: number) => Promise<void>;
  restoreSave: (save: Save) => Promise<boolean>;
  notice: string;
  notify: (message: string) => void;
};
const Context = createContext<Store | null>(null);
export function SaveProvider({
  children,
  initialSave,
  ephemeral = false,
}: {
  children: ReactNode;
  initialSave?: Save;
  ephemeral?: boolean;
}) {
  const [save, setSave] = useState(() => initialSave ?? createSave());
  const [ready, setReady] = useState(ephemeral);
  const [notice, notify] = useState('');
  const [slot, setSlot] = useState(1);
  const [slots, setSlots] = useState<SlotSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const writable = useRef(false);
  const writer = useRef<SaveWriter<Save> | null>(null);
  if (!writer.current) writer.current = new SaveWriter<Save>(
    async (value, slot) => {
      await writeStoredSave(value, slot);
      try { setSlots(await readSlots()); } catch { /* The career is already saved; metadata is an optional display cache. */ }
    },
    setSaving,
    (error) => notify(`Falha ao gravar (${error instanceof Error ? error.message : String(error)}). Exporte um backup em Configurações.`),
  );
  useEffect(() => {
    if (ephemeral) return;
    let mounted = true;
    (async () => {
      try {
        const activeSlot = await readActiveSlot();
        const summaries = await readSlots();
        const rawSlots = await Promise.all([1, 2, 3].map((id) => readSlot(id)));
        if (!mounted) return;
        setSlots(summaries);
        const records = summaries.map((meta) => ({
          slot: meta.slot,
          raw: rawSlots[meta.slot - 1],
          exists: meta.exists,
          updated: meta.updated,
        }));
        let recovered = false;
        for (const candidate of orderedStartupSlots(activeSlot, records)) {
          if (!mounted) return;
          const parsed = candidate.raw ? parseSave(candidate.raw) : null;
          if (parsed) {
            setSlot(candidate.slot);
            setSave(parsed);
            writable.current = true;
            recovered = true;
            if (candidate.slot !== activeSlot)
              notify(`Slot ${activeSlot} indisponível. Carreira recuperada do slot ${candidate.slot}.`);
            break;
          }
          if (candidate.raw) {
            try { await preserveRejectedSave(candidate.raw); }
            catch { notify(`O backup do slot ${candidate.slot} falhou. Exporte qualquer cópia existente antes de continuar.`); }
          }
          const snapshot = (await readSnapshots(candidate.slot))
            .map((entry) => parseSave(entry.raw)).find(Boolean);
          if (snapshot) {
            setSave(snapshot);
            setSlot(candidate.slot);
            writable.current = true;
            recovered = true;
            notify(`Carreira do slot ${candidate.slot} recuperada de um snapshot válido.`);
            break;
          }
        }
        // Legacy `active` and localStorage keys are a migration path only.
        // An empty slot must never inherit another slot's most recent save.
        if (!recovered && allowLegacyCareer(records)) {
          const raw = (await readStoredSave()) ?? localStorage.getItem(SAVE_KEY);
          if (raw) {
            const parsed = parseSave(raw);
            if (parsed) {
              setSlot(1);
              setSave(parsed);
              writable.current = true;
              recovered = true;
              notify('Carreira antiga migrada para o slot 1.');
            } else await preserveRejectedSave(raw);
          }
        }
        if (!recovered) {
          setSlot(activeSlot);
          if (allowLegacyCareer(records)) writable.current = true;
          else notify('Nenhum slot pôde ser recuperado. Os dados antigos foram preservados. Importe um backup ou inicie um novo jogo.');
        }
      } catch {
        if (mounted) notify('Armazenamento indisponível. Exporte seu save em Configurações.');
      }
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (ephemeral || !ready || !writable.current) return;
    // At 16× speed we can receive many race ticks per second. Coalesce writes,
    // never coalesce a finish, a qualifying result, or a career-management action.
    writer.current!.schedule(save, slot, save.race?.status !== 'RUNNING');
  }, [save, slot, ready, ephemeral]);
  useEffect(() => {
    if (ephemeral) return;
    const flushHidden = () => {
      if (document.visibilityState === 'hidden') void writer.current?.flush();
    };
    const flushPage = () => { void writer.current?.flush(); };
    document.addEventListener('visibilitychange', flushHidden);
    window.addEventListener('pagehide', flushPage);
    return () => {
      document.removeEventListener('visibilitychange', flushHidden);
      window.removeEventListener('pagehide', flushPage);
      writer.current?.close();
    };
  }, [ephemeral]);
  async function switchSlot(id: number) {
    if (![1, 2, 3].includes(id)) return;
    try { await writer.current?.drain(); }
    catch { notify('A troca foi bloqueada: não foi possível salvar a carreira atual. Exporte um backup antes de continuar.'); return; }
    const raw = await readSlot(id);
    const parsed = raw ? parseSave(raw) : null;
    if (!parsed) {
      notify('Slot vazio ou inválido. Crie um novo jogo neste slot.');
      return;
    }
    writable.current = true;
    setSlot(id);
    setSave(parsed);
    setSlots(await readSlots());
  }
  async function createSlot(next: Save, id: number) {
    if (![1, 2, 3].includes(id)) return;
    try { await writer.current?.drain(); }
    catch { notify('Não foi possível criar o slot: a carreira anterior ainda não foi gravada.'); return; }
    try { await writeStoredSave(next, id); }
    catch (error) { notify(`Falha ao criar novo slot: ${error instanceof Error ? error.message : String(error)}`); return; }
    writable.current = true;
    setSlot(id);
    setSave(next);
    setSlots(await readSlots());
  }
  async function restoreSave(next: Save): Promise<boolean> {
    // Import and snapshot recovery are replacements, not ordinary UI edits.
    // Make the previous state durable first and persist the replacement before
    // displaying a success notification or changing the active career.
    try {
      await writer.current?.drain();
      if (!ephemeral) await writeStoredSave(next, slot);
      writable.current = true;
      setSave(next);
      if (!ephemeral) {
        try { setSlots(await readSlots()); }
        catch { /* The save itself succeeded; slot cards can refresh later. */ }
      }
      return true;
    } catch (error) {
      notify(`Restauração bloqueada: ${error instanceof Error ? error.message : String(error)}. A carreira atual foi mantida.`);
      return false;
    }
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => notify(''), 8500);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <Context.Provider
      value={{
        save,
        slot,
        slots,
        saving,
        switchSlot,
        createSlot,
        restoreSave,
        update: (fn) => {
          writable.current = true;
          setSave(fn);
        },
        ready,
        notice,
        notify,
      }}
    >
      <div
        className={[
          save.preferences.reducedMotion ? 'reduce-motion' : '',
          save.preferences.compact ? 'compact' : '',
          save.world.settings.highContrast ? 'high-contrast' : '',
          save.world.settings.colorblind ? 'accessible-colors' : '',
        ].join(' ')}
        style={{ zoom: save.world.settings.fontSize / 100 }}
      >
        {children}
      </div>
    </Context.Provider>
  );
}
export function useSave() {
  const value = useContext(Context);
  if (!value) throw new Error('SaveProvider ausente');
  return value;
}
export function useUniverse() {
  const { save } = useSave();
  return useMemo(() => {
    const g = save.game;
    const powerScore = (team: Team) => score(team, g);
    return {
      ...g,
      tires: g.tyres,
      driverById: Object.fromEntries(allDrivers(save).map((d) => [d.id, d])),
      teamById: Object.fromEntries(g.teams.map((t) => [t.id, t])),
      powerScore,
      powerRankings: [...g.teams].sort((a, b) => powerScore(b).power - powerScore(a).power),
      technicalRankings: [...g.teams].sort((a, b) => b.rating - a.rating),
      recentChampions: g.champions.map((c) => ({
        year: c.season,
        driver: c.driver,
        team: c.team,
        color: '#eac16b',
      })),
      news: g.news.length
        ? g.news.slice(0, 24).map((n) => ({
            ...n,
            category: n.category.toUpperCase() + ' • ' + n.season + ' / GP' + n.round,
            lead: n.body,
            href: '/temporada',
            color: '#75cec2',
          }))
        : editorialNews,
    };
  }, [save]);
}
