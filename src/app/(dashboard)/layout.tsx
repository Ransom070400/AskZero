import { IconRail } from "@/components/layout/icon-rail";
import { ContentSidebar } from "@/components/layout/content-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { CurrencyProvider } from "@/lib/currency";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CurrencyProvider>
    <div className="flex h-screen overflow-hidden">
      {/* Column 1: Icon Rail */}
      <IconRail />

      {/* Column 2: Content Sidebar */}
      <ContentSidebar />

      {/* Column 3: Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center md:hidden">
          <div className="px-2">
            <MobileSidebar />
          </div>
          <div className="flex-1">
            <TopNav />
          </div>
        </div>
        <div className="hidden md:block">
          <TopNav />
        </div>
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>
    </div>
    </CurrencyProvider>
  );
}
