// Metadata trình bày cho từng game (thể loại, chữ viết tắt, màu ảnh bìa) — dùng cho
// trang danh sách Nạp game và dải thông tin ở trang nạp riêng. Game lạ chưa có
// trong bảng này sẽ rơi về thể loại "Khác" và chữ viết tắt lấy từ tên game.
export interface GameMeta {
  genre: string;
  initials: string;
  /** Các lớp Tailwind cho nền gradient của ô ảnh bìa (viết literal để Tailwind quét được). */
  art: string;
}

const META: Record<string, GameMeta> = {
  "lien-quan-mobile": { genre: "MOBA", initials: "LQ", art: "from-[#7C2D12] via-[#EA580C] to-[#F59E0B]" },
  "free-fire": { genre: "Battle Royale", initials: "FF", art: "from-[#7F1D1D] via-[#DC2626] to-[#F97316]" },
  "pubg-mobile": { genre: "Battle Royale", initials: "PB", art: "from-[#1E293B] via-[#B45309] to-[#F59E0B]" },
  "genshin-impact": { genre: "RPG", initials: "GI", art: "from-[#164E63] via-[#0EA5E9] to-[#67E8F9]" },
};

export const GAME_GENRES = ["Tất cả", "MOBA", "Battle Royale", "RPG", "Khác"] as const;

export function gameMeta(slug: string, name: string): GameMeta {
  const known = META[slug];
  if (known) return known;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return { genre: "Khác", initials: initials || "G", art: "from-[#9A3412] via-[#F97316] to-[#FBBF24]" };
}
