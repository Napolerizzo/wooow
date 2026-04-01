'use client';

// Committee home redirects to /marking — this is the marking interface entry point
// Full implementation in Phase 7
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function CommitteePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    if (id) router.replace(`/committee/${id}/marking`);
  }, [id, router]);

  return (
    <div style={{ padding: '2rem', fontFamily: 'var(--font-body)', color: 'var(--secondary)' }}>
      <span className="loading-text">LOADING</span>
    </div>
  );
}
