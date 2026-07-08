import { ContentSidebar } from "@/components/layout/content-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { WhatsNew } from "@/components/whats-new";
import { CommandPalette } from "@/components/command-palette";
import { CurrencyProvider } from "@/lib/currency";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CurrencyProvider>
      <WhatsNew />
      <CommandPalette />
      <div className="flex h-[100dvh] overflow-hidden">
        <ContentSidebar />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Mobile header */}
          <div className="flex items-center md:hidden border-b border-border bg-background">
            <MobileSidebar />
            <div className="flex-1 min-w-0">
              <TopNav />
            </div>
          </div>
          {/* Desktop header */}
          <div className="hidden md:block">
            <TopNav />
          </div>
          <main className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] md:pb-0">
            {children}
          </main>
        </div>
      </div>
    </CurrencyProvider>
  );
}
