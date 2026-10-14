import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { navigate } from './navigation';
const Link = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; scroll?: boolean }
>(function Link({ href, onClick, prefetch, scroll, ...props }, ref) {
  return (
    <a
      {...props}
      ref={ref}
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.ctrlKey ||
          e.metaKey ||
          e.shiftKey ||
          e.altKey ||
          props.target === '_blank' ||
          props.download
        )
          return;
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) return;
        e.preventDefault();
        navigate(url.pathname + url.search + url.hash);
        if (url.hash)
          requestAnimationFrame(() => document.getElementById(url.hash.slice(1))?.scrollIntoView());
      }}
    />
  );
});
export default Link;
