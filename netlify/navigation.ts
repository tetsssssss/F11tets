import { useSyncExternalStore } from 'react';
const subscribe = (fn: () => void) => {
  window.addEventListener('popstate', fn);
  return () => window.removeEventListener('popstate', fn);
};
export function navigate(href: string, replace = false) {
  history[replace ? 'replaceState' : 'pushState']({}, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
export function usePathname() {
  return useSyncExternalStore(
    subscribe,
    () => location.pathname,
    () => '/',
  );
}
export function useSearchParams() {
  const search = useSyncExternalStore(
    subscribe,
    () => location.search,
    () => '',
  );
  return new URLSearchParams(search);
}
export function useRouter() {
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, true),
    back: () => history.back(),
    refresh: () => location.reload(),
  };
}
export function notFound(): never {
  throw new Error('F1_ROUTE_NOT_FOUND');
}
