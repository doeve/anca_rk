import React from 'react';
import { PinBoard } from './components/PinBoard';
import { PinnedItem } from './types';
import { getRandomRotation, getRandomPinColor, generateId } from './utils';

// Initial items for the PinBoard
// We'll add more properties as per the updated PinnedItem type
const initialBoardItems: PinnedItem[] = [
  {
    id: generateId(),
    type: 'image',
    title: 'Maci',
    content: 'https://i.ibb.co/s9LS0MHg/Maci.png',
    detailedContent: '<p>This is Maci, a curious cat exploring the world.</p>',
    position: { x: 150, y: 100 },
    rotation: getRandomRotation(),
    pinEnabled: true,
    pinPosition: { x: 50, y: 10 },
    pinColor: getRandomPinColor(),
    scale: 0.35,
    zIndex: 1,
  },
  {
    id: generateId(),
    type: 'image',
    title: 'Polaroid',
    content: 'https://i.ibb.co/LhvRqr36/polaroid.png',
    detailedContent: '<p>A vintage polaroid capturing a moment.</p>',
    position: { x: 450, y: 150 },
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
    position: { x: 200, y: 400 },
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
    position: { x: 500, y: 350 },
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
    position: { x: 750, y: 200 },
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
    content: '1. Visit Japan\n2. Learn to surf\n3. Write a book\n4. Plant a garden', // This will be the short preview
    detailedContent: '<h2>My Awesome Bucket List</h2><p>Here are a few things I absolutely want to do:</p><ul><li>Visit the temples in Kyoto, Japan.</li><li>Catch a wave in Hawaii.</li><li>Finally write that novel idea I\'ve had for years.</li><li>Grow my own vegetables and herbs.</li></ul>',
    position: { x: 800, y: 450 },
    rotation: getRandomRotation(),
    pinEnabled: true,
    pinPosition: { x: 50, y: -2 }, // Adjusted for note padding
    pinColor: getRandomPinColor(),
    zIndex: 6,
    width: 250, // Explicit width for notes
    height: 200, // Explicit height for notes
  },
];

function App() {
  return (
    <div className="min-h-screen bg-orange-50">
      {/* Pass initialItems to PinBoard. PinBoard will manage its own state for these items. */}
      <PinBoard initialItems={initialBoardItems} />
    </div>
  );
}

export default App;