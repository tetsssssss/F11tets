import { notFound } from 'next/navigation';
import NewGamePage from '../../features/new-game';
import {
  HistoryPage,
  AcademyPage,
  NegotiationsPage,
  OrganizationPage,
  OffseasonPage,
  InboxPage,
} from '../../features/universe';
import QuickRacePage from '../../features/quick-race';
import FormulaTwoPage from '../../features/formula-two';
import FormulaThreePage from '../../features/formula-three';
import DriverSeatsPage from '../../features/driver-seats';
import DevPage from '../../features/dev';
import DevRace2D from '../../features/dev-race-2d';
import BabylonLab from '../../features/babylon-lab';
import { CareerSettingsPage } from '../../features/career-hub';
import Home from '../../features/home';
import { Directory, DriverProfile, TeamProfile, EngineerProfile } from '../../features/profiles';
import {
  Standings,
  Rankings,
  CalendarPage,
  SeasonPage,
  RegulationsPage,
} from '../../features/competition';
import { DevelopmentPage, MarketPage } from '../../features/development';
import WeekendPage from '../../features/weekend';
import SettingsPage from '../../features/settings';
import { drivers } from '../../data/drivers';
import { teams } from '../../data/teams';
import { engineers } from '../../data/engineers';
export default async function Page({ params }: { params: Promise<{ route?: string[] }> }) {
  const { route = [] } = await params;
  const [page, id] = route;
  if (route.length > 2) notFound();
  if (id) {
    if (
      page === 'dev' &&
      id === 'race-2d' &&
      (process.env.NODE_ENV !== 'production' || process.env.F1_ENABLE_DEV === '1')
    )
      return <DevRace2D />;
    if (page === 'pilotos' && (drivers.some((d) => d.id === id) || /^junior-\d{4}-\d+$/.test(id)))
      return <DriverProfile key={id} id={id} />;
    if (page === 'equipes' && teams.some((t) => t.id === id))
      return <TeamProfile key={id} id={id} />;
    if (page === 'engenheiros' && engineers.some((e) => e.id === id))
      return <EngineerProfile key={id} id={id} />;
    notFound();
  }
  switch (page) {
    case 'historia':
      return <HistoryPage />;
    case 'academias':
      return <AcademyPage />;
    case 'f2':
      return <FormulaTwoPage />;
    case 'f3':
      return <FormulaThreePage />;
    case 'substituicoes':
      return <DriverSeatsPage />;
    case 'silly-season':
      return <NegotiationsPage />;
    case 'organizacao':
      return <OrganizationPage />;
    case 'off-season':
      return <OffseasonPage />;
    case 'caixa-de-entrada':
      return <InboxPage />;
    case 'laboratorio-babylon':
      return <BabylonLab />;
    case 'corrida-rapida':
      return <QuickRacePage />;
    case undefined:
      return <Home />;
    case 'novo-jogo':
      return <NewGamePage />;
    case 'dev':
      return <DevPage />;
    case 'pilotos':
    case 'equipes':
    case 'engenheiros':
      return <Directory key={page} type={page} />;
    case 'construtores':
      return <Standings key={page} constructors />;
    case 'classificacao':
      return <Standings key={page} />;
    case 'estatisticas':
      return <Rankings />;
    case 'calendario':
      return <CalendarPage />;
    case 'temporada':
      return <SeasonPage />;
    case 'regulamento':
      return <RegulationsPage />;
    case 'desenvolvimento':
      return <DevelopmentPage />;
    case 'mercado':
      return <MarketPage />;
    case 'fim-de-semana':
      return <WeekendPage />;
    case 'carreira':
      return <CareerSettingsPage />;
    case 'configuracoes':
      return <SettingsPage />;
    default:
      notFound();
  }
}
