"use client";

import { cloneElement } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIncognitoHasMessages } from "@/lib/incognito-state";

// Leaves incognito for a normal chat. An empty incognito chat exits at once;
// one with messages asks first, since leaving discards the conversation.
export function ExitIncognito({
  children,
  align = "end",
}: {
  // The trigger — a single button element.
  children: React.ReactElement<{ onClick?: () => void }>;
  align?: "start" | "end";
}) {
  const router = useRouter();
  const hasMessages = useIncognitoHasMessages();
  const exit = () => router.push("/chat");

  if (!hasMessages) {
    return cloneElement(children, { onClick: exit });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64 p-3 text-left">
        <p className="text-sm font-semibold text-foreground">
          Discard this chat?
        </p>
        <p className="mt-1 text-xs leading-snug text-text-tertiary">
          Incognito chats aren&apos;t saved — leaving deletes this conversation
          for good.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <DropdownMenuItem className="w-auto justify-center px-3 py-1.5 text-xs">
            Stay
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={exit}
            className="w-auto justify-center bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:bg-foreground/90 focus:bg-foreground/90"
          >
            Discard &amp; exit
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
