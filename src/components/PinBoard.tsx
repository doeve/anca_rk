// src/components/PinBoard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Move, PlusCircle, Save, Edit3, MapPin, RotateCcw, ImagePlus, FileText, Settings,
  Volume2, VolumeX, Trash2, Palette, CheckSquare, Link as LinkIcon
} from 'lucide-react';
import { Editor } from '@tinymce/tinymce-react';
import { PinnedItem, BoardConfig } from '../types';
import { getRandomRotation, getRandomPinColor, generateId, PIN_COLORS } from '../utils';
import { fetchBoardData, saveBoardData } from '../services/jsonBinService';

const ADMIN_PASSPHRASE = process.env.ADMIN_PASSPHRASE || 'admin';
const TINYMCE_API_KEY = process.env.TINYMCE_API_KEY;

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
  backgroundColor: '#d4a373',
  backgroundMusicUrl: null,
  nextZIndex: 1,
};

interface RotationStartInfo {
  mouseStartAngle: number;
  itemInitialRotation: number;
  centerX: number; // Item center in viewport coordinates
  centerY: number; // Item center in viewport coordinates
  mouseInitialDist: number; // Distance from item center to initial mouse position
  itemInitialScale: number; // Item's scale when rotation/scaling started
}

interface ModalAnimationState {
  initialX: number;
  initialY: number;
  initialScale: number;
  initialRotation: number;
  targetX: string; 
  targetY: string; 
  targetScale: number;
  targetRotation: number;
  opacity: number;
  isAnimating: boolean;
}

const initialModalAnimState: ModalAnimationState = {
    initialX: 0, initialY: 0, initialScale: 0.3, initialRotation: 0,
    targetX: '-50%', targetY: '-50%', targetScale: 1, targetRotation: 0, 
    opacity: 0, isAnimating: false,
};


export const PinBoard: React.FC<{ initialItems?: PinnedItem[] }> = ({ initialItems: propInitialItems }) => {
  const [boardItems, setBoardItems] = useState<PinnedItem[]>(propInitialItems || []);
  const [boardConfig, setBoardConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [editingContentItemId, setEditingContentItemId] = useState<string | null>(null);
  const [currentEditorContent, setCurrentEditorContent] = useState<string>('');
  const [currentEditLinkUrl, setCurrentEditLinkUrl] = useState<string>(''); // For editing link in modal

  const [isAdmin, setIsAdmin] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');

  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [rotatingItemId, setRotatingItemId] = useState<string | null>(null); // Now also for scaling
  const [rotationStartInfo, setRotationStartInfo] = useState<RotationStartInfo | null>(null);

  const [dragStartOffset, setDragStartOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  
  const [editingPinSettingsItemId, setEditingPinSettingsItemId] = useState<string | null>(null);
  const [previewPinPosition, setPreviewPinPosition] = useState<{itemId: string, x: number, y: number} | null>(null);

  const [imageDimensions, setImageDimensions] = useState<{ [key: string]: { width: number, height: number } }>({});
  
  const [isAddingItemModalOpen, setIsAddingItemModalOpen] = useState(false);
  const [isBoardConfigModalOpen, setIsBoardConfigModalOpen] = useState(false);
  const [newItemDetails, setNewItemDetails] = useState({ type: 'image' as 'image'|'note', title: '', content: '', linkUrl: '' });
  const [tempBoardConfig, setTempBoardConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const editorRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const originalBodyCursor = useRef<string>('');
  
  const latestDragPosition = useRef<{ x: number, y: number } | null>(null);

  const [modalAnimation, setModalAnimation] = useState<ModalAnimationState>(initialModalAnimState);
  const modalRef = useRef<HTMLDivElement>(null);
  const [bgImageWidth, setBgImageWidth] = useState<number>(1);


  const debouncedSaveData = useCallback(debounce(saveBoardData, 1200), []);

  useEffect(() => { 
    const loadData = async () => {
      setIsLoading(true);
      const data = await fetchBoardData();
      if (data) {
        const items = (data.items || propInitialItems || []).map(item => ({...item, isInteractable: item.isInteractable !== false })); // Ensure default for isInteractable
        const config = data.boardConfig ? { ...DEFAULT_BOARD_CONFIG, ...data.boardConfig } : DEFAULT_BOARD_CONFIG;
        setBoardItems(items);
        setBoardConfig(config);
        setTempBoardConfig(config);
        items.forEach(item => { if (item.type === 'image' && item.content) preloadImage(item.content); });
      } else if (propInitialItems) {
        const itemsWithDefaultInteractable = propInitialItems.map(item => ({...item, isInteractable: item.isInteractable !== false }));
        setBoardItems(itemsWithDefaultInteractable);
        const newConfig = {...DEFAULT_BOARD_CONFIG, nextZIndex: itemsWithDefaultInteractable.length + 1};
        setBoardConfig(newConfig);
        setTempBoardConfig(newConfig);
        itemsWithDefaultInteractable.forEach(item => { if (item.type === 'image' && item.content) preloadImage(item.content); });
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
      if (activeItemId === itemId) setActiveItemId(null); 
      if (editingContentItemId === itemId) setEditingContentItemId(null);
      if (editingPinSettingsItemId === itemId) setEditingPinSettingsItemId(null);
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
    img.onerror = () => setImageDimensions(prev => ({ ...prev, [src]: { width: 200, height: 150 } })); // Default/fallback dimensions
    img.src = src;
  };
  useEffect(() => { boardItems.forEach(item => { if (item.type === 'image' && item.content) preloadImage(item.content); }); }, [boardItems]);

  const getNextZIndex = useCallback(() => { 
    const currentMaxZ = boardItems.length > 0 ? Math.max(...boardItems.map(item => item.zIndex || 0), 0) : 0;
    const newNextZ = Math.max(currentMaxZ, boardConfig.nextZIndex || 0) + 1;
    setBoardConfig(prev => ({ ...prev, nextZIndex: newNextZ }));
    return newNextZ -1; // Return the z-index to use for the current item
  }, [boardConfig.nextZIndex, boardItems]);

  const bringToFront = (itemId: string) => { 
    const newZ = getNextZIndex();
    setBoardItems(prevItems => prevItems.map(item => item.id === itemId ? { ...item, zIndex: newZ } : item ));
  };

  const isItemInteractable = (item: PinnedItem): boolean => {
    return item.isInteractable !== false; // Defaults to true if undefined
  };

  const handleItemClick = (item: PinnedItem) => {
    if (draggingItemId || rotatingItemId || (isAdmin && editingPinSettingsItemId === item.id)) return;
    
    if (!isItemInteractable(item)) {
        console.log(`Item "${item.title}" is not interactable for modal view.`);
        // Optionally, you could flash a border or give some other visual feedback
        return; 
    }
    
    if (activeItemId !== item.id) {
        const itemElement = itemRefs.current[item.id];
        if (itemElement && modalRef.current) {
            const itemRect = itemElement.getBoundingClientRect();
            const itemCenterX = itemRect.left + itemRect.width / 2;
            const itemCenterY = itemRect.top + itemRect.height / 2;
            const viewportCenterX = window.innerWidth / 2;
            const viewportCenterY = window.innerHeight / 2;
            const initialX = itemCenterX - viewportCenterX;
            const initialY = itemCenterY - viewportCenterY;
            const modalMaxWidth = Math.min(window.innerWidth * 0.9, 672); 
            const initialScale = Math.min(1, itemRect.width / modalMaxWidth) * 0.8;

            setModalAnimation({
                initialX, initialY, initialScale,
                initialRotation: item.rotation, 
                targetX: '-50%', targetY: '-50%',
                targetScale: 1, targetRotation: 0, 
                opacity: 0, isAnimating: true,
            });
        }
        setActiveItemId(item.id);
        setCurrentEditorContent(item.detailedContent);
        setCurrentEditLinkUrl(item.linkUrl || '');
        bringToFront(item.id);
    }
  };

  useEffect(() => { 
    if (activeItemId && modalAnimation.isAnimating && modalAnimation.opacity === 0) {
      requestAnimationFrame(() => { 
        setModalAnimation(prev => ({ ...prev, opacity: 1 }));
      });
    }
  }, [activeItemId, modalAnimation.isAnimating, modalAnimation.opacity]);

  const closeActiveItem = () => { 
    if (editingContentItemId) setEditingContentItemId(null);
    const currentActiveItem = boardItems.find(i => i.id === activeItemId);
    const itemElement = activeItemId ? itemRefs.current[activeItemId] : null;

    if (currentActiveItem && itemElement) {
        const itemRect = itemElement.getBoundingClientRect();
        const itemCenterX = itemRect.left + itemRect.width / 2;
        const itemCenterY = itemRect.top + itemRect.height / 2;
        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;
        const finalX = itemCenterX - viewportCenterX;
        const finalY = itemCenterY - viewportCenterY;
        const modalMaxWidth = Math.min(window.innerWidth * 0.9, 672);
        const finalScale = Math.min(1, itemRect.width / modalMaxWidth) * 0.8;

        setModalAnimation(prev => ({
            ...prev,
            targetX: `${finalX}px`, targetY: `${finalY}px`,
            targetScale: finalScale, targetRotation: currentActiveItem.rotation,
            opacity: 0, isAnimating: true, 
        }));
        setTimeout(() => { setActiveItemId(null); setModalAnimation(initialModalAnimState); }, 300);
    } else {
        setActiveItemId(null); setModalAnimation(initialModalAnimState);
    }
  };

  const handleStartDragItem = (e: React.MouseEvent, item: PinnedItem) => {
    e.stopPropagation();
    if (!isAdmin || activeItemId || editingPinSettingsItemId) return;
    // Admin can drag any item, regardless of its 'isInteractable' status for modal opening
    setDraggingItemId(item.id);
    bringToFront(item.id);

    const boardRect = containerRef.current?.getBoundingClientRect();
    const boardElement = containerRef.current;

    if (boardRect && boardElement) {
      const mouseX_board_px = e.clientX - boardRect.left;
      const mouseY_board_px = e.clientY - boardRect.top;
      const itemX_px = (item.position.x / 100) * boardElement.offsetWidth;
      const itemY_px = (item.position.y / 100) * boardElement.offsetHeight;
      
      setDragStartOffset({ 
        x: mouseX_board_px - itemX_px,
        y: mouseY_board_px - itemY_px
      });
    }
    originalBodyCursor.current = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';
  };
  
  const handleStartRotateItem = (e: React.MouseEvent, item: PinnedItem) => {
    e.stopPropagation();
    if (!isAdmin || activeItemId || editingPinSettingsItemId) return;
    // Admin can rotate/scale any item
    setRotatingItemId(item.id); 
    bringToFront(item.id);
    const itemRef = itemRefs.current[item.id];
    if (!itemRef) return;

    const rect = itemRef.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2; 
    const centerY = rect.top + rect.height / 2;
    const mouseStartX = e.clientX;
    const mouseStartY = e.clientY;
    const initialMouseAngle = Math.atan2(mouseStartY - centerY, mouseStartX - centerX) * (180 / Math.PI);
    const mouseInitialDist = Math.sqrt(Math.pow(mouseStartX - centerX, 2) + Math.pow(mouseStartY - centerY, 2));

    const currentItem = boardItems.find(i => i.id === item.id);
    if (currentItem) {
      setRotationStartInfo({ 
        mouseStartAngle: initialMouseAngle, 
        itemInitialRotation: currentItem.rotation, 
        centerX, 
        centerY,
        mouseInitialDist,
        itemInitialScale: currentItem.scale || 1,
      });
    }
    originalBodyCursor.current = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const boardRect = containerRef.current.getBoundingClientRect();
    const boardElement = containerRef.current;

    if (draggingItemId && boardElement) {
      const mouseX_board_px = e.clientX - boardRect.left;
      const mouseY_board_px = e.clientY - boardRect.top;
      const newItemX_px = mouseX_board_px - dragStartOffset.x;
      const newItemY_px = mouseY_board_px - dragStartOffset.y;
      const newXPercent = (newItemX_px / boardElement.offsetWidth) * 100;
      const newYPercent = (newItemY_px / boardElement.offsetHeight) * 100;
      
      latestDragPosition.current = { x: newXPercent, y: newYPercent };
      setBoardItems(prevItems => prevItems.map(it => 
          it.id === draggingItemId ? { ...it, position: { x: newXPercent, y: newYPercent } } : it
      ));

    } else if (rotatingItemId && rotationStartInfo) {
      const { mouseStartAngle, itemInitialRotation, centerX, centerY, mouseInitialDist, itemInitialScale } = rotationStartInfo;
      const currentMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      const angleDiff = currentMouseAngle - mouseStartAngle;
      const newRotation = itemInitialRotation + angleDiff;

      const currentMouseDist = Math.sqrt(Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2));
      let scaleFactor = 1;
      if (mouseInitialDist > 0.001) {
          scaleFactor = currentMouseDist / mouseInitialDist;
      }
      let newScale = itemInitialScale * scaleFactor;
      newScale = Math.max(0.1, Math.min(newScale, 5)); 

      setBoardItems(prevItems => prevItems.map(it => 
          it.id === rotatingItemId ? { ...it, rotation: newRotation, scale: newScale } : it
      ));
    }
  }, [draggingItemId, rotatingItemId, dragStartOffset, rotationStartInfo]); 

  const handleMouseUp = useCallback(() => {
    if (draggingItemId && latestDragPosition.current) {
        setBoardItems(prevItems => prevItems.map(it => 
            it.id === draggingItemId && latestDragPosition.current
            ? { ...it, position: { x: latestDragPosition.current.x, y: latestDragPosition.current.y } } 
            : it
        ));
    }
    if (draggingItemId || rotatingItemId) {
      handleSave();
    }
    if (draggingItemId) setDraggingItemId(null);
    latestDragPosition.current = null;
    if (rotatingItemId) {
      setRotatingItemId(null);
      setRotationStartInfo(null);
    }
    if (originalBodyCursor.current !== undefined || document.body.style.cursor !== 'default') {
        document.body.style.cursor = originalBodyCursor.current || 'default';
    }
  }, [draggingItemId, rotatingItemId, handleSave]);

  useEffect(() => { 
    if (draggingItemId || rotatingItemId) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
       if (originalBodyCursor.current !== undefined || document.body.style.cursor !== 'default') {
          document.body.style.cursor = originalBodyCursor.current || 'default';
      }
    };
  }, [draggingItemId, rotatingItemId, handleMouseMove, handleMouseUp]);

  const getItemDimensions = (item: PinnedItem): { width: string | number, height: string | number } => {
    const scale = item.scale || 1;
    if (item.type === 'image') {
      const dims = imageDimensions[item.content];
      return dims ? { width: dims.width * scale, height: dims.height * scale } : { width: 200 * scale, height: 'auto' };
    }
    return { width: (item.width || 250) * scale, height: (item.height || 200) * scale };
  };
  
  const handleTogglePinSettings = (itemId: string) => { 
    setEditingPinSettingsItemId(prev => prev === itemId ? null : itemId);
    if (prev => prev !== itemId) setPreviewPinPosition(null);
  };
  
  const handlePlacePinOnClick = (e: React.MouseEvent, itemToUpdate: PinnedItem) => {
    if (!isAdmin || editingPinSettingsItemId !== itemToUpdate.id) return;
    const itemElement = itemRefs.current[itemToUpdate.id];
    if (!itemElement) return;

    const itemRect = itemElement.getBoundingClientRect();
    const renderedWidth = itemElement.offsetWidth; 
    const renderedHeight = itemElement.offsetHeight;
    const mouseX_viewport = e.clientX;
    const mouseY_viewport = e.clientY;
    const itemCenterX_viewport = itemRect.left + itemRect.width / 2;
    const itemCenterY_viewport = itemRect.top + itemRect.height / 2;
    const mouseRelCenterX = mouseX_viewport - itemCenterX_viewport;
    const mouseRelCenterY = mouseY_viewport - itemCenterY_viewport;
    const itemRotationRad = -itemToUpdate.rotation * (Math.PI / 180); 
    const localMouseX = mouseRelCenterX * Math.cos(itemRotationRad) - mouseRelCenterY * Math.sin(itemRotationRad);
    const localMouseY = mouseRelCenterX * Math.sin(itemRotationRad) + mouseRelCenterY * Math.cos(itemRotationRad);
    const finalLocalX = localMouseX + renderedWidth / 2;
    const finalLocalY = localMouseY + renderedHeight / 2;
    let pinXPercent = (finalLocalX / renderedWidth) * 100;
    let pinYPercent = (finalLocalY / renderedHeight) * 100;
    pinXPercent = Math.max(0, Math.min(100, pinXPercent));
    pinYPercent = Math.max(0, Math.min(100, pinYPercent));

    const updatedItems = boardItems.map(it =>
      it.id === itemToUpdate.id ? { ...it, pinPosition: { x: pinXPercent, y: pinYPercent } } : it
    );
    setBoardItems(updatedItems);
    handleSave(updatedItems);
    setEditingPinSettingsItemId(null);
    setPreviewPinPosition(null);
  };

  const handleChangePinColor = (itemId: string, color: string) => { 
    const updatedItems = boardItems.map(item => item.id === itemId ? { ...item, pinColor: color } : item );
    setBoardItems(updatedItems); handleSave(updatedItems);
  };
  
  const handleChangePinEnabled = (itemId: string, enabled: boolean) => { 
    const updatedItems = boardItems.map(item => item.id === itemId ? { ...item, pinEnabled: enabled } : item );
    setBoardItems(updatedItems); handleSave(updatedItems);
  };

  const handleStartEditContent = (item: PinnedItem) => {
    setActiveItemId(item.id); 
    setEditingContentItemId(item.id); 
    setCurrentEditorContent(item.detailedContent);
    setCurrentEditLinkUrl(item.linkUrl || ''); 
  };

  const handleSaveContent = () => {
    if (!editingContentItemId) return;
    const newItems = boardItems.map(item => item.id === editingContentItemId ? { 
      ...item, 
      detailedContent: currentEditorContent,
      linkUrl: currentEditLinkUrl.trim() || undefined, 
    } : item);
    setBoardItems(newItems);
    setEditingContentItemId(null);
    handleSave(newItems);
  };
  const handleCancelEditContent = () => { setEditingContentItemId(null); };

  const handleAddNewItem = () => { 
    setIsAddingItemModalOpen(true); 
    setNewItemDetails({ type: 'image', title: '', content: '', linkUrl: '' }); 
  };

  const handleSubmitNewItem = () => {
    if (!newItemDetails.title.trim() || 
        (newItemDetails.type === 'image' && !newItemDetails.content.trim()) || 
        (newItemDetails.type === 'note' && !newItemDetails.content.trim())) {
        alert("Title and relevant content (URL for image, text for note) are required."); return;
    }
    const newId = generateId();
    const newItemZIndex = getNextZIndex();
    const boardWidth = containerRef.current?.offsetWidth || window.innerWidth;
    const boardHeight = containerRef.current?.offsetHeight || window.innerHeight;
    const tempScale = newItemDetails.type === 'image' ? 0.3 : 1;
    const tempWidth = (newItemDetails.type === 'note' ? 250 : 200) * tempScale;
    const tempHeight = (newItemDetails.type === 'note' ? 200 : 150) * tempScale;
    const initialXPercent = Math.max(0, Math.min(100, ( (boardWidth / 2) - (tempWidth / 2) ) / boardWidth * 100) );
    const initialYPercent = Math.max(0, Math.min(100, ( (boardHeight / 2) - (tempHeight / 2) ) / boardHeight * 100) );

    const newItem: PinnedItem = {
        id: newId, type: newItemDetails.type, title: newItemDetails.title, content: newItemDetails.content,
        detailedContent: newItemDetails.type === 'note' ? `<p>${newItemDetails.content}</p>` : '<p>Edit this content...</p>',
        position: { x: initialXPercent, y: initialYPercent }, 
        rotation: getRandomRotation(), pinEnabled: true, pinPosition: { x: 50, y: 5 }, pinColor: getRandomPinColor(),
        zIndex: newItemZIndex,
        scale: tempScale,
        width: newItemDetails.type === 'note' ? 250 : undefined,
        height: newItemDetails.type === 'note' ? 200 : undefined,
        linkUrl: newItemDetails.linkUrl.trim() || undefined,
        isInteractable: true, // New items are interactable by default
    };

    if (newItem.type === 'image') preloadImage(newItem.content);
    const updatedItems = [...boardItems, newItem];
    setBoardItems(updatedItems);
    setIsAddingItemModalOpen(false);
    handleSave(updatedItems, boardConfig);
    setActiveItemId(newId); 
    handleStartEditContent(newItem);
  };

  const handleOpenBoardConfig = () => { setTempBoardConfig(boardConfig); setIsBoardConfigModalOpen(true); };
  const handleSaveBoardConfig = () => { 
    setBoardConfig(tempBoardConfig); handleSave(boardItems, tempBoardConfig); setIsBoardConfigModalOpen(false);
  };

  useEffect(() => { 
    const currentAudio = audioRef.current;
    if (currentAudio) {
      currentAudio.muted = isMuted;
      if (!isMuted && userInteracted && boardConfig.backgroundMusicUrl) {
        currentAudio.play().then(() => setIsPlaying(true)).catch(e => console.error("Audio play failed:", e));
      } else {
        currentAudio.pause(); setIsPlaying(false);
      }
    }
  }, [isMuted, userInteracted, boardConfig.backgroundMusicUrl]);
  useEffect(() => { 
    const currentAudio = audioRef.current;
    if (currentAudio && boardConfig.backgroundMusicUrl) {
        if(currentAudio.src !== boardConfig.backgroundMusicUrl) {
            currentAudio.src = boardConfig.backgroundMusicUrl; currentAudio.load();
        }
        if (!isMuted && userInteracted) {
            currentAudio.play().then(() => setIsPlaying(true)).catch(e => console.error("Audio play failed on src change:", e));
        }
    } else if (currentAudio && !boardConfig.backgroundMusicUrl) {
        currentAudio.pause(); setIsPlaying(false); currentAudio.src = "";
    }
  }, [boardConfig.backgroundMusicUrl, isMuted, userInteracted]);
  const toggleMute = () => { if (!userInteracted) setUserInteracted(true); setIsMuted(prev => !prev); };
  const handleFirstInteraction = () => { if (!userInteracted) setUserInteracted(true); };
  
  const activeItemObject = boardItems.find(item => item.id === activeItemId);
  const getModalStyle = (): React.CSSProperties => { 
    if (!activeItemId && !modalAnimation.isAnimating) {
        return { opacity: 0, transform: 'translate(-50%, -50%) scale(0.9)', pointerEvents: 'none' };
    }
    if (activeItemId && modalAnimation.isAnimating && modalAnimation.opacity === 0 && modalAnimation.targetScale !== 1) {
        return {
            transform: `translate(${modalAnimation.initialX}px, ${modalAnimation.initialY}px) scale(${modalAnimation.initialScale}) rotate(${modalAnimation.initialRotation}deg)`,
            opacity: 0,
        };
    }
    return {
        transform: `translate(${modalAnimation.targetX}, ${modalAnimation.targetY}) scale(${modalAnimation.targetScale}) rotate(${modalAnimation.targetRotation}deg)`,
        opacity: modalAnimation.opacity,
    };
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-orange-50 text-lg">Loading Pinboard...</div>;

  return (
    <div className={`h-[100vh] flex flex-col justify-center`} style={{ backgroundColor: boardConfig.backgroundColor }} onClick={handleFirstInteraction}>
      <div className={`overflow-hidden ${activeItemId && modalAnimation.opacity > 0 ? 'fixed inset-0' : 'relative'}`} style={{ backgroundColor: boardConfig.backgroundColor }} onClick={handleFirstInteraction}>
        <audio ref={audioRef} loop src={boardConfig.backgroundMusicUrl || ''} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
        <div className={`fixed inset-0 z-[1400] transition-opacity duration-300 ease-out ${activeItemId && modalAnimation.opacity > 0 ? 'opacity-70 backdrop-blur-sm bg-black' : 'opacity-0 pointer-events-none'}`} onClick={closeActiveItem}>
          {activeItemId && modalAnimation.opacity > 0 && ( <button onClick={(e) => { e.stopPropagation(); closeActiveItem(); }} className="fixed top-4 right-4 md:top-6 md:right-6 text-white/80 hover:text-white bg-transparent rounded-full p-2 z-[1600]" aria-label="Close item"> <X size={32} /> </button> )}
        </div>
        {isAdmin && !activeItemId && ( <div className="fixed top-2 left-2 z-[2000] bg-yellow-200/90 backdrop-blur-sm p-2 rounded shadow-lg flex flex-wrap gap-2 items-center"> <button onClick={handleAddNewItem} className="px-3 py-1.5 rounded text-xs sm:text-sm bg-blue-500 text-white font-medium flex items-center gap-1.5"><PlusCircle size={16}/> Add</button> <button onClick={() => handleSave()} className="px-3 py-1.5 rounded text-xs sm:text-sm bg-purple-500 text-white font-medium flex items-center gap-1.5"><Save size={16}/> Save All</button> <button onClick={handleOpenBoardConfig} className="px-3 py-1.5 rounded text-xs sm:text-sm bg-teal-500 text-white font-medium flex items-center gap-1.5"><Settings size={16}/> Board</button> </div> )}
        {boardConfig.backgroundMusicUrl && ( <button onClick={toggleMute} className="fixed bottom-4 left-4 z-[2000] bg-black/50 text-white rounded-full p-2.5 shadow-lg hover:bg-black/70 transition-colors" aria-label={isMuted ? "Unmute" : "Mute"}> {isMuted ? <VolumeX size={22}/> : <Volume2 size={22}/>} </button> )}
        <div ref={containerRef} className={`relative transition-transform duration-300 ease-out ${activeItemId && modalAnimation.opacity > 0 ? 'scale-[0.95] opacity-60' : 'scale-100 opacity-100'}`}>
          <img src={boardConfig.backgroundImageUrl} alt="Background" className={`bg-no-repeat bg-cover bg-center`} onLoad={(e) => {setBgImageWidth(e.target.clientWidth);}}/>
          {boardItems.map((item) => {
            if (item.id === activeItemId && modalAnimation.isAnimating && modalAnimation.opacity > 0) return null; 

            const dimensions = getItemDimensions(item);
            const itemRenderedWidth = typeof dimensions.width === 'number' ? dimensions.width : 200; 
            
            const currentItemIsModifiableByAdmin = isAdmin && !activeItemId; // Admin can modify if not in modal view
            const isPinEditingThisItem = isAdmin && editingPinSettingsItemId === item.id;
            const itemClickableForModal = isItemInteractable(item);

            let resolvedItemCursor = 'default';
            if (isPinEditingThisItem) {
              resolvedItemCursor = 'crosshair';
            } else if (itemClickableForModal) {
              resolvedItemCursor = 'pointer';
            } else if (isAdmin) { // If not clickable for modal, but admin mode is on, still allow grab for controls
              resolvedItemCursor = 'default'; // Or 'grab' if we want direct grab on item if admin
            }

            const itemStyle: React.CSSProperties = {
              left: `${item.position.x}%`, 
              top: `${item.position.y}%`, 
              zIndex: item.zIndex,
              width: `${itemRenderedWidth * bgImageWidth / 1820}px`, 
              height: typeof dimensions.height === 'number' ? `${dimensions.height * bgImageWidth / 1820}px` : dimensions.height,
              transform: `rotate(${item.rotation}deg)`, 
              cursor: resolvedItemCursor,
              transitionProperty: 'left, top, transform, opacity, box-shadow, width, height',
              transitionDuration: (draggingItemId === item.id || rotatingItemId === item.id) ? '50ms' : '200ms',
              transitionTimingFunction: (draggingItemId === item.id || rotatingItemId === item.id) ? 'linear' : 'ease-out'
            };
            
            return (
              <div 
                key={item.id} ref={el => itemRefs.current[item.id] = el}
                className={`absolute group ${(draggingItemId === item.id || rotatingItemId === item.id) ? 'opacity-75 shadow-2xl' : ''} ${(rotatingItemId === item.id) ? 'scale-105' : ''}`}
                style={itemStyle}
                onClick={(e) => { 
                  if (isPinEditingThisItem) { e.stopPropagation(); handlePlacePinOnClick(e, item); } 
                  else if (!draggingItemId && !rotatingItemId) { handleItemClick(item); }
                }}
                onMouseMove={(e) => {
                  if (isPinEditingThisItem && itemRefs.current[item.id]) {
                    const itemElement = itemRefs.current[item.id];
                    if (!itemElement) return;
                    const itemRect = itemElement.getBoundingClientRect();
                    const renderedWidth = itemElement.offsetWidth;
                    const renderedHeight = itemElement.offsetHeight;
                    const mouseX_viewport = e.clientX;
                    const mouseY_viewport = e.clientY;
                    const itemCenterX_viewport = itemRect.left + itemRect.width / 2;
                    const itemCenterY_viewport = itemRect.top + itemRect.height / 2;
                    const mouseRelCenterX = mouseX_viewport - itemCenterX_viewport;
                    const mouseRelCenterY = mouseY_viewport - itemCenterY_viewport;
                    const itemRotationRad = -item.rotation * (Math.PI / 180);
                    const localMouseX = mouseRelCenterX * Math.cos(itemRotationRad) - mouseRelCenterY * Math.sin(itemRotationRad);
                    const localMouseY = mouseRelCenterX * Math.sin(itemRotationRad) + mouseRelCenterY * Math.cos(itemRotationRad);
                    const finalLocalX = localMouseX + renderedWidth / 2;
                    const finalLocalY = localMouseY + renderedHeight / 2;
                    let previewXPercent = (finalLocalX / renderedWidth) * 100;
                    let previewYPercent = (finalLocalY / renderedHeight) * 100;
                    previewXPercent = Math.max(0, Math.min(100, previewXPercent));
                    previewYPercent = Math.max(0, Math.min(100, previewYPercent));
                    setPreviewPinPosition({ itemId: item.id, x: previewXPercent, y: previewYPercent });
                  }
                }}
                onMouseLeave={() => { if (isPinEditingThisItem) { setPreviewPinPosition(null); } }}
              >
                <div className={`relative w-full h-full ${itemClickableForModal ? 'apply-wiggle-on-hover' : ''}`}>
                  {item.type === 'image' ? ( <img src={item.content} alt={item.title} className="w-full h-full object-contain rounded block hover:drop-shadow-lg" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.2))' }} draggable={false} loading="lazy"/>
                  ) : ( <div className="bg-yellow-50 p-4 h-full note-shadow rounded flex flex-col justify-between"> <h3 className="font-handwriting text-xl font-bold mb-2 text-center border-b border-amber-200 pb-1">{item.title}</h3> <p className="font-handwriting text-base whitespace-pre-line overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-amber-300 scrollbar-track-yellow-100">{item.content}</p> </div> )}
                  
                  {item.pinEnabled && ( <div className={`item-pin absolute w-4 h-4 rounded-full pin-shadow ${item.pinColor}`} style={{ left: `${item.pinPosition.x}%`, top: `${item.pinPosition.y}%`, transform: 'translate(-50%, -50%)', zIndex: 10 }} onClick={(e) => e.stopPropagation()}/> )}
                  
                  {isPinEditingThisItem && previewPinPosition?.itemId === item.id && (
                    <div className={`absolute w-3 h-3 rounded-full ${item.pinColor} opacity-60 pointer-events-none ring-1 ring-black/20`} style={{ left: `${previewPinPosition.x}%`, top: `${previewPinPosition.y}%`, transform: 'translate(-50%, -50%)', zIndex: 11 }}/>
                  )}

                  {currentItemIsModifiableByAdmin && ( // Show controls only if admin and not in modal
                    <div 
                    className={`item-control-button absolute -top-3 ${editingPinSettingsItemId === item.id ? '-right-[7rem]' : '-right-3'} opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1.5 bg-slate-700/80 backdrop-blur-sm p-1.5 rounded-md shadow-lg z-20`}
                    onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                      {editingPinSettingsItemId === item.id ? ( <>
                          <div className="text-white text-xs px-1 pt-0.5 font-semibold">Pin Options:</div>
                          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-600/50 rounded"> {PIN_COLORS.map(color => ( <button key={color} title={`Set pin to ${color.split('-')[1] || 'color'}`} onClick={() => handleChangePinColor(item.id, color)} className={`w-5 h-5 rounded-full ${color} border-2 ${item.pinColor === color ? 'border-white ring-2 ring-offset-0 ring-white/70' : 'border-slate-400/30'} hover:opacity-80 transform hover:scale-110 transition-all`}/> ))} </div>
                          <label className="flex items-center gap-2 px-1 py-1 text-white text-xs cursor-pointer hover:bg-slate-600/70 rounded transition-colors"> <input type="checkbox" checked={item.pinEnabled} onChange={(e) => handleChangePinEnabled(item.id, e.target.checked)} className="h-3.5 w-3.5 text-sky-500 bg-slate-200 border-slate-400 rounded focus:ring-sky-500 focus:ring-offset-0"/> Show Pin </label>
                          <button title="Delete Item" onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-xs rounded bg-red-500 text-white hover:bg-red-600 flex items-center justify-center gap-1 transition-colors"> <Trash2 size={14} /> Delete </button>
                          <button title="Finish Pin Editing" onClick={() => handleTogglePinSettings(item.id)} className="p-1.5 text-xs rounded bg-green-500 text-white hover:bg-green-600 flex items-center justify-center gap-1 transition-colors"> <CheckSquare size={14}/> Done </button> </>
                      ) : ( <>
                          <button title="Move Item" onMouseDown={(e) => handleStartDragItem(e, item)} className="p-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-grab"> <Move size={16} /> </button>
                          <button title="Rotate & Scale Item" onMouseDown={(e) => handleStartRotateItem(e, item)} className="p-1.5 rounded bg-orange-500 text-white hover:bg-orange-600 transition-colors cursor-grab"> <RotateCcw size={16} /> </button>
                          <button title="Edit Pin (Color & Position)" onClick={() => handleTogglePinSettings(item.id)} className={`p-1.5 rounded bg-sky-500 text-white hover:bg-sky-600 transition-colors`}> <Palette size={16} /> </button>
                          <button title="Delete Item" onClick={() => handleDeleteItem(item.id)} className="p-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"> <Trash2 size={16} /> </button> </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div 
        ref={modalRef} 
        key={activeItemObject?.id || 'modal-placeholder'} 
        className="fixed left-1/2 top-1/2 z-[1500] w-[90vw] max-w-7xl max-h-[90vh] 
                   flex flex-col rounded-lg transition-all duration-300 ease-out overflow-hidden" // Added styles & overflow-hidden
        style={getModalStyle()}
      >
        {activeItemObject && (
          // This single child div will handle scrolling for all its content (image + text)
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500/50 scrollbar-track-slate-700/50">
            <div className="p-3 sm:p-4"> {/* Container for image/note title part */}
                {activeItemObject.type === 'image' ? (
                    activeItemObject.linkUrl ? (
                        <a href={activeItemObject.linkUrl} target="_blank" rel="noopener noreferrer" title={`Open link: ${activeItemObject.linkUrl}`} className="block" onClick={e => e.stopPropagation()}>
                            <img src={activeItemObject.content} alt={activeItemObject.title} className="block rounded object-contain w-auto mx-auto max-w-full hover:opacity-80 transition-opacity"/>
                        </a>
                    ) : (
                        <img src={activeItemObject.content} alt={activeItemObject.title} className="block rounded object-contain w-auto mx-auto max-w-full"/>
                    )
                ) : ( 
                    <div className="bg-yellow-50/90 p-4 note-shadow rounded max-w-md mx-auto backdrop-blur-sm text-slate-800">
                        {activeItemObject.linkUrl ? (
                            <a href={activeItemObject.linkUrl} target="_blank" rel="noopener noreferrer" title={`Open link: ${activeItemObject.linkUrl}`} className="hover:underline text-slate-800" onClick={e => e.stopPropagation()}>
                                <h3 className="font-handwriting text-xl font-bold mb-2 text-center border-b border-amber-200 pb-1">{activeItemObject.title}</h3>
                            </a>
                        ) : (
                            <h3 className="font-handwriting text-xl font-bold mb-2 text-center border-b border-amber-200 pb-1 text-slate-800">{activeItemObject.title}</h3>
                        )}
                        <p className="font-handwriting text-lg whitespace-pre-line text-slate-700">{activeItemObject.content}</p>
                    </div>
                )}
            </div>
            
            {/* Detailed content, editor, admin buttons are here */}
            <div className="p-3 sm:p-4 md:p-6 text-white">
                {!editingContentItemId || editingContentItemId !== activeItemObject.id ? ( 
                    <>
                        <div className="prose prose-sm sm:prose-base prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: activeItemObject.detailedContent }} />
                        {activeItemObject.linkUrl && (
                            <div className="mt-4 pt-3 border-t border-gray-600/50">
                                <a href={activeItemObject.linkUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-2 text-sm"  onClick={e => e.stopPropagation()}>
                                    <LinkIcon size={16} /> Link: {activeItemObject.linkUrl}
                                </a>
                            </div>
                        )}
                    </>
                ) : ( 
                    <div className="bg-slate-100 p-2 rounded text-slate-800"  onClick={e => e.stopPropagation()}>
                        <Editor apiKey={TINYMCE_API_KEY} onInit={(evt, editor) => editorRef.current = editor} initialValue={activeItemObject?.detailedContent} value={currentEditorContent} onEditorChange={setCurrentEditorContent} init={{ height: 600, menubar: false, plugins: ['advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview', 'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen', 'insertdatetime', 'media', 'table', 'help', 'wordcount'], toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright justify | bullist numlist outdent indent | removeformat | image media link | code | help', content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'}} />
                        <div className="mt-3">
                            <label htmlFor="itemEditLinkUrl" className="block text-sm font-medium text-gray-700 mb-1">Link URL (Optional)</label>
                            <input type="url" id="itemEditLinkUrl" value={currentEditLinkUrl} onChange={e => setCurrentEditLinkUrl(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900" placeholder="https://..."/>
                        </div>
                    </div> 
                )}
                {isAdmin && ( <div className="mt-6 pt-4 border-t border-gray-500/50 flex gap-3">
                        {(!editingContentItemId || editingContentItemId !== activeItemObject.id) ? ( <button onClick={() => handleStartEditContent(activeItemObject)} className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500/90 text-white rounded flex items-center gap-2 text-sm shadow-md"><Edit3 size={18} /> Edit Details</button>
                        ) : ( <> <button onClick={handleSaveContent} className="px-4 py-2 bg-green-600/80 hover:bg-green-500/90 text-white rounded flex items-center gap-2 text-sm shadow-md"><Save size={18} /> Save</button> <button onClick={handleCancelEditContent} className="px-4 py-2 bg-gray-600/80 hover:bg-gray-500/90 text-white rounded flex items-center gap-2 text-sm shadow-md"><RotateCcw size={18} /> Cancel</button> </> )}
                    </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {isAddingItemModalOpen && isAdmin && ( 
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={() => setIsAddingItemModalOpen(false)}> 
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}> 
                <h3 className="text-xl font-semibold mb-4">Add New Pinned Item</h3> 
                <div className="space-y-4"> 
                    <div><label htmlFor="itemType" className="block text-sm font-medium text-gray-700 mb-1">Type</label><select id="itemType" value={newItemDetails.type} onChange={e => setNewItemDetails({...newItemDetails, type: e.target.value as 'image'|'note', content: '', linkUrl: newItemDetails.linkUrl})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"><option value="image">Image</option><option value="note">Note</option></select></div> 
                    <div><label htmlFor="itemTitle" className="block text-sm font-medium text-gray-700 mb-1">Title</label><input type="text" id="itemTitle" value={newItemDetails.title} onChange={e => setNewItemDetails({...newItemDetails, title: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div> 
                    {newItemDetails.type === 'image' && (<div><label htmlFor="itemContentUrl" className="block text-sm font-medium text-gray-700 mb-1">Image URL</label><input type="url" id="itemContentUrl" value={newItemDetails.content} onChange={e => setNewItemDetails({...newItemDetails, content: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="https://..."/></div>)} 
                    {newItemDetails.type === 'note' && (<div><label htmlFor="itemContentNote" className="block text-sm font-medium text-gray-700 mb-1">Short Note Content</label><textarea id="itemContentNote" value={newItemDetails.content} onChange={e => setNewItemDetails({...newItemDetails, content: e.target.value})} rows={3} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="A brief description..."/></div>)}
                    <div><label htmlFor="itemLinkUrl" className="block text-sm font-medium text-gray-700 mb-1">Link URL (Optional)</label><input type="url" id="itemLinkUrl" value={newItemDetails.linkUrl} onChange={e => setNewItemDetails({...newItemDetails, linkUrl: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="https://..."/></div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setIsAddingItemModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
                        <button onClick={handleSubmitNewItem} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-1.5">{newItemDetails.type === 'image' ? <ImagePlus size={16}/> : <FileText size={16}/>} Add</button>
                    </div> 
                </div> 
            </div> 
        </div> 
      )}
      {/* Board Config Modal */}
      {isBoardConfigModalOpen && isAdmin && ( <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={() => setIsBoardConfigModalOpen(false)}> <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}> <h3 className="text-xl font-semibold mb-6">Board Configuration</h3> <div className="space-y-4"> <div><label htmlFor="boardBgUrl" className="block text-sm font-medium text-gray-700 mb-1">Background Image URL</label><input type="url" id="boardBgUrl" value={tempBoardConfig.backgroundImageUrl} onChange={e => setTempBoardConfig({...tempBoardConfig, backgroundImageUrl: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div> <div><label htmlFor="boardBgColor" className="block text-sm font-medium text-gray-700 mb-1">Background Color</label><div className="flex items-center gap-2"><input type="text" id="boardBgColor" value={tempBoardConfig.backgroundColor} onChange={e => setTempBoardConfig({...tempBoardConfig, backgroundColor: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/><input type="color" value={tempBoardConfig.backgroundColor} onChange={e => setTempBoardConfig({...tempBoardConfig, backgroundColor: e.target.value})} className="p-1 h-10 w-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/></div></div> <div><label htmlFor="boardMusicUrl" className="block text-sm font-medium text-gray-700 mb-1">BG Music URL (optional)</label><input type="url" id="boardMusicUrl" value={tempBoardConfig.backgroundMusicUrl || ''} onChange={e => setTempBoardConfig({...tempBoardConfig, backgroundMusicUrl: e.target.value || null})} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="https://..."/></div> </div> <div className="flex justify-end gap-3 pt-8"><button onClick={() => setIsBoardConfigModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button><button onClick={handleSaveBoardConfig} className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700">Save Config</button></div> </div> </div> )}
    </div>
  );
};