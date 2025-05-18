export const getRandomRotation = (): number => {
  return Math.random() * 10 - 5; // +/- 5 degrees
};

export const PIN_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-pink-500',
  'bg-purple-500',
];

export const getRandomPinColor = (): string => {
  return PIN_COLORS[Math.floor(Math.random() * PIN_COLORS.length)];
};

// Helper for generating unique IDs (simple version)
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};