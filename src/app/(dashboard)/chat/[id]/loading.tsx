import { ChatSkeleton } from "@/components/chat/chat-skeleton";

// Shown the instant a chat is tapped in the sidebar, while the server work for
// that route is still in flight. Without this the App Router holds the old
// screen and the tap reads as ignored. Same skeleton the page itself uses while
// hydrating, so the transition into the loaded chat is seamless.
export default function Loading() {
  return <ChatSkeleton />;
}
