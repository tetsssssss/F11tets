'use client';
import { useUniverse } from './save-provider';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  CalendarDays,
  Flag,
  Users,
  CarFront,
  Trophy,
  Headphones,
  Wrench,
  ArrowLeftRight,
  ChartNoAxesCombined,
  BookOpen,
  Settings2,
  Menu,
  X,
  ChevronRight,
  ArrowUpRight,
  Check,
  Globe2,
  Layers,
} from 'lucide-react';
import { useSave } from './save-provider';

import { completedRaces } from '../domain/selectors';
export const navigation = [
  { href: '/', label: 'Central da temporada', short: 'Home', icon: House, group: 'UNIVERSO' },
  { href: '/temporada', label: 'Temporada', icon: Globe2 },
  { href: '/caixa-de-entrada', label: 'Caixa de entrada', icon: BookOpen },
  { href: '/fim-de-semana', label: 'Fim de semana', icon: Flag },
  { href: '/pilotos', label: 'Pilotos', icon: Users, group: 'PADDOCK' },
  { href: '/equipes', label: 'Equipes', icon: CarFront },
  { href: '/construtores', label: 'Construtores', icon: Layers },
  { href: '/engenheiros', label: 'Engenheiros', icon: Headphones },
  { href: '/desenvolvimento', label: 'Pesquisa & desenvolvimento', short: 'P&D', icon: Wrench },
  { href: '/mercado', label: 'Mercado', icon: ArrowLeftRight },
  { href: '/silly-season', label: 'Negociações', icon: ArrowLeftRight },
  { href: '/academias', label: 'Academias & reservas', icon: Users },
  { href: '/f2', label: 'Fórmula 2', short: 'F2', icon: Trophy },
  { href: '/f3', label: 'Fórmula 3', short: 'F3', icon: Trophy },
  { href: '/substituicoes', label: 'Gestão de assentos F1', short: 'Assentos', icon: ArrowLeftRight },
  { href: '/organizacao', label: 'Organização', icon: Wrench },
  { href: '/classificacao', label: 'Classificação', icon: Trophy, group: 'COMPETIÇÃO' },
  { href: '/calendario', label: 'Calendário', icon: CalendarDays },
  { href: '/estatisticas', label: 'Estatísticas', icon: ChartNoAxesCombined },
  { href: '/regulamento', label: 'Regulamento', icon: BookOpen },
  { href: '/historia', label: 'História & recordes', icon: Trophy },
  { href: '/off-season', label: 'Entre temporadas', icon: CalendarDays },
  { href: '/corrida-rapida', label: 'Corrida rápida', icon: Flag },
  { href: '/laboratorio-babylon', label: 'Laboratório Babylon 2D/3D', short: 'Babylon Lab', icon: Layers },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const { teamById } = useUniverse();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const drawer = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const sync = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () =>
      Array.from(drawer.current?.querySelectorAll<HTMLElement>('a, button') ?? []).filter(
        (el) => el.offsetParent !== null,
      );
    controls()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === 'Tab') {
        const elements = controls();
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown);
      menuButton.current?.focus();
    };
  }, [open, mobile]);
  const { save, ready, notice, notify } = useSave();
  const team = teamById[save.managedTeam];
  const current =
    navigation.find((n) => n.href !== '/' && path.startsWith(n.href)) ?? navigation[0];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Pular para conteúdo
      </a>
      {open && (
        <button
          aria-label="Fechar menu"
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={drawer}
        id="main-navigation"
        inert={mobile && !open}
        className={`sidebar ${open ? 'open' : ''}`}
      >
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-emblem">
            F<span>1</span>
          </span>
          <div>
            UNIVERSE<small>THE NEXT CHAPTER</small>
          </div>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Fechar navegação"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <div className="season-selector">
          <span className="season-square">{String(save.season).slice(-2)}</span>
          <div>
            <strong>Temporada {save.season}</strong>
            <small>
              <span className="status-dot" /> Nova era
            </small>
          </div>
          <ChevronRight size={14} />
        </div>
        <nav aria-label="Menu principal">
          {navigation.map((n) => (
            <div key={n.href}>
              {n.group && <div className="nav-group">{n.group}</div>}
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={
                  path === n.href || (n.href !== '/' && path.startsWith(n.href))
                    ? 'page'
                    : undefined
                }
                className={`nav-item ${path === n.href || (n.href !== '/' && path.startsWith(n.href)) ? 'active' : ''}`}
              >
                <n.icon size={17} strokeWidth={1.6} />
                <span>{n.short === 'P&D' ? 'P&D' : n.label}</span>
                {n.href === '/fim-de-semana' && <span className="nav-live" />}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            href="/configuracoes"
            onClick={() => setOpen(false)}
            className={`nav-item ${path === '/configuracoes' ? 'active' : ''}`}
          >
            <Settings2 size={17} />
            Configurações
          </Link>
          <Link
            href={`/equipes/${team.id}`}
            className="manager-card"
            onClick={() => setOpen(false)}
          >
            <span className="manager-icon" style={{ color: team.color }}>
              {team.short}
            </span>
            <div>
              <strong>{team.name}</strong>
              <small>
                Sua garagem <ArrowUpRight size={11} />
              </small>
            </div>
          </Link>
          <span className="build-version">
            UNIVERSE MARCO 61000 <span>LOCAL SAVE</span>
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              ref={menuButton}
              className="mobile-menu icon-button"
              aria-label="Abrir navegação"
              aria-expanded={open}
              aria-controls="main-navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="top-brand">F1 UNIVERSE</span>
            <ChevronRight size={12} />
            <span>
              {path === '/configuracoes' ? 'Configurações' : (current.short ?? current.label)}
            </span>
          </div>
          <div className="topbar-right">
            <span className="save-status">
              <span className="status-dot" />
              {!ready
                ? 'CARREGANDO'
                : save.race?.status === 'RUNNING'
                  ? 'CORRIDA AO VIVO'
                  : save.weekends.length === 0
                    ? 'PRÉ-TEMPORADA'
                    : save.round > 35
                      ? 'TEMPORADA ENCERRADA'
                      : 'TEMPORADA EM CURSO'}
            </span>
            <span className="top-date">
              {save.season} <span className="muted">/</span> GP{' '}
              {String(Math.min(35, save.round)).padStart(2, '0')}
            </span>
            <span className="profile-initials">TM</span>
          </div>
        </header>
        <main id="main" className="main-content">
          {children}
        </main>
        <nav className="mobile-quick-nav" aria-label="Atalhos de navegação para celular">
          {[
            { href: '/', label: 'Início', icon: House },
            { href: '/fim-de-semana', label: 'GP', icon: Flag },
            { href: '/corrida-rapida', label: 'Corrida', icon: CarFront },
            { href: '/laboratorio-babylon', label: 'Gráficos', icon: Layers },
          ].map(item => (
            <Link key={item.href} href={item.href}
              aria-current={path === item.href ? 'page' : undefined}
              className={path === item.href ? 'active' : ''}>
              <item.icon size={20} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          ))}
          <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu completo">
            <Menu size={20} strokeWidth={1.8}/><span>Menu</span>
          </button>
        </nav>
        <footer className="app-footer">
          <span>
            F1 UNIVERSE <b>2029</b>
          </span>
          <span>Universo fictício independente · Protótipo jogável</span>
          <span>
            <span className="status-dot" /> {ready ? 'Save local ativo' : 'Carregando save'}
          </span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            onClick={() => notify('')}
            aria-label="Dispensar mensagem"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
