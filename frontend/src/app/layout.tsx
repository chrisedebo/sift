import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sift - NAS Media & File Organizer',
  description: 'Intelligent NAS digital asset organizer powered by local LLM and SearXNG',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0f19] text-gray-100 antialiased">{children}</body>
    </html>
  );
}
