export interface PinnedItem {
  id: string;
  type: 'image' | 'note';
  title: string;
  content: string; // For images: URL, for notes: text preview
  detailedContent: string; // For rich text editor content
  position: {
    x: number;
    y: number;
  };
  rotation: number;
  pinEnabled: boolean;
  pinPosition: { // Percentage from left, Percentage from top
    x: number;
    y: number;
  };
  pinColor: string; // Tailwind CSS class, e.g. 'bg-red-500'
  scale?: number;
  zIndex: number;
  width?: number; // Optional: for notes, or pre-defined image width
  height?: number; // Optional: for notes, or pre-defined image height
}

export interface BoardConfig {
  backgroundImageUrl: string;
  backgroundColor: string;
  backgroundMusicUrl: string | null;
  nextZIndex: number;
}