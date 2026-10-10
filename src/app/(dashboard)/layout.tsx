import { ContentSidebar } from "@/components/layout/content-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { WhatsNew } from "@/components/whats-new";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { AccountNotice } from "@/components/layout/account-notice";
import { FirstRunTour } from "@/components/first-run-tour";
import { ReferralRedeemer } from "@/components/referral-redeemer";
import { CurrencyProvider } from "@/lib/currency";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CurrencyProvider>
      <FirstRunTour />
      <ReferralRedeemer />
      <WhatsNew />
      <CommandPalette />
      <ShortcutsHelp />
      <div className="flex h-[100dvh] overflow-hidden">
        <ContentSidebar />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* One header for both layouts (two TopNavs meant every page load
              fetched the user and balance twice); the menu button and its
              divider are mobile-only. */}
          <div className="flex items-center border-b border-border bg-background md:block md:border-b-0 md:bg-transparent">
            <div className="md:hidden">
              <MobileSidebar />
            </div>
            <div className="flex-1 min-w-0">
              <TopNav />
            </div>
          </div>
          <AccountNotice />
          <main className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] md:pb-0">
            {children}
          </main>
        </div>
      </div>
    </CurrencyProvider>
  );
}
