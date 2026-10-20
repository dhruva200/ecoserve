-- EcoServe PostgreSQL Schema (Live Production + Hackathon Edition)

-- 0. Users Table (Two Roles: 'donor' = Food Distributor/Kitchen, 'receiver' = Food Acceptor/NGO)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  organization VARCHAR(150) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password VARCHAR(120) NOT NULL,
  role VARCHAR(30) NOT NULL, -- 'donor' or 'receiver'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1. Smart Pantry Ingredients (Per-Kitchen Pantry, Auto-scanned via Camera + Gemini Vision AI)
CREATE TABLE IF NOT EXISTS pantry_items (
  id SERIAL PRIMARY KEY,
  kitchen_name VARCHAR(120) NOT NULL DEFAULT 'Govindas kitchen',
  ingredient_name VARCHAR(150) NOT NULL,
  category VARCHAR(60) NOT NULL,
  quantity VARCHAR(60) NOT NULL,
  expiry_date VARCHAR(30) NOT NULL,
  expiry_days INT NOT NULL,
  freshness_status VARCHAR(40) NOT NULL,
  storage_advice TEXT,
  image_preview TEXT,
  detection_source VARCHAR(80) DEFAULT 'Gemini Vision AI',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Surplus Food Batches (For NGO Redistribution + 4-Digit Pickup OTP + Map Location)
CREATE TABLE IF NOT EXISTS food_batches (
  id SERIAL PRIMARY KEY,
  kitchen_name VARCHAR(100) NOT NULL,
  pickup_location VARCHAR(200) DEFAULT 'Mathura Campus Mess Gate 1',
  food_item VARCHAR(150) NOT NULL,
  servings INT NOT NULL,
  quantity_kg DECIMAL(5,1) NOT NULL,
  storage_temp DECIMAL(4,1) DEFAULT 4.0,
  base_expiry_hours INT NOT NULL DEFAULT 4,
  expiry_hours INT NOT NULL DEFAULT 4,
  status VARCHAR(30) DEFAULT 'Available', -- 'Available', 'Claimed', or 'Delivered'
  claimed_by VARCHAR(100),
  pickup_otp VARCHAR(10),
  co2_saved_kg DECIMAL(6,1) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. IoT Cold-Storage Logs
CREATE TABLE IF NOT EXISTS iot_logs (
  id SERIAL PRIMARY KEY,
  sensor_id VARCHAR(50) NOT NULL,
  temperature DECIMAL(4,1) NOT NULL,
  alert_status VARCHAR(30) NOT NULL,
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
