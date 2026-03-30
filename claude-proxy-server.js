require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// API keys from environment variables
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "YOUR_CLAUDE_API_KEY_HERE";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "YOUR_OPENAI_API_KEY_HERE";

// Debug: Check if API keys are loaded (without logging the full keys)
console.log('Claude API Key loaded:', CLAUDE_API_KEY ? `${CLAUDE_API_KEY.substring(0, 15)}...` : 'NOT FOUND');
console.log('OpenAI API Key loaded:', OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 15)}...` : 'NOT FOUND');

// Middleware
app.use(cors());
app.use(express.json());

const dataDirectory = path.join(__dirname, 'data');
const liveOpsStatePath = path.join(dataDirectory, 'live-ops-state.json');
const liveOpsClients = new Set();
let writeQueue = Promise.resolve();
const LIVE_OPS_STATUSES = ['operational', 'warning', 'offline', 'out-of-service', 'maintenance'];

function isInServiceStatus(status) {
  return status === 'operational' || status === 'warning';
}

function createInitialLiveOpsState() {
  const equipmentGroups = [
    { key: 'filters', label: 'Filters', names: ['Filter 1', 'Filter 2', 'Filter 3', 'Filter 4', 'Filter 5', 'Filter 6', 'Filter 7', 'Filter 8'] },
    { key: 'low-zone-pumps', label: 'Low Zone Pumps', names: ['LZ1B', 'LZ2B', 'LZ3B', 'LZ4B', 'LZ1A', 'LZ2A', 'LZ3A'] },
    { key: 'high-zone-pumps', label: 'High Zone Pumps', names: ['HZ 1', 'HZ 2', 'HZ 3', 'HZ 4'] },
    { key: 'booster-pumps', label: 'Booster Pumps', names: ['Booster 1', 'Booster 2', 'Booster 3', 'Jockey'] },
    {
      key: 'reclaim-pumps',
      label: 'Reclaim Pumps',
      names: [
        { id: 'reclaim-pumps-north-reclaim-pump', name: 'North Reclaim' },
        { id: 'reclaim-pumps-south-reclaim-pump', name: 'South Reclaim' },
      ],
    },
    {
      key: 'waste-pumps',
      label: 'Waste Pumps',
      names: [
        { id: 'waste-pumps-north-waste-pump', name: 'North Waste' },
        { id: 'waste-pumps-south-waste-pump', name: 'South Waste' },
      ],
    },
  ];

  const now = new Date().toISOString();
  const equipment = equipmentGroups.flatMap((group) =>
    group.names.map((entry) => {
      const name = typeof entry === 'string' ? entry : entry.name;
      const id = typeof entry === 'string'
        ? `${group.key}-${name.toLowerCase().replace(/\s+/g, '-')}`
        : entry.id;
      return {
      id,
      name,
      groupKey: group.key,
      groupLabel: group.label,
      status: 'out-of-service',
      inService: false,
      swMaintenanceComplete: false,
      swMaintenanceYear: null,
      note: '',
      changeLog: [],
      updatedAt: now,
      updatedBy: 'system',
    };
    })
  );

  return {
    version: 3,
    updatedAt: now,
    comments: [],
    equipment,
  };
}

function sanitizeNote(note) {
  if (typeof note !== 'string') {
    return '';
  }
  return note.trim().slice(0, 1500);
}

function sanitizeCommentMessage(message) {
  if (typeof message !== 'string') {
    return '';
  }
  return message.trim().slice(0, 2000);
}

function sanitizeUpdatedBy(updatedBy) {
  if (typeof updatedBy !== 'string') {
    return 'operator';
  }
  const cleaned = updatedBy.trim().slice(0, 80);
  return cleaned || 'operator';
}

function sanitizeStatus(status) {
  if (typeof status !== 'string') {
    return null;
  }
  const cleaned = status.trim().toLowerCase();
  if (cleaned === 'out of service') {
    return 'out-of-service';
  }
  return LIVE_OPS_STATUSES.includes(cleaned) ? cleaned : null;
}

function sanitizeMaintenanceYear(value) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return null;
  }
  if (parsed < 1900 || parsed > 2100) {
    return null;
  }
  return parsed;
}

function sanitizeChangeLogEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : null;
  const updatedBy = sanitizeUpdatedBy(entry.updatedBy);
  const rawChanges = Array.isArray(entry.changes) ? entry.changes : [];
  const changes = rawChanges
    .map((change) => {
      if (!change || typeof change !== 'object') {
        return null;
      }
      const field = typeof change.field === 'string' ? change.field.trim().slice(0, 80) : '';
      const label = typeof change.label === 'string' ? change.label.trim().slice(0, 120) : '';
      const from = typeof change.from === 'string' ? change.from.trim().slice(0, 300) : '';
      const to = typeof change.to === 'string' ? change.to.trim().slice(0, 300) : '';
      if (!field || !label) {
        return null;
      }
      return { field, label, from, to };
    })
    .filter(Boolean);

  if (!timestamp || !changes.length) {
    return null;
  }

  return {
    timestamp,
    updatedBy,
    changes,
  };
}

function sanitizeChangeLog(changeLog) {
  if (!Array.isArray(changeLog)) {
    return [];
  }

  return changeLog
    .map(sanitizeChangeLogEntry)
    .filter(Boolean)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 100);
}

function formatStatusLabel(status) {
  switch (status) {
    case 'operational':
      return 'Online';
    case 'warning':
      return 'Warning';
    case 'offline':
      return 'Offline';
    case 'out-of-service':
      return 'Out of Service';
    case 'maintenance':
      return 'Maintenance Ongoing';
    default:
      return 'Unknown';
  }
}

function formatNoteChange(value) {
  const sanitized = sanitizeNote(value);
  return sanitized || 'No notes';
}

function formatMaintenanceCompleteLabel(value) {
  return value === true ? 'Complete' : 'Incomplete';
}

function formatMaintenanceYearLabel(value) {
  const year = sanitizeMaintenanceYear(value);
  return year === null ? 'None' : String(year);
}

function buildEquipmentChangeLog(currentEquipment, nextEquipment, timestamp, updatedBy) {
  const changes = [];

  if (currentEquipment.status !== nextEquipment.status) {
    changes.push({
      field: 'status',
      label: 'Status',
      from: formatStatusLabel(currentEquipment.status),
      to: formatStatusLabel(nextEquipment.status),
    });
  }

  if (sanitizeNote(currentEquipment.note) !== sanitizeNote(nextEquipment.note)) {
    changes.push({
      field: 'note',
      label: 'Notes',
      from: formatNoteChange(currentEquipment.note),
      to: formatNoteChange(nextEquipment.note),
    });
  }

  if (Boolean(currentEquipment.swMaintenanceComplete) !== Boolean(nextEquipment.swMaintenanceComplete)) {
    changes.push({
      field: 'swMaintenanceComplete',
      label: 'Surface Wash Maintenance',
      from: formatMaintenanceCompleteLabel(currentEquipment.swMaintenanceComplete),
      to: formatMaintenanceCompleteLabel(nextEquipment.swMaintenanceComplete),
    });
  }

  if (sanitizeMaintenanceYear(currentEquipment.swMaintenanceYear) !== sanitizeMaintenanceYear(nextEquipment.swMaintenanceYear)) {
    changes.push({
      field: 'swMaintenanceYear',
      label: 'Surface Wash Year',
      from: formatMaintenanceYearLabel(currentEquipment.swMaintenanceYear),
      to: formatMaintenanceYearLabel(nextEquipment.swMaintenanceYear),
    });
  }

  if (!changes.length) {
    return null;
  }

  return {
    timestamp,
    updatedBy,
    changes,
  };
}

function sendSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastLiveOpsEvent(event, payload) {
  for (const client of liveOpsClients) {
    sendSseEvent(client.res, event, payload);
  }
}

function queueStateWrite(state) {
  writeQueue = writeQueue
    .then(async () => {
      await fs.promises.mkdir(dataDirectory, { recursive: true });
      await fs.promises.writeFile(liveOpsStatePath, JSON.stringify(state, null, 2), 'utf8');
    })
    .catch((error) => {
      console.error('Failed writing live ops state:', error);
    });
  return writeQueue;
}

function normalizeLoadedState(rawState) {
  const fallbackState = createInitialLiveOpsState();
  if (!rawState || !Array.isArray(rawState.equipment)) {
    return fallbackState;
  }

  const loadedById = new Map(rawState.equipment.map((item) => [item.id, item]));
  const legacyLowZoneIdMap = {
    'low-zone-pumps-lz-1': 'low-zone-pumps-lz1b',
    'low-zone-pumps-lz-2': 'low-zone-pumps-lz2b',
    'low-zone-pumps-lz-3': 'low-zone-pumps-lz3b',
    'low-zone-pumps-lz-4': 'low-zone-pumps-lz4b',
    'other-pumps-jockey': 'booster-pumps-jockey',
  };
  for (const [legacyId, nextId] of Object.entries(legacyLowZoneIdMap)) {
    if (!loadedById.has(nextId) && loadedById.has(legacyId)) {
      loadedById.set(nextId, loadedById.get(legacyId));
    }
  }

  const mergedEquipment = fallbackState.equipment.map((fallback) => {
    const loaded = loadedById.get(fallback.id);
    if (!loaded) {
      return fallback;
    }
    const normalizedStatus = sanitizeStatus(loaded.status);
    const maintenanceComplete = loaded.swMaintenanceComplete === true;
    const maintenanceYear = maintenanceComplete ? sanitizeMaintenanceYear(loaded.swMaintenanceYear) : null;
    return {
      ...fallback,
      status: normalizedStatus || (Boolean(loaded.inService) ? 'operational' : 'out-of-service'),
      inService: normalizedStatus ? isInServiceStatus(normalizedStatus) : Boolean(loaded.inService),
      swMaintenanceComplete: maintenanceComplete,
      swMaintenanceYear: maintenanceYear,
      note: sanitizeNote(loaded.note),
      changeLog: sanitizeChangeLog(loaded.changeLog),
      updatedAt: typeof loaded.updatedAt === 'string' ? loaded.updatedAt : fallback.updatedAt,
      updatedBy: sanitizeUpdatedBy(loaded.updatedBy),
    };
  });

  const normalizedComments = Array.isArray(rawState.comments)
    ? rawState.comments
      .map((comment, index) => {
        const message = sanitizeCommentMessage(comment?.message);
        if (!message) {
          return null;
        }
        const rawId = typeof comment?.id === 'string' && comment.id.trim()
          ? comment.id.trim().slice(0, 120)
          : `comment-${index + 1}`;
        return {
          id: rawId,
          message,
          author: sanitizeUpdatedBy(comment?.author),
          updatedAt: typeof comment?.updatedAt === 'string' ? comment.updatedAt : fallbackState.updatedAt,
        };
      })
      .filter(Boolean)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    : [];

  return {
    version: 3,
    updatedAt: typeof rawState.updatedAt === 'string' ? rawState.updatedAt : fallbackState.updatedAt,
    comments: normalizedComments,
    equipment: mergedEquipment,
  };
}

function loadLiveOpsState() {
  const fallbackState = createInitialLiveOpsState();
  try {
    if (!fs.existsSync(liveOpsStatePath)) {
      return fallbackState;
    }
    const fileContents = fs.readFileSync(liveOpsStatePath, 'utf8');
    const parsed = JSON.parse(fileContents);
    return normalizeLoadedState(parsed);
  } catch (error) {
    console.error('Failed loading live ops state, using defaults:', error);
    return fallbackState;
  }
}

let liveOpsState = loadLiveOpsState();
queueStateWrite(liveOpsState);

app.get('/api/live-ops/state', (req, res) => {
  res.json(liveOpsState);
});

app.get('/api/live-ops/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const client = { id: clientId, res };
  liveOpsClients.add(client);

  sendSseEvent(res, 'snapshot', liveOpsState);

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    liveOpsClients.delete(client);
  });
});

app.put('/api/live-ops/equipment/:equipmentId', async (req, res) => {
  const { equipmentId } = req.params;
  const equipmentIndex = liveOpsState.equipment.findIndex((item) => item.id === equipmentId);

  if (equipmentIndex === -1) {
    return res.status(404).json({ error: `Equipment not found: ${equipmentId}` });
  }

  const incomingInService = req.body?.inService;
  const incomingStatus = req.body?.status;
  const incomingNote = req.body?.note;
  const incomingUpdatedBy = req.body?.updatedBy;
  const incomingSwMaintenanceComplete = req.body?.swMaintenanceComplete;
  const incomingSwMaintenanceYear = req.body?.swMaintenanceYear;
  const hasInService = typeof incomingInService === 'boolean';
  const sanitizedStatus = sanitizeStatus(incomingStatus);
  const hasStatus = sanitizedStatus !== null;
  const hasNote = typeof incomingNote === 'string';
  const hasSwMaintenanceComplete = typeof incomingSwMaintenanceComplete === 'boolean';
  const hasSwMaintenanceYear = incomingSwMaintenanceYear !== undefined;
  const sanitizedSwMaintenanceYear = hasSwMaintenanceYear ? sanitizeMaintenanceYear(incomingSwMaintenanceYear) : null;

  if (!hasInService && !hasStatus && !hasNote && !hasSwMaintenanceComplete && !hasSwMaintenanceYear) {
    return res.status(400).json({
      error: 'Request must include "status", "inService", "note", "swMaintenanceComplete", and/or "swMaintenanceYear"',
    });
  }

  if (hasSwMaintenanceYear && sanitizedSwMaintenanceYear === null && incomingSwMaintenanceYear !== null && incomingSwMaintenanceYear !== '') {
    return res.status(400).json({ error: '"swMaintenanceYear" must be a valid year' });
  }

  const now = new Date().toISOString();
  const currentEquipment = liveOpsState.equipment[equipmentIndex];

  const resolvedStatus = hasStatus
    ? sanitizedStatus
    : hasInService
      ? (incomingInService ? 'operational' : 'out-of-service')
      : (sanitizeStatus(currentEquipment.status) || (currentEquipment.inService ? 'operational' : 'out-of-service'));

  const resolvedSwMaintenanceComplete = hasSwMaintenanceComplete
    ? incomingSwMaintenanceComplete
    : currentEquipment.swMaintenanceComplete === true;
  const resolvedSwMaintenanceYear = resolvedSwMaintenanceComplete
    ? (hasSwMaintenanceYear ? sanitizedSwMaintenanceYear : sanitizeMaintenanceYear(currentEquipment.swMaintenanceYear))
    : null;

  const updatedEquipment = {
    ...currentEquipment,
    status: resolvedStatus,
    inService: isInServiceStatus(resolvedStatus),
    swMaintenanceComplete: resolvedSwMaintenanceComplete,
    swMaintenanceYear: resolvedSwMaintenanceYear,
    note: hasNote ? sanitizeNote(incomingNote) : currentEquipment.note,
    changeLog: sanitizeChangeLog(currentEquipment.changeLog),
    updatedBy: sanitizeUpdatedBy(incomingUpdatedBy),
    updatedAt: now,
  };

  const changeLogEntry = buildEquipmentChangeLog(
    currentEquipment,
    updatedEquipment,
    now,
    updatedEquipment.updatedBy
  );

  if (!changeLogEntry) {
    return res.json({
      success: true,
      changed: false,
      equipment: currentEquipment,
      updatedAt: currentEquipment.updatedAt,
    });
  }

  updatedEquipment.changeLog = [changeLogEntry, ...sanitizeChangeLog(currentEquipment.changeLog)].slice(0, 100);

  liveOpsState = {
    ...liveOpsState,
    updatedAt: now,
    equipment: liveOpsState.equipment.map((item, index) => (index === equipmentIndex ? updatedEquipment : item)),
  };

  await queueStateWrite(liveOpsState);
  broadcastLiveOpsEvent('state-updated', liveOpsState);

  return res.json({
    success: true,
    equipment: updatedEquipment,
    updatedAt: now,
  });
});

app.post('/api/live-ops/comments', async (req, res) => {
  const message = sanitizeCommentMessage(req.body?.message);
  if (!message) {
    return res.status(400).json({ error: '"message" is required' });
  }

  const now = new Date().toISOString();
  const comment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    author: sanitizeUpdatedBy(req.body?.updatedBy),
    updatedAt: now,
  };

  liveOpsState = {
    ...liveOpsState,
    updatedAt: now,
    comments: [comment, ...(Array.isArray(liveOpsState.comments) ? liveOpsState.comments : [])],
  };

  await queueStateWrite(liveOpsState);
  broadcastLiveOpsEvent('state-updated', liveOpsState);

  return res.json({
    success: true,
    comment,
    state: liveOpsState,
    updatedAt: now,
  });
});

app.put('/api/live-ops/comments/:commentId', async (req, res) => {
  const { commentId } = req.params;
  const commentIndex = Array.isArray(liveOpsState.comments)
    ? liveOpsState.comments.findIndex((item) => item.id === commentId)
    : -1;

  if (commentIndex === -1) {
    return res.status(404).json({ error: `Comment not found: ${commentId}` });
  }

  const message = sanitizeCommentMessage(req.body?.message);
  if (!message) {
    return res.status(400).json({ error: '"message" is required' });
  }

  const now = new Date().toISOString();
  const updatedComment = {
    ...liveOpsState.comments[commentIndex],
    message,
    author: sanitizeUpdatedBy(req.body?.updatedBy),
    updatedAt: now,
  };

  const nextComments = liveOpsState.comments.map((item, index) => (index === commentIndex ? updatedComment : item));
  nextComments.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  liveOpsState = {
    ...liveOpsState,
    updatedAt: now,
    comments: nextComments,
  };

  await queueStateWrite(liveOpsState);
  broadcastLiveOpsEvent('state-updated', liveOpsState);

  return res.json({
    success: true,
    comment: updatedComment,
    state: liveOpsState,
    updatedAt: now,
  });
});

app.delete('/api/live-ops/comments/:commentId', async (req, res) => {
  const { commentId } = req.params;
  const currentComments = Array.isArray(liveOpsState.comments) ? liveOpsState.comments : [];
  const nextComments = currentComments.filter((item) => item.id !== commentId);

  if (nextComments.length === currentComments.length) {
    return res.status(404).json({ error: `Comment not found: ${commentId}` });
  }

  const now = new Date().toISOString();
  liveOpsState = {
    ...liveOpsState,
    updatedAt: now,
    comments: nextComments,
  };

  await queueStateWrite(liveOpsState);
  broadcastLiveOpsEvent('state-updated', liveOpsState);

  return res.json({
    success: true,
    state: liveOpsState,
    updatedAt: now,
  });
});

// Proxy endpoint for AI explanations (Claude or OpenAI)
app.post('/api/claude', async (req, res) => {
  try {
    console.log('Received request for AI explanation');
    
    const { targetVariable, predictorVariable, correlationValue, provider = 'auto' } = req.body;
    
    if (!targetVariable || !predictorVariable || correlationValue === undefined) {
      return res.status(400).json({ 
        error: 'Missing required parameters: targetVariable, predictorVariable, correlationValue' 
      });
    }

    // Pick provider: auto prefers Claude when available, otherwise OpenAI
    let providerToUse = provider;
    const hasClaude = CLAUDE_API_KEY && CLAUDE_API_KEY !== "YOUR_CLAUDE_API_KEY_HERE";
    const hasOpenAI = OPENAI_API_KEY && OPENAI_API_KEY !== "YOUR_OPENAI_API_KEY_HERE";

    if (providerToUse === 'auto') {
      providerToUse = hasClaude ? 'claude' : hasOpenAI ? 'openai' : null;
    } else if (providerToUse === 'claude' && !hasClaude && hasOpenAI) {
      console.warn('Claude key missing, falling back to OpenAI');
      providerToUse = 'openai';
    } else if (providerToUse === 'openai' && !hasOpenAI && hasClaude) {
      console.warn('OpenAI key missing, falling back to Claude');
      providerToUse = 'claude';
    }

    if (!providerToUse) {
      return res.status(400).json({ error: 'No AI provider is configured (Claude or OpenAI key required)' });
    }

    const prompt = `Explain the correlation coefficient of ${correlationValue.toFixed(3)} between "${targetVariable}" and "${predictorVariable}" in a water treatment facility context.

Focus on the technical relationships and mechanisms that could cause this correlation:
- Physical and chemical processes in water treatment
- Seasonal effects and operational factors  
- Equipment interactions and process dependencies
- Water quality relationships

Provide a direct technical explanation of the underlying mechanisms without introductory phrases. Keep it concise but informative (2-3 paragraphs).`;

    console.log(`Making ${providerToUse.toUpperCase()} API request...`);

    let response;
    
    if (providerToUse === 'claude') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 400,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });
    } else if (providerToUse === 'openai') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          max_tokens: 400,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });
    } else {
      return res.status(400).json({ error: 'Invalid provider. Must be "claude" or "openai"' });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${providerToUse.toUpperCase()} API Error:`, errorText);
      return res.status(response.status).json({ 
        error: `${providerToUse.toUpperCase()} API failed: ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();
    console.log(`${providerToUse.toUpperCase()} API response received`);

    let explanation;
    
    if (providerToUse === 'claude') {
      if (data.content && data.content[0] && data.content[0].text) {
        explanation = data.content[0].text.trim();
      } else {
        console.error('Invalid Claude API response structure:', data);
        return res.status(500).json({ error: 'Invalid Claude API response structure' });
      }
    } else if (providerToUse === 'openai') {
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        explanation = data.choices[0].message.content.trim();
      } else {
        console.error('Invalid OpenAI API response structure:', data);
        return res.status(500).json({ error: 'Invalid OpenAI API response structure' });
      }
    }

    if (explanation) {
      res.json({ 
        explanation: explanation,
        provider: providerToUse,
        success: true 
      });
    } else {
      res.status(500).json({ 
        error: `Failed to parse ${providerToUse.toUpperCase()} response` 
      });
    }

  } catch (error) {
    console.error('Proxy server error:', error);
    res.status(500).json({ 
      error: 'Proxy server error',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Claude Proxy Server' });
});

app.listen(PORT, () => {
  console.log(`Claude proxy server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('API endpoint: http://localhost:${PORT}/api/claude');
});
