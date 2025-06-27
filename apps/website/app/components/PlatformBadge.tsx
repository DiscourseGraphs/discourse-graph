const PLATFORM_CONFIG = {
  obsidian: {
    name: "Obsidian",
    bgColor: "bg-[#483699]",
  },
  roam: {
    name: "Roam Research",
    bgColor: "bg-[#0C1B30]",
  },
} as const;

export function PlatformBadge({ platform }: { platform: "obsidian" | "roam" }) {
  const config = PLATFORM_CONFIG[platform];

  return (
    <div
      className={`inline-flex items-center rounded-full ${config.bgColor} px-3 py-1 text-sm text-white shadow-sm`}
    >
      <span className="font-medium">{config.name}</span>
    </div>
  );
}
