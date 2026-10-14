'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CARD_PX, resolvePersonPhoto } from '../presentation/person-photo';
type Props = {
  personId: string;
  name?: string;
  size?: number | string;
  shape?: 'rounded' | 'circle';
  showTeamAccent?: string;
  fictional?: boolean;
  eager?: boolean;
  /** `face` frames the head box from the manifest; `auto` does so for small avatars only. */
  focus?: 'auto' | 'face' | 'full';
  /** `master` skips the 512px card, for enlarged views. `auto` upgrades when the box needs it. */
  quality?: 'auto' | 'master';
};
export function PersonPortrait({
  personId,
  name = '',
  size = 64,
  shape = 'rounded',
  showTeamAccent,
  fictional = false,
  eager = false,
  focus = 'auto',
  quality = 'auto',
}: Props) {
  return (
    <PortraitImage
      key={personId}
      {...{ personId, name, size, shape, showTeamAccent, fictional, eager, focus, quality }}
    />
  );
}
function PortraitImage({
  personId,
  name,
  size,
  shape,
  showTeamAccent,
  fictional,
  eager,
  focus,
  quality,
}: Required<Omit<Props, 'showTeamAccent'>> & { showTeamAccent?: string }) {
  const photo = resolvePersonPhoto(personId, fictional),
    [bad, setBad] = useState<string[]>([]),
    [measured, setMeasured] = useState(false),
    box = useRef<HTMLSpanElement>(null),
    image = useRef<HTMLImageElement>(null);
  const wantsFace =
      focus === 'face' || (focus === 'auto' && typeof size === 'number' && size <= 72),
    zoom = wantsFace && photo.face ? 1 / photo.face.size : 1,
    hires = measured || quality === 'master';
  useEffect(() => {
    const el = box.current;
    if (hires || !photo.master || !el) return;
    // The card holds 512px: once the square spans more device pixels than that, use the master.
    const check = () => {
      if (el.clientWidth * zoom * (window.devicePixelRatio || 1) > CARD_PX) setMeasured(true);
    };
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hires, photo.master, zoom]);
  const src = [
    ...(hires ? [photo.master, photo.card] : [photo.card, photo.master]),
    '/assets/people/placeholder.svg',
  ].find((x) => x && !bad.includes(x));
  useEffect(() => {
    // A server-rendered image can fail before React attaches onError; catch that on mount.
    const el = image.current;
    if (src && el?.complete && el.naturalWidth === 0) setBad((list) => list.concat(src));
  }, [src]);
  const face = wantsFace && (src === photo.card || src === photo.master) ? photo.face : undefined;
  return (
    <span
      ref={box}
      className={`person-portrait ${shape}${face ? ' face' : ''}`}
      data-photo-status={photo.status}
      style={
        {
          width: size,
          height: size,
          '--portrait-accent': showTeamAccent || '#496078',
        } as CSSProperties
      }
      title={
        photo.status === 'fictional-generated' ? 'Retrato original de personagem fictício' : name
      }
    >
      {src ? (
        <img
          ref={image}
          src={src}
          alt={name || personId}
          width={512}
          height={512}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          style={
            face && {
              width: `${zoom * 100}%`,
              height: `${zoom * 100}%`,
              left: `${-face.x * zoom * 100}%`,
              top: `${-face.y * zoom * 100}%`,
            }
          }
          onError={() => setBad((list) => list.concat(src))}
        />
      ) : (
        <span aria-label={`Foto indisponível: ${name}`}>
          {name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')}
        </span>
      )}
    </span>
  );
}
