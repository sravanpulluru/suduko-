from __future__ import annotations

from flask import Flask, jsonify, render_template, request

from solver import generate_puzzle, has_conflicts, normalize_board, solve_sudoku

app = Flask(__name__)


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/solve")
def api_solve():
    data = request.get_json(silent=True) or {}
    try:
        board = normalize_board(data.get("board"))
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    if has_conflicts(board):
        return jsonify({"ok": False, "error": "Board has conflicts. Fix highlighted cells and try again."}), 400

    solved = [row[:] for row in board]
    if not solve_sudoku(solved):
        return jsonify({"ok": False, "error": "No solution exists for this puzzle."}), 400

    return jsonify({"ok": True, "solution": solved})


@app.get("/api/generate")
def api_generate():
    difficulty = (
        request.args.get("level") or request.args.get("difficulty") or "medium"
    ).lower()
    puzzle, solution = generate_puzzle(difficulty=difficulty)
    return jsonify(
        {
            "ok": True,
            "puzzle": puzzle,
            "solution": solution,
            "difficulty": difficulty,
        }
    )


@app.post("/api/validate")
def api_validate():
    data = request.get_json(silent=True) or {}
    try:
        board = normalize_board(data.get("board"))
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    return jsonify({"ok": True, "hasConflicts": has_conflicts(board)})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
