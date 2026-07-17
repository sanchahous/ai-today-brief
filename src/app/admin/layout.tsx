import type { Metadata, Viewport } from 'next';
import { PwaRegistration } from '@/components/admin/pwa-registration';

export const metadata: Metadata = {
  title: 'Social CMS · AI Today Brief',
  description: 'Private social publishing control plane.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'ATB CMS', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { themeColor: '#101418', colorScheme: 'dark' };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0c1014] text-slate-100">
      <PwaRegistration />
      {children}
    </div>
  );
}
