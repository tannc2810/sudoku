/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Lightbulb,
  Trash2,
  Pencil,
  RefreshCw,
  Trophy,
  Award,
  Clock,
  Sparkles,
  Info,
  CheckCircle,
  Brain,
  XCircle
} from 'lucide-react';
import { generatePuzzle, Difficulty, isValid } from './sudokuUtils';

// Intersecting cell record for notes state
type NotesState = Record<string, number[]>;

interface BestTimes {
  easy: number | null;
  medium: number | null;
  hard: number | null;
  expert: number | null;
}

export default function App() {
  // Game setup states
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [initialBoard, setInitialBoard] = useState<number[][]>([]);
  const [currentBoard, setCurrentBoard] = useState<number[][]>([]);
  const [solution, setSolution] = useState<number[][]>([]);
  const [notes, setNotes] = useState<NotesState>({});
  
  // Game interaction states
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [isNotesMode, setIsNotesMode] = useState<boolean>(false);
  const [autoCheck, setAutoCheck] = useState<boolean>(true);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [timer, setTimer] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [showStartScreen, setShowStartScreen] = useState<boolean>(true);
  const [isGivenUp, setIsGivenUp] = useState<boolean>(false);
  const [mistakes, setMistakes] = useState<number>(0);
  const [highlightedNumber, setHighlightedNumber] = useState<number | null>(null);
  
  // Undo / Redo history
  const [undoStack, setUndoStack] = useState<{ board: number[][]; notes: NotesState }[]>([]);
  const [redoStack, setRedoStack] = useState<{ board: number[][]; notes: NotesState }[]>([]);

  // Statistics
  const [bestTimes, setBestTimes] = useState<BestTimes>({
    easy: null,
    medium: null,
    hard: null,
    expert: null,
  });
  const [isNewBest, setIsNewBest] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);

  // Sound effects enabled
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Zen meditation music state setup
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
  const [musicVolume, setMusicVolume] = useState<number>(0.35);
  
  // Custom confirmation modal and toast notification states
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(prev => prev === message ? null : prev);
    }, 3000);
  };

  const musicContextRef = useRef<AudioContext | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const activeNodesRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);
  const musicTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamically update music volume
  useEffect(() => {
    if (musicGainRef.current && musicContextRef.current) {
      musicGainRef.current.gain.setValueAtTime(musicVolume * 0.22, musicContextRef.current.currentTime);
    }
  }, [musicVolume]);

  const stopZenMusic = useCallback(() => {
    setIsMusicPlaying(false);
    if (musicTimerRef.current) {
      clearInterval(musicTimerRef.current);
      musicTimerRef.current = null;
    }
    activeNodesRef.current.forEach(({ osc }) => {
      try {
        osc.stop();
      } catch {}
    });
    activeNodesRef.current = [];
  }, []);

  const startZenMusic = useCallback(() => {
    try {
      if (!musicContextRef.current) {
        musicContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = musicContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Stop any existing playing to avoid overlaps
      if (musicTimerRef.current) {
        clearInterval(musicTimerRef.current);
        musicTimerRef.current = null;
      }
      activeNodesRef.current.forEach(({ osc }) => {
        try {
          osc.stop();
        } catch {}
      });
      activeNodesRef.current = [];

      // Set up master volume for the ambient relaxation music
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(musicVolume * 0.22, ctx.currentTime);
      masterGain.connect(ctx.destination);
      musicGainRef.current = masterGain;

      // 1. CHILL LOFI BACKGROUND SOUNDSCAPE (Soft Rain Filtered Pink Noise)
      const bufferSize = ctx.sampleRate * 4; // 4 seconds looping rain buffer
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Mild pink filtering algorithm for beautiful warmth
        output[i] = (lastOut + (0.018 * white)) / 1.018;
        lastOut = output[i];
        output[i] *= 3.0; // Level compensation
      }

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(450, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(1.0, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.045, ctx.currentTime);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseNode.start();

      // Store source inside activeNodes for cleanup
      activeNodesRef.current.push({ osc: noiseNode as any, gain: noiseGain });

      // 2. EXTREMELY POPULAR FOCUS CLASSICAL PIECE: ERIK SATIE'S GYMNOPÉDIE NO. 1
      // Features very slow (Tempo = 40BPM), peaceful 3/4 floating time
      // Alternates beautiful major-seventh harmonies: Gmaj7 -> Dmaj7

      const notesFreq: Record<string, number> = {
        'D2': 73.42, 'G2': 98.00,
        'A3': 220.00, 'B3': 246.94, 'C#4': 277.18, 'D4': 293.66, 'F#4': 369.99,
        'A4': 440.00, 'B4': 493.88, 'C#5': 554.37, 'D5': 587.33, 'E5': 659.25, 'F#5': 739.99, 'G5': 783.99, 'A5': 880.00
      };

      const GymnopedieSequence = [
        { bass: 'G2', chord: ['B3', 'D4', 'F#4'], melody: [{ note: 'F#5', time: 1.8, dur: 4.0 }] },
        { bass: 'D2', chord: ['A3', 'C#4', 'F#4'], melody: [{ note: 'A5', time: 1.8, dur: 4.0 }] },
        { bass: 'G2', chord: ['B3', 'D4', 'F#4'], melody: [{ note: 'G5', time: 1.8, dur: 4.0 }] },
        { bass: 'D2', chord: ['A3', 'C#4', 'F#4'], melody: [{ note: 'F#5', time: 1.8, dur: 4.0 }] },
        { bass: 'G2', chord: ['B3', 'D4', 'F#4'], melody: [{ note: 'E5', time: 1.8, dur: 4.0 }] },
        { bass: 'D2', chord: ['A3', 'C#4', 'F#4'], melody: [{ note: 'D5', time: 1.8, dur: 4.0 }] },
        { bass: 'G2', chord: ['B3', 'D4', 'F#4'], melody: [{ note: 'B4', time: 1.8, dur: 4.0 }] },
        { bass: 'D2', chord: ['A3', 'C#4', 'F#4'], melody: [{ note: 'C#5', time: 1.2, dur: 1.5 }, { note: 'D5', time: 2.7, dur: 3.0 }] },
        { bass: 'G2', chord: ['B3', 'D4', 'F#4'], melody: [{ note: 'E5', time: 1.8, dur: 4.0 }] },
        { bass: 'D2', chord: ['A3', 'C#4', 'F#4'], melody: [{ note: 'A5', time: 1.8, dur: 4.0 }] },
        { bass: 'G2', chord: ['B3', 'D4', 'F#4'], melody: [{ note: 'G5', time: 1.8, dur: 4.0 }] },
        { bass: 'D2', chord: ['A3', 'C#4', 'F#4'], melody: [{ note: 'F#5', time: 1.8, dur: 4.0 }] },
        { bass: 'G2', chord: ['B3', 'D4', 'F#4'], melody: [{ note: 'C#5', time: 1.8, dur: 4.0 }] },
        { bass: 'D2', chord: ['A3', 'C#4', 'F#4'], melody: [{ note: 'B4', time: 1.8, dur: 4.0 }] },
        { bass: 'G2', chord: ['B3', 'D4', 'F#4'], melody: [{ note: 'A4', time: 1.8, dur: 4.0 }] },
        { bass: 'D2', chord: ['A3', 'C#4', 'F#4'], melody: [] },
      ];

      // Soft filter setup for extremely calming, warm, spacey electric piano chords
      const chordFilter = ctx.createBiquadFilter();
      chordFilter.type = 'lowpass';
      chordFilter.frequency.setValueAtTime(240, ctx.currentTime);
      chordFilter.connect(masterGain);

      // Even softer filter for deep ground bass
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(100, ctx.currentTime);
      bassFilter.connect(masterGain);

      // Flute/Oboe simulation filter for classical floating melody lines
      const melodyFilter = ctx.createBiquadFilter();
      melodyFilter.type = 'lowpass';
      melodyFilter.frequency.setValueAtTime(450, ctx.currentTime);
      melodyFilter.connect(masterGain);

      let measureIndex = 0;
      const playGymnopedieStep = () => {
        if (!musicContextRef.current || musicContextRef.current.state === 'suspended') return;
        const now = musicContextRef.current.currentTime;
        const step = GymnopedieSequence[measureIndex % GymnopedieSequence.length];
        measureIndex++;

        // 1. Play Soft Deep Ground Bass (starts at t=0.1s on Beat 1)
        const bassFreq = notesFreq[step.bass];
        if (bassFreq) {
          const bassOsc = ctx.createOscillator();
          const bassGain = ctx.createGain();
          bassOsc.type = 'sine';
          bassOsc.frequency.setValueAtTime(bassFreq, now + 0.1);

          bassGain.gain.setValueAtTime(0, now);
          bassGain.gain.linearRampToValueAtTime(0.24, now + 0.6); // Very soft attack
          bassGain.gain.setValueAtTime(0.24, now + 3.5);
          bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.8); // Resounding release

          bassOsc.connect(bassGain);
          bassGain.connect(bassFilter);
          bassOsc.start(now + 0.1);
          bassOsc.stop(now + 5.9);
        }

        // 2. Play Mellow Rhodes Chords (Beat 2 - t=1.0s)
        const chordNotes = step.chord;
        chordNotes.forEach((noteName, idx) => {
          const freq = notesFreq[noteName];
          if (freq) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            // Slight roll arpeggiation delay for peaceful human expression
            osc.frequency.setValueAtTime(freq, now + 1.0 + idx * 0.12);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.07, now + 1.8 + idx * 0.12);
            gain.gain.setValueAtTime(0.07, now + 4.0);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.8);

            osc.connect(gain);
            gain.connect(chordFilter);
            osc.start(now + 1.0);
            osc.stop(now + 5.9);
          }
        });

        // 3. Play Beautiful Iconic Melody Voice (Warm, slow breath/pluck)
        step.melody.forEach(({ note, time, dur }) => {
          const melodyFreq = notesFreq[note];
          if (melodyFreq) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            // Mix sine and triangle for flute-like warm woodwind timbre
            osc.type = 'sine';
            osc.frequency.setValueAtTime(melodyFreq, now + time);

            gain.gain.setValueAtTime(0, now + time);
            gain.gain.linearRampToValueAtTime(0.065, now + time + 0.4); // slow breathing crest
            gain.gain.setValueAtTime(0.065, now + time + dur - 0.7);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

            osc.connect(gain);
            gain.connect(melodyFilter);
            osc.start(now + time);
            osc.stop(now + time + dur);
          }
        });
      };

      playGymnopedieStep();
      // Every measure takes exactly 6.0 seconds (very comfortable, calm tempo)
      musicTimerRef.current = setInterval(playGymnopedieStep, 6000);
      setIsMusicPlaying(true);
    } catch {
      // Ignored if sound is blocked
    }
  }, [musicVolume]);

  // References
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize best times from localStorage
  useEffect(() => {
    const savedTimes = localStorage.getItem('sudoku_best_times');
    if (savedTimes) {
      try {
        setBestTimes(JSON.parse(savedTimes));
      } catch (err) {
        console.error('Error loading best times', err);
      }
    }
  }, []);

  // Play synthetic tone using Web Audio API for rewarding UX feedback (No external audio asset files needed!)
  const playTone = useCallback((frequency: number, type: OscillatorType, duration: number) => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignored if sound is blocked or unsupported
    }
  }, [soundEnabled]);

  // Generate a new game
  const startNewGame = useCallback((diff: Difficulty = difficulty) => {
    const { puzzle, solution: sol } = generatePuzzle(diff);
    setInitialBoard(puzzle.map(row => [...row]));
    setCurrentBoard(puzzle.map(row => [...row]));
    setSolution(sol);
    setNotes({});
    setSelectedCell(null);
    setHintsUsed(0);
    setTimer(0);
    setIsPaused(false);
    setGameWon(false);
    setGameOver(false);
    setIsGivenUp(false);
    setMistakes(0);
    setIsNewBest(false);
    setUndoStack([]);
    setRedoStack([]);
    setHighlightedNumber(null);
    playTone(523.25, 'triangle', 0.15); // C5 note for starting game
  }, [difficulty, playTone]);

  // Auto-start on load & audio-cleanup - Show Start/Setup screen on load
  useEffect(() => {
    setShowStartScreen(true);
    // Generate a default board so we don't have blank arrays, though it's not rendered yet
    const { puzzle, solution: sol } = generatePuzzle('easy');
    setInitialBoard(puzzle.map(row => [...row]));
    setCurrentBoard(puzzle.map(row => [...row]));
    setSolution(sol);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (musicTimerRef.current) clearInterval(musicTimerRef.current);
    };
  }, []);

  // Track elapsed timer
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (!isPaused && !gameWon && !gameOver && !showStartScreen && !isGivenUp && currentBoard.length > 0) {
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, gameWon, gameOver, showStartScreen, isGivenUp, currentBoard]);

  // Check if player has solved the puzzle correctly
  const checkWinCondition = useCallback((board: number[][]) => {
    if (board.length === 0 || solution.length === 0) return;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== solution[r][c]) {
          return; // Not won yet
        }
      }
    }
    
    // Player Won!
    setGameWon(true);
    playTone(523.25, 'sine', 0.1); // C5
    setTimeout(() => playTone(659.25, 'sine', 0.1), 120); // E5
    setTimeout(() => playTone(783.99, 'sine', 0.13), 240); // G5
    setTimeout(() => playTone(1046.50, 'sine', 0.35), 360); // C6 sound chord

    // Save best time
    const currentBest = bestTimes[difficulty];
    if (currentBest === null || timer < currentBest) {
      const updatedBestTimes = { ...bestTimes, [difficulty]: timer };
      setBestTimes(updatedBestTimes);
      localStorage.setItem('sudoku_best_times', JSON.stringify(updatedBestTimes));
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }
  }, [solution, difficulty, timer, bestTimes, playTone]);

  // Save current state for undo mechanism
  const pushToHistory = useCallback((boardToSave: number[][], notesToSave: NotesState) => {
    const deepCloneBoard = boardToSave.map(row => [...row]);
    const deepCloneNotes = JSON.parse(JSON.stringify(notesToSave));
    setUndoStack(prev => [...prev, { board: deepCloneBoard, notes: deepCloneNotes }]);
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  // Input value to selected cell
  const handleInput = useCallback((val: number, targetCell: [number, number] | null = selectedCell) => {
    if (!targetCell || isPaused || gameWon || gameOver) return;
    const [r, c] = targetCell;

    // Must not overwrite starting given digits
    if (initialBoard[r]?.[c] !== 0) return;

    // Must not overwrite correctly placed digits
    if (currentBoard[r]?.[c] === solution[r]?.[c]) return;

    pushToHistory(currentBoard, notes);

    if (isNotesMode) {
      // Notes / Pencil marks mode
      const cellKey = `${r}-${c}`;
      const currentNotes = notes[cellKey] || [];
      let updatedNotes: number[];

      if (currentNotes.includes(val)) {
        updatedNotes = currentNotes.filter(n => n !== val);
      } else {
        updatedNotes = [...currentNotes, val].sort((a, b) => a - b);
      }

      setNotes(prev => ({
        ...prev,
        [cellKey]: updatedNotes
      }));

      // Clear the main digit if we're adding notes
      const nextBoard = currentBoard.map(row => [...row]);
      nextBoard[r][c] = 0;
      setCurrentBoard(nextBoard);

      playTone(660, 'sine', 0.05); // high pitch subtle note
    } else {
      // Direct placement mode
      const nextBoard = currentBoard.map(row => [...row]);
      let isMistake = false;
      let isCorrectInput = false;
      
      if (nextBoard[r][c] === val) {
        nextBoard[r][c] = 0; // Toggle to clear if tap same number
      } else {
        nextBoard[r][c] = val;
        // Erase any pencil marks for this specific cell now that it has a digit
        const cellKey = `${r}-${c}`;
        if (notes[cellKey]) {
          setNotes(prev => {
            const next = { ...prev };
            delete next[cellKey];
            return next;
          });
        }

        if (val !== 0) {
          if (val === solution[r]?.[c]) {
            isCorrectInput = true;
          } else {
            isMistake = true;
          }
        }
      }

      setCurrentBoard(nextBoard);
      checkWinCondition(nextBoard);

      if (isCorrectInput) {
        playTone(440, 'triangle', 0.08); // Success chirp
      } else if (isMistake) {
        playTone(220, 'sawtooth', 0.15); // Low alert chirp for error
        setMistakes(prev => {
          const next = prev + 1;
          if (next >= 5) {
            setGameOver(true);
            playTone(150, 'sawtooth', 0.5); // Low play tone buzzer for Game over
          }
          return next;
        });
      } else {
        playTone(180, 'triangle', 0.08); // Neutral clear chirp
      }
    }
  }, [selectedCell, initialBoard, isNotesMode, currentBoard, notes, solution, isPaused, gameWon, gameOver, pushToHistory, checkWinCondition, playTone]);

  // Click handler for keypad numbers - Điền số vào ô đang chọn và bật bộ quét/sáng số
  const handleKeypadClick = useCallback((num: number) => {
    if (isPaused || gameWon || gameOver || showStartScreen || isGivenUp) return;

    let hasFilled = false;
    if (selectedCell) {
      const [r, c] = selectedCell;
      // Cho phép điền số mới khi ô chọn gốc là ô được phép điền và chưa điền đúng
      if (initialBoard[r]?.[c] === 0 && currentBoard[r]?.[c] !== solution[r]?.[c]) {
        handleInput(num, [r, c]);
        hasFilled = true;
      }
    }
    
    // Set highlighted number to show scanner lines and matching values
    if (hasFilled) {
      setHighlightedNumber(num);
    } else {
      setHighlightedNumber(prev => prev === num ? null : num);
    }
    playTone(450, 'sine', 0.05);
  }, [selectedCell, initialBoard, currentBoard, solution, isPaused, gameWon, gameOver, showStartScreen, isGivenUp, handleInput, playTone]);

  // Erase active cell
  const handleErase = useCallback(() => {
    if (!selectedCell || isPaused || gameWon || gameOver || showStartScreen || isGivenUp) return;
    const [r, c] = selectedCell;

    if (initialBoard[r][c] !== 0) return;

    // Không được xóa ô đã điền đúng
    if (currentBoard[r]?.[c] === solution[r]?.[c]) return;

    if (currentBoard[r][c] !== 0 || (notes[`${r}-${c}`] && notes[`${r}-${c}`].length > 0)) {
      pushToHistory(currentBoard, notes);

      const nextBoard = currentBoard.map(row => [...row]);
      nextBoard[r][c] = 0;
      setCurrentBoard(nextBoard);

      setNotes(prev => {
        const next = { ...prev };
        delete next[`${r}-${c}`];
        return next;
      });

      playTone(180, 'triangle', 0.08);
    }
  }, [selectedCell, initialBoard, currentBoard, notes, solution, isPaused, gameWon, gameOver, showStartScreen, isGivenUp, pushToHistory, playTone]);

  // Undo last action
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || isPaused || gameWon || gameOver || showStartScreen || isGivenUp) return;
    const previousState = undoStack[undoStack.length - 1];

    // Push current states to Redo stack to maintain cycle
    const currentCloneBoard = currentBoard.map(row => [...row]);
    const currentCloneNotes = JSON.parse(JSON.stringify(notes));
    setRedoStack(prev => [...prev, { board: currentCloneBoard, notes: currentCloneNotes }]);

    // Pop from Undo stack
    setCurrentBoard(previousState.board);
    setNotes(previousState.notes);
    setUndoStack(prev => prev.slice(0, prev.length - 1));
    playTone(329.63, 'sine', 0.1); // E4 note for undo
  }, [undoStack, currentBoard, notes, isPaused, gameWon, gameOver, showStartScreen, isGivenUp, playTone]);

  // Redo actions
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || isPaused || gameWon || gameOver || showStartScreen || isGivenUp) return;
    const nextState = redoStack[redoStack.length - 1];

    // Push back to Undo
    const currentCloneBoard = currentBoard.map(row => [...row]);
    const currentCloneNotes = JSON.parse(JSON.stringify(notes));
    setUndoStack(prev => [...prev, { board: currentCloneBoard, notes: currentCloneNotes }]);

    // Apply next state
    setCurrentBoard(nextState.board);
    setNotes(nextState.notes);
    setRedoStack(prev => prev.slice(0, prev.length - 1));
    playTone(392.00, 'sine', 0.1); // G4 note for redo
  }, [redoStack, currentBoard, notes, isPaused, gameWon, gameOver, showStartScreen, isGivenUp, playTone]);

  // Hand out hint based on currently selected cell
  const handleHint = useCallback(() => {
    if (!selectedCell || isPaused || gameWon || gameOver || showStartScreen || isGivenUp) return;
    const [r, c] = selectedCell;

    // Must not be a given cell, and must not already be the correct value
    if (initialBoard[r][c] !== 0) return;
    const correctVal = solution[r][c];
    if (currentBoard[r][c] === correctVal) return;

    pushToHistory(currentBoard, notes);

    const nextBoard = currentBoard.map(row => [...row]);
    nextBoard[r][c] = correctVal;
    setCurrentBoard(nextBoard);

    // Remove any note overlays
    setNotes(prev => {
      const next = { ...prev };
      delete next[`${r}-${c}`];
      return next;
    });

    setHintsUsed(prev => prev + 1);
    playTone(880, 'sine', 0.2); // clear bright bell hint audio
    checkWinCondition(nextBoard);
  }, [selectedCell, initialBoard, solution, currentBoard, notes, isPaused, gameWon, gameOver, showStartScreen, isGivenUp, pushToHistory, playTone, checkWinCondition]);

  // Toggle pause state
  const handleTogglePause = useCallback(() => {
    setIsPaused(prev => !prev);
    playTone(prevPaused => prevPaused ? 587.33 : 493.88, 'sine', 0.1); // simple auditory cue
  }, [playTone]);

  // Give Up / Xin thua
  const handleGiveUp = useCallback(() => {
    setConfirmModal({
      title: '🏳️ Xác Nhận Bỏ Cuộc?',
      message: 'Bạn có thực sự muốn nhận thua ván chơi này? Chúng tôi có một vài lời khuyên và động viên ý nghĩa dành cho bạn ở phía sau.',
      confirmText: 'Xin thua (Bỏ cuộc)',
      cancelText: 'Tiếp tục chơi',
      onConfirm: () => {
        setIsGivenUp(true);
        setConfirmModal(null);
        playTone(300, 'sawtooth', 0.3); // Low gentle alert tone
      }
    });
  }, [playTone]);

  // Clear specific keys handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPaused || gameWon || gameOver || showStartScreen || isGivenUp) return;
      
      // Moving selection using arrows
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        setSelectedCell(prev => {
          if (!prev) return [0, 0];
          const [r, c] = prev;
          if (e.key === 'ArrowUp') return [Math.max(0, r - 1), c];
          if (e.key === 'ArrowDown') return [Math.min(8, r + 1), c];
          if (e.key === 'ArrowLeft') return [r, Math.max(0, c - 1)];
          if (e.key === 'ArrowRight') return [r, Math.min(8, c + 1)];
          return prev;
        });
        return;
      }

      // Input numbers 1-9
      const numKey = parseInt(e.key, 10);
      if (!isNaN(numKey) && numKey >= 1 && numKey <= 9) {
        handleKeypadClick(numKey);
        return;
      }

      // Erase modifiers
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        handleErase();
        return;
      }

      // Action hotkeys
      if (e.key.toLowerCase() === 'n') {
        setIsNotesMode(p => !p);
        playTone(600, 'sine', 0.05);
        return;
      }
      if (e.key.toLowerCase() === 'u') {
        handleUndo();
        return;
      }
      if (e.key.toLowerCase() === 'r') {
        handleRedo();
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        handleHint();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCell, isPaused, gameWon, gameOver, showStartScreen, isGivenUp, handleKeypadClick, handleErase, handleUndo, handleRedo, handleHint, playTone]);

  // Handle difficulty change with safety check
  const handleDifficultyChange = (newDiff: Difficulty) => {
    if (newDiff === difficulty) {
      if (!showStartScreen && !gameWon && !gameOver && !isGivenUp) {
        setConfirmModal({
          title: 'Khởi Động Lại Ván Chơi?',
          message: 'Bạn có muốn chơi lại từ đầu ván Sudoku hiện tại không?',
          confirmText: 'Chơi lại',
          cancelText: 'Hủy bỏ',
          onConfirm: () => {
            startNewGame(newDiff);
            setConfirmModal(null);
          }
        });
      }
      return;
    }
    
    // Check if the current board has modifications
    const holdsEdits = currentBoard.some((row, r) => 
      row.some((val, c) => val !== initialBoard[r][c])
    );

    const isInActiveGame = !showStartScreen && !gameWon && !gameOver && !isGivenUp;

    if (!isInActiveGame || !holdsEdits) {
      setDifficulty(newDiff);
      setShowStartScreen(true);
      setIsGivenUp(false);
      setGameWon(false);
      setGameOver(false);
      playTone(400, 'sine', 0.08);
    } else {
      setConfirmModal({
        title: 'Thử Sức Cấp Độ Mới?',
        message: 'Bạn muốn bắt đầu ván đấu mới ở cấp độ khác? Ván hiện tại sẽ bị hủy và tiến trình sẽ mất.',
        confirmText: 'Đồng ý chuyển',
        cancelText: 'Giữ ván hiện tại',
        onConfirm: () => {
          setDifficulty(newDiff);
          setShowStartScreen(true);
          setIsGivenUp(false);
          setGameWon(false);
          setGameOver(false);
          playTone(400, 'sine', 0.08);
          setConfirmModal(null);
        }
      });
    }
  };

  // Safe formatting for stopwatch string
  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get active number to highlight (from selection or button filtering)
  const getActiveNum = useCallback(() => {
    if (selectedCell) {
      const [r, c] = selectedCell;
      const val = currentBoard[r]?.[c];
      if (val !== 0) return val;
    }
    return highlightedNumber;
  }, [selectedCell, currentBoard, highlightedNumber]);

  const activeNum = getActiveNum();

  // Find all cell positions with the activeNum
  const getActivePositions = useCallback(() => {
    const positions: [number, number][] = [];
    if (activeNum !== null) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (currentBoard[r]?.[c] === activeNum) {
            positions.push([r, c]);
          }
        }
      }
    }
    return positions;
  }, [activeNum, currentBoard]);

  const activePositions = getActivePositions();

  // Helper styles for cell highlighting with scanning lines
  const getCellClassName = (r: number, c: number) => {
    const isSelected = selectedCell && selectedCell[0] === r && selectedCell[1] === c;
    const isGiven = initialBoard[r]?.[c] !== 0;
    const val = currentBoard[r]?.[c];
    
    // Same number highlighting
    const isSameValue = activeNum !== null && val === activeNum;

    // Highlighting related areas (row, col, 3x3 block) of SELECTED cell
    const isRelated = selectedCell && (
      selectedCell[0] === r ||
      selectedCell[1] === c ||
      (Math.floor(selectedCell[0] / 3) === Math.floor(r / 3) &&
       Math.floor(selectedCell[1] / 3) === Math.floor(c / 3))
    );

    // Active number scanning guides (row, col, block)
    const hasRowMatch = activePositions.some(([posR]) => posR === r);
    const hasColMatch = activePositions.some(([_, posC]) => posC === c);
    const hasBlockMatch = activePositions.some(([posR, posC]) => 
      Math.floor(posR / 3) === Math.floor(r / 3) && Math.floor(posC / 3) === Math.floor(c / 3)
    );
    const isUnderScan = activeNum !== null && (hasRowMatch || hasColMatch || hasBlockMatch);

    // Outer grid line styles
    const borderB = (r === 2 || r === 5) ? "border-b-3 border-b-slate-500" : (r === 8 ? "" : "border-b border-b-slate-800/80");
    const borderR = (c === 2 || c === 5) ? "border-r-3 border-r-slate-500" : (c === 8 ? "" : "border-r border-r-slate-800/80");
    
    // Default base styles
    let bgStyle = "bg-slate-900";
    let textStyle = "text-indigo-400";

    if (isGiven) {
      bgStyle = "bg-slate-900";
      textStyle = "text-slate-100 font-bold";
    }

    // Correctness status
    const isIncorrect = autoCheck && val !== 0 && !isGiven && val !== solution[r]?.[c];
    if (isIncorrect) {
      bgStyle = "bg-red-950/20";
      textStyle = "text-red-400 font-semibold";
    }

    // Under active scan line guide highlight - gentle backdrop overlay
    if (isUnderScan && !isSelected && !isIncorrect && !isSameValue) {
      bgStyle = isGiven ? "bg-indigo-950/45" : "bg-indigo-950/35";
    }

    // Secondary highlights (selected cell guides)
    if (isRelated && !isSelected && !isIncorrect && !isSameValue && !isUnderScan) {
      bgStyle = isGiven ? "bg-slate-800/40" : "bg-slate-800/35";
    }

    if (isSameValue && !isSelected && !isIncorrect) {
      bgStyle = isGiven 
        ? "bg-indigo-600/25 ring-1 ring-indigo-500/30 ring-inset" 
        : "bg-indigo-500/30 ring-1 ring-indigo-400/40 ring-inset";
      textStyle = isGiven 
        ? "text-indigo-200 font-extrabold scale-105 transition-all duration-150" 
        : "text-indigo-100 font-black scale-105 transition-all duration-150";
    }

    if (isSelected) {
      bgStyle = "bg-indigo-600/30 ring-2 ring-indigo-500 ring-inset z-10";
    }

    return `relative flex items-center justify-center text-xl sm:text-2xl aspect-square w-full select-none cursor-pointer transition-all duration-150 ${bgStyle} ${textStyle} ${borderB} ${borderR}`;
  };

  const copyShareText = () => {
    const text = `Tôi hoàn thành ván Sudoku [${difficulty.toUpperCase()}] trong ${formatTime(timer)} với ${hintsUsed} gợi ý! 🧠 Hãy thử đánh bại kỷ lục này nhé!`;
    navigator.clipboard.writeText(text);
    showToast('Đã sao chép liên kết chia sẻ vào khay nhớ tạm!');
  };

  const resetBestTimes = () => {
    setConfirmModal({
      title: 'Xóa Tất Cả Kỷ Lục?',
      message: 'Bạn có chắc chắn muốn xóa tất cả kỷ lục giải đố đã lưu? Hành động này sẽ đặt lại thành tích của bạn về ban đầu.',
      confirmText: 'Đồng ý xóa',
      cancelText: 'Giữ lại',
      onConfirm: () => {
        const emptyTimes = { easy: null, medium: null, hard: null, expert: null };
        setBestTimes(emptyTimes);
        localStorage.setItem('sudoku_best_times', JSON.stringify(emptyTimes));
        setConfirmModal(null);
        showToast('Đã đặt lại kỷ lục thành công!');
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-3 sm:p-6 select-none font-sans">
      {/* Upper Brand Header */}
      <header className="w-full max-w-lg flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/20">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white">SUDOKU</h1>
            <p className="text-[9px] sm:text-[11px] text-indigo-400 font-bold uppercase tracking-wider">GAME THƯ GIẢN ĐẦU ÓC</p>
          </div>
        </div>

        {/* Action icons like Sound, Zen Music, Stats */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            id="toggle-music-btn"
            onClick={() => {
              if (isMusicPlaying) {
                stopZenMusic();
              } else {
                startZenMusic();
              }
            }}
            className={`px-2 py-2 rounded-lg text-[10px] sm:text-xs font-mono border transition flex items-center gap-1 font-bold ${
              isMusicPlaying 
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/50' 
                : 'border-slate-800 text-slate-400 hover:bg-slate-900'
            }`}
            title="Bật/Tắt nhạc thiền không lời tập trung cao độ"
          >
            <span>{isMusicPlaying ? '🧘 THIỀN BẬT' : '🎵 NHẠC THIỀN'}</span>
          </button>
          <button
            id="toggle-sound-btn"
            onClick={() => setSoundEnabled(s => !s)}
            className={`p-2 rounded-lg text-xs font-mono border transition ${
              soundEnabled 
                ? 'border-indigo-500/30 bg-indigo-950/20 text-indigo-400 hover:bg-indigo-950/40' 
                : 'border-slate-800 text-slate-500 hover:bg-slate-900'
            }`}
            title="Bật/Tắt âm thanh"
          >
            {soundEnabled ? '🔊 AM' : '🔇 TẮT'}
          </button>
          <button
            id="view-stats-btn"
            onClick={() => setShowStatsModal(true)}
            className="p-2 border border-slate-800 rounded-lg hover:bg-slate-900 transition text-slate-300 flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Kỷ lục</span>
          </button>
        </div>
      </header>

      {/* Main Core Segment */}
      <main className="w-full max-w-lg flex-1 flex flex-col justify-center items-center gap-4">
        {/* Game Stats Bar */}
        <div className="w-full flex items-center justify-between text-xs sm:text-sm font-mono text-slate-400 px-1">
          <div className="flex items-center gap-2 bg-slate-900/50 py-1.5 px-3 rounded-full border border-slate-900">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-100 font-bold tracking-wider">{showStartScreen ? '--:--' : formatTime(timer)}</span>
            <button
              id="pause-timer-btn"
              onClick={handleTogglePause}
              disabled={showStartScreen || gameWon || gameOver || isGivenUp}
              className="ml-1 text-slate-400 hover:text-white transition disabled:opacity-35"
              title={isPaused ? 'Tiếp tục' : 'Tạm dừng'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/50 py-1.5 px-3 rounded-full border border-slate-900">
            <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wide">Lỗi:</span>
            <span id="mistakes-counter" className={`font-mono font-bold text-xs sm:text-sm px-1 rounded ${
              !showStartScreen && mistakes > 0 ? 'text-rose-400 animate-pulse bg-rose-500/10' : 'text-slate-300'
            }`}>
              {showStartScreen ? '0/5' : `${mistakes}/5`}
            </span>
          </div>

          {isMusicPlaying && (
            <div className="flex items-center gap-2 bg-slate-900/50 py-1 px-2.5 rounded-full border border-slate-900 text-xs text-indigo-400">
              <span className="text-[10px]">🧘 Nhạc</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={musicVolume}
                onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                className="w-12 sm:w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                title="Âm lượng nhạc thiền"
              />
            </div>
          )}

          <div className="flex items-center gap-1">
            <span className="text-xs uppercase">Tự kiểm lỗi:</span>
            <button
              id="toggle-autocheck-btn"
              onClick={() => setAutoCheck(a => !a)}
              className={`px-2 py-1 rounded text-[11px] font-bold border transition ${
                autoCheck 
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' 
                  : 'bg-slate-905 bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              {autoCheck ? "BẬT" : "TẮT"}
            </button>
          </div>
        </div>

        {/* Difficulty Select Tabs */}
        <div className="w-full grid grid-cols-4 gap-1.5 p-1 bg-slate-950/70 border border-slate-900 rounded-xl">
          {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((diff) => (
            <button
              key={diff}
              id={`diff-tab-${diff}`}
              onClick={() => handleDifficultyChange(diff)}
              className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                difficulty === diff
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {diff === 'easy' ? 'Dễ' : diff === 'medium' ? 'Trung Bình' : diff === 'hard' ? 'Khó' : 'Chuyên Gia'}
            </button>
          ))}
        </div>

        {/* Sudden Block/Pause Display or interactive Board Grid */}
        <div className="w-full aspect-square relative rounded-2xl bg-slate-900 border-3 border-slate-700 shadow-2xl p-0 overflow-hidden">
          {showStartScreen ? (
            /* Welcome & Setup Screen */
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm text-center p-6 animate-fade-in">
              <div className="bg-indigo-600/10 p-4 rounded-full border border-indigo-500/30 text-indigo-400 mb-4 animate-pulse">
                <Brain className="w-10 h-10" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase">Chọn Cấp Độ Chơi</h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 mb-6 max-w-xs leading-relaxed">
                Chào mừng bạn bước vào trải nghiệm Sudoku thiền tịnh. Hãy lựa chọn cấp độ rèn luyện tâm trí phù hợp:
              </p>

              <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm mb-6">
                {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((diff) => (
                  <button
                    key={diff}
                    id={`setup-diff-${diff}`}
                    onClick={() => {
                      setDifficulty(diff);
                      playTone(392, 'sine', 0.05);
                    }}
                    className={`p-2.5 rounded-xl border transition-all text-xs text-left relative flex flex-col justify-between ${
                      difficulty === diff
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between w-full">
                      <span>
                        {diff === 'easy' ? '⭐️ Dễ' : diff === 'medium' ? '⚡️ Trung bình' : diff === 'hard' ? '🔥 Khó' : '👑 Chuyên gia'}
                      </span>
                      {difficulty === diff && <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-indigo-450 bg-indigo-500 rounded-full" />}
                    </div>
                    <span className="text-[10px] text-slate-400 font-light leading-snug mt-1 block">
                      {diff === 'easy' ? 'Phù hợp học hỏi giải trí' : diff === 'medium' ? 'Thử thách logic vừa vặn' : diff === 'hard' ? 'Suy luận logic sắc sảo' : 'Khơi nguồn tinh hoa trí tuệ'}
                    </span>
                  </button>
                ))}
              </div>

              <button
                id="start-game-btn"
                onClick={() => {
                  startNewGame(difficulty);
                  setShowStartScreen(false);
                }}
                className="w-full max-w-xs py-3 bg-indigo-600 hover:bg-indigo-500 transition rounded-xl font-bold text-sm text-white shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 active:scale-95"
              >
                <Play className="w-4 h-4" /> BẮT ĐẦU CHƠI
              </button>
            </div>
          ) : isPaused ? (
            /* Blurred Pause Board Screen Overlay */
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md animate-fade-in text-center p-6">
              <div className="bg-indigo-600/10 p-5 rounded-full mb-4 border border-indigo-500/20 text-indigo-400">
                <Pause className="w-10 h-10 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold mb-1 text-white">Đang tạm dừng</h2>
              <p className="text-sm text-slate-400 mb-6 max-w-xs leading-relaxed">
                Bảng Sudoku được ẩn để đảm bảo tính khách quan của trò chơi.
              </p>
              <button
                id="resume-game-btn"
                onClick={handleTogglePause}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 transition rounded-xl font-bold shadow-lg shadow-indigo-600/20 text-sm tracking-wide"
              >
                Tiếp tục chơi
              </button>
            </div>
          ) : gameWon ? (
            /* Victory Complete Layout */
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md text-center p-6 animate-fade-in">
              <div className="bg-amber-500/10 p-4 rounded-full border border-amber-500/30 text-amber-500 mb-4 animate-bounce">
                <Sparkles className="w-10 h-10" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">Chiến thắng! 🎉</h2>
              <p className="text-sm text-emerald-400 font-mono mt-1 mb-4 flex items-center gap-1.5 bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle className="w-4 h-4" /> Hoàn thành xuất sắc!
              </p>

              {isNewBest && (
                <div className="transform rotate-2 mb-4 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
                  <Award className="w-4 h-4 animate-spin" /> KỶ LỤC MỚI KHAI PHÁ!
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-6 text-left">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                  <div className="text-xs text-slate-500 mb-0.5 uppercase tracking-wide">Cấp độ</div>
                  <div className="text-sm font-bold text-white uppercase tracking-wider">{difficulty === 'easy' ? 'Dễ' : difficulty === 'medium' ? 'Trung Bình' : difficulty === 'hard' ? 'Khó' : 'Chuyên Gia'}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                  <div className="text-xs text-slate-500 mb-0.5 uppercase tracking-wide">Thời gian</div>
                  <div className="text-sm font-bold text-white font-mono">{formatTime(timer)}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button
                  id="win-restart-btn"
                  onClick={() => {
                    startNewGame(difficulty);
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 transition rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5"
                >
                  <Play className="w-4.5 h-4.5" /> Tiếp tục chơi cùng cấp độ
                </button>
                <div className="flex gap-2 w-full">
                  <button
                    id="win-change-diff-btn"
                    onClick={() => {
                      setShowStartScreen(true);
                      setGameWon(false);
                    }}
                    className="flex-1 py-2 bg-slate-850 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition rounded-xl font-medium text-xs text-slate-300"
                  >
                    Đổi Cấp Độ
                  </button>
                  <button
                    id="win-share-btn"
                    onClick={copyShareText}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition rounded-xl font-medium text-xs text-slate-300"
                  >
                    Chia Sẻ
                  </button>
                </div>
              </div>
            </div>
          ) : gameOver ? (
            /* Game Over Screen Overlay */
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md text-center p-6 animate-fade-in">
              <div className="bg-rose-500/10 p-4 rounded-full border border-rose-500/30 text-rose-500 mb-4 animate-bounce">
                <XCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-rose-500 tracking-wide">Trò chơi kết thúc!</h2>
              <p className="text-sm text-slate-400 mt-2 mb-6 max-w-xs leading-relaxed">
                Bạn đã phạm lỗi quá 5 lần (5/5). Hãy rèn luyện thêm và thử lại nhé!
              </p>

              <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                <button
                  id="gameover-restart-btn"
                  onClick={() => startNewGame()}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 transition rounded-xl font-bold text-sm text-white shadow-lg shadow-indigo-600/20"
                >
                  Chơi Lại Ván Mới
                </button>
              </div>
            </div>
          ) : isGivenUp ? (
            /* Give Up & Encouraging screen */
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md text-center p-6 animate-fade-in">
              <div className="bg-amber-500/10 p-4 rounded-full border border-amber-500/30 text-amber-500 mb-4 animate-bounce">
                <Sparkles className="w-10 h-10" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-amber-500 tracking-wide uppercase">Kiên Trì Là Sức Mạnh! 🕊️</h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 mb-6 max-w-sm leading-relaxed px-2">
                Bỏ cuộc hôm nay chỉ là một bước đệm giúp bạn tập trung và kiên trì hơn vào ngày mai. Đừng nản lòng nhé! Trí tuệ được rèn giũa qua từng thử thách, mỗi lần đối mặt với bảng số là một lần tâm trí bạn trở nên tinh thông hơn. Hẹn lần sau bạn chắc chắn sẽ vượt qua bản thân, chinh phục những nấc thang độ khó cao hơn!
              </p>

              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button
                  id="givenup-retry-btn"
                  onClick={() => {
                    startNewGame(difficulty);
                    setIsGivenUp(false);
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 transition rounded-xl font-bold text-sm text-white shadow-lg shadow-indigo-600/20"
                >
                  Thử Sức Lại Ván Mới
                </button>
                <button
                  id="givenup-change-diff-btn"
                  onClick={() => {
                    setShowStartScreen(true);
                    setIsGivenUp(false);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-705 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition rounded-xl font-medium text-xs text-slate-300"
                >
                  Thay Đổi Cấp Độ
                </button>
              </div>
            </div>
          ) : null}

          {/* Core Grid Matrix representing Board cells */}
          <div className="grid grid-cols-9 h-full w-full select-none" style={{ touchAction: 'none' }}>
            {Array.from({ length: 9 }).map((_, r) =>
              Array.from({ length: 9 }).map((_, c) => {
                const val = currentBoard[r]?.[c];
                const cellKey = `${r}-${c}`;
                const cellNotes = notes[cellKey] || [];

                return (
                  <div
                    key={cellKey}
                    id={`cell-${r}-${c}`}
                    onClick={() => {
                      if (!isPaused && !gameWon && !gameOver && !showStartScreen && !isGivenUp) {
                        setSelectedCell([r, c]);
                        playTone(350, 'sine', 0.04);
                        // Khi chọn 1 số trên ván, đồng bộ nhảy đúng số đó ở dãy số phía dưới
                        const cellVal = currentBoard[r]?.[c];
                        if (cellVal !== 0) {
                          setHighlightedNumber(cellVal);
                        }
                      }
                    }}
                    className={getCellClassName(r, c)}
                  >
                    {val !== 0 ? (
                      <span className="scale-95 transform sm:scale-100 z-10">{val}</span>
                    ) : (
                      /* Display Pencil Marks Notes inside cell */
                      <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-0.5 text-[8px] sm:text-[10px] leading-none text-slate-400 font-light font-mono z-10">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                          <div key={num} className="flex items-center justify-center">
                            {cellNotes.includes(num) ? num : ""}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Secondary Action Toolbar: Pencil, Erase, Hints, Undo, Redo */}
        <div className="w-full grid grid-cols-5 gap-2 px-1">
          {/* Notes Toggle Pencil */}
          <button
            id="tool-pencil-btn"
            onClick={() => {
              setIsNotesMode(prev => !prev);
              playTone(600, 'sine', 0.05);
            }}
            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition ${
              isNotesMode
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <div className="relative">
              <Pencil className="w-4 h-4 sm:w-5 h-5" />
              {isNotesMode && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              )}
            </div>
            <span className="text-[9px] sm:text-xs font-medium mt-1">Ghi chú</span>
          </button>

          {/* Erase Tool */}
          <button
            id="tool-erase-btn"
            onClick={handleErase}
            disabled={!selectedCell}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:pointer-events-none"
          >
            <Trash2 className="w-4 h-4 sm:w-5 h-5 text-rose-400" />
            <span className="text-[9px] sm:text-xs font-medium mt-1">Xóa</span>
          </button>

          {/* Hint Tool */}
          <button
            id="tool-hint-btn"
            onClick={handleHint}
            disabled={!selectedCell || (selectedCell && initialBoard[selectedCell[0]]?.[selectedCell[1]] !== 0)}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:pointer-events-none"
          >
            <div className="relative">
              <Lightbulb className="w-4 h-4 sm:w-5 h-5 text-amber-400 animate-pulse" />
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-[8px] border border-slate-950 font-bold px-1 rounded-full text-slate-950">
                {hintsUsed}
              </span>
            </div>
            <span className="text-[9px] sm:text-xs font-medium mt-1">Gợi ý</span>
          </button>

          {/* Undo Action */}
          <button
            id="tool-undo-btn"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:pointer-events-none"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 h-5 text-indigo-400" />
            <span className="text-[9px] sm:text-xs font-medium mt-1">Hoàn tác</span>
          </button>

          {/* Redo Action */}
          <button
            id="tool-redo-btn"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:pointer-events-none"
          >
            <RotateCw className="w-4 h-4 sm:w-5 h-5 text-indigo-400" />
            <span className="text-[9px] sm:text-xs font-medium mt-1">Kế tiếp</span>
          </button>
        </div>

        {/* Standard Numeric Keyboard */}
        <div className="w-full">
          <div className="grid grid-cols-9 gap-1 sm:gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              // Count remaining times number can be entered
              let placedCount = 0;
              currentBoard.forEach(row => {
                row.forEach(val => {
                  if (val === num) placedCount++;
                });
              });
              const remaining = Math.max(0, 9 - placedCount);
              const isFull = remaining === 0;
              const isActiveHighlight = activeNum === num;

              return (
                <button
                  key={num}
                  id={`keypad-number-${num}`}
                  onClick={() => handleKeypadClick(num)}
                  className={`py-2 sm:py-3 justify-center flex flex-col items-center text-lg sm:text-2xl font-black rounded-xl transition-all relative ${
                    isActiveHighlight
                      ? 'bg-indigo-600 border border-indigo-400 text-white cursor-pointer ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 scale-105'
                      : isFull 
                        ? 'bg-slate-950/40 border border-slate-950 text-slate-600 hover:bg-slate-950/60 cursor-pointer'
                        : 'bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white cursor-pointer active:scale-95'
                  }`}
                >
                  <span className={isActiveHighlight ? 'text-white' : isFull ? 'text-slate-600' : 'text-slate-100'}>{num}</span>
                  {/* Remaining places badge indicator */}
                  <span className={`text-[10px] sm:text-xs font-mono font-bold leading-none mt-0.5 tracking-tight ${
                    isActiveHighlight ? 'text-indigo-200' : isFull ? 'text-slate-700/80 font-normal' : 'text-indigo-400'
                  }`}>
                    ({remaining})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Reset / Restart trigger */}
        <div className="w-full flex justify-between items-center text-xs text-slate-505 text-slate-400 px-1 border-t border-slate-900 pt-3">
          <div className="flex items-center gap-1.5">
            <button
              id="giveup-game-btn"
              onClick={handleGiveUp}
              disabled={showStartScreen || isGivenUp || gameWon || gameOver}
              className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-bold transition disabled:opacity-20 disabled:pointer-events-none"
              title="Xin thua và xem lời khuyên"
            >
              🏳️ Xin Thua (Bỏ Cuộc)
            </button>
          </div>
          <button
            id="global-restart-btn"
            onClick={() => {
              if (!showStartScreen && !isGivenUp && !gameWon && !gameOver) {
                setConfirmModal({
                  title: 'Bắt Đầu Ván Mới?',
                  message: `Bạn muốn khởi tạo một ván Sudoku hoàn toàn mới ở cấp độ ${
                    difficulty === 'easy' ? 'Dễ' : difficulty === 'medium' ? 'Trung Bình' : difficulty === 'hard' ? 'Khó' : 'Chuyên Gia'
                  } không?`,
                  confirmText: 'Đồng ý tạo',
                  cancelText: 'Hủy bỏ',
                  onConfirm: () => {
                    startNewGame(difficulty);
                    setConfirmModal(null);
                    showToast('Đã khởi tạo ván đấu mới!');
                  }
                });
              } else {
                setShowStartScreen(true);
                setIsGivenUp(false);
                setGameWon(false);
                setGameOver(false);
              }
            }}
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {showStartScreen || isGivenUp || gameWon || gameOver ? "Đổi Cấp Độ" : "Tạo Ván Mới"}
          </button>
        </div>
      </main>

      {/* Stats Record Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative animate-scale-up">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Kỷ Lục Đạt Được
            </h3>

            <div className="space-y-3 mb-6">
              {[
                { label: 'Dễ', key: 'easy' },
                { label: 'Trung Bình', key: 'medium' },
                { label: 'Khó', key: 'hard' },
                { label: 'Chuyên Gia', key: 'expert' },
              ].map((item) => {
                const record = bestTimes[item.key as keyof BestTimes];
                return (
                  <div key={item.key} className="flex justify-between items-center p-2 bg-slate-950/50 rounded-lg border border-slate-950">
                    <span className="text-slate-400 font-medium text-sm">{item.label}</span>
                    <span className="text-white font-mono font-bold">
                      {record !== null ? formatTime(record) : '--:--'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                id="reset-stats-btn"
                onClick={resetBestTimes}
                className="flex-1 py-2 text-xs bg-red-950/20 text-red-400 hover:bg-red-950/40 hover:text-red-300 border border-red-900/30 rounded-xl transition"
              >
                Xóa Kỷ Lục
              </button>
              <button
                id="close-stats-modal-btn"
                onClick={() => setShowStatsModal(false)}
                className="flex-1 py-2 text-xs bg-slate-850 bg-slate-800 hover:bg-slate-700 transition rounded-xl text-white font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div id="custom-confirm-modal" className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-5 sm:p-6 shadow-2xl relative animate-scale-up">
            <h3 className="text-base sm:text-lg font-black text-white mb-2 flex items-center gap-2 uppercase tracking-wide">
              {confirmModal.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex gap-2.5">
              <button
                id="custom-confirm-cancel-btn"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 text-xs bg-slate-800 hover:bg-slate-700 transition rounded-xl text-slate-300 font-bold cursor-pointer"
              >
                {confirmModal.cancelText}
              </button>
              <button
                id="custom-confirm-ok-btn"
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2.5 text-xs bg-indigo-600 hover:bg-indigo-500 transition rounded-xl text-white font-bold shadow-lg shadow-indigo-600/15 cursor-pointer"
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Toast Notification */}
      {toastMessage && (
        <div id="custom-toast" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-800 text-indigo-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <span>✨ {toastMessage}</span>
        </div>
      )}
    </div>
  );
}
