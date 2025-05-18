// src/components/PinBoard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Move, PlusCircle, Save, Edit3, MapPin, RotateCcw, ImagePlus, FileText, Settings,
  Volume2, VolumeX, Trash2, Palette, CheckSquare
} from 'lucide-react';
import { Editor } from '@tinymce/tinymce-react';
import { PinnedItem, BoardConfig } from '../types'; // Assuming types.ts defines PinnedItem
import { getRandomRotation, getRandomPinColor, generateId } from '../utils'; // Assuming utils.ts provides these
import { fetchBoardData, saveBoardData } from '../services/jsonBinService'; // Assuming jsonBinService.ts exists
import { PIN_COLORS } from '../utils'; 

const ADMIN_PASSPHRASE = process.env.ADMIN_PASSPHRASE || 'admin';
const TINYMCE_API_KEY = process.env.TINYMCE_API_KEY;

// Debounce function
const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
};

const DEFAULT_BOARD_CONFIG: BoardConfig = {
  backgroundImageUrl: 'https://www.transparenttextures.com/patterns/cork-board.png',
  backgroundColor: '#d4a373', // Default cork color
  backgroundMusicUrl: null,   // Default to no music
  nextZIndex: 1,
};

export const PinBoard: React.FC<{ initialItems?: PinnedItem[] }> = ({ initialItems: propInitialItems }) => {
  const [boardItems, setBoardItems] = useState<PinnedItem[]>(propInitialItems || []);
  const [boardConfig, setBoardConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [editingContentItemId, setEditingContentItemId] = useState<string | null>(null);
  const [currentEditorContent, setCurrentEditorContent] = useState<string>('');

  const [isAdmin, setIsAdmin] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');

  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [draggingPinItemId, setDraggingPinItemId] = useState<string | null>(null);
  const [dragStartOffset, setDragStartOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [editingPinSettingsItemId, setEditingPinSettingsItemId] = useState<string | null>(null);

  const [imageDimensions, setImageDimensions] = useState<{ [key: string]: { width: number, height: number } }>({});
  
  const [isAddingItemModalOpen, setIsAddingItemModalOpen] = useState(false);
  const [isBoardConfigModalOpen, setIsBoardConfigModalOpen] = useState(false);
  const [newItemDetails, setNewItemDetails] = useState({ type: 'image' as 'image'|'note', title: '', content: '' });
  const [tempBoardConfig, setTempBoardConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const editorRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  const debouncedSaveData = useCallback(debounce(saveBoardData, 1200), []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await fetchBoardData();
      if (data) {
        const items = data.items || propInitialItems || [];
        const config = data.boardConfig ? { ...DEFAULT_BOARD_CONFIG, ...data.boardConfig } : DEFAULT_BOARD_CONFIG;
        setBoardItems(items);
        setBoardConfig(config);
        setTempBoardConfig(config);
        items.forEach(item => { if (item.type === 'image' && item.content) preloadImage(item.content); });
      } else if (propInitialItems) {
        setBoardItems(propInitialItems);
        const newConfig = {...DEFAULT_BOARD_CONFIG, nextZIndex: propInitialItems.length + 1};
        setBoardConfig(newConfig);
        setTempBoardConfig(newConfig);
        propInitialItems.forEach(item => { if (item.type === 'image' && item.content) preloadImage(item.content); });
      }
      setIsLoading(false);
    };
    loadData();
  }, [propInitialItems]);

  const handleSave = useCallback(async (updatedItems?: PinnedItem[], updatedConfig?: BoardConfig) => {
    const itemsToSave = updatedItems || boardItems;
    const configToSave = updatedConfig || boardConfig;
    const success = await debouncedSaveData({ items: itemsToSave, boardConfig: configToSave });
    if (success) console.log("Data saved.");
    else console.error("Failed to save data.");
  }, [boardItems, boardConfig, debouncedSaveData]);

  const handleDeleteItem = (itemId: string) => {
    if (window.confirm("Are you sure you want to delete this item? This cannot be undone.")) {
      const updatedItems = boardItems.filter(item => item.id !== itemId);
      setBoardItems(updatedItems);
      if (activeItemId === itemId) setActiveItemId(null); // Close if active
      if (editingContentItemId === itemId) setEditingContentItemId(null);
      handleSave(updatedItems);
    }
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (activeItemId || isAddingItemModalOpen || editingContentItemId || isBoardConfigModalOpen) return; 
      let newPassphraseInput = passphraseInput + event.key.toLowerCase();
      if (ADMIN_PASSPHRASE.startsWith(newPassphraseInput)) {
        if (newPassphraseInput === ADMIN_PASSPHRASE) {
          setIsAdmin(prev => !prev); setPassphraseInput(''); 
          alert(isAdmin ? 'Admin mode deactivated.' : 'Admin mode activated!');
        } else setPassphraseInput(newPassphraseInput);
      } else setPassphraseInput(event.key.toLowerCase() === ADMIN_PASSPHRASE[0] ? event.key.toLowerCase() : '');
    };
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [passphraseInput, isAdmin, activeItemId, editingContentItemId, isAddingItemModalOpen, isBoardConfigModalOpen]);

  const preloadImage = (src: string) => {
    if (imageDimensions[src] || !src) return;
    const img = new Image();
    img.onload = () => setImageDimensions(prev => ({ ...prev, [src]: { width: img.naturalWidth, height: img.naturalHeight } }));
    img.onerror = () => setImageDimensions(prev => ({ ...prev, [src]: { width: 200, height: 150 } }));
    img.src = src;
  };
  useEffect(() => { boardItems.forEach(item => { if (item.type === 'image' && item.content) preloadImage(item.content); }); }, [boardItems]);

  const getNextZIndex = useCallback(() => {
    const currentMaxZ = boardItems.length > 0 ? Math.max(...boardItems.map(item => item.zIndex || 0), 0) : 0;
    const newNextZ = Math.max(currentMaxZ, boardConfig.nextZIndex || 0) + 1;
    setBoardConfig(prev => ({ ...prev, nextZIndex: newNextZ }));
    return newNextZ -1;
  }, [boardConfig.nextZIndex, boardItems]);

  const bringToFront = (itemId: string) => {
    const newZ = getNextZIndex();
    setBoardItems(prevItems => prevItems.map(item => item.id === itemId ? { ...item, zIndex: newZ } : item ));
  };

  const handleEditorChange = useCallback((content: string) => {
    setCurrentEditorContent(content);
  }, []);
  
  const handleItemClick = (item: PinnedItem) => {
    if (isLayoutEditing || draggingPinItemId || editingContentItemId) return;
    if (activeItemId !== item.id) {
      setActiveItemId(item.id);
      setCurrentEditorContent(item.detailedContent);
      bringToFront(item.id);
    }
  };

  const closeActiveItem = () => {
    if (editingContentItemId) setEditingContentItemId(null);
    setActiveItemId(null);
  };

  const handleMouseDownOnItem = (e: React.MouseEvent, item: PinnedItem) => {
    if (!isAdmin || !isLayoutEditing || activeItemId || (e.target as HTMLElement).closest('.item-control-button') || (e.target as HTMLElement).closest('.item-pin')) return;
    e.preventDefault(); e.stopPropagation();
    setDraggingItemId(item.id);
    const currentZ = getNextZIndex();
    const boardRect = containerRef.current?.getBoundingClientRect();
    if (boardRect) setDragStartOffset({ x: e.clientX - boardRect.left - item.position.x, y: e.clientY - boardRect.top - item.position.y });
    setBoardItems(prevItems => prevItems.map(it => it.id === item.id ? { ...it, zIndex: currentZ } : it));
  };

  const handleMouseDownOnPin = (e: React.MouseEvent, item: PinnedItem) => {
    if (!isAdmin || draggingItemId || activeItemId || draggingPinItemId !== item.id) return;
    e.preventDefault(); e.stopPropagation();
    const currentZ = getNextZIndex();
    if (itemRefs.current[item.id]) setDragStartOffset({ x: e.clientX, y: e.clientY });
    setBoardItems(prevItems => prevItems.map(it => it.id === item.id ? { ...it, zIndex: currentZ } : it));
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const boardRect = containerRef.current.getBoundingClientRect();
    if (draggingItemId) {
      const newX = e.clientX - boardRect.left - dragStartOffset.x;
      const newY = e.clientY - boardRect.top - dragStartOffset.y;
      setBoardItems(prevItems => prevItems.map(it => it.id === draggingItemId ? { ...it, position: { x: newX, y: newY } } : it));
    }
    if (draggingPinItemId) {
      const item = boardItems.find(it => it.id === draggingPinItemId);
      const itemElement = itemRefs.current[draggingPinItemId];
      if (!item || !itemElement) return;
      const itemRect = itemElement.getBoundingClientRect();
      let pinXPercent = ((e.clientX - itemRect.left) / itemElement.offsetWidth) * 100;
      let pinYPercent = ((e.clientY - itemRect.top) / itemElement.offsetHeight) * 100;
      pinXPercent = Math.max(-10, Math.min(110, pinXPercent));
      pinYPercent = Math.max(-10, Math.min(110, pinYPercent));
      setBoardItems(prevItems => prevItems.map(it => it.id === draggingPinItemId ? { ...it, pinPosition: { x: pinXPercent, y: pinYPercent } } : it));
    }
  }, [draggingItemId, draggingPinItemId, dragStartOffset, boardItems]);

  const handleMouseUp = useCallback(() => {
    if (draggingItemId || draggingPinItemId) handleSave();
    if (draggingItemId) setDraggingItemId(null);
  }, [draggingItemId, draggingPinItemId, handleSave]);

  useEffect(() => {
    if (draggingItemId || draggingPinItemId) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingItemId, draggingPinItemId, handleMouseMove, handleMouseUp]);

  const getItemDimensions = (item: PinnedItem): { width: string | number, height: string | number } => {
    if (item.type === 'image') {
      const dims = imageDimensions[item.content];
      const scale = item.scale || 1;
      return dims ? { width: dims.width * scale, height: dims.height * scale } : { width: 200, height: 'auto' };
    }
    return { width: item.width || 250, height: item.height || 200 };
  };

  // const togglePinDragMode = (itemId: string) => { setDraggingPinItemId(prev => (prev === itemId ? null : itemId)); setIsLayoutEditing(false); };
  const handleTogglePinSettings = (itemId: string) => {
    if (editingPinSettingsItemId === itemId) {
      setEditingPinSettingsItemId(null); // Close settings
      // Pin position is saved immediately on click if in click-to-place mode
    } else {
      setEditingPinSettingsItemId(itemId);
      setIsLayoutEditing(false); // Ensure layout editing is off
      setDraggingPinItemId(null); // Ensure manual pin dragging is off
    }
  };
  
  const handlePlacePinOnClick = (e: React.MouseEvent, item: PinnedItem) => {
    if (!isAdmin || editingPinSettingsItemId !== item.id) return;

    const itemElement = itemRefs.current[item.id];
    if (!itemElement) return;

    const itemRect = itemElement.getBoundingClientRect();
    // Calculate click position relative to the item's top-left corner
    const relativeX = e.clientX - itemRect.left;
    const relativeY = e.clientY - itemRect.top;

    // Convert to percentage
    let pinXPercent = (relativeX / itemElement.offsetWidth) * 100;
    let pinYPercent = (relativeY / itemElement.offsetHeight) * 100;

    // Clamp values slightly within the item to ensure visibility, or allow edges
    pinXPercent = Math.max(0, Math.min(100, pinXPercent));
    pinYPercent = Math.max(0, Math.min(100, pinYPercent));

    const updatedItems = boardItems.map(it =>
      it.id === item.id ? { ...it, pinPosition: { x: pinXPercent, y: pinYPercent } } : it
    );
    setBoardItems(updatedItems);
    handleSave(updatedItems); // Save immediately
    // setEditingPinSettingsItemId(null); // Optionally close settings after placing pin
  };

  const handleChangePinColor = (itemId: string, color: string) => {
    const updatedItems = boardItems.map(item =>
      item.id === itemId ? { ...item, pinColor: color } : item
    );
    setBoardItems(updatedItems);
    handleSave(updatedItems);
    // Optionally close pin settings after color change, or keep open for more changes
    // setEditingPinSettingsItemId(null); 
  };
  
  const handleChangePinEnabled = (itemId: string, enabled: boolean) => {
    const updatedItems = boardItems.map(item =>
      item.id === itemId ? { ...item, pinEnabled: enabled } : item
    );
    setBoardItems(updatedItems);
    handleSave(updatedItems);
  };

  const handleStartEditContent = (item: PinnedItem) => { setActiveItemId(item.id); setEditingContentItemId(item.id); setCurrentEditorContent(item.detailedContent); };
  
  const handleSaveContent = () => {
    if (!editingContentItemId) return;
    const newItems = boardItems.map(item => item.id === editingContentItemId ? { ...item, detailedContent: currentEditorContent } : item);
    setBoardItems(newItems);
    setEditingContentItemId(null);
    handleSave(newItems);
  };
  const handleCancelEditContent = () => { setEditingContentItemId(null); };
  
  const handleAddNewItem = () => { setIsAddingItemModalOpen(true); setNewItemDetails({ type: 'image', title: '', content: '' }); };
  const handleSubmitNewItem = () => {
    if (!newItemDetails.title.trim() || (newItemDetails.type === 'image' && !newItemDetails.content.trim()) || (newItemDetails.type === 'note' && !newItemDetails.content.trim())) {
        alert("Title and relevant content are required."); return;
    }
    const newId = generateId();
    const newItemZIndex = getNextZIndex();
    const newItem: PinnedItem = {
        id: newId, type: newItemDetails.type, title: newItemDetails.title, content: newItemDetails.content,
        detailedContent: newItemDetails.type === 'note' ? `<p>${newItemDetails.content}</p>` : '<p>Edit this content...</p>',
        position: { x: (containerRef.current?.offsetWidth || window.innerWidth) / 2 - 100, y: (containerRef.current?.offsetHeight || window.innerHeight) / 2 - 100 },
        rotation: getRandomRotation(), pinEnabled: true, pinPosition: { x: 50, y: 5 }, pinColor: getRandomPinColor(),
        zIndex: newItemZIndex,
        scale: newItemDetails.type === 'image' ? 0.4 : undefined,
        width: newItemDetails.type === 'note' ? 250 : undefined,
        height: newItemDetails.type === 'note' ? 200 : undefined,
    };
    if (newItem.type === 'image') preloadImage(newItem.content);
    const updatedItems = [...boardItems, newItem];
    setBoardItems(updatedItems);
    setIsAddingItemModalOpen(false);
    handleSave(updatedItems, boardConfig); // Save items and current boardConfig (for nextZIndex)
    setActiveItemId(newId); setEditingContentItemId(newId); setCurrentEditorContent(newItem.detailedContent);
  };

  const handleOpenBoardConfig = () => { setTempBoardConfig(boardConfig); setIsBoardConfigModalOpen(true); };
  const handleSaveBoardConfig = () => {
    setBoardConfig(tempBoardConfig);
    handleSave(boardItems, tempBoardConfig); // Save items and new boardConfig
    setIsBoardConfigModalOpen(false);
  };

  useEffect(() => {
    const currentAudio = audioRef.current;
    if (currentAudio) {
      currentAudio.muted = isMuted;
      if (!isMuted && userInteracted && boardConfig.backgroundMusicUrl) {
        currentAudio.play().then(() => setIsPlaying(true)).catch(e => console.error("Audio play failed:", e));
      } else {
        currentAudio.pause();
        setIsPlaying(false);
      }
    }
  }, [isMuted, userInteracted, boardConfig.backgroundMusicUrl]);

  useEffect(() => {
    const currentAudio = audioRef.current;
    if (currentAudio && boardConfig.backgroundMusicUrl) {
        if(currentAudio.src !== boardConfig.backgroundMusicUrl) { // Prevents reloading same src
            currentAudio.src = boardConfig.backgroundMusicUrl;
            currentAudio.load();
        }
        if (!isMuted && userInteracted) {
            currentAudio.play().then(() => setIsPlaying(true)).catch(e => console.error("Audio play failed on src change:", e));
        }
    } else if (currentAudio && !boardConfig.backgroundMusicUrl) {
        currentAudio.pause();
        setIsPlaying(false);
        currentAudio.src = "";
    }
  }, [boardConfig.backgroundMusicUrl, isMuted, userInteracted]);

  const toggleMute = () => {
    if (!userInteracted) setUserInteracted(true);
    setIsMuted(prev => !prev);
  };
  
  const handleFirstInteraction = () => {
    if (!userInteracted) setUserInteracted(true);
  };

  const activeItemObject = boardItems.find(item => item.id === activeItemId);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-orange-50 text-lg">Loading Pinboard...</div>;

  return (
    <div className={`min-h-screen bg-orange-50 overflow-hidden ${activeItemId ? 'fixed inset-0' : 'relative'}`} onClick={handleFirstInteraction}>
      <audio ref={audioRef} loop src={boardConfig.backgroundMusicUrl || ''} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />

      <div
        className={`fixed inset-0 z-[1400] transition-all duration-500 ease-in-out 
          ${activeItemId ? 'opacity-100 backdrop-blur-md bg-black/60' : 'opacity-0 pointer-events-none'}`}
        onClick={closeActiveItem}
      >
        {activeItemId && (
            <button
                onClick={(e) => { e.stopPropagation(); closeActiveItem(); }}
                className="fixed top-4 right-4 md:top-6 md:right-6 text-white/80 hover:text-white bg-transparent rounded-full p-2 z-[1600]"
                aria-label="Close item"
            > <X size={32} /> </button>
        )}
      </div>

      {isAdmin && !activeItemId && (
        <div className="fixed top-2 left-2 z-[2000] bg-yellow-200/90 backdrop-blur-sm p-2 rounded shadow-lg flex flex-wrap gap-2 items-center">
          <button onClick={() => { setIsLayoutEditing(p => !p); setDraggingPinItemId(null); }} className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium flex items-center gap-1.5 ${isLayoutEditing ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}> {isLayoutEditing ? <X size={16}/> : <Move size={16}/>} {isLayoutEditing ? 'Finish' : 'Layout'}</button>
          <button onClick={handleAddNewItem} className="px-3 py-1.5 rounded text-xs sm:text-sm bg-blue-500 text-white font-medium flex items-center gap-1.5"><PlusCircle size={16}/> Add</button>
          <button onClick={() => handleSave()} className="px-3 py-1.5 rounded text-xs sm:text-sm bg-purple-500 text-white font-medium flex items-center gap-1.5"><Save size={16}/> Save All</button>
          <button onClick={handleOpenBoardConfig} className="px-3 py-1.5 rounded text-xs sm:text-sm bg-teal-500 text-white font-medium flex items-center gap-1.5"><Settings size={16}/> Board</button>
        </div>
      )}
      
      {boardConfig.backgroundMusicUrl && (
        <button
          onClick={toggleMute}
          className="fixed bottom-4 left-4 z-[2000] bg-black/50 text-white rounded-full p-2.5 shadow-lg hover:bg-black/70 transition-colors"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={22}/> : <Volume2 size={22}/>}
        </button>
      )}

      <div
        ref={containerRef}
        className={`relative w-full h-full min-h-screen bg-no-repeat bg-cover bg-center transition-transform duration-500 ease-in-out
          ${activeItemId ? 'scale-[0.95] opacity-60' : 'scale-100 opacity-100'} 
        `}
        style={{ 
          backgroundColor: boardConfig.backgroundColor,
          backgroundImage: `url(${boardConfig.backgroundImageUrl})`,
          cursor: isLayoutEditing && isAdmin ? 'grab' : 'default',
        }}
      >
        {boardItems.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map((item) => {
          if (item.id === activeItemId) return null;
          const dimensions = getItemDimensions(item);
          const itemWidth = typeof dimensions.width === 'number' ? `${dimensions.width}px` : dimensions.width;
          const itemHeight = typeof dimensions.height === 'number' ? `${dimensions.height}px` : dimensions.height;
          return (
            <div 
              key={item.id} ref={el => itemRefs.current[item.id] = el}
              className={`absolute group transform transition-all duration-300 ease-out ${isLayoutEditing && isAdmin ? 'cursor-grab' : 'cursor-pointer'} ${(draggingItemId === item.id && isLayoutEditing) ? 'opacity-75 shadow-2xl scale-105' : ''}`}
              style={{ left: `${item.position.x}px`, top: `${item.position.y}px`, zIndex: item.zIndex, width: itemWidth, height: itemHeight, transform: `rotate(${item.rotation}deg)`}}
              onMouseDown={(e) => handleMouseDownOnItem(e, item)} onClick={() => handleItemClick(item)}
            >
              <div className="relative w-full h-full">
                {item.type === 'image' ? ( <img src={item.content} alt={item.title} className="w-full h-full object-contain rounded block hover:drop-shadow-lg" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.2))' }} draggable={false} loading="lazy"/>
                ) : ( <div className="bg-yellow-50 p-4 h-full note-shadow rounded flex flex-col justify-between"> <h3 className="font-handwriting text-xl font-bold mb-2 text-center border-b border-amber-200 pb-1">{item.title}</h3> <p className="font-handwriting text-base whitespace-pre-line overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-amber-300 scrollbar-track-yellow-100">{item.content}</p> </div> )}
                {item.pinEnabled && ( <div className={`item-pin absolute w-4 h-4 rounded-full pin-shadow ${item.pinColor} ${isAdmin && draggingPinItemId === item.id ? 'ring-2 ring-offset-1 ring-blue-400 cursor-grabbing' : ''} ${isAdmin && !isLayoutEditing ? 'hover:ring-2 hover:ring-offset-1 hover:ring-yellow-300' : ''}`} style={{ left: `${item.pinPosition.x}%`, top: `${item.pinPosition.y}%`, transform: 'translate(-50%, -50%)', zIndex: 10, cursor: isAdmin && draggingPinItemId === item.id ? 'grabbing' : (isAdmin && !isLayoutEditing ? 'grab' : 'default')}} onMouseDown={(e) => isAdmin && draggingPinItemId === item.id && handleMouseDownOnPin(e, item)} onClick={(e) => e.stopPropagation()}/> )}
                {isAdmin && !isLayoutEditing && ( <div className="item-control-button absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 bg-black/50 p-1 rounded z-10"> <button title="Edit Pin Position" onClick={(e) => { e.stopPropagation(); togglePinDragMode(item.id); }} className={`p-1 rounded ${draggingPinItemId === item.id ? 'bg-red-500' : 'bg-blue-500'} text-white hover:bg-opacity-80`}> <MapPin size={14} /> </button> </div> )}
              </div>
            </div>
          );
        })}
      </div>

      {activeItemObject && (
        <div
          key={activeItemObject.id}
          className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1500] 
                     w-[90vw] max-w-2xl max-h-[90vh] 
                     flex flex-col transition-all duration-500 ease-in-out
                     overflow-visible"
        >
            <div className="flex-shrink-0 p-3 sm:p-4">
                {activeItemObject.type === 'image' ? (
                    <img src={activeItemObject.content} alt={activeItemObject.title} className="block rounded object-contain max-h-48 sm:max-h-60 md:max-h-72 w-auto mx-auto shadow-xl"/>
                ) : (
                    <div className="bg-yellow-50/90 p-4 note-shadow rounded max-w-md mx-auto backdrop-blur-sm">
                        <h3 className="font-handwriting text-xl font-bold mb-2 text-center border-b border-amber-200 pb-1 text-slate-800">{activeItemObject.title}</h3>
                        <p className="font-handwriting text-lg whitespace-pre-line text-slate-700">{activeItemObject.content}</p>
                    </div>
                )}
            </div>

            <div className="flex-grow p-3 sm:p-4 md:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent text-white">
                {!editingContentItemId || editingContentItemId !== activeItemObject.id ? (
                    <div className="prose prose-sm sm:prose-base prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: activeItemObject.detailedContent }} />
                ) : (
                    <div className="bg-slate-100 p-2 rounded text-slate-800"> 
                        <Editor
                            apiKey={TINYMCE_API_KEY}
                            onInit={(evt, editor) => editorRef.current = editor}
                            initialValue={activeItemObject?.detailedContent}
                            value={currentEditorContent}
                            onEditorChange={handleEditorChange}
                            init={{ height: 300, menubar: false, plugins: ['advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview', 'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen', 'insertdatetime', 'media', 'table', 'help', 'wordcount'], toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright justify | bullist numlist outdent indent | removeformat | image media link | code | help', content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'}}
                        />
                    </div>
                )}
                {isAdmin && (
                    <div className="mt-6 pt-4 border-t border-gray-500/50 flex gap-3">
                        {(!editingContentItemId || editingContentItemId !== activeItemObject.id) ? (
                            <button onClick={() => handleStartEditContent(activeItemObject)} className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500/90 text-white rounded flex items-center gap-2 text-sm shadow-md"><Edit3 size={18} /> Edit Content</button>
                        ) : (
                            <>
                                <button onClick={handleSaveContent} className="px-4 py-2 bg-green-600/80 hover:bg-green-500/90 text-white rounded flex items-center gap-2 text-sm shadow-md"><Save size={18} /> Save</button>
                                <button onClick={handleCancelEditContent} className="px-4 py-2 bg-gray-600/80 hover:bg-gray-500/90 text-white rounded flex items-center gap-2 text-sm shadow-md"><RotateCcw size={18} /> Cancel</button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
      )}

      {isAddingItemModalOpen && isAdmin && (
         <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={() => setIsAddingItemModalOpen(false)}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-4">Add New Pinned Item</h3>
            <div className="space-y-4">
              <div><label htmlFor="itemType" className="block text-sm font-medium text-gray-700 mb-1">Type</label><select id="itemType" value={newItemDetails.type} onChange={e => setNewItemDetails({...newItemDetails, type: e.target.value as 'image'|'note'})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"><option value="image">Image</option><option value="note">Note</option></select></div>
              <div><label htmlFor="itemTitle" className="block text-sm font-medium text-gray-700 mb-1">Title</label><input type="text" id="itemTitle" value={newItemDetails.title} onChange={e => setNewItemDetails({...newItemDetails, title: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div>
              {newItemDetails.type === 'image' && (<div><label htmlFor="itemContentUrl" className="block text-sm font-medium text-gray-700 mb-1">Image URL</label><input type="url" id="itemContentUrl" value={newItemDetails.content} onChange={e => setNewItemDetails({...newItemDetails, content: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="https://..."/></div>)}
              {newItemDetails.type === 'note' && (<div><label htmlFor="itemContentNote" className="block text-sm font-medium text-gray-700 mb-1">Short Note Content</label><textarea id="itemContentNote" value={newItemDetails.content} onChange={e => setNewItemDetails({...newItemDetails, content: e.target.value})} rows={3} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="A brief description..."/></div>)}
              <div className="flex justify-end gap-3 pt-2"><button onClick={() => setIsAddingItemModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button><button onClick={handleSubmitNewItem} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-1.5">{newItemDetails.type === 'image' ? <ImagePlus size={16}/> : <FileText size={16}/>} Add</button></div>
            </div>
          </div>
        </div>
      )}
      {isBoardConfigModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={() => setIsBoardConfigModalOpen(false)}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-semibold mb-6">Board Configuration</h3>
                <div className="space-y-4">
                    <div><label htmlFor="boardBgUrl" className="block text-sm font-medium text-gray-700 mb-1">Background Image URL</label><input type="url" id="boardBgUrl" value={tempBoardConfig.backgroundImageUrl} onChange={e => setTempBoardConfig({...tempBoardConfig, backgroundImageUrl: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div>
                    <div><label htmlFor="boardBgColor" className="block text-sm font-medium text-gray-700 mb-1">Background Color</label><div className="flex items-center gap-2"><input type="text" id="boardBgColor" value={tempBoardConfig.backgroundColor} onChange={e => setTempBoardConfig({...tempBoardConfig, backgroundColor: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/><input type="color" value={tempBoardConfig.backgroundColor} onChange={e => setTempBoardConfig({...tempBoardConfig, backgroundColor: e.target.value})} className="p-1 h-10 w-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/></div></div>
                    <div><label htmlFor="boardMusicUrl" className="block text-sm font-medium text-gray-700 mb-1">BG Music URL (optional)</label><input type="url" id="boardMusicUrl" value={tempBoardConfig.backgroundMusicUrl || ''} onChange={e => setTempBoardConfig({...tempBoardConfig, backgroundMusicUrl: e.target.value || null})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="https://..."/></div>
                </div>
                <div className="flex justify-end gap-3 pt-8"><button onClick={() => setIsBoardConfigModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button><button onClick={handleSaveBoardConfig} className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700">Save Config</button></div>
            </div>
        </div>
      )}
    </div>
  );
};