// src/App.tsx
import React from 'react';
import { PinBoard } from './components/PinBoard';
import { PinnedItem } from './types';
import { getRandomRotation, getRandomPinColor, generateId } from './utils';

// Initial items for the PinBoard
// Positions are now percentage-based (e.g., 15 means 15% from the left/top of the board)
const initialBoardItems: PinnedItem[] = [
  {
    id: generateId(),
    type: 'image',
    title: 'Maci',
    content: 'https://i.ibb.co/s9LS0MHg/Maci.png',
    detailedContent: '<p>This is Maci, a curious cat exploring the world.</p>',
    position: { x: 15, y: 12 }, // e.g., 15% from left, 12% from top
    rotation: getRandomRotation(),
    pinEnabled: true,
    pinPosition: { x: 50, y: 10 }, // Pin position is relative to item itself (still %)
    pinColor: getRandomPinColor(),
    scale: 0.35,
    zIndex: 1,
    linkUrl: 'https://en.wikipedia.org/wiki/Cat', // Example link
  },
  {
    id: generateId(),
    type: 'image',
    title: 'Polaroid',
    content: 'https://i.ibb.co/LhvRqr36/polaroid.png',
    detailedContent: '<p>A vintage polaroid capturing a moment.</p>',
    position: { x: 40, y: 18 },
    rotation: getRandomRotation(),
    pinEnabled: true,
    pinPosition: { x: 30, y: 15 },
    pinColor: getRandomPinColor(),
    scale: 0.35,
    zIndex: 2,
  },
  {
    id: generateId(),
    type: 'image',
    title: 'Envelope',
    content: 'https://i.ibb.co/zWjhJStp/envelope.png',
    detailedContent: '<p>An old envelope, perhaps holding secrets.</p>',
    position: { x: 20, y: 50 },
    rotation: getRandomRotation(),
    pinEnabled: true,
    pinPosition: { x: 70, y: 20 },
    pinColor: getRandomPinColor(),
    scale: 0.35,
    zIndex: 3,
  },
  {
    id: generateId(),
    type: 'image',
    title: 'Plane Ticket',
    content: 'https://i.ibb.co/JjBx3nQP/Plane-Ticket.png',
    detailedContent: '<p>A ticket to an adventure waiting to happen.</p>',
    position: { x: 55, y: 45 },
    rotation: getRandomRotation(),
    pinEnabled: true,
    pinPosition: { x: 50, y: 0 },
    pinColor: getRandomPinColor(),
    scale: 0.4,
    zIndex: 4,
  },
  {
    id: generateId(),
    type: 'image',
    title: 'Sunflower',
    content: 'https://i.ibb.co/8v01VM4/sunflower.png',
    detailedContent: '<p>A bright sunflower, always facing the light.</p>',
    position: { x: 70, y: 25 },
    rotation: getRandomRotation(),
    pinEnabled: true,
    pinPosition: { x: 40, y: 5 },
    pinColor: getRandomPinColor(),
    scale: 0.35,
    zIndex: 5,
  },
  {
    id: generateId(),
    type: 'note',
    title: 'Bucket List',
    content: '1. Visit Japan\n2. Learn to surf\n3. Write a book\n4. Plant a garden',
    detailedContent: '<h2>My Awesome Bucket List</h2><p>Here are a few things I absolutely want to do:</p><ul><li>Visit the temples in Kyoto, Japan.</li><li>Catch a wave in Hawaii.</li><li>Finally write that novel idea I\'ve had for years.</li><li>Grow my own vegetables and herbs.</li></ul>',
    position: { x: 75, y: 60 },
    rotation: getRandomRotation(),
    pinEnabled: true,
    pinPosition: { x: 50, y: -2 },
    pinColor: getRandomPinColor(),
    zIndex: 6,
    width: 250,
    height: 200,
    scale: 1, // Explicitly set scale for notes if multipurpose rotate/scale button will affect them
  },
];

function App() {
  return (
    <div className="bg-orange-50">
      <PinBoard initialItems={initialBoardItems} />
    </div>
  );
}

export default App;