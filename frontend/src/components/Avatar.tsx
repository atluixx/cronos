export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dims = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-11 h-11 text-base" : "w-9 h-9 text-sm";
  return (
    <div
      className={`${dims} shrink-0 rounded-full bg-accent text-accent-contrast flex items-center justify-center font-semibold`}
    >
      {initial}
    </div>
  );
}
