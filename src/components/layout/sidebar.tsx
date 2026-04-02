"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Plus,
  Settings,
  Wallet,
} from "lucide-react";

const placeholderChats = [
  { id: "1", title: "How does 0G work?", date: "Today" },
  { id: "2", title: "Explain smart contracts", date: "Today" },
  { id: "3", title: "What is decentralized AI?", date: "Yesterday" },
  { id: "4", title: "Token economics basics", date: "Yesterday" },
  { id: "5", title: "Build a DeFi dashboard", date: "Last 7 days" },
];

export function Sidebar() {
  const pathname = usePathname();

  const groupedChats = placeholderChats.reduce(
    (acc, chat) => {
      if (!acc[chat.date]) acc[chat.date] = [];
      acc[chat.date].push(chat);
      return acc;
    },
    {} as Record<string, typeof placeholderChats>
  );

  return (
    <div className="flex h-full w-64 flex-col border-r border-border/50 bg-sidebar">
      {/* Brand Header */}
      <div className="flex items-center gap-2 px-4 py-5">
        <MessageSquare className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">AskZero</span>
      </div>

      {/* New Chat Button */}
      <div className="px-3 pb-2">
        <Button
          asChild
          variant="outline"
          className="w-full justify-start gap-2 border-border/50"
        >
          <Link href="/chat">
            <Plus className="h-4 w-4" />
            New chat
          </Link>
        </Button>
      </div>

      {/* Chat History */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-4 py-2">
          {Object.entries(groupedChats).map(([date, chats]) => (
            <div key={date}>
              <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
                {date}
              </p>
              <div className="space-y-0.5">
                {chats.map((chat) => (
                  <Link
                    key={chat.id}
                    href={`/chat/${chat.id}`}
                    className={cn(
                      "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                      pathname === `/chat/${chat.id}` &&
                        "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                  >
                    <span className="truncate">{chat.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Bottom Nav */}
      <div className="border-t border-border/50 p-3 space-y-1">
        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2",
            pathname === "/deposit" && "bg-sidebar-accent"
          )}
        >
          <Link href="/deposit">
            <Wallet className="h-4 w-4" />
            Deposit
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2",
            pathname === "/settings" && "bg-sidebar-accent"
          )}
        >
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>
    </div>
  );
}
