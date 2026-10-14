import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="empty-state">
      <span className="eyebrow red">404 / FORA DO TRAÇADO</span>
      <h1>Esta página não está no grid.</h1>
      <p>Volte à central para continuar explorando o universo.</p>
      <Link href="/" className="button primary">
        Voltar à central
      </Link>
    </section>
  );
}
