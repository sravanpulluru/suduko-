# 🧠 AI Sudoku Solver

An interactive web-based Sudoku game and solver built using **Flask (Python)** and the **Backtracking Algorithm**, enhanced with modern UI, animations, and game logic.

---

## 🚀 Features

- 🔢 9×9 Interactive Sudoku Grid
- 🧠 AI Solver using Backtracking Algorithm
- 🎯 Difficulty Levels: Easy, Medium, Hard
- 🎮 Game Features:
  - Timer
  - Mistake counter (Game Over after 3 mistakes)
  - Reset & New Game
- 🎨 Modern UI:
  - Glassmorphism design
  - Gradient themes
  - Smooth animations
- ⚡ Real-time validation (row, column, box)
- 🎉 Win animation & Game Over modal

---

## 🏗️ Tech Stack

- **Frontend:** HTML, CSS, JavaScript  
- **Backend:** Flask (Python)  
- **Algorithm:** Backtracking  

---

## 🧩 How It Works

The solver uses a **Backtracking algorithm** to fill empty cells:

1. Find an empty cell  
2. Try numbers (1–9)  
3. Check if valid  
4. Recursively solve  
5. Backtrack if needed  

---

## 📂 Project Structure
sudoku-ai-project/
│
├── app.py
├── solver.py
│
├── templates/
│ └── index.html
│
├── static/
│ ├── style.css
│ └── script.js
│
└── README.md


---

## ▶️ How to Run

```bash
pip install flask
python app.py

Open in browser:

http://127.0.0.1:5000
