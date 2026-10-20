import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import {
  connectDB,
  getDbMode,
  resetDatabase,
  loginOrRegisterUser,
  checkGoogleUser,
  googleAuthUser,
  getAllPantryItems,
  addPantryItem,
  deletePantryItem,
  getAllBatches,
  addFoodBatch,
  claimFoodBatch,
  verifyPickupBatch,
  deleteFoodBatch,
  logIoTReading,
  getLatestIoT,
} from '../database/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.join(__dirname, '../.env');
const DIST_PATH = path.join(__dirname, '../dist');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.BACKEND_HOST || '0.0.0.0';

let runtimeGeminiKey = (process.env.GEMINI_API_KEY || '').replace(/['"]/g, '').trim();
if (runtimeGeminiKey === 'your_gemini_api_key_here') {
  runtimeGeminiKey = '';
}

let runtimeGoogleClientId = (
  process.env.GOOGLE_CLIENT_ID ||
  process.env.VITE_GOOGLE_CLIENT_ID ||
  ''
)
  .replace(/['"]/g, '')
  .trim();
if (
  runtimeGoogleClientId === 'your_google_client_id.apps.googleusercontent.com'
) {
  runtimeGoogleClientId = '';
}

// Re-reads .env from disk so saving .env in VS Code takes effect immediately without restarting node
function refreshEnvKeysFromDisk(apiKeyFromClient = '') {
  try {
    if (fs.existsSync(ENV_PATH)) {
      const parsed = dotenv.parse(fs.readFileSync(ENV_PATH, 'utf8'));
      const diskGemini = (parsed.GEMINI_API_KEY || '').replace(/['"]/g, '').trim();
      if (diskGemini && diskGemini !== 'your_gemini_api_key_here') {
        if (diskGemini !== runtimeGeminiKey) {
          runtimeGeminiKey = diskGemini;
          discoveredModelsCache = null;
        }
      }
      const diskGoogleId = (
        parsed.GOOGLE_CLIENT_ID ||
        parsed.VITE_GOOGLE_CLIENT_ID ||
        ''
      )
        .replace(/['"]/g, '')
        .trim();
      if (
        diskGoogleId &&
        diskGoogleId !== 'your_google_client_id.apps.googleusercontent.com'
      ) {
        runtimeGoogleClientId = diskGoogleId;
      }
    }
  } catch {}

  const cleanClientKey = String(apiKeyFromClient || '').replace(/['"]/g, '').trim();
  if (!runtimeGeminiKey && cleanClientKey.startsWith('AIza')) {
    runtimeGeminiKey = cleanClientKey;
  }
  return runtimeGeminiKey;
}

// Official Server-Side Verification of Google OAuth 2.0 Token with Google Servers
async function verifyGoogleTokenWithGoogleServers({ accessToken, idToken }) {
  if (accessToken) {
    const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await resp.json();
    if (!resp.ok || !data.email) {
      throw new Error(
        data.error_description || 'Invalid or expired Google OAuth access token.'
      );
    }
    return {
      email: data.email.toLowerCase().trim(),
      name: data.name || data.email.split('@')[0],
      picture: data.picture || '',
      sub: data.sub || '',
    };
  }

  if (idToken) {
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    const data = await resp.json();
    if (!resp.ok || !data.email) {
      throw new Error(
        data.error_description || 'Invalid or expired Google ID token.'
      );
    }
    return {
      email: data.email.toLowerCase().trim(),
      name: data.name || data.email.split('@')[0],
      picture: data.picture || '',
      sub: data.sub || '',
    };
  }

  throw new Error('Missing Google OAuth token.');
}

let cachedWorkingModel = 'gemini-2.5-flash-lite';
let discoveredModelsCache = null;

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(event, payload) {
  const message = JSON.stringify({
    event,
    payload,
    time: new Date().toLocaleTimeString(),
  });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(message);
  });
}

async function getAvailableGeminiModels(apiKey) {
  if (discoveredModelsCache && discoveredModelsCache.length > 0) {
    return discoveredModelsCache;
  }
  // Includes both Gemini Flash models AND Google's multimodal Gemma-3 Vision models
  // (Gemma-3 uses the exact same GEMINI_API_KEY but runs on a separate server pool that avoids 503 High Demand spikes!)
  const preferredOrder = [
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemma-3-27b-it',
    'gemma-3-12b-it',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-2.5-flash',
  ];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await res.json();
    if (Array.isArray(data?.models)) {
      const supported = data.models
        .filter(
          (m) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent') &&
            (m.name.includes('gemini') || m.name.includes('gemma-3')) &&
            !m.name.includes('embedding') &&
            !m.name.includes('tts') &&
            !m.name.includes('image-generation')
        )
        .map((m) => m.name.replace('models/', ''));

      const sorted = [
        ...preferredOrder.filter((p) => supported.includes(p)),
        ...supported.filter((s) => !preferredOrder.includes(s)),
      ];
      if (sorted.length > 0) {
        discoveredModelsCache = sorted.slice(0, 8);
        cachedWorkingModel = discoveredModelsCache[0];
        return discoveredModelsCache;
      }
    }
  } catch {}
  return preferredOrder;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGeminiJSON({ prompt, base64Data = null, mimeType = 'image/jpeg' }) {
  if (!runtimeGeminiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  const available = await getAvailableGeminiModels(runtimeGeminiKey);
  const candidateModels = [...new Set([cachedWorkingModel, ...available])];

  const parts = [{ text: prompt }];
  if (base64Data) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64Data,
      },
    });
  }

  let lastError = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${runtimeGeminiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.25,
            },
          }),
        });
        clearTimeout(timer);

        const data = await response.json();
        if (!response.ok || data.error) {
          const errMsg = data.error?.message || `HTTP ${response.status}`;
          if (response.status !== 404 || !lastError) {
            lastError = new Error(errMsg);
          }
          if (errMsg.toLowerCase().includes('api key not valid')) {
            throw lastError;
          }
          // If 503 High Demand on attempt 1, wait 1.2s and retry before switching to next model
          if (
            attempt === 1 &&
            (response.status === 503 || errMsg.toLowerCase().includes('high demand'))
          ) {
            await sleep(1200);
            continue;
          }
          break; // Move to next model in candidateModels
        }

        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          lastError = new Error('Gemini response did not contain JSON');
          break;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        cachedWorkingModel = model;
        console.log(`✅ AI Request succeeded using model: ${model}`);
        return {
          modelUsed: model,
          result: parsed,
        };
      } catch (err) {
        if (!lastError) lastError = err;
        if (err.message?.toLowerCase().includes('api key not valid')) {
          throw err;
        }
        break;
      }
    }
  }

  throw lastError || new Error('Gemini API call failed');
}

// 1. GET complete state & health status
app.get('/api/data', async (_req, res) => {
  try {
    refreshEnvKeysFromDisk();
    const [pantryItems, batches, iotLogs] = await Promise.all([
      getAllPantryItems(),
      getAllBatches(),
      getLatestIoT(),
    ]);
    res.json({
      dbMode: getDbMode(),
      hasGeminiKey: Boolean(runtimeGeminiKey),
      activeGeminiModel: cachedWorkingModel,
      pantryItems,
      batches,
      iotLogs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1A. POST Live Gemini AI Health & Key Verification Check
app.post('/api/test-gemini', async (req, res) => {
  refreshEnvKeysFromDisk();
  const passedKey = (req.body?.apiKey || '').replace(/['"]/g, '').trim();
  const candidateKey = passedKey || runtimeGeminiKey;
  if (!candidateKey) {
    return res.status(400).json({
      ok: false,
      error:
        'Gemini API Key is missing! Please paste your GEMINI_API_KEY in .env or in the ⚙️ AI Key bar.',
    });
  }

  runtimeGeminiKey = candidateKey;
  discoveredModelsCache = null;

  try {
    const { modelUsed, result } = await callGeminiJSON({
      prompt:
        'Respond ONLY with valid JSON: {"status": "online", "message": "Google Gemini AI is connected and working properly."}',
    });
    return res.json({
      ok: true,
      modelUsed,
      message: result?.message || `Connected to ${modelUsed}`,
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: `Gemini API Error: ${err.message}`,
    });
  }
});

// 1B. POST Login & Sign Up Authentication (With Email & Password Validation)
app.post('/api/login', async (req, res) => {
  try {
    const user = await loginOrRegisterUser({
      ...(req.body || {}),
      mode: req.body?.mode || 'login',
    });
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const user = await loginOrRegisterUser({
      ...(req.body || {}),
      mode: 'signup',
    });
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 1C. REAL GOOGLE OAUTH 2.0 CONFIG & SERVER-SIDE TOKEN VERIFICATION
app.get('/api/auth/google-config', (_req, res) => {
  res.json({
    clientId: runtimeGoogleClientId,
    configured: Boolean(runtimeGoogleClientId),
  });
});

app.post('/api/auth/google-config', (req, res) => {
  const cleanClientId = (req.body?.clientId || '').replace(/['"]/g, '').trim();
  if (!cleanClientId || !cleanClientId.includes('.apps.googleusercontent.com')) {
    return res.status(400).json({
      error:
        'Invalid Google Client ID. It must end with .apps.googleusercontent.com',
    });
  }
  runtimeGoogleClientId = cleanClientId;

  try {
    let envContent = fs.existsSync(ENV_PATH)
      ? fs.readFileSync(ENV_PATH, 'utf8')
      : 'PORT=4000\nGEMINI_API_KEY=\nDATABASE_URL=\nGOOGLE_CLIENT_ID=\n';
    if (envContent.includes('GOOGLE_CLIENT_ID=')) {
      envContent = envContent.replace(
        /GOOGLE_CLIENT_ID=.*/g,
        `GOOGLE_CLIENT_ID=${cleanClientId}`
      );
    } else {
      envContent += `\nGOOGLE_CLIENT_ID=${cleanClientId}\n`;
    }
    fs.writeFileSync(ENV_PATH, envContent);
  } catch (e) {
    console.warn('Could not save GOOGLE_CLIENT_ID to .env:', e.message);
  }

  res.json({ ok: true, clientId: runtimeGoogleClientId });
});

// Step 1 of Real Google OAuth: Verify Google Token with Google Servers & Check DB
app.post('/api/google-auth/verify', async (req, res) => {
  try {
    const { accessToken, idToken, role } = req.body || {};
    const googleProfile = await verifyGoogleTokenWithGoogleServers({
      accessToken,
      idToken,
    });
    const checkResult = await checkGoogleUser({
      role,
      email: googleProfile.email,
    });

    if (checkResult.exists) {
      return res.json({
        exists: true,
        user: checkResult.user,
        googleProfile,
      });
    }

    return res.json({
      exists: false,
      googleProfile,
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Step 2 of Real Google OAuth: Re-verify Google Token & Save Kitchen / NGO Name in DB
app.post('/api/google-auth/complete', async (req, res) => {
  try {
    const { accessToken, idToken, role, organization } = req.body || {};
    const googleProfile = await verifyGoogleTokenWithGoogleServers({
      accessToken,
      idToken,
    });
    const user = await googleAuthUser({
      role,
      organization,
      email: googleProfile.email,
    });
    res.json({ user, googleProfile });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Direct 2-Step Google Email Check & Complete (works out-of-the-box even before GOOGLE_CLIENT_ID is set)
app.post('/api/google-auth/check', async (req, res) => {
  try {
    const result = await checkGoogleUser(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/google-auth', async (req, res) => {
  try {
    const user = await googleAuthUser(req.body || {});
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. POST Save Gemini API Key
app.post('/api/set-key', (req, res) => {
  const cleanKey = (req.body?.apiKey || '').replace(/['"]/g, '').trim();
  runtimeGeminiKey = cleanKey;
  discoveredModelsCache = null;

  try {
    let envContent = fs.existsSync(ENV_PATH)
      ? fs.readFileSync(ENV_PATH, 'utf8')
      : 'PORT=4000\nGEMINI_API_KEY=\nDATABASE_URL=\n';
    if (envContent.includes('GEMINI_API_KEY=')) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${cleanKey}`);
    } else {
      envContent += `\nGEMINI_API_KEY=${cleanKey}\n`;
    }
    fs.writeFileSync(ENV_PATH, envContent);
  } catch (e) {
    console.warn('Could not write .env file:', e.message);
  }

  res.json({ ok: true, hasGeminiKey: Boolean(runtimeGeminiKey) });
});

// 3. POST Reset Demo Data
app.post('/api/reset', async (_req, res) => {
  await resetDatabase();
  broadcast('RESET', {
    message: '🔄 Demo database restored to clean initial state.',
  });
  res.json({ ok: true });
});

// 4. REAL GEMINI VISION AI IMAGE SCANNER (With Strict Error Handling)
app.post('/api/pantry/scan-image', async (req, res) => {
  const {
    kitchenName = 'Govindas kitchen',
    imageDataUrl = '',
    apiKeyFromClient = '',
  } = req.body || {};

  refreshEnvKeysFromDisk(apiKeyFromClient);

  if (!imageDataUrl || !imageDataUrl.includes('base64,')) {
    return res
      .status(400)
      .json({ error: 'No valid image provided. Please upload a valid food photo.' });
  }

  if (!runtimeGeminiKey) {
    return res.status(400).json({
      error:
        'Gemini API Key is missing! Please add GEMINI_API_KEY in your .env file or click "⚙️ AI Key" in the top navbar to set it.',
    });
  }

  const [header, base64Data] = imageDataUrl.split('base64,');
  const matchMime = header.match(/data:(.*?);/);
  const mimeType = matchMime && matchMime[1] ? matchMime[1] : 'image/jpeg';
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const visionPrompt = `You are an expert AI Food & Ingredient Vision Analyzer for an institutional kitchen pantry. Today's date is ${todayStr}.

Look directly at the visual pixels of this image. You do NOT need printed text or OCR:
1. Visually identify the exact ingredient, fruit, vegetable, dairy product, bread, grain, or cooked dish shown in the photo.
2. Assess its visual freshness/ripeness state (color, texture, condition).
3. Estimate how many days ("expiry_days") this item will stay fresh before spoiling, and calculate "expiry_date" (YYYY-MM-DD) starting from today (${todayStr}).
4. Estimate the visible quantity/count/weight in the photo.

Respond ONLY with valid JSON in this exact format:
{
  "ingredient_name": "<Specific name of the food/ingredient in the photo>",
  "category": "<Fresh Produce | Fruits | Dairy & Chilled | Bakery | Grains & Pulses | Cooked Food | Packaged Grocery>",
  "quantity": "<Estimated visible quantity, e.g., ~1.5 kg (6 pieces) or 1 Packet>",
  "expiry_days": <integer number of days until expiry, e.g. 4>,
  "expiry_date": "<YYYY-MM-DD>",
  "freshness_analysis": "<1 sentence describing what you visually see in the photo>",
  "storage_advice": "<1 short sentence on optimal storage temperature & how to keep it fresh>"
}`;

    const { modelUsed, result } = await callGeminiJSON({
      prompt: visionPrompt,
      base64Data,
      mimeType,
    });

    const savedItem = await addPantryItem({
      kitchen_name: kitchenName,
      ingredient_name: result.ingredient_name || 'Detected Ingredient',
      category: result.category || 'Fresh Produce',
      quantity: result.quantity || '1.5 kg',
      expiry_days: Number(result.expiry_days ?? 3),
      expiry_date: result.expiry_date,
      storage_advice: result.freshness_analysis
        ? `${result.freshness_analysis} • ${result.storage_advice || ''}`
        : result.storage_advice || 'Keep in cool dry storage.',
      image_preview: imageDataUrl,
      detection_source: `Gemini Vision (${modelUsed})`,
    });

    broadcast('PANTRY_ADDED', {
      message: `📸 Gemini Vision (${modelUsed}) Identified for ${kitchenName}: "${savedItem.ingredient_name}" — Expires ${savedItem.expiry_date} (${savedItem.expiry_days}d left)`,
      item: savedItem,
    });

    return res.json({ item: savedItem, aiLive: true, modelUsed });
  } catch (err) {
    console.error('Gemini Vision Error:', err.message);
    return res.status(502).json({
      error: `Gemini Vision API Error: ${err.message}`,
    });
  }
});

// 5. DELETE Pantry Item
app.delete('/api/pantry/:id', async (req, res) => {
  await deletePantryItem(req.params.id);
  res.json({ ok: true });
});

// 6. POST Move Expiring Pantry Item Directly to NGO Surplus Marketplace
app.post('/api/pantry/:id/move-to-surplus', async (req, res) => {
  const items = await getAllPantryItems();
  const item = items.find((i) => String(i.id) === String(req.params.id));
  if (!item) {
    return res.status(404).json({ error: 'Pantry item not found' });
  }

  const numMatch = String(item.quantity).match(/(\d+(\.\d+)?)/);
  const kg = numMatch ? Math.max(2, Number(numMatch[1])) : 5;
  const servings = Math.round(kg * 3);
  const ownerKitchen =
    req.body?.kitchenName?.trim() || item.kitchen_name || 'Govindas kitchen';

  const newBatch = await addFoodBatch({
    kitchen_name: ownerKitchen,
    food_item: `${item.ingredient_name} (${item.quantity})`,
    servings,
    quantity_kg: kg,
    expiry_hours: Math.max(2, Number(item.expiry_days) * 6),
  });

  await deletePantryItem(item.id);

  broadcast('NEW_SURPLUS', {
    message: `♻️ ${ownerKitchen} routed "${newBatch.food_item}" (${newBatch.servings} servings) to NGOs!`,
    batch: newBatch,
  });

  res.json({ batch: newBatch });
});

// 7. Google Gemini AI Demand Forecasting (With Strict Input Validation & Error Handling)
app.post('/api/ai-forecast', async (req, res) => {
  const {
    kitchenName = '',
    mealType = 'Lunch',
    dayOfWeek = 'Tuesday',
    expectedStudents,
    weather = 'Sunny',
    apiKeyFromClient = '',
  } = req.body || {};

  refreshEnvKeysFromDisk(apiKeyFromClient);

  const cleanKitchen = String(kitchenName || '').trim();
  if (!cleanKitchen || cleanKitchen.length < 2) {
    return res.status(400).json({
      error: 'Please enter a valid Kitchen Name (at least 2 characters).',
    });
  }

  const headcount = Number(expectedStudents);
  if (!Number.isFinite(headcount) || headcount < 5 || headcount > 50000) {
    return res.status(400).json({
      error:
        'Please enter a valid Registered Headcount between 5 and 50,000 diners.',
    });
  }

  if (!runtimeGeminiKey) {
    return res.status(400).json({
      error:
        'Gemini API Key is missing! Please add GEMINI_API_KEY in your .env file or click "⚙️ AI Key" in the top navbar to set it.',
    });
  }

  try {
    const prompt = `You are an AI food waste advisor for an institutional kitchen named "${cleanKitchen}".
Exact Current Inputs:
- Kitchen Name: "${cleanKitchen}"
- Day of Week: ${dayOfWeek}
- Weather Condition: ${weather}
- Meal Session: ${mealType}
- Total Registered Headcount: ${headcount} people

IMPORTANT RULES:
1. "predictedMeals" MUST be an integer LESS than ${headcount} (typically between ${Math.round(
      headcount * 0.68
    )} and ${Math.round(headcount * 0.94)} depending on ${weather} weather on ${dayOfWeek} for ${mealType}).
2. "mealsSavedFromWaste" MUST equal (${headcount} minus predictedMeals).
3. "estimatedCostSavedINR" MUST equal (mealsSavedFromWaste * 120).
4. "aiAdvice" MUST specifically mention "${cleanKitchen}", "${dayOfWeek}", "${weather}" weather, "${mealType}", and ${headcount} registered people!

Respond ONLY in valid JSON with this exact structure:
{
  "predictedMeals": <integer>,
  "mealsSavedFromWaste": <integer>,
  "estimatedCostSavedINR": <integer>,
  "aiAdvice": "<2 sentences tailored specifically to ${cleanKitchen} on a ${weather} ${dayOfWeek} ${mealType} for ${headcount} people>"
}`;

    const { modelUsed, result } = await callGeminiJSON({ prompt });

    let pred = Math.round(Number(result.predictedMeals));
    if (!pred || pred >= headcount || pred < Math.round(headcount * 0.35)) {
      pred = Math.round(headcount * 0.85);
    }
    const saved = Math.max(1, headcount - pred);
    const costSaved = saved * 120;

    return res.json({
      ok: true,
      modelUsed,
      source: `Google Gemini AI (${modelUsed})`,
      kitchenName: cleanKitchen,
      dayOfWeek,
      weather,
      mealType,
      headcount,
      predictedMeals: pred,
      mealsSavedFromWaste: saved,
      estimatedCostSavedINR: costSaved,
      aiAdvice:
        result.aiAdvice ||
        `For ${cleanKitchen} on ${dayOfWeek} (${weather} ${mealType}) with ${headcount} registered diners, prepare ${pred} meals to prevent ${saved} plates of food waste.`,
    });
  } catch (err) {
    console.error('Gemini Forecast Error:', err.message);
    return res.status(502).json({
      error: `Gemini Forecast API Error: ${err.message}`,
    });
  }
});

// 8. Kitchen Posts Surplus Food Batch
app.post('/api/batches', async (req, res) => {
  const newBatch = await addFoodBatch(req.body || {});
  broadcast('NEW_SURPLUS', {
    message: `🍱 New Surplus Posted: ${newBatch.food_item} (${newBatch.servings} meals) from ${newBatch.kitchen_name}!`,
    batch: newBatch,
  });
  res.json(newBatch);
});

// 9. NGO Claims Surplus Food Batch (Generates 4-Digit Pickup OTP)
app.post('/api/batches/:id/claim', async (req, res) => {
  const { ngo_name = 'Adi-Yuva Foundation' } = req.body || {};
  const updated = await claimFoodBatch(req.params.id, ngo_name);
  broadcast('BATCH_CLAIMED', {
    message: `🚚 ${ngo_name} accepted "${updated?.food_item}" (Pickup OTP: ${updated?.pickup_otp})!`,
    batch: updated,
  });
  res.json(updated);
});

// 9B. Kitchen Verifies Pickup OTP & Marks Delivered
app.post('/api/batches/:id/verify-pickup', async (req, res) => {
  const { otp = '' } = req.body || {};
  const result = await verifyPickupBatch(req.params.id, otp);
  if (result?.error) {
    return res.status(400).json({ error: result.error });
  }
  broadcast('BATCH_DELIVERED', {
    message: `🎉 Verified Pickup! "${result?.food_item}" handed over to ${result?.claimed_by}.`,
    batch: result,
  });
  res.json(result);
});

// 10. DELETE Food Batch (Only the Owner Kitchen can delete its own batch!)
app.delete('/api/batches/:id', async (req, res) => {
  const requesterKitchen = (req.query.kitchen || '').toLowerCase().trim();
  if (requesterKitchen) {
    const all = await getAllBatches();
    const target = all.find((b) => String(b.id) === String(req.params.id));
    if (
      target &&
      (target.kitchen_name || '').toLowerCase().trim() !== requesterKitchen
    ) {
      return res
        .status(403)
        .json({ error: 'You can only delete food batches posted by your own kitchen!' });
    }
  }
  await deleteFoodBatch(req.params.id);
  res.json({ ok: true });
});

// 11. IoT Cold-Storage Sensor Endpoint
app.post('/api/iot', async (req, res) => {
  const { sensor_id = 'FREEZER-01', temperature = 4.0 } = req.body || {};
  const reading = await logIoTReading({ sensor_id, temperature });

  if (reading.alert_status === 'High Temp Alert') {
    broadcast('IOT_ALERT', {
      message: `🚨 IoT Alert: ${sensor_id} hit ${reading.temperature}°C! Available surplus marked URGENT (1 hr expiry).`,
      reading,
    });
  } else {
    broadcast('IOT_UPDATE', {
      message: `✅ IoT Sensor ${sensor_id} normalized to ${reading.temperature}°C. Standard expiry restored.`,
      reading,
    });
  }

  res.json(reading);
});

// 12. Serve Production Frontend (dist/) for Live Hosting (Render / Railway / Single-Server)
if (fs.existsSync(path.join(DIST_PATH, 'index.html'))) {
  app.use(express.static(DIST_PATH));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

connectDB().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`🚀 EcoServe Server running on http://127.0.0.1:${PORT}`);
  });
});
