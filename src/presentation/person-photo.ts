import manifest from '../data/photo-manifest.json';
export type PhotoStatus =
  'verified' | 'usable' | 'missing' | 'incorrect' | 'fictional-generated' | 'needs-review';
/** Square head box inside the packaged photo, as fractions of its side. Framing only. */
export type FaceBox = { x: number; y: number; size: number };
export type Photo = {
  card?: string;
  master?: string;
  masterSize?: number;
  face?: FaceBox;
  sourceUrl?: string;
  status: PhotoStatus;
  name?: string;
};
export const CARD_PX = 512;
/**
 * Smallest packaged file that still covers the screen. `devicePx` is how many device pixels
 * the whole square photo spans, so a face crop asks for more than its visible box.
 */
export function pickPhotoSrc(photo: Photo, devicePx: number, preferMaster = false) {
  if (!photo.master || !photo.card) return photo.card ?? photo.master;
  return devicePx > (preferMaster ? CARD_PX / 2 : CARD_PX) ? photo.master : photo.card;
}
/** Identity is publisher metadata, never a resemblance/face-recognition match. */
export function resolvePersonPhoto(personId: string, fictional = false): Photo {
  const entry = (manifest as Record<string, Photo>)[personId];
  if (entry && ['verified', 'usable'].includes(entry.status)) return entry;
  if (fictional) return { status: 'fictional-generated', card: fictionalPortrait(personId) };
  return { status: 'missing', card: '/assets/people/placeholder.svg' };
}
export function fictionalPortrait(id: string) {
  let h = 0;
  for (const c of id) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  const skin = ['#ca9273', '#edbb95', '#976444', '#b77f5c'][h % 4],
    hair = ['#262122', '#593927', '#3c3028', '#967348'][h % 4],
    shirt = `hsl(${h % 360},35%,37%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#1b2835"/><circle cx="128" cy="108" r="83" fill="#263b49"/><path d="M30 256Q30 190 106 187H150Q226 190 226 256" fill="${shirt}"/><path d="M110 163V199Q128 216 146 199V163" fill="${skin}"/><ellipse cx="128" cy="114" rx="53" ry="70" fill="${skin}"/><path d="M75 103Q59 38 121 30Q194 23 182 106L166 66Q139 88 91 70Z" fill="${hair}"/><path d="M95 112h18m31 0h18" stroke="${hair}" stroke-width="5"/><circle cx="105" cy="120" r="4"/><circle cx="153" cy="120" r="4"/><path d="M129 123l-5 22h11M109 158q20 14 40 0" fill="none" stroke="#724c3e" stroke-width="3"/><text x="128" y="242" text-anchor="middle" fill="white" font-size="11">PERSONAGEM FICTÍCIO</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
