import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import './globals.css';
import GrainOverlay from '@/components/GrainOverlay';
import Vignette from '@/components/Vignette';
import HUD from '@/components/HUD';
import PageTransition from '@/components/PageTransition';
import { SaveStatusProvider } from '@/lib/save-status';

// SSR-disabled: uses canvas + requestAnimationFrame
const GenerativeBackground = dynamic(
  () => import('@/components/GenerativeBackground'),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'Markzo — MUN Marking',
  description: 'The last marksheet your EB will ever build in excel.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://markzo.sandnco.lol'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SaveStatusProvider>
          {/* z-index 1 — generative art canvas */}
          <GenerativeBackground />
          {/* z-index 50 — vignette dark frame */}
          <Vignette />
          {/* z-index 200 — persistent HUD chrome */}
          <HUD />
          {/* z-index 9999 — grain film overlay */}
          <GrainOverlay />
          {/* z-index 10 — page content with enter/exit transitions */}
          <PageTransition>{children}</PageTransition>
        </SaveStatusProvider>
      </body>
    </html>
  );
}
