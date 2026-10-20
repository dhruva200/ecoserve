import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_DB_FILE = path.join(__dirname, 'local_db.json');
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

let pool = null;
let usingPostgres = false;

function hashPassword(pw) {
  return crypto
    .createHash('sha256')
    .update(String(pw || '123456') + '_ecoserve_salt')
    .digest('hex');
}

function createSessionToken(email, role) {
  const payload = Buffer.from(
    JSON.stringify({ email, role, iat: Date.now() })
  ).toString('base64url');
  const sig = crypto
    .createHash('sha256')
    .update(payload + '_ecoserve_jwt_secret')
    .digest('base64url');
  return `${payload}.${sig}`;
}

function addDaysFormatted(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().split('T')[0];
}

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function normalizePantryItem(item) {
  if (!item) return item;
  const name = item.item_name || item.ingredient_name || 'Fresh Ingredient';
  const days = item.days_left ?? item.expiry_days ?? 3;
  const notes = item.ai_notes || item.storage_advice || 'Keep in cool dry storage.';
  const kitchen = item.kitchen_name || 'Govindas kitchen';
  return {
    ...item,
    kitchen_name: kitchen,
    item_name: name,
    ingredient_name: name,
    days_left: days,
    expiry_days: days,
    ai_notes: notes,
    storage_advice: notes,
  };
}

function normalizeBatch(batch) {
  if (!batch) return batch;
  const temp = batch.temperature_c ?? batch.storage_temp ?? 4.0;
  return {
    ...batch,
    pickup_location:
      batch.pickup_location || `${batch.kitchen_name || 'Govindas kitchen'}, Mathura`,
    temperature_c: temp,
    storage_temp: temp,
    pickup_otp: batch.pickup_otp || (batch.status === 'Claimed' ? '4829' : null),
  };
}

function normalizeIotLog(log) {
  if (!log) return log;
  const level = log.alert_level || log.alert_status || 'Normal';
  return {
    ...log,
    alert_level: level,
    alert_status: level,
  };
}

function getInitialData() {
  return {
    users: [
      {
        id: 1,
        name: 'Govindas kitchen',
        organization: 'Govindas kitchen',
        email: 'kitchen@govindas.in',
        password: hashPassword('123456'),
        role: 'donor',
      },
      {
        id: 2,
        name: 'Adi-Yuva Foundation',
        organization: 'Adi-Yuva Foundation',
        email: 'ngo@ecoserve.in',
        password: hashPassword('123456'),
        role: 'receiver',
      },
    ],
    pantry_items: [
      {
        id: 101,
        kitchen_name: 'Govindas kitchen',
        item_name: 'Fruit Juice Tetra Pack 150ml',
        ingredient_name: 'Fruit Juice Tetra Pack 150ml',
        category: 'Packaged Grocery',
        quantity: '1 Packet (150ml)',
        expiry_date: addDaysFormatted(165),
        expiry_days: 165,
        days_left: 165,
        freshness_status: 'Fresh',
        storage_advice: 'Sealed tetra pack. Store in cool dry pantry.',
        ai_notes: 'Sealed tetra pack. Store in cool dry pantry.',
        image_preview: '',
        detection_source: 'Gemini Vision AI (Auto-Scan)',
        created_at: new Date().toISOString(),
      },
      {
        id: 102,
        kitchen_name: 'Govindas kitchen',
        item_name: 'Farm Fresh Red Tomatoes (Crate)',
        ingredient_name: 'Farm Fresh Red Tomatoes (Crate)',
        category: 'Fresh Produce',
        quantity: '12.0 kg',
        expiry_date: addDaysFormatted(4),
        expiry_days: 4,
        days_left: 4,
        freshness_status: 'Fresh',
        storage_advice: 'Ripe red stage. Store in cool dry ventilated rack at 10-12°C.',
        ai_notes: 'Ripe red stage. Store in cool dry ventilated rack at 10-12°C.',
        image_preview: '',
        detection_source: 'Gemini Vision AI (Auto-Scan)',
        created_at: new Date().toISOString(),
      },
      {
        id: 103,
        kitchen_name: 'Govindas kitchen',
        item_name: 'Whole Wheat Sandwich Bread Loaves',
        ingredient_name: 'Whole Wheat Sandwich Bread Loaves',
        category: 'Bakery',
        quantity: '8 Loaves (3.2 kg)',
        expiry_date: addDaysFormatted(1),
        expiry_days: 1,
        days_left: 1,
        freshness_status: 'Critical',
        storage_advice: 'Best before tomorrow. Use immediately or donate to NGO shelter.',
        ai_notes: 'Best before tomorrow. Use immediately or donate to NGO shelter.',
        image_preview: '',
        detection_source: 'Gemini Vision AI (Auto-Scan)',
        created_at: new Date().toISOString(),
      },
    ],
    food_batches: [
      {
        id: 1,
        kitchen_name: 'Govindas kitchen',
        food_item: 'Shahi Paneer & Butter Roti Trays',
        servings: 100,
        quantity_kg: 38,
        storage_temp: 4.1,
        temperature_c: 4.1,
        base_expiry_hours: 4,
        expiry_hours: 4,
        status: 'Available',
        claimed_by: null,
        pickup_otp: null,
        co2_saved_kg: 95.0,
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        kitchen_name: 'Govindas kitchen',
        food_item: 'Rajma Chawal & Mixed Veg Trays',
        servings: 100,
        quantity_kg: 38,
        storage_temp: 4.1,
        temperature_c: 4.1,
        base_expiry_hours: 4,
        expiry_hours: 4,
        status: 'Available',
        claimed_by: null,
        pickup_otp: null,
        co2_saved_kg: 95.0,
        created_at: new Date().toISOString(),
      },
      {
        id: 3,
        kitchen_name: 'Govindas kitchen',
        food_item: 'Amul Fresh Malai Paneer (Bulk Pack) (5.0 kg (10 Packs))',
        servings: 15,
        quantity_kg: 5,
        storage_temp: 4.0,
        temperature_c: 4.0,
        base_expiry_hours: 12,
        expiry_hours: 12,
        status: 'Claimed',
        claimed_by: 'Robin Hood Army NGO',
        pickup_otp: '4829',
        co2_saved_kg: 12.5,
        created_at: new Date().toISOString(),
      },
    ],
    iot_logs: [
      {
        id: 1,
        sensor_id: 'FREEZER-01',
        temperature: 4.1,
        alert_status: 'Normal',
        alert_level: 'Normal',
        logged_at: new Date().toISOString(),
      },
    ],
  };
}

function readLocalDb() {
  if (!fs.existsSync(LOCAL_DB_FILE)) {
    const initial = getInitialData();
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
    if (!Array.isArray(parsed.pantry_items)) {
      parsed.pantry_items = getInitialData().pantry_items;
    }
    if (!Array.isArray(parsed.users)) {
      parsed.users = getInitialData().users;
    }
    return parsed;
  } catch {
    const initial = getInitialData();
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
}

function writeLocalDb(data) {
  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2));
}

async function seedPostgresIfNeeded() {
  const initial = getInitialData();

  for (const u of initial.users) {
    await pool
      .query(
        `INSERT INTO users (name, organization, email, password, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING`,
        [u.name, u.organization, u.email, u.password, u.role]
      )
      .catch(() => {});
  }

  const pantryCount = await pool.query('SELECT COUNT(*) FROM pantry_items');
  if (Number(pantryCount.rows[0].count) === 0) {
    for (const item of initial.pantry_items) {
      await pool.query(
        `INSERT INTO pantry_items
         (kitchen_name, ingredient_name, category, quantity, expiry_date, expiry_days, freshness_status, storage_advice, image_preview, detection_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.kitchen_name || 'Govindas kitchen',
          item.ingredient_name,
          item.category,
          item.quantity,
          item.expiry_date,
          item.expiry_days,
          item.freshness_status,
          item.storage_advice,
          item.image_preview,
          item.detection_source,
        ]
      );
    }
  }

  const batchCount = await pool.query('SELECT COUNT(*) FROM food_batches');
  if (Number(batchCount.rows[0].count) === 0) {
    for (const b of initial.food_batches) {
      await pool.query(
        `INSERT INTO food_batches
         (kitchen_name, food_item, servings, quantity_kg, storage_temp, base_expiry_hours, expiry_hours, status, claimed_by, pickup_otp, co2_saved_kg)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          b.kitchen_name,
          b.food_item,
          b.servings,
          b.quantity_kg,
          b.storage_temp,
          b.base_expiry_hours,
          b.expiry_hours,
          b.status,
          b.claimed_by,
          b.pickup_otp,
          b.co2_saved_kg,
        ]
      );
    }
  }

  const iotCount = await pool.query('SELECT COUNT(*) FROM iot_logs');
  if (Number(iotCount.rows[0].count) === 0) {
    for (const log of initial.iot_logs) {
      await pool.query(
        `INSERT INTO iot_logs (sensor_id, temperature, alert_status) VALUES ($1, $2, $3)`,
        [log.sensor_id, log.temperature, log.alert_status]
      );
    }
  }
}

export async function connectDB() {
  const rawUrl = process.env.DATABASE_URL?.replace(/['"]/g, '').trim();
  if (rawUrl && !rawUrl.includes('password@localhost') && !rawUrl.includes('****')) {
    const cleanDbUrl = rawUrl.replace('&channel_binding=require', '');
    try {
      pool = new Pool({
        connectionString: cleanDbUrl,
        ssl: cleanDbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      });
      await pool.query('SELECT 1');
      const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf8');
      await pool.query(schemaSql);
      await pool
        .query('ALTER TABLE food_batches ADD COLUMN IF NOT EXISTS pickup_otp VARCHAR(10)')
        .catch(() => {});
      await pool
        .query(
          "ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS kitchen_name VARCHAR(120) DEFAULT 'Govindas kitchen'"
        )
        .catch(() => {});
      await pool
        .query(
          "ALTER TABLE food_batches ADD COLUMN IF NOT EXISTS pickup_location VARCHAR(200) DEFAULT 'Mathura Campus Gate 1'"
        )
        .catch(() => {});
      await seedPostgresIfNeeded();
      usingPostgres = true;
      console.log('✅ Connected to Neon / Cloud PostgreSQL Database');
      return;
    } catch (err) {
      console.log('⚠️ PostgreSQL connection failed, using local JSON database:', err.message);
    }
  }
  readLocalDb();
  console.log('✅ Connected to Local Database (database/local_db.json)');
}

export function getDbMode() {
  return usingPostgres ? 'PostgreSQL Connected' : 'Local DB (database/local_db.json)';
}

export async function resetDatabase() {
  const initial = getInitialData();
  if (usingPostgres) {
    await pool.query('DELETE FROM pantry_items');
    await pool.query('DELETE FROM food_batches');
    await pool.query('DELETE FROM iot_logs');
    await seedPostgresIfNeeded();
  }
  writeLocalDb(initial);
  return initial;
}

// ---------------- AUTH / LOGIN & SIGNUP (Strict Email + Password Validation) ----------------

export async function loginOrRegisterUser({
  mode = 'login',
  role,
  organization,
  email,
  password,
}) {
  const cleanRole = role === 'receiver' || role === 'ngo' ? 'receiver' : 'donor';
  const cleanOrg =
    (organization || '').trim() ||
    (cleanRole === 'donor' ? 'Govindas kitchen' : 'Adi-Yuva Foundation');
  const cleanEmail = (email || '').trim().toLowerCase();
  const rawPw = String(password || '');

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    throw new Error('Please enter a valid email address (e.g. name@domain.com).');
  }
  if (rawPw.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const hashedPw = hashPassword(rawPw);
  const token = createSessionToken(cleanEmail, cleanRole);

  if (usingPostgres) {
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [
      cleanEmail,
    ]);

    if (mode === 'signup') {
      if (existing.rows.length > 0) {
        throw new Error(
          'An account with this email already exists! Please switch to Login.'
        );
      }
      const existingOrg = await pool.query(
        'SELECT * FROM users WHERE LOWER(organization) = LOWER($1)',
        [cleanOrg]
      );
      if (existingOrg.rows.length > 0) {
        throw new Error(
          `The name "${cleanOrg}" is already registered! Please choose a different name or Login.`
        );
      }
      const created = await pool.query(
        `INSERT INTO users (name, organization, email, password, role)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, organization, email, role`,
        [cleanOrg, cleanOrg, cleanEmail, hashedPw, cleanRole]
      );
      return { ...created.rows[0], token };
    }

    // Login Mode
    if (existing.rows.length === 0) {
      throw new Error(
        'No account found with this email! Please click "Create New Account" to Sign Up.'
      );
    }

    const user = existing.rows[0];
    const isDefaultDemoMatch =
      (cleanEmail === 'kitchen@govindas.in' || cleanEmail === 'ngo@ecoserve.in') &&
      rawPw === '123456';
    const passwordMatches =
      user.password === hashedPw ||
      user.password === rawPw ||
      isDefaultDemoMatch;

    if (!passwordMatches) {
      throw new Error('Incorrect password! Please enter the right password.');
    }

    if (user.role && user.role !== cleanRole) {
      const expectedLabel = user.role === 'donor' ? 'Kitchen Login' : 'NGO Login';
      throw new Error(
        `This email is registered under "${expectedLabel}". Please select ${expectedLabel} above.`
      );
    }

    const registeredOrg = (user.organization || user.name || '').trim();
    if (
      registeredOrg &&
      cleanOrg.toLowerCase() !== registeredOrg.toLowerCase()
    ) {
      throw new Error(
        cleanRole === 'donor'
          ? 'Invalid Kitchen Name! Please enter your registered Kitchen Name.'
          : 'Invalid NGO Name! Please enter your registered NGO Name.'
      );
    }

    return {
      id: user.id,
      name: registeredOrg,
      organization: registeredOrg,
      email: user.email,
      role: user.role,
      token,
    };
  }

  // Local JSON Database Mode
  const db = readLocalDb();
  const user = db.users.find((u) => u.email === cleanEmail);

  if (mode === 'signup') {
    if (user) {
      throw new Error(
        'An account with this email already exists! Please switch to Login.'
      );
    }
    const orgTaken = db.users.find(
      (u) => (u.organization || '').toLowerCase().trim() === cleanOrg.toLowerCase()
    );
    if (orgTaken) {
      throw new Error(
        `The name "${cleanOrg}" is already registered! Please choose a different name or Login.`
      );
    }
    const newUser = {
      id: Date.now(),
      name: cleanOrg,
      organization: cleanOrg,
      email: cleanEmail,
      password: hashedPw,
      role: cleanRole,
    };
    db.users.push(newUser);
    writeLocalDb(db);
    return {
      id: newUser.id,
      name: newUser.name,
      organization: newUser.organization,
      email: newUser.email,
      role: newUser.role,
      token,
    };
  }

  // Login Mode
  if (!user) {
    throw new Error(
      'No account found with this email! Please click "Create New Account" to Sign Up.'
    );
  }

  const isDefaultDemoMatch =
    (cleanEmail === 'kitchen@govindas.in' || cleanEmail === 'ngo@ecoserve.in') &&
    rawPw === '123456';
  const passwordMatches =
    user.password === hashedPw ||
    user.password === rawPw ||
    isDefaultDemoMatch;

  if (!passwordMatches) {
    throw new Error('Incorrect password! Please enter the right password.');
  }

  if (user.role && user.role !== cleanRole) {
    const expectedLabel = user.role === 'donor' ? 'Kitchen Login' : 'NGO Login';
    throw new Error(
      `This email is registered under "${expectedLabel}". Please select ${expectedLabel} above.`
    );
  }

  const registeredOrg = (user.organization || user.name || '').trim();
  if (
    registeredOrg &&
    cleanOrg.toLowerCase() !== registeredOrg.toLowerCase()
  ) {
    throw new Error(
      cleanRole === 'donor'
        ? 'Invalid Kitchen Name! Please enter your registered Kitchen Name.'
        : 'Invalid NGO Name! Please enter your registered NGO Name.'
    );
  }

  return {
    id: user.id,
    name: registeredOrg,
    organization: registeredOrg,
    email: user.email,
    role: user.role,
    token,
  };
}

// ---------------- GOOGLE CLOUD / OAUTH 2-STEP SIGN-IN ----------------

// Step 1: Check if Google Email already has a registered Kitchen/NGO account
export async function checkGoogleUser({ role, email }) {
  const cleanRole = role === 'receiver' || role === 'ngo' ? 'receiver' : 'donor';
  const cleanEmail = (email || '').trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    throw new Error('Please enter a valid Google email address (e.g. yourname@gmail.com).');
  }

  const token = createSessionToken(cleanEmail, cleanRole);

  if (usingPostgres) {
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [
      cleanEmail,
    ]);
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.role && user.role !== cleanRole) {
        const expectedLabel = user.role === 'donor' ? 'Kitchen Login' : 'NGO Login';
        throw new Error(
          `This Google account is registered under "${expectedLabel}". Please select ${expectedLabel}.`
        );
      }
      return {
        exists: true,
        user: {
          id: user.id,
          name: user.organization || user.name,
          organization: user.organization || user.name,
          email: user.email,
          role: user.role || cleanRole,
          token,
        },
      };
    }
    return { exists: false, email: cleanEmail };
  }

  const db = readLocalDb();
  const user = db.users.find((u) => u.email === cleanEmail);
  if (user) {
    if (user.role && user.role !== cleanRole) {
      const expectedLabel = user.role === 'donor' ? 'Kitchen Login' : 'NGO Login';
      throw new Error(
        `This Google account is registered under "${expectedLabel}". Please select ${expectedLabel}.`
      );
    }
    return {
      exists: true,
      user: {
        id: user.id,
        name: user.organization || user.name,
        organization: user.organization || user.name,
        email: user.email,
        role: user.role || cleanRole,
        token,
      },
    };
  }
  return { exists: false, email: cleanEmail };
}

// Step 2: Complete Google Sign-In by saving the Kitchen / NGO Name entered on Screen 2
export async function googleAuthUser({ role, organization, email }) {
  const cleanRole = role === 'receiver' || role === 'ngo' ? 'receiver' : 'donor';
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanOrg = (organization || '').trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    throw new Error('Please enter a valid Google email address.');
  }
  if (!cleanOrg || cleanOrg.length < 2) {
    throw new Error(
      cleanRole === 'donor'
        ? 'Please enter your Kitchen / Mess Name (at least 2 characters).'
        : 'Please enter your NGO / Organization Name (at least 2 characters).'
    );
  }

  const token = createSessionToken(cleanEmail, cleanRole);
  const googlePwHash = hashPassword(`google_oauth_${cleanEmail}`);

  if (usingPostgres) {
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [
      cleanEmail,
    ]);
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      return {
        id: user.id,
        name: user.organization || user.name || cleanOrg,
        organization: user.organization || user.name || cleanOrg,
        email: user.email,
        role: user.role || cleanRole,
        token,
      };
    }

    const existingOrg = await pool.query(
      'SELECT * FROM users WHERE LOWER(organization) = LOWER($1)',
      [cleanOrg]
    );
    if (existingOrg.rows.length > 0) {
      throw new Error(
        `The name "${cleanOrg}" is already registered! Please enter a unique name.`
      );
    }

    const created = await pool.query(
      `INSERT INTO users (name, organization, email, password, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, organization, email, role`,
      [cleanOrg, cleanOrg, cleanEmail, googlePwHash, cleanRole]
    );
    return { ...created.rows[0], token };
  }

  const db = readLocalDb();
  let user = db.users.find((u) => u.email === cleanEmail);
  if (user) {
    return {
      id: user.id,
      name: user.organization || user.name || cleanOrg,
      organization: user.organization || user.name || cleanOrg,
      email: user.email,
      role: user.role || cleanRole,
      token,
    };
  }

  const orgTaken = db.users.find(
    (u) => (u.organization || '').toLowerCase().trim() === cleanOrg.toLowerCase()
  );
  if (orgTaken) {
    throw new Error(
      `The name "${cleanOrg}" is already registered! Please enter a unique name.`
    );
  }

  user = {
    id: Date.now(),
    name: cleanOrg,
    organization: cleanOrg,
    email: cleanEmail,
    password: googlePwHash,
    role: cleanRole,
  };
  db.users.push(user);
  writeLocalDb(db);
  return {
    id: user.id,
    name: user.name,
    organization: user.organization,
    email: user.email,
    role: user.role,
    token,
  };
}

// ---------------- PANTRY FUNCTIONS (PER-KITCHEN) ----------------

export async function getAllPantryItems() {
  if (usingPostgres) {
    const res = await pool.query('SELECT * FROM pantry_items ORDER BY expiry_days ASC, id DESC');
    return res.rows.map(normalizePantryItem);
  }
  const db = readLocalDb();
  return db.pantry_items.map(normalizePantryItem);
}

export async function addPantryItem(item) {
  const kitchenName = (item.kitchen_name || 'Govindas kitchen').trim();
  const expiryDays = Math.max(0, Number(item.expiry_days ?? item.days_left ?? 3));
  const expiryDate = item.expiry_date || addDaysFormatted(expiryDays);
  const freshnessStatus =
    expiryDays <= 1 ? 'Critical' : expiryDays <= 3 ? 'Expiring Soon' : 'Fresh';
  const name = item.ingredient_name || item.item_name || 'Detected Ingredient';
  const advice = item.storage_advice || item.ai_notes || 'Keep in cool dry storage.';

  if (usingPostgres) {
    const res = await pool.query(
      `INSERT INTO pantry_items
       (kitchen_name, ingredient_name, category, quantity, expiry_date, expiry_days, freshness_status, storage_advice, image_preview, detection_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        kitchenName,
        name,
        item.category || 'Grocery',
        item.quantity || '2.0 kg',
        expiryDate,
        expiryDays,
        freshnessStatus,
        advice,
        item.image_preview || '',
        item.detection_source || 'Gemini Vision AI',
      ]
    );
    return normalizePantryItem(res.rows[0]);
  }

  const db = readLocalDb();
  const newItem = normalizePantryItem({
    id: Date.now(),
    kitchen_name: kitchenName,
    item_name: name,
    ingredient_name: name,
    category: item.category || 'Grocery',
    quantity: item.quantity || '2.0 kg',
    expiry_date: expiryDate,
    expiry_days: expiryDays,
    days_left: expiryDays,
    freshness_status: freshnessStatus,
    storage_advice: advice,
    ai_notes: advice,
    image_preview: item.image_preview || '',
    detection_source: item.detection_source || 'Gemini Vision AI',
    created_at: new Date().toISOString(),
  });
  db.pantry_items.unshift(newItem);
  writeLocalDb(db);
  return newItem;
}

export async function deletePantryItem(id) {
  if (usingPostgres) {
    await pool.query('DELETE FROM pantry_items WHERE id = $1', [id]);
    return { ok: true };
  }
  const db = readLocalDb();
  db.pantry_items = db.pantry_items.filter((i) => String(i.id) !== String(id));
  writeLocalDb(db);
  return { ok: true };
}

// ---------------- SURPLUS BATCH FUNCTIONS ----------------

export async function getAllBatches() {
  if (usingPostgres) {
    const res = await pool.query('SELECT * FROM food_batches ORDER BY id DESC');
    return res.rows.map(normalizeBatch);
  }
  const db = readLocalDb();
  return db.food_batches.map(normalizeBatch);
}

export async function addFoodBatch({
  kitchen_name = 'Govindas kitchen',
  pickup_location = '',
  food_item,
  servings = 50,
  quantity_kg = 20,
  expiry_hours = 4,
}) {
  const cleanServings = Math.max(5, Number(servings) || 50);
  const cleanKg = Math.max(1, Number(quantity_kg) || 20);
  const cleanHours = Math.max(1, Number(expiry_hours) || 4);
  const co2_saved_kg = Number((cleanKg * 2.5).toFixed(1));
  const cleanLoc = (pickup_location || `${kitchen_name}, Mathura`).trim();

  if (usingPostgres) {
    const res = await pool.query(
      `INSERT INTO food_batches (kitchen_name, pickup_location, food_item, servings, quantity_kg, base_expiry_hours, expiry_hours, co2_saved_kg)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7) RETURNING *`,
      [kitchen_name, cleanLoc, food_item, cleanServings, cleanKg, cleanHours, co2_saved_kg]
    );
    return normalizeBatch(res.rows[0]);
  }

  const db = readLocalDb();
  const currentTemp = db.iot_logs[0]?.temperature ?? 4.0;
  const newBatch = normalizeBatch({
    id: Date.now(),
    kitchen_name: kitchen_name.trim(),
    pickup_location: cleanLoc,
    food_item: food_item.trim(),
    servings: cleanServings,
    quantity_kg: cleanKg,
    storage_temp: currentTemp,
    temperature_c: currentTemp,
    base_expiry_hours: cleanHours,
    expiry_hours: currentTemp > 7.0 ? 1 : cleanHours,
    status: 'Available',
    claimed_by: null,
    pickup_otp: null,
    co2_saved_kg,
    created_at: new Date().toISOString(),
  });
  db.food_batches.unshift(newBatch);
  writeLocalDb(db);
  return newBatch;
}

export async function claimFoodBatch(id, ngo_name) {
  const otp = generateOtp();
  if (usingPostgres) {
    const res = await pool.query(
      `UPDATE food_batches SET status = 'Claimed', claimed_by = $1, pickup_otp = $2 WHERE id = $3 RETURNING *`,
      [ngo_name, otp, id]
    );
    return normalizeBatch(res.rows[0]);
  }

  const db = readLocalDb();
  const batch = db.food_batches.find((b) => String(b.id) === String(id));
  if (batch) {
    batch.status = 'Claimed';
    batch.claimed_by = ngo_name;
    batch.pickup_otp = otp;
    writeLocalDb(db);
  }
  return normalizeBatch(batch);
}

export async function verifyPickupBatch(id, entered_otp) {
  if (usingPostgres) {
    const found = await pool.query('SELECT * FROM food_batches WHERE id = $1', [id]);
    const row = found.rows[0];
    if (!row) return { error: 'Batch not found' };
    if (
      entered_otp &&
      row.pickup_otp &&
      String(entered_otp).trim() !== String(row.pickup_otp).trim()
    ) {
      return { error: 'Invalid Pickup OTP' };
    }
    const res = await pool.query(
      `UPDATE food_batches SET status = 'Delivered' WHERE id = $1 RETURNING *`,
      [id]
    );
    return normalizeBatch(res.rows[0]);
  }

  const db = readLocalDb();
  const batch = db.food_batches.find((b) => String(b.id) === String(id));
  if (!batch) return { error: 'Batch not found' };
  if (
    entered_otp &&
    batch.pickup_otp &&
    String(entered_otp).trim() !== String(batch.pickup_otp).trim()
  ) {
    return { error: 'Invalid Pickup OTP' };
  }
  batch.status = 'Delivered';
  writeLocalDb(db);
  return normalizeBatch(batch);
}

export async function deleteFoodBatch(id) {
  if (usingPostgres) {
    await pool.query('DELETE FROM food_batches WHERE id = $1', [id]);
    return { ok: true };
  }
  const db = readLocalDb();
  db.food_batches = db.food_batches.filter((b) => String(b.id) !== String(id));
  writeLocalDb(db);
  return { ok: true };
}

// ---------------- IOT TELEMETRY FUNCTIONS ----------------

export async function logIoTReading({ sensor_id = 'FREEZER-01', temperature = 4.0 }) {
  const temp = Number(Number(temperature).toFixed(1));
  const alert_status = temp > 7.0 ? 'High Temp Alert' : 'Normal';

  if (usingPostgres) {
    await pool.query(
      `INSERT INTO iot_logs (sensor_id, temperature, alert_status) VALUES ($1, $2, $3)`,
      [sensor_id, temp, alert_status]
    );
    if (temp > 7.0) {
      await pool.query(
        `UPDATE food_batches SET storage_temp = $1, expiry_hours = 1 WHERE status = 'Available'`,
        [temp]
      );
    } else {
      await pool.query(
        `UPDATE food_batches SET storage_temp = $1, expiry_hours = COALESCE(base_expiry_hours, 4) WHERE status = 'Available'`,
        [temp]
      );
    }
  } else {
    const db = readLocalDb();
    db.iot_logs.unshift({
      id: Date.now(),
      sensor_id,
      temperature: temp,
      alert_status,
      alert_level: alert_status,
      logged_at: new Date().toISOString(),
    });
    if (db.iot_logs.length > 20) db.iot_logs.length = 20;

    db.food_batches.forEach((b) => {
      if (b.status === 'Available') {
        b.storage_temp = temp;
        b.temperature_c = temp;
        const baseHrs = b.base_expiry_hours || 4;
        b.expiry_hours = temp > 7.0 ? 1 : baseHrs;
      }
    });
    writeLocalDb(db);
  }

  return { sensor_id, temperature: temp, alert_status, alert_level: alert_status };
}

export async function getLatestIoT() {
  if (usingPostgres) {
    const res = await pool.query('SELECT * FROM iot_logs ORDER BY id DESC LIMIT 5');
    return res.rows.map(normalizeIotLog);
  }
  const db = readLocalDb();
  return db.iot_logs.slice(0, 5).map(normalizeIotLog);
}
