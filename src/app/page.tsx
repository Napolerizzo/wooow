// Phase 1 placeholder — replaced in Phase 4 with full landing page
export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-wordmark)',
          fontSize: '4rem',
          color: 'var(--off-white)',
        }}
      >
        MARKZO
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--secondary)',
          fontSize: '1rem',
        }}
      >
        markzo.sandnco.lol
      </p>
    </main>
  );
}
