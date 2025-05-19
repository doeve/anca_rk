// src/types.ts
export interface PinnedItem {
  id: string;
  type: 'image' | 'note';
  title: string;
  content: string; // For images: URL, for notes: text preview
  detailedContent: string; // For rich text editor content
  position: { // Percentage (0-100) from board left, Percentage (0-100) from board top
    x: number; // Percentage value (e.g., 50 for 50%)
    y: number; // Percentage value (e.g., 50 for 50%)
  };
  rotation: number;
  pinEnabled: boolean;
  pinPosition: { // Percentage from left, Percentage from top of the item itself
    x: number;
    y: number;
  };
  pinColor: string; // Tailwind CSS class, e.g. 'bg-red-500'
  scale?: number; // Applied to both images and notes (for notes, it scales base width/height)
  zIndex: number;
  width?: number; // Optional: base width for notes, or pre-defined image width before scale
  height?: number; // Optional: base height for notes, or pre-defined image height before scale
  linkUrl?: string; // New: For external links
}

export interface BoardConfig {
  backgroundImageUrl: string;
  backgroundColor: string;
  backgroundMusicUrl: string | null;
  nextZIndex: number;
}