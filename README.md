# Calory — Calorie Tracker

A lightweight calorie and macro tracker built with plain HTML, CSS, and JavaScript.

## What is included

- Daily calorie dashboard
- Protein, carbohydrate, and fat tracking
- Breakfast / Lunch / Dinner / Snacks grouping
- Quick food presets for common foods
- Custom food entry
- Serving multiplier
- Seven-day calorie chart
- Seven-day history table
- Editable daily goals
- CSV export
- Light / dark theme
- Responsive layout
- Data stored locally in the browser with `localStorage`

## Project structure

```text
calorie-tracker/
├── index.html
├── style.css
├── script.js
└── README.md
```

## Run it

No build step is required.

Open `index.html` directly in a modern browser, or use a local server:

```bash
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

## Data model

The app stores two top-level pieces of data in local storage:

```js
{
  goals: {
    calories: 2000,
    protein: 140,
    carbs: 220,
    fat: 65
  },
  logs: {
    "YYYY-MM-DD": [
      {
        id: "...",
        meal: "Lunch",
        name: "Chicken breast",
        calories: 330,
        protein: 62,
        carbs: 0,
        fat: 7.2,
        quantity: 2
      }
    ]
  }
}
```

Calories and macros in the log are stored as the total for the selected number of servings.

## Important note

This version is intentionally frontend-only. It is suitable as a portfolio / college project and does not pretend to provide an account system or a nutrition database backend.

For a production version, the next layer would be a server-side database, authenticated user accounts, server validation, and a verified nutrition-data provider such as USDA FoodData Central.
