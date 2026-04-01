import type { Metadata } from 'next';
import './globals.css';
import GrainOverlay from '@/components/GrainOverlay';

export const metadata: Metadata = {
  title: 'Markzo — MUN Marking System',
  description: 'Digital marking and scoring for Model United Nations conferences. By sandnco.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://markzo.sandnco.lol'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <GrainOverlay />
        {children}
      </body>
    </html>
  );
}
