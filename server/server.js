require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ── In-Memory Database ───────────────────────────────────────────────────────
// Store upload tracking info in memory since Firebase has been removed.
const uploadedDocs = new Map();

// ── AWS S3 Setup ─────────────────────────────────────────────────────────────
// Raw trade documents are still stored in S3 for secure viewing via presigned URLs.
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const upload = multer({ storage: multer.memoryStorage() });

// Python AI service base URL
const PYTHON_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:7860';

// ── Auth Middleware ──────────────────────────────────────────────────────────
const verifyToken = async (req, res, next) => {
    // Auth removed. Bypass token check and set default user.
    req.uid = 'local-user';
    next();
};

// ── GET /documents ───────────────────────────────────────────────────────────
// Returns all uploaded documents
app.get('/documents', verifyToken, (req, res) => {
    // Return array of values from Map
    const docs = Array.from(uploadedDocs.values());
    // Sort by createdAt descending
    docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(docs);
});

// ── POST /upload ─────────────────────────────────────────────────────────────
// Uploads trade document to S3 and creates Firestore upload record.
// Firestore record tracks: fileName, fileUrl, status, uid, customerId
app.post('/upload', verifyToken, upload.single('document'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Customer ID from form data (determines validation rules)
        const customerId = req.body.customerId || 'generic';

        const fileKey = `uploads/${Date.now()}-${file.originalname}`;
        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        }));
        const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;

        // Create in-memory doc for status tracking only
        const docId = `doc-${crypto.randomUUID()}`;
        const docRecord = {
            id: docId,
            fileUrl,
            fileName: file.originalname,
            status: 'uploaded',
            uid: req.uid,
            customerId,
            createdAt: new Date().toISOString(),
        };
        uploadedDocs.set(docId, docRecord);

        const result = { id: docId, fileUrl, fileName: file.originalname, customerId };
        res.json({ message: 'File uploaded successfully', documents: [result] });
    } catch (error) {
        console.error('[Upload] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── POST /trigger ─────────────────────────────────────────────────────────────
// Triggers the Python multi-agent pipeline for a document.
// Passes customerId so the Validator Agent loads the right rules.
app.post('/trigger', verifyToken, async (req, res) => {
    const { docId, fileUrl, customerId } = req.body;
    if (!docId || !fileUrl) {
        return res.status(400).json({ error: 'docId and fileUrl are required' });
    }

    try {
        // Check document exists in memory
        const docSnap = uploadedDocs.get(docId);
        if (!docSnap) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const fileName = docSnap.fileName || 'document';
        const effectiveCustomerId = customerId || docSnap.customerId || 'generic';

        // Update to 'processing'
        docSnap.status = 'processing';
        console.log(`[Server] Triggering pipeline for doc: ${docId}, customer: ${effectiveCustomerId}`);

        // Fire-and-forget: call Python AI service
        axios.post(`${PYTHON_URL}/process`, {
            docId,
            fileUrl,
            fileName,
            customerId: effectiveCustomerId
        }).then(response => {
            console.log(`[Server] Pipeline accepted for ${docId}:`, response.data);
        }).catch(err => {
            console.error(`[Server] Python service error for ${docId}:`, err.message);
        });

        // ── Status sync polling ──────────────────────────────────────────
        // Poll the Python AI service every 10s to sync the in-memory doc
        // status with the actual pipeline result stored in SQLite.
        // This prevents the watchdog from incorrectly marking docs as failed.
        const POLL_INTERVAL = 10000; // 10 seconds
        const MAX_POLLS = 30;        // 5 minutes total
        let pollCount = 0;
        const statusPoller = setInterval(async () => {
            pollCount++;
            try {
                const snap = uploadedDocs.get(docId);
                if (!snap || snap.status !== 'processing') {
                    clearInterval(statusPoller);
                    return;
                }
                const resp = await axios.get(`${PYTHON_URL}/shipments/${docId}`, { timeout: 5000 });
                const finalStatus = resp.data?.status;
                if (finalStatus && finalStatus !== 'pending' && finalStatus !== 'processing' && finalStatus !== 'extracted' && finalStatus !== 'validated') {
                    // Pipeline reached a terminal state — sync it
                    snap.status = finalStatus;
                    console.log(`[Server] Status synced for ${docId}: ${finalStatus}`);
                    clearInterval(statusPoller);
                }
            } catch (e) {
                // Shipment not in SQLite yet — keep polling
            }
            if (pollCount >= MAX_POLLS) {
                clearInterval(statusPoller);
                const snap = uploadedDocs.get(docId);
                if (snap && snap.status === 'processing') {
                    console.log(`[Server] TIMEOUT for doc ${docId}. Marking timed_out.`);
                    snap.status = 'failed';
                    snap.error = 'Pipeline timed out after 5 minutes.';
                }
            }
        }, POLL_INTERVAL);

        res.json({ message: 'Pipeline triggered', docId, customer: effectiveCustomerId });
    } catch (error) {
        console.error('[Trigger] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── GET /documents/:docId/view ────────────────────────────────────────────────
// Generates presigned S3 URL for secure document viewing in the UI.
app.get('/documents/:docId/view', verifyToken, async (req, res) => {
    const { docId } = req.params;
    try {
        let fileUrl;
        let fileName;

        const docSnap = uploadedDocs.get(docId);
        if (docSnap) {
            fileUrl = docSnap.fileUrl;
            fileName = docSnap.fileName;
        } else {
            // Fetch from python service if not in memory (e.g. after server restart)
            try {
                const pythonRes = await axios.get(`${PYTHON_URL}/shipments/${docId}`);
                if (pythonRes.data) {
                    fileUrl = pythonRes.data.file_url;
                    fileName = pythonRes.data.file_name;
                }
            } catch (err) {
                return res.status(404).json({ error: 'Document not found in database' });
            }
        }

        if (!fileUrl) {
            return res.status(404).json({ error: 'File URL not found' });
        }

        const key = decodeURIComponent(new URL(fileUrl).pathname.substring(1));
        const command = new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key });
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 });
        res.json({ url: presignedUrl, fileName });
    } catch (error) {
        console.error('[View] Presigned URL error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── GET /shipments ─────────────────────────────────────────────────────────────
// ARCHITECTURE: Proxies to Python service SQLite — the source of truth for
// extracted/validated shipment data. Node.js server does NOT query SQLite directly.
app.get('/shipments', verifyToken, async (req, res) => {
    try {
        const params = new URLSearchParams();
        if (req.query.customer_id) params.append('customer_id', req.query.customer_id);
        if (req.query.limit) params.append('limit', req.query.limit);

        const response = await axios.get(`${PYTHON_URL}/shipments?${params.toString()}`, {
            timeout: 10000
        });
        res.json(response.data);
    } catch (error) {
        console.error('[Shipments] Proxy error:', error.message);
        res.status(500).json({ error: 'Failed to fetch shipments from AI service' });
    }
});

// ── GET /shipments/:id ─────────────────────────────────────────────────────────
// Returns full pipeline result: extracted fields + validation + decision + audit trail
app.get('/shipments/:shipmentId', verifyToken, async (req, res) => {
    try {
        const response = await axios.get(
            `${PYTHON_URL}/shipments/${req.params.shipmentId}`,
            { timeout: 10000 }
        );
        res.json(response.data);
    } catch (error) {
        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        console.error('[Shipment Detail] Proxy error:', error.message);
        res.status(500).json({ error: 'Failed to fetch shipment detail' });
    }
});

// ── POST /query ────────────────────────────────────────────────────────────────
// Natural language query over trade data.
// Example body: { "question": "How many shipments were flagged this week?" }
app.post('/query', verifyToken, async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ error: 'question is required' });
        }
        const response = await axios.post(
            `${PYTHON_URL}/query`,
            { question },
            { timeout: 30000 }
        );
        res.json(response.data);
    } catch (error) {
        console.error('[Query] Proxy error:', error.message);
        res.status(500).json({ error: 'Query failed' });
    }
});

// ── GET /decisions ─────────────────────────────────────────────────────────────
// Returns recent router agent decisions across all shipments.
app.get('/decisions', verifyToken, async (req, res) => {
    try {
        const response = await axios.get(`${PYTHON_URL}/decisions`, { timeout: 10000 });
        res.json(response.data);
    } catch (error) {
        console.error('[Decisions] Proxy error:', error.message);
        res.status(500).json({ error: 'Failed to fetch decisions' });
    }
});

// ── GET /stats ─────────────────────────────────────────────────────────────────
// Dashboard summary statistics.
app.get('/stats', verifyToken, async (req, res) => {
    try {
        const response = await axios.get(`${PYTHON_URL}/stats`, { timeout: 10000 });
        res.json(response.data);
    } catch (error) {
        console.error('[Stats] Proxy error:', error.message);
        // Return zeros on AI service unavailability
        res.json({ total_shipments: 0, auto_approved: 0, human_review: 0, amendment_required: 0, failed: 0 });
    }
});

// ── Server Startup ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
    console.log(`[Server] TradeAI Backend running on port ${PORT}`);
    console.log(`[Server] Python AI Service: ${PYTHON_URL}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${PORT} already in use.`);
    } else {
        console.error('[Server] Critical error:', err);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled Rejection:', reason);
});
