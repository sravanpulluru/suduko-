from __future__ import annotations

import random
from typing import List, Optional, Tuple

Board = List[List[int]]  # 9x9, 0 means empty


def find_empty(board: Board) -> Optional[Tuple[int, int]]:
    """
    Find the next empty cell (0). Returns (row, col) or None if full.
    """
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0:
                return r, c
    return None


def is_valid(board: Board, row: int, col: int, num: int) -> bool:
    """
    Check whether placing `num` at (row, col) is valid.
    Assumes 0 <= row,col < 9 and 1 <= num <= 9.
    """
    # Row
    if any(board[row][c] == num for c in range(9)):
        return False

    # Column
    if any(board[r][col] == num for r in range(9)):
        return False

    # 3x3 box
    box_r = (row // 3) * 3
    box_c = (col // 3) * 3
    for r in range(box_r, box_r + 3):
        for c in range(box_c, box_c + 3):
            if board[r][c] == num:
                return False

    return True


def solve_sudoku(board: Board) -> bool:
    """
    Solve the Sudoku board in-place using recursion + backtracking.
    Returns True if solved, False if no solution exists.
    """
    empty = find_empty(board)
    if empty is None:
        return True

    row, col = empty
    for num in range(1, 10):
        if is_valid(board, row, col, num):
            board[row][col] = num
            if solve_sudoku(board):
                return True
            board[row][col] = 0

    return False


def _deep_copy_board(board: Board) -> Board:
    return [row[:] for row in board]


def _fill_board_randomly(board: Board) -> bool:
    """
    Create a complete solved board by backtracking with randomized choices.
    """
    empty = find_empty(board)
    if empty is None:
        return True

    r, c = empty
    nums = list(range(1, 10))
    random.shuffle(nums)
    for n in nums:
        if is_valid(board, r, c, n):
            board[r][c] = n
            if _fill_board_randomly(board):
                return True
            board[r][c] = 0
    return False


def _count_solutions(board: Board, limit: int = 2) -> int:
    """
    Count solutions up to `limit` (early stop). Used to enforce uniqueness.
    """
    empty = find_empty(board)
    if empty is None:
        return 1

    r, c = empty
    count = 0
    for n in range(1, 10):
        if is_valid(board, r, c, n):
            board[r][c] = n
            count += _count_solutions(board, limit=limit)
            board[r][c] = 0
            if count >= limit:
                return count
    return count


def generate_puzzle(difficulty: str = "medium") -> Tuple[Board, Board]:
    """
    Generate a random Sudoku puzzle with (attempted) unique solution.

    difficulty: "easy" | "medium" | "hard"

    Returns (puzzle, solution) where solution is the completed grid the puzzle
    was carved from (matches the unique solution when uniqueness holds).
    """
    difficulty = (difficulty or "medium").lower()
    holes = {"easy": 40, "medium": 50, "hard": 58}.get(difficulty, 50)

    # Step 1: generate a full solved board
    board: Board = [[0 for _ in range(9)] for _ in range(9)]
    _fill_board_randomly(board)

    solution = _deep_copy_board(board)

    # Step 2: remove numbers while keeping uniqueness (best-effort)
    puzzle = _deep_copy_board(board)
    cells = [(r, c) for r in range(9) for c in range(9)]
    random.shuffle(cells)

    removed = 0
    for (r, c) in cells:
        if removed >= holes:
            break

        if puzzle[r][c] == 0:
            continue

        backup = puzzle[r][c]
        puzzle[r][c] = 0

        test = _deep_copy_board(puzzle)
        if _count_solutions(test, limit=2) != 1:
            puzzle[r][c] = backup
            continue

        removed += 1

    return puzzle, solution


def normalize_board(board_like) -> Board:
    """
    Validate/normalize incoming JSON board into a strict 9x9 int board.
    Raises ValueError on invalid shapes/values.
    """
    if not isinstance(board_like, list) or len(board_like) != 9:
        raise ValueError("Board must be a 9x9 list.")
    board: Board = []
    for r in range(9):
        row = board_like[r]
        if not isinstance(row, list) or len(row) != 9:
            raise ValueError("Board must be a 9x9 list.")
        new_row: List[int] = []
        for c in range(9):
            v = row[c]
            if v in ("", None):
                v = 0
            if not isinstance(v, int):
                raise ValueError("Board values must be integers 0-9.")
            if v < 0 or v > 9:
                raise ValueError("Board values must be in 0..9.")
            new_row.append(v)
        board.append(new_row)
    return board


def has_conflicts(board: Board) -> bool:
    """
    Return True if the current (possibly incomplete) board violates Sudoku rules.
    """
    # Check rows and cols
    for i in range(9):
        seen_row = set()
        seen_col = set()
        for j in range(9):
            vr = board[i][j]
            if vr != 0:
                if vr in seen_row:
                    return True
                seen_row.add(vr)

            vc = board[j][i]
            if vc != 0:
                if vc in seen_col:
                    return True
                seen_col.add(vc)

    # Check boxes
    for br in range(0, 9, 3):
        for bc in range(0, 9, 3):
            seen = set()
            for r in range(br, br + 3):
                for c in range(bc, bc + 3):
                    v = board[r][c]
                    if v != 0:
                        if v in seen:
                            return True
                        seen.add(v)
    return False

