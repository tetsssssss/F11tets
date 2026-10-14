import type { Dynamic, Ratings } from '../domain/types';
export const driverGroups = {
  VELOCIDADE: ['Velocidade pura', 'Classificação', 'Ritmo de corrida', 'Largada'],
  CONTROLE: [
    'Frenagem',
    'Entrada de curva',
    'Meio de curva',
    'Saída de curva',
    'Controle do carro',
  ],
  CORRIDA: ['Chuva', 'Consistência', 'Concentração', 'Inteligência de corrida'],
  COMBATE: ['Ultrapassagem', 'Defesa', 'Agressividade'],
  TÉCNICA: ['Gestão de pneus', 'Gestão de energia', 'Adaptabilidade', 'Feedback técnico'],
};
export const teamGroups = {
  AERODINÂMICA: ['Aerodinâmica', 'Eficiência aerodinâmica', 'Curvas médias', 'Curvas rápidas'],
  MECÂNICA: ['Chassi', 'Suspensão', 'Tração', 'Frenagem', 'Curvas lentas'],
  POWERTRAIN: ['Velocidade de reta', 'Confiabilidade', 'Integração motor-chassi', 'Refrigeração'],
  PNEUS: ['Gestão de pneus', 'Aquecimento dos pneus'],
  OPERAÇÃO: ['Estratégia', 'Pit stops', 'Engenharia de pista', 'Operação geral'],
  DESENVOLVIMENTO: ['Desenvolvimento'],
};
export const driverDynamicLabels = [
  'Forma atual',
  'Confiança',
  'Moral',
  'Entrosamento com carro',
  'Entrosamento com motor',
  'Entrosamento com engenheiro',
  'Domínio dos ajustes',
  'Gestão de pressão',
  'Conhecimento da pista',
  'Momentum',
  'Condição física',
  'Estado mental competitivo',
];
export const teamDynamicLabels = [
  'Forma técnica',
  'Momentum',
  'Moral',
  'Confiança no projeto',
  'Compreensão do carro',
  'Correlação CFD/túnel/pista',
  'Integração motor',
  'Integração pneus',
  'Eficiência de upgrades',
  'Execução operacional atual',
  'Pressão interna',
  'Estabilidade técnica',
];
export const engineerLabels = [
  'Comunicação',
  'Leitura de corrida',
  'Acerto do carro',
  'Gestão estratégica',
  'Gestão de energia',
  'Análise de dados',
  'Gestão de pneus',
  'Reação sob pressão',
  'Conhecimento técnico',
  'Gestão do piloto',
];
export const engineerDynamicLabels = [
  'Entrosamento com piloto',
  'Confiança mútua',
  'Compreensão do carro atual',
  'Forma operacional',
  'Pressão',
  'Sincronia com equipe',
];
export const circuitLabels = [
  'Conhecimento da pista',
  'Adaptação ao layout',
  'Confiança nas curvas-chave',
  'Domínio das frenagens',
  'Uso de zebras',
  'Ritmo nos setores críticos',
  'Histórico',
  'Capacidade de ultrapassagem',
];
export const relationshipLabels = [
  'Respeito',
  'Confiança',
  'Rivalidade',
  'Cooperação',
  'Tensão',
  'Agressividade mútua',
  'Obediência à equipe',
  'Sensibilidade a resultados',
  'Memória de conflitos',
  'Proximidade competitiva',
];
// Editable, deterministic editorial fixtures. These are NOT measured athlete ratings.
export function makeRatings(labels: string[], base: number, seed: number): Ratings {
  return Object.fromEntries(
    labels.map((label, i) => [
      label,
      Math.min(99, Math.max(40, base + ((seed * 7 + i * 11) % 17) - 8)),
    ]),
  );
}
export function makeDynamics(labels: string[], base: number, seed: number): Dynamic[] {
  return labels.map((label, i) => ({
    label,
    value: Math.min(99, base + ((i * 3 + seed) % 11) - 5),
    trend: ((i + seed) % 9) - 4,
  }));
}
