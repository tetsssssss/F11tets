import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '../src/app/globals.css';
import { SaveProvider } from '../src/components/save-provider';
import { Shell } from '../src/components/shell';
import Page from '../src/app/[[...route]]/page';
import NotFound from '../src/app/not-found';
import { usePathname } from './navigation';
function StaticApp() {
  const pathname = usePathname(),
    [page, setPage] = useState<ReactNode>(null);
  useEffect(() => {
    let current = true;
    Page({ params: Promise.resolve({ route: pathname.split('/').filter(Boolean) }) })
      .then((result) => {
        if (current) setPage(result);
      })
      .catch((error) => {
        if (current)
          setPage(
            error.message === 'F1_ROUTE_NOT_FOUND' ? (
              <NotFound />
            ) : (
              <p>Falha ao abrir a página: {String(error)}</p>
            ),
          );
      });
    return () => {
      current = false;
    };
  }, [pathname]);
  return (
    <SaveProvider>
      <Shell>{page}</Shell>
    </SaveProvider>
  );
}
createRoot(document.getElementById('root')!).render(<StaticApp />);
