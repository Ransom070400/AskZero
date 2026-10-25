"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { ContentSidebar } from "./content-sidebar";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  // Close after picking a chat or page; the sheet otherwise stayed open over
  // the page you'd just navigated to.
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(18rem,calc(100vw-2.5rem))] p-0">
        <ContentSidebar variant="sheet" />
      </SheetContent>
    </Sheet>
  );
}
