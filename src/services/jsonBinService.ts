// src/services/jsonBinService.ts

const MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '';
const BIN_ID = process.env.JSONBIN_BIN_ID || '';
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const LATEST_URL = `${API_URL}/latest`;

interface BoardData {
  items: any[]; // Define a proper type later, should match PinnedItem[]
  boardConfig: {
    backgroundImageUrl: string;
    nextZIndex: number;
  };
}

export const fetchBoardData = async (): Promise<BoardData | null> => {
  if (!MASTER_KEY || !BIN_ID) {
    console.error('JSONBin Master Key or Bin ID is not configured.');
    // Return a default structure or throw an error based on how you want to handle this
    return { 
      items: [], 
      boardConfig: { 
        backgroundImageUrl: 'https://www.transparenttextures.com/patterns/cork-board.png',
        nextZIndex: 1 
      } 
    };
  }

  try {
    const response = await fetch(LATEST_URL, {
      method: 'GET',
      headers: {
        'X-Master-Key': MASTER_KEY,
      },
    });
    if (!response.ok) {
      console.error('Failed to fetch data from JSONBin:', response.status, await response.text());
      // Fallback if bin is empty or error
      if (response.status === 404) { // Bin might be empty or not found (if 'latest' is used on new bin)
        const initialResponse = await fetch(API_URL, {
          method: 'GET',
          headers: { 'X-Master-Key': MASTER_KEY }
        });
        if (initialResponse.ok) return (await initialResponse.json()) as BoardData; // If bin exists but /latest failed (e.g. new bin)
         else throw new Error(`Failed to fetch initial bin data: ${initialResponse.status}`);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    // jsonbin.io wraps the record in a 'record' object when using /latest
    // and sometimes it might be directly the data if accessing the bin root.
    // also ensure items and boardConfig exist
    const boardData = data.record || data;
    if (!boardData.items) boardData.items = [];
    if (!boardData.boardConfig) boardData.boardConfig = { 
        backgroundImageUrl: 'https://www.transparenttextures.com/patterns/cork-board.png',
        nextZIndex: Math.max(1, ...boardData.items.map((item: any) => item.zIndex || 0)) + 1
    };
    
    return boardData as BoardData;
  } catch (error) {
    console.error('Error fetching board data:', error);
    return { 
        items: [], 
        boardConfig: { 
          backgroundImageUrl: 'https://www.transparenttextures.com/patterns/cork-board.png',
          nextZIndex: 1 
        } 
      }; // Fallback
  }
};

export const saveBoardData = async (data: BoardData): Promise<boolean> => {
  if (!MASTER_KEY || !BIN_ID) {
    console.error('JSONBin Master Key or Bin ID is not configured. Data not saved.');
    return false;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY,
        // 'X-Bin-Versioning': 'false', // Optional: set to false if you don't want versions for every PUT
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      console.error('Failed to save data to JSONBin:', response.status, await response.text());
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    // console.log('Data saved successfully to JSONBin.');
    return true;
  } catch (error) {
    console.error('Error saving board data:', error);
    return false;
  }
};