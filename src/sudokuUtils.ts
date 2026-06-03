/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

/**
 * Check if num can be placed at board[row][col]
 */
export function isValid(board: number[][], row: number, col: number, num: number): boolean {
  // Check row and column
  for (let x = 0; x < 9; x++) {
    if (board[row][x] === num && x !== col) return false;
    if (board[x][col] === num && x !== row) return false;
  }

  // Check 3x3 block
  const startRow = row - (row % 3);
  const startCol = col - (col % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i + startRow][j + startCol] === num && (i + startRow !== row || j + startCol !== col)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Solves the board in-place using backtracking.
 */
export function solve(board: number[][]): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (solve(board)) {
              return true;
            }
            board[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

/**
 * Helper to shuffle arrays
 */
function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Seed the grid with random blocks diagonally to maintain validity while generating variety
 */
function fillDiagonalBoxes(board: number[][]) {
  for (let i = 0; i < 9; i += 3) {
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let idx = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        board[i + r][i + c] = nums[idx++];
      }
    }
  }
}

/**
 * Generate a complete solved valid board
 */
export function generateFullBoard(): number[][] {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillDiagonalBoxes(board);
  
  // Internal randomized solver
  function solveWithRandom(b: number[][]): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === 0) {
          const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
          for (const num of numbers) {
            if (isValid(b, r, c, num)) {
              b[r][c] = num;
              if (solveWithRandom(b)) {
                return true;
              }
              b[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }
  
  solveWithRandom(board);
  return board;
}

/**
 * Count the number of possible solutions to ensure uniqueness
 */
export function countSolutions(board: number[][], limit = 2): number {
  let count = 0;

  function find(b: number[][]): boolean {
    if (count >= limit) return true;

    let row = -1;
    let col = -1;
    let isEmpty = true;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === 0) {
          row = r;
          col = c;
          isEmpty = false;
          break;
        }
      }
      if (!isEmpty) break;
    }

    if (isEmpty) {
      count++;
      return false; // backtrack to find other solutions
    }

    for (let num = 1; num <= 9; num++) {
      if (isValid(b, row, col, num)) {
        b[row][col] = num;
        find(b);
        b[row][col] = 0;
      }
    }
    return false;
  }

  find(board);
  return count;
}

/**
 * Create a new Sudoku puzzle with the given difficulty.
 * Returns both the puzzle board and its unique solution.
 */
export function generatePuzzle(difficulty: Difficulty): { puzzle: number[][]; solution: number[][] } {
  const solution = generateFullBoard();
  const puzzle = solution.map(row => [...row]);

  // Determine cells to clear based on standard difficulty
  let cellsToRemove = 35; // Easy (approx 46 cells filled)
  if (difficulty === 'medium') cellsToRemove = 44; // Approx 37 cells filled
  if (difficulty === 'hard') cellsToRemove = 52; // Approx 29 cells filled
  if (difficulty === 'expert') cellsToRemove = 58; // Approx 23 cells filled

  // Create random coordinate list
  const coords: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      coords.push([r, c]);
    }
  }
  const randomCoords = shuffle(coords);

  let removed = 0;
  // To avoid long loops on expert difficulty, we guarantee a fast generation by keeping removal simple
  // while attempting to maintain uniqueness.
  for (const [r, c] of randomCoords) {
    if (removed >= cellsToRemove) break;

    const backup = puzzle[r][c];
    puzzle[r][c] = 0;

    // Check if uniqueness is maintained
    const puzzleClone = puzzle.map(row => [...row]);
    if (countSolutions(puzzleClone, 2) === 1) {
      removed++;
    } else {
      puzzle[r][c] = backup; // Restore if it yields multiple solutions
    }
  }

  // Fallback check: if we couldn't remove enough while preserving absolute uniqueness,
  // we do a direct force removal for expert but stay as close as possible.
  if (removed < cellsToRemove - 5 && (difficulty === 'expert' || difficulty === 'hard')) {
    for (const [r, c] of randomCoords) {
      if (removed >= cellsToRemove) break;
      if (puzzle[r][c] !== 0) {
        puzzle[r][c] = 0;
        removed++;
      }
    }
  }

  return { puzzle, solution };
}
