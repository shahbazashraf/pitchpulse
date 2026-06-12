import './globals.css';
import Navbar from '@/components/layout/Navbar';
import LiveTicker from '@/components/layout/LiveTicker';
import Footer from '@/components/layout/Footer';
import Providers from '@/app/providers';

export const metadata = {
  title: 'KickStreaming',
  description: 'Live football scores, World Cup 2026, streams, and AI commentary',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-sans">
      <head>
        <meta name="theme-color" content="#050810" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-gray-900 text-text-primary min-h-screen flex flex-col overflow-x-hidden" suppressHydrationWarning>
        <Providers>
          <Navbar />
          <LiveTicker />
          <main className="flex-1 container mx-auto px-3 sm:px-4 md:px-6 py-6">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
