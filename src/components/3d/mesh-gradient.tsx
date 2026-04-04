"use client";

export function MeshGradient({ className }: { className?: string }) {
  return (
    <div className={className || "absolute inset-0 -z-10 overflow-hidden"}>
      <div
        className="absolute -top-[40%] -left-[20%] h-[80%] w-[60%] rounded-full opacity-30 dark:opacity-20 blur-[120px] animate-blob"
        style={{ background: "hsl(252, 91%, 66%)" }}
      />
      <div
        className="absolute -top-[20%] -right-[20%] h-[70%] w-[50%] rounded-full opacity-20 dark:opacity-15 blur-[120px] animate-blob [animation-delay:2s]"
        style={{ background: "hsl(220, 80%, 60%)" }}
      />
      <div
        className="absolute -bottom-[30%] left-[20%] h-[70%] w-[55%] rounded-full opacity-25 dark:opacity-15 blur-[120px] animate-blob [animation-delay:4s]"
        style={{ background: "hsl(270, 80%, 60%)" }}
      />
    </div>
  );
}
