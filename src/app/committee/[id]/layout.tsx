'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const committeeId = params?.id as string;
  const [committeeName, setCommitteeName] = useState('');

  useEffect(() => {
    if (!committeeId) return;
    const supabase = createClient();
    supabase
      .from('committees')
      .select('name')
      .eq('id', committeeId)
      .single()
      .then(({ data }) => { if (data) setCommitteeName(data.name); });
  }, [committeeId]);

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 10 }}>
      {/* Committee name watermark — Rubik Dirt, 180px, 2.5% opacity */}
      {committeeName && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 2,
            overflow: 'hidden',
          }}
        >
          <span style={{
            fontFamily: 'var(--font-wordmark)',
            fontSize: 'clamp(80px, 14vw, 180px)',
            color: 'rgba(240,236,228,0.025)',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            letterSpacing: '-0.02em',
          }}>
            {committeeName.toUpperCase()}
          </span>
        </div>
      )}

      {/* Page content — padding-top clears HUD (≈48px) */}
      <main style={{ position: 'relative', zIndex: 10, paddingTop: '56px' }}>
        {children}
      </main>
    </div>
  );
}
