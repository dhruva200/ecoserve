# 🌱 EcoServe — AI-Driven Institutional Food Waste & NGO Redistribution Platform

Full-Stack **PERN (PostgreSQL + Express + React + Node.js + WebSockets + Google Gemini & Gemma-3 Vision AI)** Startup Application.

---

## 📂 Project Architecture

```text
ecoserve/
├── backend/
│   ├── server.js               # Express + WebSocket + Gemini/Gemma-3 AI + Google OAuth 2.0 API
│   ├── iot-simulator.js        # Cold-Chain IoT Telemetry Simulator
│   └── utils/
│       └── validators.js       # Backend Input & Auth Validators
├── database/
│   ├── db.js                   # Neon PostgreSQL + Local JSON Automatic Failover Layer
│   └── schema.sql              # PostgreSQL Database Schema
├── src/
│   ├── App.jsx                 # Top-Level Router & WebSocket State Sync
│   ├── components/
│   │   ├── Navbar.jsx          # Role-Aware Navigation & AI Key Modal
│   │   └── KpiStatsBar.jsx     # Live KPI Metrics Bar
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── AuthPage.jsx    # Login, Sign Up & 2-Step Google Authentication
│   │   │   ├── LoginForm.jsx   # Strict Email, Password & Organization Login
│   │   │   └── SignupForm.jsx  # Validated Account Registration
│   │   ├── kitchen/
│   │   │   ├── KitchenDashboard.jsx
│   │   │   ├── PantryScanner.jsx
│   │   │   ├── DemandForecast.jsx
│   │   │   ├── PostSurplusFood.jsx
│   │   │   └── PostedFoodStatus.jsx
│   │   └── ngo/
│   │       ├── NgoDashboard.jsx
│   │       ├── AcceptFoodFeed.jsx
│   │       └── ColdChainIoT.jsx
│   └── utils/
│       ├── esgCertificate.js   # Printable ESG Impact Certificate Generator
│       ├── forecastHelper.js   # Baseline Attendance & Waste Forecaster
│       ├── imageHelper.js      # Client-Side Image Compression Helper
│       └── validators.js       # Frontend Email & Password Validators
├── .env                        # Environment Configuration
└── package.json
```

---

## 💻 Quick Start (Local Development)

```bash
cd ecoserve
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.
