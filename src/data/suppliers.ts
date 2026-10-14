import { makeRatings } from './attributes';
import { teams } from './teams';
export const engines = teams.map((t, i) => ({
  id: `engine-${t.id}`,
  name: t.engine,
  architecture: 'V8 híbrido',
  independent: true,
  attributes: makeRatings(
    ['Potência', 'Eficiência', 'Confiabilidade', 'Integração elétrica'],
    t.rating,
    i,
  ),
}));
export const tires = [
  {
    name: 'Pirelli',
    color: '#ffcc4c',
    strength: 'Aquecimento / agressividade',
    values: [94, 80, 77, 83],
  },
  { name: 'Bridgestone', color: '#ef7777', strength: 'Estabilidade', values: [83, 95, 88, 86] },
  { name: 'Michelin', color: '#83a9ff', strength: 'Durabilidade', values: [80, 87, 96, 85] },
  { name: 'Continental', color: '#e9ad5f', strength: 'Janela térmica', values: [87, 85, 84, 96] },
];
export const compounds = [
  { id: 'H', name: 'Hard', color: '#e3e6ec' },
  { id: 'M', name: 'Medium', color: '#edcb61' },
  { id: 'S', name: 'Soft', color: '#ed5e62' },
  { id: 'I', name: 'Chuva fraca', color: '#73bc97' },
  { id: 'W', name: 'Chuva forte', color: '#69aaf5' },
];
export const batteries = [
  'Panasonic Energy',
  'CATL',
  'LG Energy Solution',
  'Samsung SDI',
  'SK On',
].map((name, i) => ({
  id: `battery-${i}`,
  name,
  attributes: makeRatings(
    [
      'Densidade energética',
      'Potência de descarga',
      'Regeneração',
      'Eficiência',
      'Peso',
      'Gestão térmica',
      'Durabilidade',
      'Confiabilidade',
    ],
    87,
    i,
  ),
}));
