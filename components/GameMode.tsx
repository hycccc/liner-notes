'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { ArrowLeft, ArrowRight, Flag, RefreshCcw, X } from 'lucide-react';

interface GameModeProps {
  onClose: () => void;
  isDark: boolean;
}

type PlayableView = 'select' | '2048' | 'minesweeper' | 'flappy' | 'dino';
type GameView = PlayableView;
type PlayableGameView = Exclude<PlayableView, 'select'>;
type Direction2048 = 'up' | 'down' | 'left' | 'right';
type MinesDifficultyId = 'easy' | 'medium' | 'expert';
type MinesStatus = 'ready' | 'playing' | 'won' | 'lost';

interface CellPosition {
  row: number;
  col: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const seededRandom = (seed: number) => {
  const raw = Math.sin(seed * 91.173 + 17.7) * 43758.5453123;
  return raw - Math.floor(raw);
};
const readStoredBest = (key: string) => {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(key);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const EASE_BOUNCY = 'cubic-bezier(0.16, 1, 0.3, 1)';

type Grid2048 = number[][];

interface Tile2048 {
  id: number;
  value: number;
  row: number;
  col: number;
  prevRow?: number;
  prevCol?: number;
  isNew: boolean;
  isMerged: boolean;
  isMergingOut?: boolean;
}

interface MergeEvent2048 extends CellPosition {
  value: number;
}

interface ScoreBurst2048 extends MergeEvent2048 {
  id: number;
}

interface Game2048State {
  tiles: Tile2048[];
  score: number;
  best: number;
  won: boolean;
  victoryShown: boolean;
  lost: boolean;
  scoreBursts: ScoreBurst2048[];
  scorePulse: boolean;
  bestRecordPulse: boolean;
  celebrationFlash: boolean;
}

interface RandomSpawn2048 extends CellPosition {
  value: number;
}

interface MoveResult2048 {
  moved: boolean;
  scoreGain: number;
  mergeEvents: MergeEvent2048[];
  resolvedTiles: Tile2048[];
  animationTiles: Tile2048[];
}

interface LineTile2048 {
  tile: Tile2048;
  sourceOffset: number;
}

const GRID_SIZE_2048 = 4;
const STORAGE_KEY_2048_BEST = 'game-mode-2048-best';
const STORAGE_KEY_FLAPPY_BEST = 'game-mode-flappy-best';
const STORAGE_KEY_DINO_BEST = 'game-mode-dino-best';
const TILE_SLIDE_MS_2048 = 120;
const TILE_MERGE_BOUNCE_MS_2048 = 180;
const TILE_SPAWN_DELAY_MS_2048 = 150;
const TILE_VISUAL_GAP_PX_2048 = 8;
const SELECTION_DRAG_THRESHOLD_PX = 3;
const SELECTION_SWIPE_DISTANCE_RATIO = 0.17;
const SELECTION_SWIPE_VELOCITY = 0.45;
const SELECTION_CARD_PEEK_PX = 40;

const createEmpty2048Grid = (): Grid2048 =>
  Array.from({ length: GRID_SIZE_2048 }, () => Array(GRID_SIZE_2048).fill(0));

const positionKey2048 = (row: number, col: number) => `${row}-${col}`;

const getLineCells2048 = (lineIndex: number, direction: Direction2048): CellPosition[] => {
  const cells: CellPosition[] = [];
  for (let offset = 0; offset < GRID_SIZE_2048; offset += 1) {
    switch (direction) {
      case 'left':
        cells.push({ row: lineIndex, col: offset });
        break;
      case 'right':
        cells.push({ row: lineIndex, col: GRID_SIZE_2048 - 1 - offset });
        break;
      case 'up':
        cells.push({ row: offset, col: lineIndex });
        break;
      case 'down':
        cells.push({ row: GRID_SIZE_2048 - 1 - offset, col: lineIndex });
        break;
    }
  }
  return cells;
};

const createGridFromTiles2048 = (tiles: Tile2048[]): Grid2048 => {
  const grid = createEmpty2048Grid();
  tiles.forEach((tile) => {
    if (tile.isMergingOut) return;
    if (tile.row < 0 || tile.col < 0 || tile.row >= GRID_SIZE_2048 || tile.col >= GRID_SIZE_2048) return;
    grid[tile.row][tile.col] = tile.value;
  });
  return grid;
};

const pickRandomSpawns2048 = (tiles: Tile2048[], count: number): RandomSpawn2048[] => {
  const tempGrid = createGridFromTiles2048(tiles);
  const spawned: RandomSpawn2048[] = [];

  for (let index = 0; index < count; index += 1) {
    const emptyCells: CellPosition[] = [];
    for (let row = 0; row < GRID_SIZE_2048; row += 1) {
      for (let col = 0; col < GRID_SIZE_2048; col += 1) {
        if (tempGrid[row][col] === 0) emptyCells.push({ row, col });
      }
    }

    if (emptyCells.length === 0) break;
    const picked = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    tempGrid[picked.row][picked.col] = value;
    spawned.push({ ...picked, value });
  }

  return spawned;
};

const createTilesFromSpawns2048 = (
  spawns: RandomSpawn2048[],
  nextTileId: () => number,
  isNew: boolean
): Tile2048[] =>
  spawns.map((spawn) => ({
    id: nextTileId(),
    value: spawn.value,
    row: spawn.row,
    col: spawn.col,
    prevRow: spawn.row,
    prevCol: spawn.col,
    isNew,
    isMerged: false,
  }));

const moveTiles2048 = (tiles: Tile2048[], direction: Direction2048): MoveResult2048 => {
  const baseTiles = tiles.filter((tile) => !tile.isMergingOut);
  const tileByPosition = new Map<string, Tile2048>();
  baseTiles.forEach((tile) => {
    tileByPosition.set(positionKey2048(tile.row, tile.col), tile);
  });

  const resolvedTiles: Tile2048[] = [];
  const animationTiles: Tile2048[] = [];
  const mergeEvents: MergeEvent2048[] = [];
  let moved = false;
  let scoreGain = 0;

  for (let lineIndex = 0; lineIndex < GRID_SIZE_2048; lineIndex += 1) {
    const lineCells = getLineCells2048(lineIndex, direction);
    const lineTiles: LineTile2048[] = lineCells
      .map((cell, offset) => {
        const tile = tileByPosition.get(positionKey2048(cell.row, cell.col));
        return tile ? { tile, sourceOffset: offset } : null;
      })
      .filter((entry): entry is LineTile2048 => Boolean(entry));

    let nextOffset = 0;
    let pendingMerge:
      | {
          tile: Tile2048;
          targetOffset: number;
          merged: boolean;
        }
      | null = null;

    lineTiles.forEach(({ tile, sourceOffset }) => {
      if (pendingMerge && !pendingMerge.merged && pendingMerge.tile.value === tile.value) {
        const targetCell = lineCells[pendingMerge.targetOffset];
        const mergedReceiver: Tile2048 = {
          ...pendingMerge.tile,
          value: pendingMerge.tile.value * 2,
          row: targetCell.row,
          col: targetCell.col,
          isMerged: true,
          isNew: false,
          isMergingOut: false,
        };

        resolvedTiles[resolvedTiles.length - 1] = mergedReceiver;
        animationTiles[animationTiles.length - 1] = mergedReceiver;
        pendingMerge = { ...pendingMerge, tile: mergedReceiver, merged: true };

        animationTiles.push({
          ...tile,
          prevRow: tile.row,
          prevCol: tile.col,
          row: targetCell.row,
          col: targetCell.col,
          isNew: false,
          isMerged: false,
          isMergingOut: true,
        });

        const mergedValue = mergedReceiver.value;
        scoreGain += mergedValue;
        mergeEvents.push({ ...targetCell, value: mergedValue });
        moved = true;
        return;
      }

      const targetCell = lineCells[nextOffset];
      const nextTile: Tile2048 = {
        ...tile,
        prevRow: tile.row,
        prevCol: tile.col,
        row: targetCell.row,
        col: targetCell.col,
        isNew: false,
        isMerged: false,
        isMergingOut: false,
      };

      if (tile.row !== targetCell.row || tile.col !== targetCell.col || sourceOffset !== nextOffset) {
        moved = true;
      }

      resolvedTiles.push(nextTile);
      animationTiles.push(nextTile);
      pendingMerge = { tile: nextTile, targetOffset: nextOffset, merged: false };
      nextOffset += 1;
    });
  }

  return { moved, scoreGain, mergeEvents, resolvedTiles, animationTiles };
};

const canMove2048 = (grid: Grid2048) => {
  for (let row = 0; row < GRID_SIZE_2048; row += 1) {
    for (let col = 0; col < GRID_SIZE_2048; col += 1) {
      const value = grid[row][col];
      if (value === 0) return true;
      if (row + 1 < GRID_SIZE_2048 && grid[row + 1][col] === value) return true;
      if (col + 1 < GRID_SIZE_2048 && grid[row][col + 1] === value) return true;
    }
  }
  return false;
};

const hasReached2048 = (grid: Grid2048) => {
  for (let row = 0; row < GRID_SIZE_2048; row += 1) {
    for (let col = 0; col < GRID_SIZE_2048; col += 1) {
      if (grid[row][col] >= 2048) return true;
    }
  }
  return false;
};

const createInitial2048State = (best: number, nextTileId: () => number): Game2048State => {
  const spawned = pickRandomSpawns2048([], 2);
  return {
    tiles: createTilesFromSpawns2048(spawned, nextTileId, true),
    score: 0,
    best,
    won: false,
    victoryShown: false,
    lost: false,
    scoreBursts: [],
    scorePulse: false,
    bestRecordPulse: false,
    celebrationFlash: false,
  };
};

const get2048TileClass = (value: number) => {
  switch (value) {
    case 2:
      return 'from-zinc-100 to-zinc-200 text-zinc-700 shadow-[0_10px_20px_rgba(113,113,122,0.22)]';
    case 4:
      return 'from-amber-100 to-amber-200 text-amber-800 shadow-[0_10px_20px_rgba(217,119,6,0.24)]';
    case 8:
      return 'from-orange-400 to-orange-500 text-white shadow-[0_14px_28px_rgba(249,115,22,0.45)]';
    case 16:
      return 'from-orange-500 to-red-500 text-white shadow-[0_14px_30px_rgba(239,68,68,0.46)]';
    case 32:
      return 'from-red-500 to-pink-500 text-white shadow-[0_16px_32px_rgba(244,63,94,0.48)]';
    case 64:
      return 'from-red-600 to-rose-600 text-white shadow-[0_18px_36px_rgba(225,29,72,0.56)]';
    case 128:
      return 'from-yellow-400 to-amber-500 text-white shadow-[0_18px_36px_rgba(245,158,11,0.55)]';
    case 256:
      return 'from-yellow-500 to-orange-400 text-white shadow-[0_18px_36px_rgba(249,115,22,0.52)]';
    case 512:
      return 'from-emerald-400 to-teal-500 text-white shadow-[0_18px_36px_rgba(20,184,166,0.5)]';
    case 1024:
      return 'from-blue-500 to-indigo-600 text-white shadow-[0_20px_40px_rgba(59,130,246,0.58)]';
    case 2048:
      return 'from-fuchsia-500 via-orange-400 to-cyan-400 text-white shadow-[0_24px_46px_rgba(236,72,153,0.62)]';
    default:
      return 'from-orange-500 to-pink-500 text-white shadow-[0_20px_40px_rgba(249,115,22,0.55)]';
  }
};

const get2048TileStyle = (value: number): CSSProperties | undefined => {
  if (value <= 2048) return undefined;
  const hue = Math.max(0, 36 - Math.log2(value) * 2.2);
  return {
    background: `linear-gradient(130deg, hsl(${hue} 94% 58%), hsl(${Math.max(0, hue - 14)} 86% 46%))`,
  };
};

const get2048TileFontSize = (value: number) => {
  if (value >= 16384) return 14;
  if (value >= 1024) return 18;
  if (value >= 128) return 24;
  return 30;
};

interface MinesConfig {
  id: MinesDifficultyId;
  label: string;
  rows: number;
  cols: number;
  mines: number;
  mobileVisible: boolean;
}

interface MinesCell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
  exploded: boolean;
}

type MinesBoard = MinesCell[][];

interface MinesState {
  config: MinesConfig;
  board: MinesBoard;
  status: MinesStatus;
  flags: number;
  elapsedMs: number;
  startedAt: number | null;
  endedAt: number | null;
  firstClickDone: boolean;
  pendingReveal: CellPosition[];
}

const MINES_CONFIGS: MinesConfig[] = [
  { id: 'easy', label: 'Easy 9×9 · 10 mines', rows: 9, cols: 9, mines: 10, mobileVisible: true },
  { id: 'medium', label: 'Medium 16×16 · 40 mines', rows: 16, cols: 16, mines: 40, mobileVisible: true },
  { id: 'expert', label: 'Expert 16×30 · 99 mines', rows: 16, cols: 30, mines: 99, mobileVisible: false },
];

const createEmptyMinesBoard = (config: MinesConfig): MinesBoard =>
  Array.from({ length: config.rows }, () =>
    Array.from({ length: config.cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
      exploded: false,
    }))
  );

const cloneMinesBoard = (board: MinesBoard): MinesBoard =>
  board.map((row) => row.map((cell) => ({ ...cell })));

const getMinesNeighbors = (row: number, col: number, rows: number, cols: number): CellPosition[] => {
  const neighbors: CellPosition[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      neighbors.push({ row: nr, col: nc });
    }
  }
  return neighbors;
};

const placeMinesOnBoard = (
  board: MinesBoard,
  mines: number,
  safeRow: number,
  safeCol: number
): MinesBoard => {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const nextBoard = cloneMinesBoard(board);
  const candidates: CellPosition[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (row === safeRow && col === safeCol) continue;
      candidates.push({ row, col });
    }
  }

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const pickedIndex = Math.floor(Math.random() * (index + 1));
    const temp = candidates[index];
    candidates[index] = candidates[pickedIndex];
    candidates[pickedIndex] = temp;
  }

  for (let index = 0; index < Math.min(mines, candidates.length); index += 1) {
    const picked = candidates[index];
    nextBoard[picked.row][picked.col].mine = true;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (nextBoard[row][col].mine) {
        nextBoard[row][col].adjacent = 0;
        continue;
      }
      const adjacentMines = getMinesNeighbors(row, col, rows, cols).reduce((count, pos) => {
        return count + (nextBoard[pos.row][pos.col].mine ? 1 : 0);
      }, 0);
      nextBoard[row][col].adjacent = adjacentMines;
    }
  }

  return nextBoard;
};

const floodRevealMines = (board: MinesBoard, startRow: number, startCol: number) => {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const queue: CellPosition[] = [{ row: startRow, col: startCol }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const cell = board[current.row][current.col];
    if (cell.revealed || cell.flagged) continue;

    cell.revealed = true;
    if (cell.mine || cell.adjacent > 0) continue;

    getMinesNeighbors(current.row, current.col, rows, cols).forEach((neighbor) => {
      const nextCell = board[neighbor.row][neighbor.col];
      if (!nextCell.revealed && !nextCell.flagged && !nextCell.mine) {
        queue.push(neighbor);
      }
    });
  }
};

const checkMinesWin = (board: MinesBoard) => {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const cell = board[row][col];
      if (!cell.mine && !cell.revealed) return false;
    }
  }
  return true;
};

const createInitialMinesState = (config: MinesConfig): MinesState => ({
  config,
  board: createEmptyMinesBoard(config),
  status: 'ready',
  flags: 0,
  elapsedMs: 0,
  startedAt: null,
  endedAt: null,
  firstClickDone: false,
  pendingReveal: [],
});

const formatElapsedMs = (milliseconds: number) => {
  const safeMs = Math.max(0, milliseconds);
  const totalSeconds = Math.floor(safeMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const ms = safeMs % 1000;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

const getMinesNumberGradientClass = (value: number, isDark: boolean) => {
  switch (value) {
    case 1:
      return 'from-blue-500 to-cyan-400';
    case 2:
      return 'from-green-500 to-emerald-400';
    case 3:
      return 'from-red-500 to-orange-400';
    case 4:
      return 'from-indigo-500 to-purple-500';
    case 5:
      return 'from-rose-500 to-red-500';
    case 6:
      return 'from-cyan-500 to-blue-500';
    case 7:
      return isDark ? 'from-zinc-100 to-zinc-200' : 'from-zinc-900 to-zinc-700';
    case 8:
      return 'from-zinc-500 to-zinc-400';
    default:
      return isDark ? 'from-zinc-100 to-zinc-300' : 'from-zinc-700 to-zinc-500';
  }
};

type PreviewTile = {
  value: number;
  delay: number;
  glow: boolean;
};

function Selection2048Preview({ isDark }: { isDark: boolean }) {
  const tiles = useMemo<PreviewTile[]>(
    () =>
      Array.from({ length: 16 }, (_, index) => {
        const random = seededRandom(index * 13 + 7);
        const value =
          random > 0.86
            ? 64
            : random > 0.73
            ? 32
            : random > 0.58
            ? 16
            : random > 0.42
            ? 8
            : random > 0.24
            ? 4
            : random > 0.1
            ? 2
            : 0;
        return {
          value,
          delay: seededRandom(index * 7 + 5) * 1.8,
          glow: seededRandom(index * 9 + 11) > 0.64,
        };
      }),
    []
  );

  return (
    <div
      className={`relative grid h-full w-full grid-cols-4 gap-2 rounded-2xl border p-3 ${
        isDark
          ? 'border-white/10 bg-gradient-to-br from-zinc-900/85 to-zinc-950/85'
          : 'border-zinc-200 bg-gradient-to-br from-zinc-100 to-zinc-200/70'
      }`}
    >
      {tiles.map((tile, index) => (
        <div
          key={`preview-2048-${index}`}
          className={`relative aspect-square overflow-hidden rounded-lg ${
            isDark
              ? 'bg-gradient-to-br from-zinc-800/80 to-zinc-900 shadow-[inset_0_2px_6px_rgba(255,255,255,0.05)]'
              : 'bg-gradient-to-br from-white to-zinc-200 shadow-[inset_0_1px_5px_rgba(255,255,255,0.8)]'
          } ${tile.glow ? 'gm-preview-flicker' : ''}`}
          style={{ animationDelay: `${tile.delay}s` }}
        >
          {tile.value > 0 && (
            <span
              className={`absolute inset-0 flex items-center justify-center rounded-lg bg-gradient-to-br text-sm font-black ${get2048TileClass(
                tile.value
              )}`}
            >
              {tile.value}
            </span>
          )}
        </div>
      ))}
      <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-orange-400/30 px-2 py-1 text-[10px] font-black tracking-[0.2em] text-orange-100">
        2048
      </span>
    </div>
  );
}

type MinesPreviewCell =
  | { type: 'hidden'; delay: number }
  | { type: 'flag'; delay: number }
  | { type: 'mine'; delay: number }
  | { type: 'number'; value: number; delay: number };

function SelectionMinesPreview({ isDark }: { isDark: boolean }) {
  const cells = useMemo<MinesPreviewCell[]>(
    () =>
      Array.from({ length: 36 }, (_, index) => {
        const random = seededRandom(index * 17 + 2);
        const delay = seededRandom(index * 19 + 4) * 2;
        if (random > 0.9) return { type: 'mine', delay };
        if (random > 0.8) return { type: 'flag', delay };
        if (random > 0.42) {
          return {
            type: 'number',
            value: 1 + Math.floor(seededRandom(index * 23 + 8) * 8),
            delay,
          };
        }
        return { type: 'hidden', delay };
      }),
    []
  );

  return (
    <div
      className={`relative grid h-full w-full grid-cols-6 gap-1.5 rounded-2xl border p-3 ${
        isDark
          ? 'border-white/10 bg-gradient-to-br from-zinc-900/85 to-zinc-950/85'
          : 'border-zinc-200 bg-gradient-to-br from-zinc-100 to-zinc-200/70'
      }`}
    >
      {cells.map((cell, index) => (
        <span
          key={`preview-mines-${index}`}
          className={`relative flex aspect-square items-center justify-center rounded-md text-[11px] font-black ${
            cell.type === 'hidden'
              ? isDark
                ? 'bg-gradient-to-br from-zinc-700 to-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_3px_6px_rgba(0,0,0,0.25)]'
                : 'bg-gradient-to-br from-white to-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_2px_4px_rgba(0,0,0,0.08)]'
              : isDark
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900'
              : 'bg-gradient-to-br from-zinc-100 to-zinc-200'
          } ${cell.type !== 'hidden' ? 'gm-preview-flicker' : ''}`}
          style={{ animationDelay: `${cell.delay}s` }}
        >
          {cell.type === 'number' && (
            <span
              className={`bg-gradient-to-r bg-clip-text text-transparent ${getMinesNumberGradientClass(
                cell.value,
                isDark
              )}`}
            >
              {cell.value}
            </span>
          )}
          {cell.type === 'flag' && <Flag className="h-3 w-3 text-orange-500" />}
          {cell.type === 'mine' && <span className="gm-preview-bomb" />}
        </span>
      ))}
      <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-cyan-400/25 px-2 py-1 text-[10px] font-black tracking-[0.2em] text-cyan-100">
        MINES
      </span>
    </div>
  );
}

interface GameSelectionCardProps {
  mode: PlayableGameView;
  title: string;
  subtitle: string;
  isDark: boolean;
  isCurrent: boolean;
  isAdjacent: boolean;
  entered: boolean;
  delay: number;
  selecting: boolean;
  dimmed: boolean;
  onSelect: () => void;
}

function GameSelectionCard({
  mode,
  title,
  subtitle,
  isDark,
  isCurrent,
  isAdjacent,
  entered,
  delay,
  selecting,
  dimmed,
  onSelect,
}: GameSelectionCardProps) {
  const baseScale = selecting ? 0.96 : dimmed ? 0.9 : isCurrent ? 1 : isAdjacent ? 0.92 : 0.86;
  const opacity = entered ? (dimmed ? 0.44 : isCurrent ? 1 : isAdjacent ? 0.7 : 0.4) : 0;
  const entryTranslate = entered ? 0 : 48;
  const isWarm = mode === '2048';

  const preview = (() => {
    switch (mode) {
      case '2048':
        return <Selection2048Preview isDark={isDark} />;
      case 'minesweeper':
        return <SelectionMinesPreview isDark={isDark} />;
      case 'flappy':
        return (
          <div
            className={`relative h-full w-full overflow-hidden rounded-2xl border ${
              isDark
                ? 'border-white/10 bg-gradient-to-b from-sky-900/85 via-blue-900/72 to-indigo-950/85'
                : 'border-sky-200 bg-gradient-to-b from-sky-200/95 via-cyan-100 to-blue-200/90'
            }`}
          >
            <span className="gm-flappy-preview-cloud absolute left-[8%] top-[14%] h-4 w-10 rounded-full bg-white/70" />
            <span className="gm-flappy-preview-cloud absolute left-[58%] top-[26%] h-5 w-12 rounded-full bg-white/55" />
            <span className={`gm-flappy-preview-pipe absolute bottom-0 left-[22%] w-7 ${isDark ? 'brightness-90' : ''}`} />
            <span className={`gm-flappy-preview-pipe gm-flappy-preview-pipe-top absolute left-[66%] top-0 w-7 ${isDark ? 'brightness-90' : ''}`} />
            <span
              className={`gm-flappy-preview-bird absolute left-[42%] top-[42%] h-9 w-11 rounded-full ${
                isDark
                  ? 'bg-[linear-gradient(135deg,#facc15_0%,#f97316_55%,#ef4444_100%)]'
                  : 'bg-[linear-gradient(135deg,#fde047_0%,#fb923c_55%,#f43f5e_100%)]'
              }`}
            >
              <span className="gm-flappy-preview-wing absolute left-[30%] top-[44%] h-4 w-5 rounded-full bg-orange-200/80" />
              <span className="absolute right-[18%] top-[34%] h-2 w-2 rounded-full bg-zinc-900/90" />
            </span>
          </div>
        );
      case 'dino':
        return (
          <div
            className={`relative h-full w-full overflow-hidden rounded-2xl border ${
              isDark
                ? 'border-white/10 bg-gradient-to-b from-zinc-900/90 to-zinc-950/92'
                : 'border-zinc-200 bg-gradient-to-b from-zinc-100 to-zinc-200/85'
            }`}
          >
            <span className={`absolute inset-x-0 bottom-7 h-px ${isDark ? 'bg-zinc-500' : 'bg-zinc-500'}`} />
            <span className={`absolute inset-x-0 bottom-5 h-[2px] ${isDark ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
            <span className={`gm-dino-preview-cactus absolute bottom-5 left-[65%] h-10 w-4 rounded-sm ${isDark ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
            <span className={`gm-dino-preview-cactus absolute bottom-5 left-[86%] h-7 w-3 rounded-sm ${isDark ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
            <span className={`gm-dino-preview-runner absolute bottom-5 left-[25%] h-10 w-10 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`} />
          </div>
        );
    }
  })();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect();
      }}
      className={`gm-selection-card group relative isolate w-full overflow-hidden rounded-3xl border p-0 text-left transition-all duration-300 ${
        isDark ? 'border-white/10' : 'border-zinc-200'
      }`}
      style={{
        height: '100%',
        opacity,
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: EASE_BOUNCY,
        transform: `translate3d(0, ${entryTranslate}px, 0) scale(${baseScale})`,
      }}
      aria-label={`Play ${title}`}
    >
      <span className={`gm-selection-gradient absolute inset-0 ${isWarm ? 'gm-selection-warm' : mode === 'minesweeper' ? 'gm-selection-cool' : mode === 'flappy' ? 'gm-selection-sky' : 'gm-selection-mono'}`} />
      <span
        className={`absolute inset-0 rounded-3xl ${
          isDark ? 'bg-zinc-950/68' : 'bg-zinc-50/72'
        } backdrop-blur-xl`}
      />
      <span
        className={`gm-selection-border-glow absolute inset-[1px] rounded-[1.4rem] border ${
          isWarm ? 'border-orange-400/25' : 'border-cyan-400/25'
        }`}
      />

      <span className="relative z-10 flex h-full flex-col p-4 sm:p-6">
        <span className="mb-4 flex-[1.05]">
          {preview}
        </span>
        <span className="space-y-1.5">
          <span className={`block text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
            {title}
          </span>
          {subtitle.trim().length > 0 && (
            <span className={`block text-xs sm:text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{subtitle}</span>
          )}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          className={`mt-5 inline-flex w-full items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-150 group-hover:scale-[1.01] active:scale-[0.97] ${
            isWarm
              ? isDark
                ? 'border-orange-300/35 bg-gradient-to-r from-orange-500/26 to-pink-500/26 text-orange-100 group-hover:from-orange-500/35 group-hover:to-pink-500/35'
                : 'border-orange-300 bg-gradient-to-r from-orange-500/12 to-pink-500/16 text-orange-700 group-hover:from-orange-500/20 group-hover:to-pink-500/24'
              : mode === 'minesweeper'
              ? isDark
                ? 'border-cyan-300/35 bg-gradient-to-r from-blue-500/24 to-emerald-400/24 text-cyan-100 group-hover:from-blue-500/34 group-hover:to-emerald-400/34'
                : 'border-cyan-300 bg-gradient-to-r from-blue-500/12 to-emerald-400/16 text-sky-700 group-hover:from-blue-500/20 group-hover:to-emerald-400/24'
              : mode === 'flappy'
              ? isDark
                ? 'border-sky-300/40 bg-gradient-to-r from-sky-500/28 to-indigo-500/28 text-sky-100 group-hover:from-sky-500/36 group-hover:to-indigo-500/36'
                : 'border-sky-300 bg-gradient-to-r from-sky-500/14 to-indigo-500/14 text-sky-800 group-hover:from-sky-500/24 group-hover:to-indigo-500/24'
              : isDark
              ? 'border-zinc-200/35 bg-gradient-to-r from-zinc-700/45 to-zinc-500/32 text-zinc-100 group-hover:from-zinc-600/52 group-hover:to-zinc-400/44'
              : 'border-zinc-400 bg-gradient-to-r from-zinc-300/45 to-zinc-100/84 text-zinc-800 group-hover:from-zinc-300/62 group-hover:to-zinc-100'
          }`}
        >
          Start Game
        </button>
      </span>
    </article>
  );
}

interface FireworkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: number;
  size: number;
}

const getMinesStatusText = (status: MinesStatus) => {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'playing':
      return 'Playing';
    case 'won':
      return 'Victory';
    case 'lost':
      return 'Defeat';
  }
};

const getMinesCellAriaLabel = (
  row: number,
  col: number,
  cell: MinesCell,
  status: MinesStatus
) => {
  if (!cell.revealed) {
    if (cell.flagged) return `Cell row ${row + 1}, column ${col + 1}, flagged`;
    return `Cell row ${row + 1}, column ${col + 1}, hidden`;
  }
  if (cell.mine) {
    if (cell.exploded) return `Cell row ${row + 1}, column ${col + 1}, exploded mine`;
    return `Cell row ${row + 1}, column ${col + 1}, mine`;
  }
  if (cell.adjacent > 0) {
    return `Cell row ${row + 1}, column ${col + 1}, ${cell.adjacent} adjacent mines`;
  }
  if (status === 'won') return `Cell row ${row + 1}, column ${col + 1}, safely revealed`;
  return `Cell row ${row + 1}, column ${col + 1}, empty`;
};

interface SelectionOption {
  mode: PlayableGameView;
  title: string;
  subtitle: string;
}

const GAME_SELECTION_OPTIONS: SelectionOption[] = [
  { mode: '2048', title: '2048', subtitle: '' },
  { mode: 'minesweeper', title: 'Minesweeper', subtitle: '' },
  { mode: 'flappy', title: 'Flappy Bird', subtitle: '' },
  { mode: 'dino', title: 'Chrome Dino', subtitle: '' },
];

type FlappyStatus = 'idle' | 'playing' | 'dead';

interface FlappyPipe {
  x: number;
  width: number;
  gapY: number;
  gapHeight: number;
  passed: boolean;
}

interface FlappyRuntime {
  width: number;
  height: number;
  groundHeight: number;
  birdX: number;
  birdY: number;
  birdRadius: number;
  birdVelocity: number;
  birdRotation: number;
  gravity: number;
  flapImpulse: number;
  pipeSpeed: number;
  pipeWidth: number;
  pipeGap: number;
  spawnInterval: number;
  lastSpawnAt: number;
  lastTime: number;
  groundOffset: number;
  score: number;
  pipes: FlappyPipe[];
}

interface FlappyState {
  status: FlappyStatus;
  score: number;
  best: number;
}

type DinoStatus = 'idle' | 'playing' | 'dead';
type DinoObstacleKind = 1 | 2 | 3;

interface DinoObstacle {
  x: number;
  width: number;
  height: number;
  kind: DinoObstacleKind;
}

interface DinoRuntime {
  width: number;
  height: number;
  groundY: number;
  groundOffset: number;
  dinoX: number;
  dinoY: number;
  dinoWidth: number;
  dinoHeight: number;
  dinoVelocity: number;
  gravity: number;
  jumpImpulse: number;
  secondJumpImpulse: number;
  jumpsUsed: number;
  speed: number;
  runFrame: 0 | 1;
  runFrameTick: number;
  lastSpawnAt: number;
  lastTime: number;
  score: number;
  nextSpeedScore: number;
  obstacles: DinoObstacle[];
}

interface DinoState {
  status: DinoStatus;
  score: number;
  best: number;
}

export default function GameMode({ onClose, isDark }: GameModeProps) {
  const [activeView, setActiveView] = useState<GameView>('select');
  const [selectionEntered, setSelectionEntered] = useState(false);
  const [pendingView, setPendingView] = useState<PlayableGameView | null>(null);
  const [currentSelectionIndex, setCurrentSelectionIndex] = useState(0);
  const [selectionDragOffset, setSelectionDragOffset] = useState(0);
  const [selectionDragging, setSelectionDragging] = useState(false);
  const [selectionViewportWidth, setSelectionViewportWidth] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1280);
  const [viewportHeight, setViewportHeight] = useState(900);
  const selectionViewportRef = useRef<HTMLDivElement>(null);
  const selectionGestureRef = useRef<{
    pointerId: number;
    startX: number;
    latestX: number;
    startedAt: number;
    hasDragged: boolean;
  } | null>(null);
  const selectionTouchGestureRef = useRef<{
    startX: number;
    startY: number;
    latestX: number;
    latestY: number;
    startedAt: number;
    hasDragged: boolean;
  } | null>(null);
  const selectionSuppressSelectRef = useRef(false);
  const tileSpawnTimerRef = useRef<number | null>(null);
  const tileMoveLockRef = useRef(false);
  const boardShell2048Ref = useRef<HTMLDivElement>(null);
  const [boardSize2048, setBoardSize2048] = useState(0);

  const [game2048, setGame2048] = useState<Game2048State>(() => {
    let nextId = 1;
    const getInitialTileId = () => {
      const id = nextId;
      nextId += 1;
      return id;
    };
    if (typeof window === 'undefined') return createInitial2048State(0, getInitialTileId);
    return createInitial2048State(readStoredBest(STORAGE_KEY_2048_BEST), getInitialTileId);
  });
  const tileIdRef = useRef(game2048.tiles.reduce((maxId, tile) => Math.max(maxId, tile.id), 0) + 1);
  const getNextTileId2048 = useCallback(() => {
    const id = tileIdRef.current;
    tileIdRef.current += 1;
    return id;
  }, []);
  const game2048Ref = useRef<Game2048State>(game2048);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const burstIdRef = useRef(1);

  const [minesState, setMinesState] = useState<MinesState>(() => createInitialMinesState(MINES_CONFIGS[0]));
  const minesLongPressTimerRef = useRef<number | null>(null);
  const minesLongPressStateRef = useRef<{ row: number; col: number; triggered: boolean } | null>(null);
  const minesBoardShellRef = useRef<HTMLDivElement>(null);
  const minesFireworksCanvasRef = useRef<HTMLCanvasElement>(null);
  const [flappyState, setFlappyState] = useState<FlappyState>(() => ({
    status: 'idle',
    score: 0,
    best: readStoredBest(STORAGE_KEY_FLAPPY_BEST),
  }));
  const flappyCanvasRef = useRef<HTMLCanvasElement>(null);
  const flappyShellRef = useRef<HTMLDivElement>(null);
  const flappyBirdVisualRef = useRef<HTMLSpanElement>(null);
  const flappyRuntimeRef = useRef<FlappyRuntime | null>(null);
  const flappyStateRef = useRef(flappyState);
  const flappyRafRef = useRef<number | null>(null);

  const [dinoState, setDinoState] = useState<DinoState>(() => ({
    status: 'idle',
    score: 0,
    best: readStoredBest(STORAGE_KEY_DINO_BEST),
  }));
  const dinoCanvasRef = useRef<HTMLCanvasElement>(null);
  const dinoShellRef = useRef<HTMLDivElement>(null);
  const dinoRuntimeRef = useRef<DinoRuntime | null>(null);
  const dinoStateRef = useRef(dinoState);
  const dinoRafRef = useRef<number | null>(null);

  const viewSwitchTimerRef = useRef<number | null>(null);
  const clear2048SpawnTimer = useCallback(() => {
    if (tileSpawnTimerRef.current) {
      window.clearTimeout(tileSpawnTimerRef.current);
      tileSpawnTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    game2048Ref.current = game2048;
  }, [game2048]);

  useEffect(() => {
    flappyStateRef.current = flappyState;
  }, [flappyState]);

  useEffect(() => {
    dinoStateRef.current = dinoState;
  }, [dinoState]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (viewSwitchTimerRef.current) {
        clearTimeout(viewSwitchTimerRef.current);
      }
      if (minesLongPressTimerRef.current) {
        clearTimeout(minesLongPressTimerRef.current);
      }
      if (tileSpawnTimerRef.current) {
        clearTimeout(tileSpawnTimerRef.current);
      }
      if (flappyRafRef.current) {
        cancelAnimationFrame(flappyRafRef.current);
      }
      if (dinoRafRef.current) {
        cancelAnimationFrame(dinoRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (activeView === 'select') {
        onClose();
      } else {
        setActiveView('select');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView, onClose]);

  useEffect(() => {
    if (activeView !== 'select') return;
    const frame = window.setTimeout(() => setSelectionEntered(true), 50);
    return () => window.clearTimeout(frame);
  }, [activeView]);

  useEffect(() => {
    const syncViewport = () => {
      const mobile = window.innerWidth < 768;
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
      setIsMobileViewport(mobile);
      setMinesState((prev) => {
        const visible = mobile ? MINES_CONFIGS.filter((config) => config.mobileVisible) : MINES_CONFIGS;
        if (visible.some((config) => config.id === prev.config.id)) return prev;
        return createInitialMinesState(visible[0] ?? MINES_CONFIGS[0]);
      });
    };
    const frame = window.requestAnimationFrame(syncViewport);
    window.addEventListener('resize', syncViewport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  useEffect(() => {
    if (activeView !== '2048') return;
    const boardShell = boardShell2048Ref.current;
    if (!boardShell) return;

    const updateBoardSize = () => {
      setBoardSize2048(boardShell.clientWidth);
    };

    updateBoardSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateBoardSize);
      return () => window.removeEventListener('resize', updateBoardSize);
    }

    const resizeObserver = new ResizeObserver(updateBoardSize);
    resizeObserver.observe(boardShell);
    return () => resizeObserver.disconnect();
  }, [activeView]);

  useEffect(() => {
    if (activeView !== 'select') return;
    const viewport = selectionViewportRef.current;
    if (!viewport) return;

    const syncSelectionViewport = () => {
      setSelectionViewportWidth(viewport.clientWidth);
    };

    syncSelectionViewport();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncSelectionViewport);
      return () => window.removeEventListener('resize', syncSelectionViewport);
    }

    const resizeObserver = new ResizeObserver(syncSelectionViewport);
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, [activeView]);

  const visibleMinesConfigs = useMemo(
    () => (isMobileViewport ? MINES_CONFIGS.filter((config) => config.mobileVisible) : MINES_CONFIGS),
    [isMobileViewport]
  );

  const cardsCount = GAME_SELECTION_OPTIONS.length;
  const maxSelectionIndex = cardsCount - 1;
  const goSelectionIndex = useCallback((nextIndex: number) => {
    setCurrentSelectionIndex(clamp(nextIndex, 0, maxSelectionIndex));
  }, [maxSelectionIndex]);
  const selectionViewportWidthPx = Math.max(1, selectionViewportWidth > 0 ? selectionViewportWidth : viewportWidth);
  const selectionTrackGapPx = isMobileViewport ? 5 : 12;
  const selectionCardWidthPx = useMemo(() => {
    if (isMobileViewport) {
      const mobileTarget = Math.min(
        selectionViewportWidthPx * 0.75,
        selectionViewportWidthPx - SELECTION_CARD_PEEK_PX * 2
      );
      return clamp(mobileTarget, 220, Math.max(220, selectionViewportWidthPx - 24));
    }
    const desktopTarget = Math.min(360, selectionViewportWidthPx * 0.8);
    return clamp(
      desktopTarget,
      260,
      Math.max(260, selectionViewportWidthPx - SELECTION_CARD_PEEK_PX * 2)
    );
  }, [isMobileViewport, selectionViewportWidthPx]);
  const selectionTrackStepPx = selectionCardWidthPx + selectionTrackGapPx;
  const selectionTrackOffsetPx = useMemo(() => {
    const centeredOffset = (selectionViewportWidthPx - selectionCardWidthPx) / 2;
    return centeredOffset - currentSelectionIndex * selectionTrackStepPx + selectionDragOffset;
  }, [
    currentSelectionIndex,
    selectionCardWidthPx,
    selectionDragOffset,
    selectionTrackStepPx,
    selectionViewportWidthPx,
  ]);

  const handleSelectionPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (pendingView) return;
    if (event.pointerType === 'touch') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    selectionGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      latestX: event.clientX,
      startedAt: performance.now(),
      hasDragged: false,
    };
    selectionSuppressSelectRef.current = false;
    setSelectionDragging(false);
    setSelectionDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [pendingView]);

  const handleSelectionPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    const gesture = selectionGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    gesture.latestX = event.clientX;

    if (!gesture.hasDragged && Math.abs(deltaX) >= SELECTION_DRAG_THRESHOLD_PX) {
      gesture.hasDragged = true;
      selectionSuppressSelectRef.current = true;
      setSelectionDragging(true);
      if (event.pointerType === 'mouse' && !event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }

    if (!gesture.hasDragged) return;
    event.preventDefault();
    setSelectionDragOffset(deltaX);
  }, []);

  const finishSelectionGesture = useCallback((pointerId: number, clientX: number) => {
    const gesture = selectionGestureRef.current;
    if (!gesture || gesture.pointerId !== pointerId) return;

    const resolvedClientX = Number.isFinite(clientX) ? clientX : gesture.latestX;
    const deltaX = resolvedClientX - gesture.startX;
    const distance = Math.abs(deltaX);
    const elapsed = Math.max(12, performance.now() - gesture.startedAt);
    const velocity = deltaX / elapsed;
    const dragDetected = gesture.hasDragged || distance >= SELECTION_DRAG_THRESHOLD_PX;
    const switchDistance = Math.max(
      selectionCardWidthPx * SELECTION_SWIPE_DISTANCE_RATIO,
      SELECTION_DRAG_THRESHOLD_PX + 8
    );
    const shouldSwitch =
      dragDetected && (distance > switchDistance || Math.abs(velocity) > SELECTION_SWIPE_VELOCITY);

    if (shouldSwitch) {
      goSelectionIndex(currentSelectionIndex + (deltaX < 0 ? 1 : -1));
    } else {
      goSelectionIndex(currentSelectionIndex);
    }

    selectionGestureRef.current = null;
    setSelectionDragging(false);
    setSelectionDragOffset(0);
    if (dragDetected) {
      selectionSuppressSelectRef.current = true;
      window.setTimeout(() => {
        selectionSuppressSelectRef.current = false;
      }, 0);
      return;
    }
    selectionSuppressSelectRef.current = false;
  }, [currentSelectionIndex, goSelectionIndex, selectionCardWidthPx]);

  const handleSelectionPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    const latestX = selectionGestureRef.current?.latestX ?? event.clientX;
    finishSelectionGesture(event.pointerId, latestX);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [finishSelectionGesture]);

  const handleSelectionPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    const latestX = selectionGestureRef.current?.latestX ?? event.clientX;
    finishSelectionGesture(event.pointerId, latestX);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [finishSelectionGesture]);

  const selectView = useCallback(
    (view: PlayableGameView) => {
      if (pendingView) return;
      if (viewSwitchTimerRef.current) clearTimeout(viewSwitchTimerRef.current);
      const pickedIndex = GAME_SELECTION_OPTIONS.findIndex((option) => option.mode === view);
      if (pickedIndex >= 0) {
        setCurrentSelectionIndex(pickedIndex);
      }
      setSelectionEntered(false);
      setPendingView(view);
      viewSwitchTimerRef.current = window.setTimeout(() => {
        setActiveView(view);
        setPendingView(null);
      }, 320);
    },
    [pendingView]
  );

  useEffect(() => {
    if (activeView !== 'select') return;
    const viewport = selectionViewportRef.current;
    if (!viewport) return;

    const finishTouchGesture = (clientX: number, clientY: number) => {
      const gesture = selectionTouchGestureRef.current;
      if (!gesture) return;

      const resolvedClientX = Number.isFinite(clientX) ? clientX : gesture.latestX;
      const resolvedClientY = Number.isFinite(clientY) ? clientY : gesture.latestY;
      const deltaX = resolvedClientX - gesture.startX;
      const deltaY = resolvedClientY - gesture.startY;
      const distance = Math.abs(deltaX);
      const elapsed = Math.max(12, performance.now() - gesture.startedAt);
      const velocity = deltaX / elapsed;
      const dragDetected = gesture.hasDragged || distance >= SELECTION_DRAG_THRESHOLD_PX;
      const switchDistance = Math.max(
        selectionCardWidthPx * SELECTION_SWIPE_DISTANCE_RATIO,
        SELECTION_DRAG_THRESHOLD_PX + 8
      );
      const shouldSwitch =
        dragDetected && (distance > switchDistance || Math.abs(velocity) > SELECTION_SWIPE_VELOCITY);
      const isTap = Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5;

      if (shouldSwitch) {
        goSelectionIndex(currentSelectionIndex + (deltaX < 0 ? 1 : -1));
      } else {
        goSelectionIndex(currentSelectionIndex);
      }

      selectionTouchGestureRef.current = null;
      setSelectionDragging(false);
      setSelectionDragOffset(0);

      if (!shouldSwitch && isTap) {
        selectionSuppressSelectRef.current = true;
        const currentOption = GAME_SELECTION_OPTIONS[currentSelectionIndex];
        if (currentOption) {
          selectView(currentOption.mode);
        }
        window.setTimeout(() => {
          selectionSuppressSelectRef.current = false;
        }, 0);
        return;
      }

      if (dragDetected) {
        selectionSuppressSelectRef.current = true;
        window.setTimeout(() => {
          selectionSuppressSelectRef.current = false;
        }, 0);
        return;
      }
      selectionSuppressSelectRef.current = false;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (pendingView) return;
      const touch = event.touches[0];
      if (!touch) return;
      selectionTouchGestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        latestX: touch.clientX,
        latestY: touch.clientY,
        startedAt: performance.now(),
        hasDragged: false,
      };
      selectionSuppressSelectRef.current = false;
      setSelectionDragging(false);
      setSelectionDragOffset(0);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const gesture = selectionTouchGestureRef.current;
      if (!gesture) return;
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - gesture.startX;
      gesture.latestX = touch.clientX;
      gesture.latestY = touch.clientY;
      event.preventDefault();

      if (!gesture.hasDragged && Math.abs(deltaX) >= SELECTION_DRAG_THRESHOLD_PX) {
        gesture.hasDragged = true;
        selectionSuppressSelectRef.current = true;
        setSelectionDragging(true);
      }

      if (!gesture.hasDragged) return;
      setSelectionDragOffset(deltaX);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      finishTouchGesture(touch?.clientX ?? Number.NaN, touch?.clientY ?? Number.NaN);
    };

    const handleTouchCancel = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      finishTouchGesture(touch?.clientX ?? Number.NaN, touch?.clientY ?? Number.NaN);
    };

    viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd, { passive: false });
    viewport.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    return () => {
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
      viewport.removeEventListener('touchcancel', handleTouchCancel);
      selectionTouchGestureRef.current = null;
    };
  }, [activeView, currentSelectionIndex, goSelectionIndex, pendingView, selectionCardWidthPx, selectView]);

  const handleSelectionCardSelect = useCallback(
    (view: PlayableGameView) => {
      if (selectionSuppressSelectRef.current || selectionDragging) return;
      selectView(view);
    },
    [selectView, selectionDragging]
  );

  const clearMinesLongPress = useCallback(() => {
    if (minesLongPressTimerRef.current) {
      clearTimeout(minesLongPressTimerRef.current);
      minesLongPressTimerRef.current = null;
    }
    minesLongPressStateRef.current = null;
  }, []);

  useEffect(() => {
    if (activeView !== 'minesweeper') clearMinesLongPress();
  }, [activeView, clearMinesLongPress]);

  const restart2048 = useCallback(() => {
    clear2048SpawnTimer();
    tileMoveLockRef.current = false;
    const nextState = createInitial2048State(game2048Ref.current.best, getNextTileId2048);
    game2048Ref.current = nextState;
    setGame2048(nextState);
  }, [clear2048SpawnTimer, getNextTileId2048]);

  const continue2048 = useCallback(() => {
    const nextState: Game2048State = {
      ...game2048Ref.current,
      won: false,
    };
    game2048Ref.current = nextState;
    setGame2048(nextState);
  }, []);

  const perform2048Move = useCallback(
    (direction: Direction2048) => {
      if (tileMoveLockRef.current) return;

      const current = game2048Ref.current;
      if (current.lost || current.won) return;

      const moved = moveTiles2048(current.tiles, direction);
      if (!moved.moved) return;

      const nextScore = current.score + moved.scoreGain;
      const nextBest = Math.max(current.best, nextScore);
      const recordBroken = nextBest > current.best;
      if (recordBroken) {
        window.localStorage.setItem(STORAGE_KEY_2048_BEST, String(nextBest));
      }

      const pendingSpawns = pickRandomSpawns2048(moved.resolvedTiles, 1);
      const simulatedGrid = createGridFromTiles2048([
        ...moved.resolvedTiles,
        ...pendingSpawns.map((spawn) => ({
          id: -1,
          value: spawn.value,
          row: spawn.row,
          col: spawn.col,
          isNew: false,
          isMerged: false,
        })),
      ]);

      const reached2048 = hasReached2048(simulatedGrid);
      const firstWin = !current.victoryShown && reached2048;
      const lost = !canMove2048(simulatedGrid);

      const burstBaseId = burstIdRef.current;
      const newBursts = moved.mergeEvents.map((event, index) => ({
        ...event,
        id: burstBaseId + index,
      }));
      burstIdRef.current += newBursts.length;

      const movingState: Game2048State = {
        ...current,
        tiles: moved.animationTiles,
        score: nextScore,
        best: nextBest,
        won: firstWin,
        victoryShown: current.victoryShown || reached2048,
        lost,
        scoreBursts: [...current.scoreBursts, ...newBursts],
        scorePulse: moved.scoreGain > 0,
        bestRecordPulse: recordBroken,
        celebrationFlash: firstWin,
      };

      tileMoveLockRef.current = true;
      clear2048SpawnTimer();
      game2048Ref.current = movingState;
      setGame2048(movingState);

      tileSpawnTimerRef.current = window.setTimeout(() => {
        const stateAtSpawn = game2048Ref.current;
        const settledTiles = stateAtSpawn.tiles
          .filter((tile) => !tile.isMergingOut)
          .map((tile) => ({
            ...tile,
            prevRow: tile.row,
            prevCol: tile.col,
            isMerged: false,
            isNew: false,
            isMergingOut: false,
          }));

        const spawnedTiles = createTilesFromSpawns2048(pendingSpawns, getNextTileId2048, true);
        const settledState: Game2048State = {
          ...stateAtSpawn,
          tiles: [...settledTiles, ...spawnedTiles],
        };
        game2048Ref.current = settledState;
        setGame2048(settledState);
        tileMoveLockRef.current = false;
        tileSpawnTimerRef.current = null;
      }, TILE_SPAWN_DELAY_MS_2048);
    },
    [clear2048SpawnTimer, getNextTileId2048]
  );

  useEffect(() => {
    if (game2048.scoreBursts.length === 0) return;
    const timer = window.setTimeout(() => {
      setGame2048((prev) => {
        if (prev.scoreBursts.length === 0) return prev;
        const activeIds = new Set(prev.scoreBursts.map((burst) => burst.id));
        const nextBursts = prev.scoreBursts.filter((burst) => !activeIds.has(burst.id));
        return { ...prev, scoreBursts: nextBursts };
      });
    }, 740);
    return () => window.clearTimeout(timer);
  }, [game2048.scoreBursts]);

  useEffect(() => {
    if (!game2048.scorePulse && !game2048.bestRecordPulse && !game2048.celebrationFlash) return;
    const timer = window.setTimeout(() => {
      setGame2048((prev) => ({
        ...prev,
        scorePulse: false,
        bestRecordPulse: false,
        celebrationFlash: false,
      }));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [game2048.scorePulse, game2048.bestRecordPulse, game2048.celebrationFlash]);

  useEffect(() => {
    if (activeView !== '2048') return;
    const keyMap: Record<string, Direction2048> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const direction = keyMap[event.key];
      if (!direction) return;
      event.preventDefault();
      perform2048Move(direction);
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView, perform2048Move]);

  const handle2048TouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handle2048TouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const start = swipeStartRef.current;
      const touch = event.changedTouches[0];
      swipeStartRef.current = null;
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        perform2048Move(dx > 0 ? 'right' : 'left');
      } else {
        perform2048Move(dy > 0 ? 'down' : 'up');
      }
    },
    [perform2048Move]
  );

  const boardMetrics2048 = useMemo(() => {
    const cellSize = boardSize2048 > 0 ? boardSize2048 / GRID_SIZE_2048 : 0;
    const tileSize = Math.max(0, cellSize - TILE_VISUAL_GAP_PX_2048);
    const tileOffset = TILE_VISUAL_GAP_PX_2048 / 2;
    return { cellSize, tileSize, tileOffset };
  }, [boardSize2048]);

  const boardBackgroundCells2048 = useMemo(
    () =>
      Array.from({ length: GRID_SIZE_2048 * GRID_SIZE_2048 }, (_, index) => ({
        row: Math.floor(index / GRID_SIZE_2048),
        col: index % GRID_SIZE_2048,
      })),
    []
  );

  const resetMinesBoard = useCallback((config?: MinesConfig) => {
    setMinesState((prev) => createInitialMinesState(config ?? prev.config));
  }, []);

  const revealMinesCell = useCallback((row: number, col: number) => {
    setMinesState((prev) => {
      if (prev.status === 'won' || prev.status === 'lost') return prev;
      const target = prev.board[row]?.[col];
      if (!target || target.flagged || target.revealed) return prev;

      let board = cloneMinesBoard(prev.board);
      let status: MinesStatus = prev.status;
      let firstClickDone = prev.firstClickDone;
      let startedAt = prev.startedAt;
      let endedAt = prev.endedAt;
      let elapsedMs = prev.elapsedMs;

      if (!firstClickDone) {
        board = placeMinesOnBoard(board, prev.config.mines, row, col);
        firstClickDone = true;
        status = 'playing';
        startedAt = Date.now();
        elapsedMs = 0;
      }

      const cell = board[row][col];
      if (cell.mine) {
        cell.exploded = true;
        cell.revealed = true;
        status = 'lost';
        endedAt = Date.now();
        if (startedAt !== null) {
          elapsedMs = endedAt - startedAt;
        }

        const pendingReveal: CellPosition[] = [];
        for (let r = 0; r < board.length; r += 1) {
          for (let c = 0; c < board[r].length; c += 1) {
            if (!board[r][c].mine) continue;
            if (r === row && c === col) continue;
            pendingReveal.push({ row: r, col: c });
          }
        }

        return {
          ...prev,
          board,
          status,
          firstClickDone,
          startedAt,
          endedAt,
          elapsedMs,
          pendingReveal,
        };
      }

      floodRevealMines(board, row, col);

      if (checkMinesWin(board)) {
        let flags = 0;
        for (let r = 0; r < board.length; r += 1) {
          for (let c = 0; c < board[r].length; c += 1) {
            if (board[r][c].mine) {
              board[r][c].flagged = true;
              flags += 1;
            }
          }
        }
        status = 'won';
        endedAt = Date.now();
        if (startedAt !== null) {
          elapsedMs = endedAt - startedAt;
        }
        return {
          ...prev,
          board,
          status,
          flags,
          firstClickDone,
          startedAt,
          endedAt,
          elapsedMs,
          pendingReveal: [],
        };
      }

      return {
        ...prev,
        board,
        status,
        firstClickDone,
        startedAt,
        endedAt: null,
        elapsedMs,
      };
    });
  }, []);

  const toggleMinesFlag = useCallback((row: number, col: number) => {
    setMinesState((prev) => {
      if (prev.status === 'won' || prev.status === 'lost') return prev;
      const target = prev.board[row]?.[col];
      if (!target || target.revealed) return prev;
      const board = cloneMinesBoard(prev.board);
      board[row][col].flagged = !board[row][col].flagged;
      const flags = prev.flags + (board[row][col].flagged ? 1 : -1);
      return { ...prev, board, flags };
    });
  }, []);

  useEffect(() => {
    if (activeView !== 'minesweeper') return;
    if (minesState.status !== 'playing' || minesState.startedAt === null) return;

    const timer = window.setInterval(() => {
      setMinesState((prev) => {
        if (prev.status !== 'playing' || prev.startedAt === null) return prev;
        const nextElapsed = Date.now() - prev.startedAt;
        if (nextElapsed === prev.elapsedMs) return prev;
        return { ...prev, elapsedMs: nextElapsed };
      });
    }, 41);

    return () => window.clearInterval(timer);
  }, [activeView, minesState.status, minesState.startedAt]);

  useEffect(() => {
    if (activeView !== 'minesweeper') return;
    if (minesState.status !== 'lost' || minesState.pendingReveal.length === 0) return;

    const timer = window.setInterval(() => {
      setMinesState((prev) => {
        if (prev.status !== 'lost' || prev.pendingReveal.length === 0) return prev;
        const board = cloneMinesBoard(prev.board);
        const nextPending = [...prev.pendingReveal];
        const batchSize = clamp(Math.ceil(nextPending.length / 8), 1, 4);
        for (let index = 0; index < batchSize; index += 1) {
          const position = nextPending.shift();
          if (!position) break;
          board[position.row][position.col].revealed = true;
        }
        return { ...prev, board, pendingReveal: nextPending };
      });
    }, 56);

    return () => window.clearInterval(timer);
  }, [activeView, minesState.status, minesState.pendingReveal.length]);

  useEffect(() => {
    if (activeView !== 'minesweeper' || minesState.status !== 'won') return;
    const canvas = minesFireworksCanvasRef.current;
    const shell = minesBoardShellRef.current;
    if (!canvas || !shell) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: FireworkParticle[] = [];
    let width = 1;
    let height = 1;
    let rafId = 0;
    let lastBurst = 0;
    const startedAt = performance.now();

    const resize = () => {
      const rect = shell.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnBurst = (x?: number, y?: number) => {
      const burstX = x ?? (0.18 + Math.random() * 0.64) * width;
      const burstY = y ?? (0.14 + Math.random() * 0.45) * height;
      const hue = Math.random() * 360;
      const count = 34 + Math.floor(Math.random() * 12);

      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + Math.random() * 0.2;
        const speed = 1.8 + Math.random() * 2.8;
        particles.push({
          x: burstX,
          y: burstY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - Math.random() * 0.6,
          life: 0,
          maxLife: 32 + Math.random() * 28,
          hue: (hue + Math.random() * 44) % 360,
          size: 1.8 + Math.random() * 1.8,
        });
      }
    };

    const render = (time: number) => {
      const elapsed = time - startedAt;

      if (time - lastBurst > 260 && elapsed < 2300) {
        spawnBurst();
        lastBurst = time;
      }

      ctx.fillStyle = isDark ? 'rgba(9, 9, 11, 0.16)' : 'rgba(250, 250, 250, 0.18)';
      ctx.fillRect(0, 0, width, height);

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.life += 1;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.984;
        particle.vy = particle.vy * 0.984 + 0.032;
        const alpha = 1 - particle.life / particle.maxLife;
        if (alpha <= 0) {
          particles.splice(index, 1);
          continue;
        }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${particle.hue}, 100%, 66%, ${alpha})`;
        ctx.shadowColor = `hsla(${particle.hue}, 100%, 70%, ${alpha})`;
        ctx.shadowBlur = 10;
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      if (elapsed < 3000 || particles.length > 0) {
        rafId = window.requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    resize();
    spawnBurst(width * 0.28, height * 0.4);
    spawnBurst(width * 0.72, height * 0.36);
    window.addEventListener('resize', resize);
    rafId = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, width, height);
    };
  }, [activeView, minesState.status, isDark]);

  const handleMinesPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, row: number, col: number) => {
      if (event.pointerType !== 'touch') return;
      event.preventDefault();
      clearMinesLongPress();
      minesLongPressStateRef.current = { row, col, triggered: false };
      minesLongPressTimerRef.current = window.setTimeout(() => {
        toggleMinesFlag(row, col);
        const state = minesLongPressStateRef.current;
        if (state && state.row === row && state.col === col) {
          state.triggered = true;
        }
      }, 420);
    },
    [clearMinesLongPress, toggleMinesFlag]
  );

  const handleMinesPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, row: number, col: number) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
        const state = minesLongPressStateRef.current;
        const triggered = Boolean(state && state.row === row && state.col === col && state.triggered);
        clearMinesLongPress();
        if (!triggered) revealMinesCell(row, col);
        return;
      }
      if (event.pointerType === 'mouse' && event.button === 0) {
        revealMinesCell(row, col);
      }
    },
    [clearMinesLongPress, revealMinesCell]
  );

  const handleMinesPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== 'touch') return;
      clearMinesLongPress();
    },
    [clearMinesLongPress]
  );

  const createFlappyRuntime = useCallback((width: number, height: number): FlappyRuntime => {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const groundHeight = Math.max(28, safeHeight * 0.16);
    const birdRadius = clamp(Math.min(safeWidth, safeHeight) * 0.036, 9, 20);
    const flyZoneHeight = Math.max(72, safeHeight - groundHeight - 20);
    const pipeGap = clamp(safeHeight * 0.3, 56, flyZoneHeight * 0.88);
    const pipeWidth = clamp(safeWidth * 0.115, 34, 90);
    return {
      width: safeWidth,
      height: safeHeight,
      groundHeight,
      birdX: safeWidth * 0.2,
      birdY: safeHeight * 0.5,
      birdRadius,
      birdVelocity: 0,
      birdRotation: 0,
      gravity: clamp(safeHeight * 0.00055 * 16.67, 0.24, 0.56),
      flapImpulse: -clamp(safeHeight * 0.0172, 10.2, 17.2),
      pipeSpeed: clamp(safeWidth * 0.0047, 2.4, 6.2),
      pipeWidth,
      pipeGap,
      spawnInterval: 1360,
      lastSpawnAt: 0,
      lastTime: 0,
      groundOffset: 0,
      score: 0,
      pipes: [],
    };
  }, []);

  const resetFlappy = useCallback(() => {
    const runtime = flappyRuntimeRef.current;
    if (runtime) {
      flappyRuntimeRef.current = createFlappyRuntime(runtime.width, runtime.height);
    }
    setFlappyState((prev) => ({ ...prev, status: 'idle', score: 0 }));
  }, [createFlappyRuntime]);

  const startOrFlapFlappy = useCallback(() => {
    const runtime = flappyRuntimeRef.current;
    if (!runtime) return;

    setFlappyState((prev) => {
      if (prev.status === 'dead') return prev;
      const now = performance.now();

      if (prev.status === 'idle') {
        runtime.pipes = [];
        runtime.score = 0;
        runtime.lastSpawnAt = now;
        runtime.lastTime = now;
        runtime.birdY = runtime.height * 0.5;
        runtime.birdVelocity = runtime.flapImpulse;
        runtime.birdRotation = -22;
        return { ...prev, status: 'playing', score: 0 };
      }

      runtime.birdVelocity = runtime.flapImpulse;
      runtime.birdRotation = -22;
      return prev;
    });
  }, []);

  useEffect(() => {
    if (activeView !== 'flappy') return;
    const canvas = flappyCanvasRef.current;
    const shell = flappyShellRef.current;
    if (!canvas || !shell) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const syncCanvas = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(1, shell.clientWidth);
      const height = Math.max(1, shell.clientHeight);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      const previous = flappyRuntimeRef.current;
      if (!previous) {
        flappyRuntimeRef.current = createFlappyRuntime(width, height);
        return;
      }

      const resized = createFlappyRuntime(width, height);
      const scaleX = width / Math.max(1, previous.width);
      const scaleY = height / Math.max(1, previous.height);
      resized.birdY = previous.birdY * scaleY;
      resized.birdVelocity = previous.birdVelocity * scaleY;
      resized.birdRotation = previous.birdRotation;
      resized.score = previous.score;
      resized.lastSpawnAt = previous.lastSpawnAt;
      resized.lastTime = previous.lastTime;
      resized.groundOffset = previous.groundOffset;
      resized.pipes = previous.pipes.map((pipe) => ({
        ...pipe,
        x: pipe.x * scaleX,
        width: resized.pipeWidth,
        gapY: pipe.gapY * scaleY,
        gapHeight: resized.pipeGap,
      }));
      flappyRuntimeRef.current = resized;
    };

    const spawnPipe = (runtime: FlappyRuntime) => {
      const topPadding = Math.max(20, runtime.height * 0.08);
      const maxGapTop = runtime.height - runtime.groundHeight - runtime.pipeGap - topPadding;
      const gapY =
        maxGapTop > topPadding
          ? topPadding + Math.random() * (maxGapTop - topPadding)
          : topPadding;
      runtime.pipes.push({
        x: runtime.width + runtime.pipeWidth,
        width: runtime.pipeWidth,
        gapY,
        gapHeight: runtime.pipeGap,
        passed: false,
      });
    };

    const drawCloud = (x: number, y: number, radius: number, alpha: number) => {
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.arc(x + radius * 0.9, y + 2, radius * 0.8, 0, Math.PI * 2);
      ctx.arc(x + radius * 1.7, y, radius * 0.72, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawRuntime = (runtime: FlappyRuntime) => {
      const skyGradient = ctx.createLinearGradient(0, 0, 0, runtime.height);
      if (isDark) {
        skyGradient.addColorStop(0, '#082f49');
        skyGradient.addColorStop(0.55, '#0f172a');
        skyGradient.addColorStop(1, '#020617');
      } else {
        skyGradient.addColorStop(0, '#bae6fd');
        skyGradient.addColorStop(0.5, '#7dd3fc');
        skyGradient.addColorStop(1, '#bfdbfe');
      }
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, runtime.width, runtime.height);

      drawCloud(runtime.width * 0.12, runtime.height * 0.16, 22, isDark ? 0.2 : 0.46);
      drawCloud(runtime.width * 0.55, runtime.height * 0.25, 26, isDark ? 0.16 : 0.36);

      runtime.pipes.forEach((pipe) => {
        const pipeGradient = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
        pipeGradient.addColorStop(0, '#22c55e');
        pipeGradient.addColorStop(0.55, '#16a34a');
        pipeGradient.addColorStop(1, '#15803d');
        ctx.fillStyle = pipeGradient;
        ctx.fillRect(pipe.x, 0, pipe.width, pipe.gapY);
        ctx.fillRect(pipe.x, pipe.gapY + pipe.gapHeight, pipe.width, runtime.height - pipe.gapY - pipe.gapHeight - runtime.groundHeight);
        ctx.fillStyle = '#166534';
        ctx.fillRect(pipe.x - 4, pipe.gapY - 16, pipe.width + 8, 16);
        ctx.fillRect(pipe.x - 4, pipe.gapY + pipe.gapHeight, pipe.width + 8, 16);
      });

      const groundTop = runtime.height - runtime.groundHeight;
      const groundGradient = ctx.createLinearGradient(0, groundTop, 0, runtime.height);
      groundGradient.addColorStop(0, isDark ? '#3f3f46' : '#a3e635');
      groundGradient.addColorStop(1, isDark ? '#18181b' : '#65a30d');
      ctx.fillStyle = groundGradient;
      ctx.fillRect(0, groundTop, runtime.width, runtime.groundHeight);

      ctx.fillStyle = isDark ? 'rgba(244,244,245,0.24)' : 'rgba(30,64,175,0.18)';
      for (let x = -runtime.groundOffset; x < runtime.width + 28; x += 28) {
        ctx.fillRect(x, groundTop + 10, 16, 4);
      }
    };

    const updateBirdVisual = (runtime: FlappyRuntime) => {
      const bird = flappyBirdVisualRef.current;
      if (!bird) return;
      bird.style.width = `${runtime.birdRadius * 2.2}px`;
      bird.style.height = `${runtime.birdRadius * 1.86}px`;
      bird.style.transform = `translate3d(${runtime.birdX - runtime.birdRadius * 1.1}px, ${
        runtime.birdY - runtime.birdRadius * 0.95
      }px, 0) rotate(${runtime.birdRotation}deg)`;
    };

    const killBird = (runtime: FlappyRuntime) => {
      const finalScore = runtime.score;
      setFlappyState((prev) => {
        if (prev.status === 'dead') return prev;
        const nextBest = Math.max(prev.best, finalScore);
        if (nextBest > prev.best) {
          window.localStorage.setItem(STORAGE_KEY_FLAPPY_BEST, String(nextBest));
        }
        return { ...prev, status: 'dead', score: finalScore, best: nextBest };
      });
    };

    const animate = (time: number) => {
      const runtime = flappyRuntimeRef.current;
      if (!runtime) {
        rafId = window.requestAnimationFrame(animate);
        return;
      }
      if (runtime.lastTime === 0) runtime.lastTime = time;
      const dt = Math.min(2.4, (time - runtime.lastTime) / 16.6667);
      runtime.lastTime = time;

      if (flappyStateRef.current.status === 'playing') {
        runtime.birdVelocity += runtime.gravity * dt;
        runtime.birdY += runtime.birdVelocity * dt;
        runtime.birdRotation = clamp(runtime.birdVelocity * 4.5, -26, 84);
        runtime.groundOffset = (runtime.groundOffset + runtime.pipeSpeed * dt * 3.2) % 28;

        if (time - runtime.lastSpawnAt > runtime.spawnInterval) {
          spawnPipe(runtime);
          runtime.lastSpawnAt = time;
        }

        runtime.pipes.forEach((pipe) => {
          pipe.x -= runtime.pipeSpeed * dt;
          if (!pipe.passed && pipe.x + pipe.width < runtime.birdX) {
            pipe.passed = true;
            runtime.score += 1;
            const scoreNow = runtime.score;
            setFlappyState((prev) => {
              const nextBest = Math.max(prev.best, scoreNow);
              if (nextBest > prev.best) {
                window.localStorage.setItem(STORAGE_KEY_FLAPPY_BEST, String(nextBest));
              }
              return { ...prev, score: scoreNow, best: nextBest };
            });
          }
        });
        runtime.pipes = runtime.pipes.filter((pipe) => pipe.x + pipe.width > -20);

        const birdLeft = runtime.birdX - runtime.birdRadius * 0.72;
        const birdRight = runtime.birdX + runtime.birdRadius * 0.72;
        const birdTop = runtime.birdY - runtime.birdRadius * 0.72;
        const birdBottom = runtime.birdY + runtime.birdRadius * 0.72;
        const hitBounds =
          birdTop <= 0 || birdBottom >= runtime.height - runtime.groundHeight;
        const hitPipe = runtime.pipes.some((pipe) => {
          if (birdRight < pipe.x || birdLeft > pipe.x + pipe.width) return false;
          return birdTop < pipe.gapY || birdBottom > pipe.gapY + pipe.gapHeight;
        });

        if (hitBounds || hitPipe) {
          runtime.birdVelocity = 0;
          runtime.birdRotation = 88;
          killBird(runtime);
        }
      } else if (flappyStateRef.current.status === 'idle') {
        runtime.birdY = runtime.height * 0.5 + Math.sin(time / 280) * Math.max(4, runtime.height * 0.018);
        runtime.birdRotation = Math.sin(time / 460) * 7;
      }

      drawRuntime(runtime);
      updateBirdVisual(runtime);
      flappyRafRef.current = window.requestAnimationFrame(animate);
      rafId = flappyRafRef.current;
    };

    syncCanvas();
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => syncCanvas());
    if (resizeObserver) {
      resizeObserver.observe(shell);
    } else {
      window.addEventListener('resize', syncCanvas);
    }
    rafId = window.requestAnimationFrame(animate);
    flappyRafRef.current = rafId;

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', syncCanvas);
      }
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      flappyRafRef.current = null;
    };
  }, [activeView, createFlappyRuntime, isDark]);

  useEffect(() => {
    if (activeView !== 'flappy') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (flappyStateRef.current.status === 'dead') return;
      startOrFlapFlappy();
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView, startOrFlapFlappy]);

  const createDinoRuntime = useCallback((width: number, height: number): DinoRuntime => {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const groundY = safeHeight * 0.75;
    const dinoHeight = clamp(safeHeight * 0.15, 18, safeHeight * 0.24);
    const dinoWidth = dinoHeight * 0.92;
    return {
      width: safeWidth,
      height: safeHeight,
      groundY,
      groundOffset: 0,
      dinoX: safeWidth * 0.16,
      dinoY: groundY - dinoHeight,
      dinoWidth,
      dinoHeight,
      dinoVelocity: 0,
      gravity: clamp(safeHeight * 0.0006 * 16.67, 0.24, 0.62),
      jumpImpulse: -clamp(safeHeight * 0.022, 10, 15),
      secondJumpImpulse: -clamp(safeHeight * 0.019, 8.5, 13),
      jumpsUsed: 0,
      speed: clamp(safeWidth * 0.0075, 4.5, 9.6),
      runFrame: 0,
      runFrameTick: 0,
      lastSpawnAt: 0,
      lastTime: 0,
      score: 0,
      nextSpeedScore: 100,
      obstacles: [],
    };
  }, []);

  const resetDino = useCallback(() => {
    const runtime = dinoRuntimeRef.current;
    if (runtime) {
      dinoRuntimeRef.current = createDinoRuntime(runtime.width, runtime.height);
    }
    setDinoState((prev) => ({ ...prev, status: 'idle', score: 0 }));
  }, [createDinoRuntime]);

  const startOrJumpDino = useCallback(() => {
    const runtime = dinoRuntimeRef.current;
    if (!runtime) return;

    setDinoState((prev) => {
      if (prev.status === 'dead') return prev;
      if (prev.status === 'idle') {
        const reset = createDinoRuntime(runtime.width, runtime.height);
        const now = performance.now();
        reset.lastTime = now;
        reset.lastSpawnAt = now;
        reset.jumpsUsed = 1;
        reset.dinoVelocity = reset.jumpImpulse;
        dinoRuntimeRef.current = reset;
        return { ...prev, status: 'playing', score: 0 };
      }

      if (runtime.jumpsUsed >= 2) return prev;
      runtime.jumpsUsed += 1;
      runtime.dinoVelocity = runtime.jumpsUsed === 1 ? runtime.jumpImpulse : runtime.secondJumpImpulse;
      return prev;
    });
  }, [createDinoRuntime]);

  useEffect(() => {
    if (activeView !== 'dino') return;
    const canvas = dinoCanvasRef.current;
    const shell = dinoShellRef.current;
    if (!canvas || !shell) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const syncCanvas = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(1, shell.clientWidth);
      const height = Math.max(1, shell.clientHeight);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      const previous = dinoRuntimeRef.current;
      if (!previous) {
        dinoRuntimeRef.current = createDinoRuntime(width, height);
        return;
      }

      const resized = createDinoRuntime(width, height);
      const scaleX = width / Math.max(1, previous.width);
      const scaleY = height / Math.max(1, previous.height);
      const floorY = resized.groundY - resized.dinoHeight;
      resized.dinoY = clamp(previous.dinoY * scaleY, 0, floorY);
      resized.dinoVelocity = previous.dinoVelocity * scaleY;
      resized.jumpsUsed = previous.jumpsUsed;
      resized.speed = previous.speed;
      resized.score = previous.score;
      resized.nextSpeedScore = previous.nextSpeedScore;
      resized.runFrame = previous.runFrame;
      resized.runFrameTick = previous.runFrameTick;
      resized.lastSpawnAt = previous.lastSpawnAt;
      resized.lastTime = previous.lastTime;
      resized.groundOffset = previous.groundOffset;
      resized.obstacles = previous.obstacles.map((obstacle) => ({
        ...obstacle,
        x: obstacle.x * scaleX,
        width: obstacle.width * scaleX,
        height: obstacle.height * scaleY,
      }));
      dinoRuntimeRef.current = resized;
    };

    const obstacleDimensions = (runtime: DinoRuntime, kind: DinoObstacleKind) => {
      switch (kind) {
        case 1:
          return { width: clamp(runtime.dinoWidth * 0.34, 14, 22), height: clamp(runtime.dinoHeight * 0.92, 30, 44) };
        case 2:
          return { width: clamp(runtime.dinoWidth * 0.66, 26, 36), height: clamp(runtime.dinoHeight * 1.02, 34, 50) };
        case 3:
          return { width: clamp(runtime.dinoWidth * 1.03, 40, 58), height: clamp(runtime.dinoHeight * 1.2, 40, 56) };
      }
    };

    const spawnObstacle = (runtime: DinoRuntime) => {
      const roll = Math.random();
      const kind: DinoObstacleKind = roll > 0.78 ? 3 : roll > 0.45 ? 2 : 1;
      const size = obstacleDimensions(runtime, kind);
      runtime.obstacles.push({
        x: runtime.width + size.width + 12,
        width: size.width,
        height: size.height,
        kind,
      });
    };

    const drawPixelDino = (runtime: DinoRuntime, isDead: boolean) => {
      const unit = runtime.dinoWidth / 14;
      const x = runtime.dinoX;
      const y = runtime.dinoY;
      ctx.fillStyle = isDark ? (isDead ? '#d4d4d8' : '#f4f4f5') : isDead ? '#52525b' : '#111827';
      ctx.fillRect(x + unit * 3, y + unit * 2, unit * 7, unit * 6);
      ctx.fillRect(x + unit * 8, y, unit * 4, unit * 4);
      ctx.fillRect(x + unit * 11, y + unit, unit * 2, unit * 2);
      ctx.fillRect(x + unit * 2, y + unit * 5, unit * 2, unit * 2);
      ctx.fillRect(x + unit, y + unit * 6, unit * 2, unit);
      if (runtime.runFrame === 0) {
        ctx.fillRect(x + unit * 4, y + unit * 8, unit * 2, unit * 3);
        ctx.fillRect(x + unit * 8, y + unit * 8, unit * 2, unit * 3);
      } else {
        ctx.fillRect(x + unit * 4, y + unit * 8, unit * 2, unit * 2);
        ctx.fillRect(x + unit * 8, y + unit * 8.6, unit * 2, unit * 2.4);
      }
      ctx.fillStyle = isDead ? (isDark ? '#3f3f46' : '#e5e7eb') : isDark ? '#09090b' : '#f8fafc';
      if (isDead) {
        ctx.fillRect(x + unit * 9, y + unit * 1.8, unit * 2, Math.max(1, unit * 0.44));
      } else {
        ctx.fillRect(x + unit * 9.2, y + unit * 1.5, unit * 1.1, unit * 1.1);
      }
    };

    const drawObstacle = (runtime: DinoRuntime, obstacle: DinoObstacle) => {
      const baseY = runtime.groundY - obstacle.height;
      ctx.fillStyle = isDark ? '#d4d4d8' : '#111827';
      const stemWidth = Math.max(3, obstacle.width * 0.38);
      const stemX = obstacle.x + (obstacle.width - stemWidth) / 2;
      ctx.fillRect(stemX, baseY, stemWidth, obstacle.height);
      if (obstacle.kind >= 2) {
        ctx.fillRect(stemX - stemWidth * 0.6, baseY + obstacle.height * 0.35, stemWidth * 0.6, obstacle.height * 0.2);
      }
      if (obstacle.kind === 3) {
        ctx.fillRect(stemX + stemWidth, baseY + obstacle.height * 0.22, stemWidth * 0.56, obstacle.height * 0.22);
      }
    };

    const collide = (runtime: DinoRuntime) => {
      const margin = runtime.dinoWidth * 0.1;
      const dinoLeft = runtime.dinoX + margin;
      const dinoRight = runtime.dinoX + runtime.dinoWidth - margin;
      const dinoTop = runtime.dinoY + runtime.dinoHeight * 0.08;
      const dinoBottom = runtime.dinoY + runtime.dinoHeight - runtime.dinoHeight * 0.08;
      return runtime.obstacles.some((obstacle) => {
        const obstacleTop = runtime.groundY - obstacle.height;
        const obstacleBottom = runtime.groundY;
        const obstacleLeft = obstacle.x;
        const obstacleRight = obstacle.x + obstacle.width;
        return dinoRight > obstacleLeft && dinoLeft < obstacleRight && dinoBottom > obstacleTop && dinoTop < obstacleBottom;
      });
    };

    const drawRuntime = (runtime: DinoRuntime) => {
      ctx.fillStyle = isDark ? '#09090b' : '#f8fafc';
      ctx.fillRect(0, 0, runtime.width, runtime.height);
      ctx.fillStyle = isDark ? '#71717a' : '#374151';
      ctx.fillRect(0, runtime.groundY, runtime.width, 2);
      ctx.fillStyle = isDark ? '#a1a1aa' : '#1f2937';
      for (let x = -runtime.groundOffset; x < runtime.width + 28; x += 28) {
        ctx.fillRect(x, runtime.groundY + 6, 14, 2);
      }
      runtime.obstacles.forEach((obstacle) => drawObstacle(runtime, obstacle));
      drawPixelDino(runtime, dinoStateRef.current.status === 'dead');
    };

    const animate = (time: number) => {
      const runtime = dinoRuntimeRef.current;
      if (!runtime) {
        rafId = window.requestAnimationFrame(animate);
        return;
      }

      if (runtime.lastTime === 0) runtime.lastTime = time;
      const dt = Math.min(2.6, (time - runtime.lastTime) / 16.6667);
      runtime.lastTime = time;

      if (dinoStateRef.current.status === 'playing') {
        runtime.groundOffset = (runtime.groundOffset + runtime.speed * dt * 3.1) % 28;
        runtime.dinoVelocity += runtime.gravity * dt;
        runtime.dinoY += runtime.dinoVelocity * dt;

        const floorY = runtime.groundY - runtime.dinoHeight;
        if (runtime.dinoY >= floorY) {
          runtime.dinoY = floorY;
          runtime.dinoVelocity = 0;
          runtime.jumpsUsed = 0;
        }

        runtime.runFrameTick += dt;
        if (runtime.runFrameTick > 6 && runtime.dinoY >= floorY) {
          runtime.runFrame = runtime.runFrame === 0 ? 1 : 0;
          runtime.runFrameTick = 0;
        }

        const spawnInterval = clamp(1170 - runtime.speed * 45 + Math.random() * 180, 560, 1280);
        if (time - runtime.lastSpawnAt > spawnInterval) {
          spawnObstacle(runtime);
          runtime.lastSpawnAt = time;
        }

        runtime.obstacles.forEach((obstacle) => {
          obstacle.x -= runtime.speed * dt;
        });
        runtime.obstacles = runtime.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -20);

        runtime.score += dt * 0.96;
        const scoreInt = Math.floor(runtime.score);
        if (scoreInt >= runtime.nextSpeedScore) {
          runtime.speed += 0.46;
          runtime.nextSpeedScore += 100;
        }

        if (scoreInt !== dinoStateRef.current.score) {
          setDinoState((prev) => {
            const nextBest = Math.max(prev.best, scoreInt);
            if (nextBest > prev.best) {
              window.localStorage.setItem(STORAGE_KEY_DINO_BEST, String(nextBest));
            }
            return { ...prev, score: scoreInt, best: nextBest };
          });
        }

        if (collide(runtime)) {
          const finalScore = Math.floor(runtime.score);
          setDinoState((prev) => {
            if (prev.status === 'dead') return prev;
            const nextBest = Math.max(prev.best, finalScore);
            if (nextBest > prev.best) {
              window.localStorage.setItem(STORAGE_KEY_DINO_BEST, String(nextBest));
            }
            return { ...prev, status: 'dead', score: finalScore, best: nextBest };
          });
        }
      }

      drawRuntime(runtime);
      dinoRafRef.current = window.requestAnimationFrame(animate);
      rafId = dinoRafRef.current;
    };

    syncCanvas();
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => syncCanvas());
    if (resizeObserver) {
      resizeObserver.observe(shell);
    } else {
      window.addEventListener('resize', syncCanvas);
    }
    rafId = window.requestAnimationFrame(animate);
    dinoRafRef.current = rafId;

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', syncCanvas);
      }
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      dinoRafRef.current = null;
    };
  }, [activeView, createDinoRuntime, isDark]);

  useEffect(() => {
    if (activeView !== 'dino') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (dinoStateRef.current.status === 'dead') return;
      startOrJumpDino();
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView, startOrJumpDino]);

  const minesLeft = minesState.config.mines - minesState.flags;
  const mineCellSize = useMemo(() => {
    const availableW = Math.max(200, viewportWidth - (isMobileViewport ? 96 : 210));
    const availableH = isMobileViewport ? Math.max(160, viewportHeight - 480) : Math.max(200, viewportHeight - 280);
    const available = Math.min(availableW, availableH);
    const estimated = Math.floor(available / minesState.config.cols);
    const min = minesState.config.cols >= 30 ? 12 : minesState.config.cols >= 16 ? (isMobileViewport ? 14 : 18) : (isMobileViewport ? 20 : 24);
    const max = minesState.config.cols >= 30 ? 24 : minesState.config.cols >= 16 ? (isMobileViewport ? 16 : 34) : (isMobileViewport ? 28 : 46);
    return clamp(estimated, min, max);
  }, [viewportWidth, viewportHeight, isMobileViewport, minesState.config.cols]);

  const mineNumberSize = Math.max(10, Math.floor(mineCellSize * 0.46));
  const mineIconSize = Math.max(10, Math.floor(mineCellSize * 0.6));

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Game mode"
    >
      <div className={`absolute inset-0 backdrop-blur-xl ${isDark ? 'bg-zinc-950/95' : 'bg-zinc-50/95'}`} />
      <div className="gm-ambient absolute inset-0" />

      <div className="relative z-10 flex h-full flex-col p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className={`text-[11px] tracking-[0.35em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>GAME MODE</p>
            <h2 className={`text-2xl font-black sm:text-3xl ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
              Game Mode
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {activeView !== 'select' && (
              <button
                type="button"
                onClick={() => setActiveView('select')}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] ${
                  isDark
                    ? 'border-white/15 bg-zinc-900/70 text-zinc-100 hover:bg-zinc-800'
                    : 'border-zinc-300 bg-white/90 text-zinc-800 hover:bg-zinc-100'
                }`}
                aria-label="Back to game select"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] ${
                isDark
                  ? 'border-white/15 bg-zinc-900/70 text-zinc-100 hover:bg-zinc-800'
                  : 'border-zinc-300 bg-white/90 text-zinc-800 hover:bg-zinc-100'
              }`}
              aria-label="Close game mode"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {activeView === 'select' ? (
            <div className="relative mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden">
              {!isMobileViewport && (
                <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between px-2 sm:px-4">
                  <button
                    type="button"
                    onClick={() => goSelectionIndex(currentSelectionIndex - 1)}
                    disabled={currentSelectionIndex <= 0}
                    className={`pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-150 ${
                      currentSelectionIndex <= 0
                        ? isDark
                          ? 'cursor-not-allowed border-white/5 bg-zinc-900/45 text-zinc-600'
                          : 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                        : isDark
                        ? 'border-white/15 bg-zinc-900/76 text-zinc-100 hover:scale-[1.03] hover:bg-zinc-800'
                        : 'border-zinc-300 bg-white/92 text-zinc-800 hover:scale-[1.03] hover:bg-zinc-100'
                    }`}
                    aria-label="Previous game card"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goSelectionIndex(currentSelectionIndex + 1)}
                    disabled={currentSelectionIndex >= maxSelectionIndex}
                    className={`pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-150 ${
                      currentSelectionIndex >= maxSelectionIndex
                        ? isDark
                          ? 'cursor-not-allowed border-white/5 bg-zinc-900/45 text-zinc-600'
                          : 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                        : isDark
                        ? 'border-white/15 bg-zinc-900/76 text-zinc-100 hover:scale-[1.03] hover:bg-zinc-800'
                        : 'border-zinc-300 bg-white/92 text-zinc-800 hover:scale-[1.03] hover:bg-zinc-100'
                    }`}
                    aria-label="Next game card"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              )}

              <div
                ref={selectionViewportRef}
                className="relative flex-1 min-h-0 w-full overflow-hidden"
                onPointerDown={handleSelectionPointerDown}
                onPointerMove={handleSelectionPointerMove}
                onPointerUp={handleSelectionPointerUp}
                onPointerCancel={handleSelectionPointerCancel}
                onPointerLeave={handleSelectionPointerCancel}
                style={{ touchAction: 'none' }}
              >
                <div
                  className="flex h-full flex-row items-stretch"
                  style={{
                    gap: `${selectionTrackGapPx}px`,
                    transform: `translate3d(${selectionTrackOffsetPx}px, 0, 0)`,
                    transition: selectionDragging ? 'none' : 'transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  }}
                >
                  {GAME_SELECTION_OPTIONS.map((option, index) => (
                    <div
                      key={option.mode}
                      className="flex h-full flex-shrink-0 items-stretch justify-center"
                      style={{ width: `${selectionCardWidthPx}px` }}
                    >
                      <div className="h-full w-full">
                        <GameSelectionCard
                          mode={option.mode}
                          title={option.title}
                          subtitle={option.subtitle}
                          isDark={isDark}
                          entered={selectionEntered}
                          delay={index * 60}
                          isCurrent={index === currentSelectionIndex}
                          isAdjacent={Math.abs(index - currentSelectionIndex) === 1}
                          selecting={pendingView === option.mode}
                          dimmed={pendingView !== null && pendingView !== option.mode}
                          onSelect={() => handleSelectionCardSelect(option.mode)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute bottom-3 left-0 right-0 z-20 flex items-center justify-center gap-2 sm:bottom-4">
                {GAME_SELECTION_OPTIONS.map((option, index) => (
                  <button
                    key={`gm-indicator-${option.mode}`}
                    type="button"
                    onClick={() => goSelectionIndex(index)}
                    className={`h-2.5 rounded-full transition-all duration-200 ${
                      index === currentSelectionIndex
                        ? isDark
                          ? 'w-6 bg-zinc-100'
                          : 'w-6 bg-zinc-800'
                        : isDark
                        ? 'w-2.5 bg-zinc-600'
                        : 'w-2.5 bg-zinc-400'
                    }`}
                    aria-label={`Switch to ${option.title}`}
                    aria-pressed={index === currentSelectionIndex}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              key={activeView}
              className={`gm-view-shell mx-auto flex h-full w-full max-w-6xl flex-col gap-4 rounded-3xl border p-5 sm:gap-5 sm:p-7 ${
                isDark
                  ? 'border-white/10 bg-zinc-950/72 text-zinc-100'
                  : 'border-zinc-200 bg-zinc-50/84 text-zinc-900'
              }`}
            >
              {activeView === '2048' ? (
                <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4 overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className={`text-2xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>2048</h3>
                      <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>Arrow keys / swipe to play — chase a high score</p>
                    </div>
                    <button
                      type="button"
                      onClick={restart2048}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] ${
                        isDark
                          ? 'border-white/12 bg-zinc-900/75 text-zinc-100 hover:bg-zinc-800'
                          : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
                      }`}
                      aria-label="Restart 2048"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Restart
                    </button>
                  </div>

                  <div className="grid w-full max-w-md grid-cols-2 gap-3">
                    <div
                      className={`rounded-2xl border px-4 py-3 ${
                        isDark ? 'border-white/10 bg-zinc-900/65' : 'border-zinc-200 bg-white/90'
                      } ${game2048.scorePulse ? 'gm-score-pulse' : ''}`}
                    >
                      <p className={`text-[11px] tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>SCORE</p>
                      <p className={`mt-1 text-2xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                        {game2048.score}
                      </p>
                    </div>
                    <div
                      className={`rounded-2xl border px-4 py-3 ${
                        isDark ? 'border-white/10 bg-zinc-900/65' : 'border-zinc-200 bg-white/90'
                      } ${game2048.bestRecordPulse ? 'gm-best-break' : ''}`}
                    >
                      <p className={`text-[11px] tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>BEST</p>
                      <p className={`mt-1 text-2xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                        {game2048.best}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    <div className="w-full max-w-[min(94vw,33rem)]">
                      <div
                        className={`relative rounded-3xl border p-3 sm:p-4 ${
                          isDark
                            ? 'border-white/10 bg-gradient-to-br from-zinc-900/95 via-zinc-900/90 to-zinc-950/95'
                            : 'border-zinc-200 bg-gradient-to-br from-zinc-100 via-zinc-100 to-zinc-200/80'
                        }`}
                        onTouchStart={handle2048TouchStart}
                        onTouchEnd={handle2048TouchEnd}
                        onTouchCancel={() => {
                          swipeStartRef.current = null;
                        }}
                        aria-label="2048 board"
                      >
                        <div ref={boardShell2048Ref} className="relative aspect-square w-full overflow-hidden rounded-2xl">
                          <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                            {boardBackgroundCells2048.map((cell) => (
                              <span
                                key={`gm-2048-bg-${cell.row}-${cell.col}`}
                                className={`rounded-xl border ${
                                  isDark
                                    ? 'border-white/5 bg-gradient-to-br from-zinc-800/82 to-zinc-900/94 shadow-[inset_0_2px_8px_rgba(255,255,255,0.05)]'
                                    : 'border-zinc-200 bg-gradient-to-br from-white to-zinc-200/80 shadow-[inset_0_1px_6px_rgba(255,255,255,0.88)]'
                                }`}
                                style={{ margin: `${boardMetrics2048.tileOffset}px` }}
                              />
                            ))}
                          </div>

                          {boardMetrics2048.cellSize > 0 && (
                            <div className="pointer-events-none absolute inset-0 z-10">
                              {game2048.tiles.map((tile) => {
                                const tileStyle = get2048TileStyle(tile.value);
                                const fontSize = get2048TileFontSize(tile.value);
                                const translateX = tile.col * boardMetrics2048.cellSize + boardMetrics2048.tileOffset;
                                const translateY = tile.row * boardMetrics2048.cellSize + boardMetrics2048.tileOffset;

                                return (
                                  <div
                                    key={tile.id}
                                    className="gm-2048-tile-shell absolute left-0 top-0"
                                    style={{
                                      width: `${boardMetrics2048.tileSize}px`,
                                      height: `${boardMetrics2048.tileSize}px`,
                                      transform: `translate3d(${translateX}px, ${translateY}px, 0)`,
                                      zIndex: tile.isMergingOut ? 18 : tile.isMerged ? 20 : 16,
                                    }}
                                  >
                                    <span
                                      className={`gm-2048-tile flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br font-black tracking-tight ${get2048TileClass(
                                        tile.value
                                      )} ${tile.isMerged ? 'gm-2048-tile-merge' : ''} ${tile.isNew ? 'gm-2048-tile-new' : ''} ${
                                        tile.isMergingOut ? 'gm-2048-tile-fadeout' : ''
                                      } ${tile.value === 2048 ? 'gm-2048-rainbow' : ''} ${
                                        tile.value >= 1024 ? 'gm-2048-high-border' : ''
                                      }`}
                                      style={{ ...tileStyle, fontSize: `${fontSize}px` }}
                                    >
                                      <span>{tile.value}</span>
                                      {tile.value === 128 && <span className="absolute right-1 top-0.5 text-[11px]">✨</span>}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {game2048.scoreBursts.map((burst) => (
                          <span
                            key={burst.id}
                            className="gm-2048-score-burst pointer-events-none absolute z-20"
                            style={{
                              left:
                                boardMetrics2048.cellSize > 0
                                  ? `${boardMetrics2048.tileOffset + burst.col * boardMetrics2048.cellSize + boardMetrics2048.tileSize * 0.5 - 12}px`
                                  : `calc(${(burst.col + 0.5) * 25}% - 12px)`,
                              top:
                                boardMetrics2048.cellSize > 0
                                  ? `${boardMetrics2048.tileOffset + burst.row * boardMetrics2048.cellSize + boardMetrics2048.tileSize * 0.5 - 10}px`
                                  : `calc(${(burst.row + 0.5) * 25}% - 10px)`,
                            }}
                          >
                            +{burst.value}
                          </span>
                        ))}

                        {game2048.celebrationFlash && <span className="gm-2048-celebration pointer-events-none absolute inset-0 z-10 rounded-2xl" />}

                        {(game2048.won || game2048.lost) && (
                          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-zinc-950/45 p-5 backdrop-blur-sm">
                            <div className="gm-outcome-card w-full max-w-xs rounded-3xl border border-white/20 bg-black/45 p-5 text-white">
                              <h4 className="text-xl font-black">{game2048.won ? '🎉 You made 2048!' : '💥 No moves left'}</h4>
                              <p className="mt-2 text-sm text-zinc-200">
                                {game2048.won ? 'Keep stacking and push your record even higher.' : 'Start fresh and plan your merges better.'}
                              </p>
                              <div className="mt-5 flex flex-wrap gap-2">
                                {game2048.won && (
                                  <button
                                    type="button"
                                    onClick={continue2048}
                                    className="inline-flex rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold transition-all duration-150 hover:scale-[1.03] hover:bg-white/30 active:scale-[0.97]"
                                  >
                                    Keep Playing
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={restart2048}
                                  className="inline-flex rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-3 py-2 text-sm font-semibold text-white transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
                                >
                                  Play Again
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className={`mt-3 text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>Arrow keys / swipe to move · Esc to exit</p>
                    </div>
                  </div>
                </div>
              ) : activeView === 'minesweeper' ? (
                <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4 overflow-hidden">
                  <div className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className={`text-2xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Minesweeper</h3>
                      <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                        Right-click to flag on desktop, long-press on mobile — first click is always safe
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => resetMinesBoard()}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] ${
                        isDark
                          ? 'border-white/12 bg-zinc-900/75 text-zinc-100 hover:bg-zinc-800'
                          : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
                      }`}
                      aria-label="Reset minesweeper board"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      New Board
                    </button>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap gap-2">
                    {visibleMinesConfigs.map((config) => (
                      <button
                        key={config.id}
                        type="button"
                        onClick={() => resetMinesBoard(config)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] ${
                          minesState.config.id === config.id
                            ? config.id === 'easy'
                              ? isDark
                                ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : config.id === 'medium'
                              ? isDark
                                ? 'border-blue-300/50 bg-blue-500/20 text-blue-100'
                                : 'border-blue-300 bg-blue-50 text-blue-700'
                              : isDark
                              ? 'border-rose-300/50 bg-rose-500/20 text-rose-100'
                              : 'border-rose-300 bg-rose-50 text-rose-700'
                            : isDark
                            ? 'border-white/10 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100'
                        }`}
                        aria-label={`Switch difficulty: ${config.label}`}
                      >
                        {config.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid flex-shrink-0 grid-cols-3 gap-2 sm:gap-3">
                    <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-zinc-900/65' : 'border-zinc-200 bg-white/90'}`}>
                      <p className={`text-[10px] tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>TIME</p>
                      <p
                        className={`mt-1 font-mono text-base font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'} ${
                          minesState.status !== 'playing' && minesState.firstClickDone ? 'gm-stopwatch-freeze' : ''
                        }`}
                      >
                        {formatElapsedMs(minesState.elapsedMs)}
                      </p>
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-zinc-900/65' : 'border-zinc-200 bg-white/90'}`}>
                      <p className={`text-[10px] tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Mines</p>
                      <p className={`mt-1 text-base font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{minesLeft}</p>
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-zinc-900/65' : 'border-zinc-200 bg-white/90'}`}>
                      <p className={`text-[10px] tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>STATUS</p>
                      <p className={`mt-1 text-base font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                        {getMinesStatusText(minesState.status)}
                      </p>
                    </div>
                  </div>

                  <div className={`relative min-h-0 flex-1 overflow-hidden rounded-3xl border p-3 sm:p-4 ${
                    isDark ? 'border-white/10 bg-zinc-900/45' : 'border-zinc-200 bg-white/70'
                  }`}>
                    <div className="h-full max-h-full overflow-auto">
                      <div
                        ref={minesBoardShellRef}
                        className={`relative mx-auto w-max overflow-hidden rounded-2xl border p-2 sm:p-3 ${
                          isDark ? 'border-white/10 bg-zinc-900/92' : 'border-zinc-200 bg-zinc-100/96'
                        } ${minesState.status === 'won' ? 'gm-mines-win-shell' : ''} ${
                          minesState.status === 'lost' ? 'gm-mines-loss-shake' : ''
                        }`}
                      >
                      <canvas
                        ref={minesFireworksCanvasRef}
                        className="pointer-events-none absolute inset-0 z-20 h-full w-full rounded-2xl"
                        aria-hidden="true"
                      />
                      <div
                        className="grid gap-[3px] sm:gap-1"
                        style={{
                          gridTemplateColumns: `repeat(${minesState.config.cols}, ${mineCellSize}px)`,
                        }}
                        role="grid"
                        aria-label={`Minesweeper board, ${minesState.config.rows} rows by ${minesState.config.cols} columns`}
                      >
                        {minesState.board.map((row, rowIndex) =>
                          row.map((cell, colIndex) => {
                            const numberGradient =
                              cell.revealed && !cell.mine && cell.adjacent > 0
                                ? getMinesNumberGradientClass(cell.adjacent, isDark)
                                : '';
                            const cellLabel = getMinesCellAriaLabel(rowIndex, colIndex, cell, minesState.status);
                            const revealedBase =
                              cell.mine
                                ? cell.exploded
                                  ? 'gm-mine-cell-exploded border-rose-400/80 bg-gradient-to-br from-rose-500 to-red-600'
                                  : isDark
                                  ? 'border-white/10 bg-gradient-to-br from-zinc-700/85 to-zinc-900'
                                  : 'border-zinc-300 bg-gradient-to-br from-zinc-200 to-zinc-300'
                                : minesState.status === 'won'
                                ? 'gm-mine-cell-victory border-emerald-400/60 bg-gradient-to-br from-emerald-300/40 to-emerald-500/35'
                                : isDark
                                ? 'border-white/10 bg-gradient-to-br from-zinc-700/88 to-zinc-900'
                                : 'border-zinc-300 bg-gradient-to-br from-zinc-100 to-zinc-200';
                            const hiddenBase = isDark
                              ? 'border-zinc-500/70 bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_10px_rgba(0,0,0,0.32)]'
                              : 'border-zinc-300 bg-gradient-to-br from-white via-zinc-100 to-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_10px_rgba(148,163,184,0.32)]';

                            return (
                              <button
                                key={`${rowIndex}-${colIndex}`}
                                type="button"
                                onPointerDown={(event) => handleMinesPointerDown(event, rowIndex, colIndex)}
                                onPointerUp={(event) => handleMinesPointerUp(event, rowIndex, colIndex)}
                                onPointerCancel={handleMinesPointerCancel}
                                onPointerLeave={handleMinesPointerCancel}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  toggleMinesFlag(rowIndex, colIndex);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    revealMinesCell(rowIndex, colIndex);
                                    return;
                                  }
                                  if (event.key.toLowerCase() === 'f') {
                                    event.preventDefault();
                                    toggleMinesFlag(rowIndex, colIndex);
                                  }
                                }}
                                style={{
                                  width: `${mineCellSize}px`,
                                  height: `${mineCellSize}px`,
                                  touchAction: 'none',
                                  fontSize: `${mineNumberSize}px`,
                                }}
                                className={`relative flex items-center justify-center rounded-[10px] border font-black transition-all duration-150 select-none ${
                                  cell.revealed ? revealedBase : hiddenBase
                                }`}
                                aria-label={cellLabel}
                                aria-pressed={cell.flagged}
                              >
                                {!cell.revealed && cell.flagged && (
                                  <Flag
                                    style={{ width: `${mineIconSize * 0.78}px`, height: `${mineIconSize * 0.78}px` }}
                                    className="text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.55)]"
                                  />
                                )}
                                {cell.revealed && cell.mine && <span className={`gm-mine-icon ${cell.exploded ? 'gm-mine-icon-exploded' : ''}`} style={{ width: `${mineIconSize}px`, height: `${mineIconSize}px` }} />}
                                {cell.revealed && !cell.mine && cell.adjacent > 0 && (
                                  <span className={`bg-gradient-to-r bg-clip-text text-transparent ${numberGradient}`} style={{ fontSize: `${mineNumberSize}px` }}>
                                    {cell.adjacent}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>

                      {minesState.status === 'lost' && minesState.pendingReveal.length > 0 && (
                        <span className="gm-mines-lose-flash pointer-events-none absolute inset-0 z-10 rounded-2xl" />
                      )}

                      {(minesState.status === 'won' || minesState.status === 'lost') && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-zinc-950/44 backdrop-blur-sm">
                          <div className="gm-outcome-card w-[min(92%,23rem)] rounded-3xl border border-white/20 bg-black/42 p-5 text-white">
                            <h4 className="text-xl font-black">{minesState.status === 'won' ? '🏆 Board cleared!' : '💥 Boom!'}</h4>
                            <p className="mt-2 text-sm text-zinc-200">
                              {minesState.status === 'won'
                                ? `Final time ${formatElapsedMs(minesState.elapsedMs)}`
                                : 'All the mines will be revealed after the blast'}
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => resetMinesBoard()}
                                className="inline-flex rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-sm font-semibold text-white transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
                              >
                                Play Again
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveView('select')}
                                className="inline-flex rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold transition-all duration-150 hover:scale-[1.03] hover:bg-white/30 active:scale-[0.97]"
                              >
                                Back to Games
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeView === 'flappy' ? (
                <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4 overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className={`text-2xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Flappy Bird</h3>
                      <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                        Tap / press Space to flap — thread the pipes to score
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetFlappy}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] ${
                        isDark
                          ? 'border-white/12 bg-zinc-900/75 text-zinc-100 hover:bg-zinc-800'
                          : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
                      }`}
                      aria-label="Reset Flappy Bird"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Reset
                    </button>
                  </div>

                  <div className="grid w-full max-w-md grid-cols-3 gap-1 sm:gap-3 flex-shrink-0">
                    <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-zinc-900/65' : 'border-zinc-200 bg-white/90'}`}>
                      <p className={`text-[10px] tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>SCORE</p>
                      <p className={`mt-1 text-xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{flappyState.score}</p>
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-zinc-900/65' : 'border-zinc-200 bg-white/90'}`}>
                      <p className={`text-[10px] tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>BEST</p>
                      <p className={`mt-1 text-xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{flappyState.best}</p>
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-zinc-900/65' : 'border-zinc-200 bg-white/90'}`}>
                      <p className={`text-[10px] tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>STATE</p>
                      <p className={`mt-1 text-xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                        {flappyState.status === 'idle' ? 'Idle' : flappyState.status === 'playing' ? 'Flying' : 'Crashed'}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    <div className="h-full w-full max-w-4xl">
                      <div
                        ref={flappyShellRef}
                        className={`relative mx-auto h-full w-full max-w-[min(92vw,34rem)] overflow-hidden rounded-3xl border sm:max-w-[min(88vw,54rem)] ${
                          isDark ? 'border-white/10 bg-zinc-900/40' : 'border-sky-200 bg-sky-50/70'
                        } ${flappyState.status === 'dead' ? 'gm-flappy-dead-shake' : ''}`}
                        onPointerDown={(event) => {
                          if (event.pointerType === 'mouse' && event.button !== 0) return;
                          if (flappyState.status === 'dead') return;
                          event.preventDefault();
                          startOrFlapFlappy();
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          if (flappyState.status === 'dead') return;
                          event.preventDefault();
                          startOrFlapFlappy();
                        }}
                        aria-label="Flappy Bird game canvas"
                      >
                        <canvas ref={flappyCanvasRef} className="absolute inset-0 h-full w-full" />
                        <span
                          ref={flappyBirdVisualRef}
                          className="gm-flappy-bird absolute left-0 top-0 z-20 rounded-full bg-[linear-gradient(135deg,#fde047_0%,#fb923c_55%,#f43f5e_100%)]"
                        >
                          <span className="gm-flappy-bird-wing absolute left-[32%] top-[42%] h-[46%] w-[45%] rounded-full bg-orange-200/80" />
                          <span className="absolute right-[16%] top-[30%] h-[18%] w-[16%] rounded-full bg-zinc-900/95" />
                          <span className="absolute right-[-8%] top-[50%] h-[18%] w-[28%] rounded-full bg-orange-300/85" />
                        </span>

                        {flappyState.status === 'idle' && (
                          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 p-5 backdrop-blur-[1px]">
                            <div className="gm-outcome-card w-[min(92%,24rem)] rounded-3xl border border-white/20 bg-black/40 p-5 text-center text-white">
                              <h4 className="text-xl font-black">Tap to start flying</h4>
                              <p className="mt-2 text-sm text-zinc-200">Dodge the pipes — every pair you pass is +1 point.</p>
                            </div>
                          </div>
                        )}

                        {flappyState.status === 'dead' && (
                          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/42 p-5 backdrop-blur-sm">
                            <div className="gm-outcome-card w-[min(92%,24rem)] rounded-3xl border border-white/20 bg-black/46 p-5 text-center text-white">
                              <h4 className="text-xl font-black">💥 Crashed!</h4>
                              <p className="mt-2 text-sm text-zinc-200">
                                Score {flappyState.score} · Best {flappyState.best}
                              </p>
                              <div className="mt-5 flex justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={resetFlappy}
                                  className="inline-flex rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
                                >
                                  Retry
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className={`mt-3 text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>Tap / Space to flap · Esc to exit</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4 overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className={`text-2xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Chrome Dino</h3>
                      <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                        Space / tap to jump, double jump included — survive longer, score higher
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetDino}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] ${
                        isDark
                          ? 'border-white/12 bg-zinc-900/75 text-zinc-100 hover:bg-zinc-800'
                          : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
                      }`}
                      aria-label="Reset Dino"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Reset
                    </button>
                  </div>

                  <div className="grid w-full max-w-md grid-cols-3 gap-1 sm:gap-3 flex-shrink-0">
                    <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-zinc-900/65' : 'border-zinc-200 bg-white/90'}`}>
                      <p className={`text-[10px] tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>SCORE</p>
                      <p className={`mt-1 text-xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{dinoState.score}</p>
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-zinc-900/65' : 'border-zinc-200 bg-white/90'}`}>
                      <p className={`text-[10px] tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>BEST</p>
                      <p className={`mt-1 text-xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{dinoState.best}</p>
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-zinc-900/65' : 'border-zinc-200 bg-white/90'}`}>
                      <p className={`text-[10px] tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>STATE</p>
                      <p className={`mt-1 text-xl font-black ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                        {dinoState.status === 'idle' ? 'Idle' : dinoState.status === 'playing' ? 'Running' : 'Wrecked'}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    <div className="h-full w-full max-w-5xl">
                      <div
                        ref={dinoShellRef}
                        className={`relative mx-auto h-full w-full max-w-[min(94vw,62rem)] overflow-hidden rounded-3xl border ${
                          isDark ? 'border-white/10 bg-zinc-900/42' : 'border-zinc-300 bg-zinc-50/80'
                        } ${dinoState.status === 'dead' ? 'gm-dino-dead-flash' : ''}`}
                        onPointerDown={(event) => {
                          if (event.pointerType === 'mouse' && event.button !== 0) return;
                          if (dinoState.status === 'dead') return;
                          event.preventDefault();
                          startOrJumpDino();
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          if (dinoState.status === 'dead') return;
                          event.preventDefault();
                          startOrJumpDino();
                        }}
                        aria-label="Dino game canvas"
                      >
                        <canvas ref={dinoCanvasRef} className="absolute inset-0 h-full w-full" />

                        {dinoState.status === 'idle' && (
                          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/8 p-5">
                            <div className="rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-center text-white">
                              <h4 className="text-lg font-black">Tap to start running</h4>
                              <p className="mt-1 text-xs text-zinc-200">Space/tap to jump — double jump available.</p>
                            </div>
                          </div>
                        )}

                        {dinoState.status === 'dead' && (
                          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm">
                            <div className="gm-outcome-card w-[min(92%,24rem)] rounded-3xl border border-white/20 bg-black/48 p-5 text-center text-white">
                              <h4 className="text-xl font-black">☠️ Hit a cactus</h4>
                              <p className="mt-2 text-sm text-zinc-200">
                                Score {dinoState.score} · Best {dinoState.best}
                              </p>
                              <div className="mt-5 flex justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={resetDino}
                                  className="inline-flex rounded-xl bg-gradient-to-r from-zinc-700 to-zinc-500 px-3 py-2 text-sm font-semibold text-white transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
                                >
                                  Retry
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className={`mt-3 text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>Space / tap to jump · Esc to exit</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .gm-ambient {
          background-image:
            radial-gradient(circle at 10% 18%, rgba(249, 115, 22, 0.2), transparent 34%),
            radial-gradient(circle at 88% 14%, rgba(59, 130, 246, 0.2), transparent 34%),
            radial-gradient(circle at 50% 88%, rgba(16, 185, 129, 0.16), transparent 34%),
            linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
          background-size: auto, auto, auto, 42px 42px, 42px 42px;
          opacity: 0.42;
          animation: gm-ambient-shift 22s linear infinite;
          will-change: transform, opacity;
        }

        .gm-view-shell {
          animation: gm-view-enter 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }

        .gm-selection-card {
          transform-style: preserve-3d;
          will-change: transform, opacity;
          transition:
            transform 500ms cubic-bezier(0.16, 1, 0.3, 1),
            opacity 500ms cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 150ms ease,
            border-color 150ms ease;
        }

        .gm-selection-card:hover {
          box-shadow:
            0 28px 52px rgba(0, 0, 0, 0.35),
            0 0 0 1px rgba(255, 255, 255, 0.14);
        }

        .gm-selection-gradient {
          opacity: 0.92;
          background-size: 240% 240%;
          animation: gm-selection-flow 9s linear infinite;
          will-change: transform, opacity;
        }

        .gm-selection-warm {
          background-image: linear-gradient(140deg, rgba(249, 115, 22, 0.65), rgba(244, 63, 94, 0.62), rgba(245, 158, 11, 0.55));
        }

        .gm-selection-cool {
          background-image: linear-gradient(140deg, rgba(59, 130, 246, 0.62), rgba(16, 185, 129, 0.58), rgba(34, 211, 238, 0.54));
        }

        .gm-selection-sky {
          background-image: linear-gradient(140deg, rgba(56, 189, 248, 0.6), rgba(99, 102, 241, 0.58), rgba(14, 116, 144, 0.52));
        }

        .gm-selection-mono {
          background-image: linear-gradient(140deg, rgba(113, 113, 122, 0.62), rgba(63, 63, 70, 0.58), rgba(24, 24, 27, 0.52));
        }

        .gm-selection-border-glow {
          transition: box-shadow 150ms ease, border-color 150ms ease;
          will-change: box-shadow, border-color;
        }

        .gm-selection-card:hover .gm-selection-border-glow {
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.2),
            0 0 28px rgba(249, 115, 22, 0.28);
        }

        .gm-preview-flicker {
          animation: gm-preview-flicker 2.2s ease-in-out infinite;
          will-change: transform, opacity;
        }

        .gm-preview-bomb {
          width: 58%;
          height: 58%;
          border-radius: 999px;
          background: radial-gradient(circle at 30% 28%, #f3f4f6 0%, #9ca3af 28%, #111827 100%);
          box-shadow:
            0 0 12px rgba(248, 113, 113, 0.45),
            inset -2px -2px 6px rgba(0, 0, 0, 0.55);
          animation: gm-preview-flicker 1.7s ease-in-out infinite;
          will-change: transform, opacity;
        }

        .gm-flappy-preview-cloud {
          filter: blur(0.2px);
          animation: gm-flappy-preview-cloud 6s linear infinite;
          will-change: transform;
        }

        .gm-flappy-preview-pipe {
          height: 46%;
          border-radius: 0.5rem 0.5rem 0 0;
          background: linear-gradient(180deg, #22c55e 0%, #16a34a 56%, #166534 100%);
          animation: gm-flappy-preview-pipe 2.6s linear infinite;
          will-change: transform;
        }

        .gm-flappy-preview-pipe-top {
          border-radius: 0 0 0.5rem 0.5rem;
          transform-origin: center top;
          transform: scaleY(0.9);
          height: 36%;
        }

        .gm-flappy-preview-bird {
          box-shadow: 0 8px 14px rgba(0, 0, 0, 0.24);
          animation: gm-flappy-preview-float 2.3s ease-in-out infinite;
          will-change: transform;
        }

        .gm-flappy-preview-wing {
          transform-origin: left center;
          animation: gm-flappy-wing 280ms ease-in-out infinite alternate;
        }

        .gm-dino-preview-cactus {
          animation: gm-dino-preview-scroll 2.1s linear infinite;
          will-change: transform;
        }

        .gm-dino-preview-runner::before,
        .gm-dino-preview-runner::after {
          content: '';
          position: absolute;
          background: currentColor;
        }

        .gm-dino-preview-runner::before {
          left: 2px;
          top: 7px;
          width: 18px;
          height: 20px;
          box-shadow:
            12px -6px 0 currentColor,
            18px -6px 0 currentColor,
            20px 0 0 currentColor,
            4px 20px 0 currentColor,
            13px 20px 0 currentColor;
        }

        .gm-dino-preview-runner::after {
          left: 5px;
          bottom: 2px;
          width: 6px;
          height: 9px;
          box-shadow: 9px 0 0 currentColor;
          animation: gm-dino-preview-legs 220ms steps(2, end) infinite;
        }

        .gm-flappy-bird {
          transform-origin: 45% 55%;
          box-shadow:
            0 12px 16px rgba(0, 0, 0, 0.3),
            inset -6px -6px 10px rgba(0, 0, 0, 0.15);
          will-change: transform;
        }

        .gm-flappy-bird-wing {
          transform-origin: left center;
          animation: gm-flappy-wing 180ms ease-in-out infinite alternate;
        }

        .gm-flappy-dead-shake {
          animation: gm-loss-shake 460ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gm-dino-dead-flash {
          animation: gm-dino-flash 520ms ease-out;
        }

        .gm-2048-tile-shell {
          transition: transform ${TILE_SLIDE_MS_2048}ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
          will-change: transform;
        }

        .gm-2048-tile {
          position: relative;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
          will-change: transform, opacity, filter;
        }

        .gm-2048-tile-new {
          animation: gm-tile-new 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .gm-2048-tile-merge {
          animation: gm-tile-merge ${TILE_MERGE_BOUNCE_MS_2048}ms cubic-bezier(0.22, 1, 0.36, 1)
            ${TILE_SLIDE_MS_2048}ms both;
        }

        .gm-2048-tile-fadeout {
          animation: gm-tile-fadeout 140ms ease-out ${TILE_SLIDE_MS_2048}ms both;
        }

        .gm-2048-rainbow {
          animation:
            gm-tile-2048-rainbow 4s linear infinite,
            gm-tile-2048-glow 1.7s ease-in-out infinite;
          background-size: 260% 260%;
        }

        .gm-2048-high-border {
          position: relative;
          overflow: hidden;
        }

        .gm-2048-high-border::after {
          content: '';
          position: absolute;
          inset: 1px;
          border-radius: inherit;
          border: 1px solid rgba(255, 255, 255, 0.4);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          padding: 2px;
          animation: gm-high-border-shift 2.2s linear infinite;
          will-change: transform, opacity;
        }

        .gm-2048-score-burst {
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #fcd34d;
          text-shadow:
            0 0 10px rgba(251, 191, 36, 0.85),
            0 0 20px rgba(249, 115, 22, 0.7);
          animation: gm-score-burst 720ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
        }

        .gm-2048-celebration {
          background: radial-gradient(circle, rgba(255, 255, 255, 0.56) 0%, rgba(255, 255, 255, 0) 66%);
          animation: gm-celebration-flash 620ms ease-out both;
          will-change: opacity, transform;
        }

        .gm-score-pulse {
          animation: gm-score-pop 360ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform, opacity;
        }

        .gm-best-break {
          animation: gm-best-break 640ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform, opacity;
        }

        .gm-outcome-card {
          animation: gm-outcome-pop 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }

        .gm-mines-loss-shake {
          animation: gm-loss-shake 520ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
        }

        .gm-mines-lose-flash {
          background: radial-gradient(circle, rgba(248, 113, 113, 0.5), rgba(239, 68, 68, 0.2), transparent 72%);
          animation: gm-loss-flash 560ms ease-out both;
          will-change: opacity;
        }

        .gm-mines-win-shell {
          animation: gm-mines-win-shell 700ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform, box-shadow;
        }

        .gm-mine-cell-exploded {
          animation: gm-mine-explode 420ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform, opacity, filter;
        }

        .gm-mine-cell-victory {
          animation: gm-cell-victory 900ms ease-in-out;
          will-change: transform, opacity;
        }

        .gm-mine-icon {
          border-radius: 999px;
          background:
            radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.95) 0%, rgba(209, 213, 219, 0.75) 24%, rgba(31, 41, 55, 0.95) 100%),
            linear-gradient(145deg, rgba(239, 68, 68, 0.65), rgba(244, 63, 94, 0.45));
          box-shadow:
            0 0 10px rgba(244, 63, 94, 0.5),
            inset -2px -2px 6px rgba(0, 0, 0, 0.56);
          will-change: transform, opacity;
        }

        .gm-mine-icon-exploded {
          animation: gm-mine-icon-explode 520ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gm-stopwatch-freeze {
          animation: gm-stopwatch-freeze 520ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform, opacity;
        }

        @keyframes gm-ambient-shift {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(42px, 42px, 0);
          }
        }

        @keyframes gm-selection-flow {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes gm-view-enter {
          0% {
            opacity: 0;
            transform: translate3d(0, 24px, 0) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes gm-preview-flicker {
          0%,
          100% {
            opacity: 0.86;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.04);
          }
        }

        @keyframes gm-flappy-preview-cloud {
          0% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(10px, -2px, 0);
          }
          100% {
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes gm-flappy-preview-pipe {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-110%, 0, 0);
          }
        }

        @keyframes gm-flappy-preview-float {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
          50% {
            transform: translate3d(0, -8px, 0) rotate(-5deg);
          }
        }

        @keyframes gm-flappy-wing {
          0% {
            transform: rotate(-20deg) scaleY(0.9);
          }
          100% {
            transform: rotate(18deg) scaleY(1.04);
          }
        }

        @keyframes gm-dino-preview-scroll {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-140%, 0, 0);
          }
        }

        @keyframes gm-dino-preview-legs {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(2px);
          }
        }

        @keyframes gm-tile-new {
          0% {
            transform: scale(0);
            opacity: 0.12;
          }
          58% {
            transform: scale(1.1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes gm-tile-merge {
          0% {
            transform: scale(1);
            filter: brightness(1);
          }
          42% {
            transform: scale(1.12);
            filter: brightness(1.2);
          }
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
        }

        @keyframes gm-tile-fadeout {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.92);
          }
        }

        @keyframes gm-score-burst {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.65);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(0, -44px, 0) scale(1.12);
          }
        }

        @keyframes gm-celebration-flash {
          0% {
            opacity: 0;
            transform: scale(0.94);
          }
          22% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.08);
          }
        }

        @keyframes gm-score-pop {
          0%,
          100% {
            transform: scale(1);
          }
          48% {
            transform: scale(1.18);
          }
        }

        @keyframes gm-best-break {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(16, 185, 129, 0);
          }
          48% {
            transform: scale(1.12);
            box-shadow:
              0 0 20px rgba(245, 158, 11, 0.55),
              0 0 34px rgba(16, 185, 129, 0.42);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(16, 185, 129, 0);
          }
        }

        @keyframes gm-tile-2048-rainbow {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }

        @keyframes gm-tile-2048-glow {
          0%,
          100% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.2);
          }
        }

        @keyframes gm-high-border-shift {
          0% {
            opacity: 0.45;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.45;
          }
        }

        @keyframes gm-outcome-pop {
          0% {
            opacity: 0;
            transform: translate3d(0, 18px, 0) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes gm-loss-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          22% {
            transform: translateX(-5px);
          }
          46% {
            transform: translateX(4px);
          }
          68% {
            transform: translateX(-3px);
          }
          84% {
            transform: translateX(2px);
          }
        }

        @keyframes gm-loss-flash {
          0% {
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes gm-mines-win-shell {
          0% {
            transform: scale(0.985);
            box-shadow: 0 0 0 rgba(16, 185, 129, 0);
          }
          52% {
            transform: scale(1.01);
            box-shadow: 0 0 24px rgba(16, 185, 129, 0.42);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(16, 185, 129, 0);
          }
        }

        @keyframes gm-mine-explode {
          0% {
            transform: scale(0.72);
            filter: brightness(1.25);
          }
          42% {
            transform: scale(1.16);
            filter: brightness(1.4);
          }
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
        }

        @keyframes gm-cell-victory {
          0%,
          100% {
            transform: scale(1);
          }
          40% {
            transform: scale(1.06);
          }
        }

        @keyframes gm-mine-icon-explode {
          0% {
            transform: scale(0.7);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes gm-stopwatch-freeze {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.08);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes gm-dino-flash {
          0% {
            box-shadow: 0 0 0 rgba(239, 68, 68, 0);
          }
          45% {
            box-shadow: inset 0 0 0 999px rgba(239, 68, 68, 0.16);
          }
          100% {
            box-shadow: 0 0 0 rgba(239, 68, 68, 0);
          }
        }
      `}</style>
    </div>
  );
}
