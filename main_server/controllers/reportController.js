/**
 * controllers/reportController.js
 * Generates a Gemini-authored forensic PDF report for a single alert.
 *
 * Flow:
 *   1. Fetch alert from MongoDB (or use the request body as fallback for mock data)
 *   2. Send structured prompt to Gemini API
 *   3. Build a styled PDF with pdfkit
 *   4. Stream PDF directly to HTTP response for browser download
 */

const PDFDocument = require("pdfkit");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Alert = require("../models/Alert");

// ── Colour palette ───────────────────────────────────────────────────────────
const C = {
  bg:        "#0f172a",   // slate-950
  panel:     "#1e293b",   // slate-800
  border:    "#334155",   // slate-600
  accent:    "#6366f1",   // indigo-500
  danger:    "#f43f5e",   // rose-500
  warning:   "#f59e0b",   // amber-500
  success:   "#10b981",   // emerald-500
  cyan:      "#06b6d4",   // cyan-500
  textPrim:  "#f1f5f9",   // slate-100
  textSec:   "#94a3b8",   // slate-400
  textMuted: "#475569",   // slate-600
};

// ── Gemini prompt builder ────────────────────────────────────────────────────
function buildPrompt(alert) {
  return `You are an expert cybersecurity forensic analyst for an AI-powered Host Intrusion Detection System (AI-HIDS). 
Analyze the following security alert and produce a professional forensic incident report.

## Alert Data
- Alert ID: ${alert._id || "N/A"}
- Sensor ID: ${alert.sensor_id}
- Process Name: ${alert.process_name}
- PID: ${alert.pid}
- Risk Score: ${alert.risk_score}%
- Anomaly Score: ${alert.anomaly_score || "N/A"}%
- Classification: ${alert.classification || "Unknown"}
- Confidence: ${alert.confidence || "N/A"}%
- Status: ${alert.status || "Active"}
- Rule Triggers: ${(alert.rule_triggers || alert.rule_hits || []).join(", ") || "None"}
- Timestamp: ${new Date(alert.timestamp).toISOString()}
- Existing Explanation: ${alert.explanation || "None"}
- Mitigation Status: ${alert.mitigation_status || "none"}

## Instructions
Produce a structured forensic report with the following sections. Be concise but thorough. Use plain text only, no markdown symbols.

SECTION 1 - EXECUTIVE SUMMARY
Write 2-3 sentences summarizing the threat, severity, and urgency for a CISO or security manager.

SECTION 2 - THREAT ANALYSIS
Provide a detailed technical analysis of what the process was likely doing based on the rule triggers, risk score, and anomaly patterns. Explain why this is classified as suspicious or malicious.

SECTION 3 - ATTACK VECTOR ASSESSMENT
Identify the most probable attack vector (e.g. ransomware, credential harvesting, lateral movement, privilege escalation, C2 communication). Explain the reasoning.

SECTION 4 - INDICATORS OF COMPROMISE (IOCs)
List specific indicators from this alert that confirm malicious intent. Be specific.

SECTION 5 - RECOMMENDED CONTAINMENT ACTIONS
List 3-5 prioritized, actionable remediation steps tailored to this specific threat.

SECTION 6 - RISK CONTEXT
Rate the business risk as LOW / MEDIUM / HIGH / CRITICAL and explain the potential impact if this alert is not addressed.

Keep each section under 150 words. Do not use asterisks, hashes, or markdown formatting.`;
}

// ── PDF builder ──────────────────────────────────────────────────────────────
function buildPDF(res, alert, geminiText, reportId) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
    bufferPages: true,
  });

  // Pipe to HTTP response
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="hids-report-pid${alert.pid}-${Date.now()}.pdf"`
  );
  doc.pipe(res);

  const W = doc.page.width - 100; // usable width
  const riskColor = alert.risk_score >= 85 ? C.danger : alert.risk_score >= 60 ? C.warning : C.success;

  // ── HEADER BANNER ─────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 90).fill("#0f172a");

  doc.fillColor(C.accent).fontSize(9).font("Helvetica-Bold")
    .text("AI-HIDS  •  FORENSIC INCIDENT REPORT", 50, 22, { characterSpacing: 2 });

  doc.fillColor(C.textPrim).fontSize(18).font("Helvetica-Bold")
    .text("Security Incident Report", 50, 38);

  doc.fillColor(C.textSec).fontSize(8).font("Helvetica")
    .text(`Report ID: ${reportId}   •   Generated: ${new Date().toUTCString()}`, 50, 62);

  doc.moveDown(4);

  // ── ALERT SUMMARY CARD ────────────────────────────────────────────────────
  const cardY = 105;
  doc.rect(50, cardY, W, 110).fill("#1e293b").stroke("#334155");

  doc.fillColor(C.textSec).fontSize(7).font("Helvetica-Bold")
    .text("ALERT SUMMARY", 66, cardY + 12, { characterSpacing: 2 });

  const col1 = 66, col2 = 210, col3 = 380;
  const rowH = 18;

  const fields = [
    ["PROCESS", alert.process_name || "Unknown"],
    ["PID", String(alert.pid)],
    ["SENSOR ID", alert.sensor_id],
    ["CLASSIFICATION", alert.classification || "Unknown"],
    ["CONFIDENCE", `${alert.confidence || "N/A"}%`],
    ["STATUS", alert.mitigation_status?.toUpperCase() || "ACTIVE"],
  ];

  fields.forEach((f, i) => {
    const x = i % 2 === 0 ? col1 : col2;
    const y = cardY + 30 + Math.floor(i / 2) * rowH;
    doc.fillColor(C.textMuted).fontSize(7).font("Helvetica-Bold").text(f[0], x, y);
    doc.fillColor(C.textPrim).fontSize(8).font("Helvetica").text(f[1], x, y + 9, { width: 130, ellipsis: true });
  });

  // Risk Score badge
  doc.rect(col3, cardY + 25, 120, 65).fill(riskColor + "22").stroke(riskColor + "66");
  doc.fillColor(riskColor).fontSize(30).font("Helvetica-Bold")
    .text(`${alert.risk_score.toFixed(0)}%`, col3 + 10, cardY + 35, { width: 100, align: "center" });
  doc.fillColor(riskColor).fontSize(7).font("Helvetica-Bold")
    .text("RISK SCORE", col3 + 10, cardY + 72, { width: 100, align: "center", characterSpacing: 2 });

  // Rule Triggers
  const triggersY = cardY + 120;
  doc.fillColor(C.textMuted).fontSize(7).font("Helvetica-Bold")
    .text("RULE TRIGGERS:", 50, triggersY, { characterSpacing: 1 });

  const triggers = (alert.rule_triggers || alert.rule_hits || []);
  const trigStr = triggers.length > 0 ? triggers.join("  •  ") : "NONE RECORDED";
  doc.fillColor(C.danger).fontSize(7.5).font("Helvetica-Bold")
    .text(trigStr, 50, triggersY + 10, { width: W });

  doc.y = triggersY + 30;
  doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).strokeColor(C.border).lineWidth(0.5).stroke();
  doc.moveDown(1);

  // ── GEMINI ANALYSIS SECTIONS ──────────────────────────────────────────────
  const sectionTitles = [
    "EXECUTIVE SUMMARY",
    "THREAT ANALYSIS",
    "ATTACK VECTOR ASSESSMENT",
    "INDICATORS OF COMPROMISE (IOCs)",
    "RECOMMENDED CONTAINMENT ACTIONS",
    "RISK CONTEXT",
  ];

  const rawSections = geminiText
    .split(/SECTION\s+\d+\s*[-–]\s*/i)
    .map(s => s.trim())
    .filter(Boolean);

  sectionTitles.forEach((title, i) => {
    const content = rawSections[i] || "Analysis not available for this section.";

    // Section label strip
    doc.rect(50, doc.y, W, 16).fill(i === 0 ? C.accent + "33" : "#1e293b").stroke(C.border);
    doc.fillColor(i === 0 ? C.accent : C.textSec)
      .fontSize(7.5).font("Helvetica-Bold")
      .text(title, 58, doc.y + 4, { characterSpacing: 1.5 });
    doc.moveDown(0.2);
    doc.y += 16;

    doc.fillColor(C.textPrim).fontSize(9).font("Helvetica")
      .text(content, 50, doc.y, { width: W, lineGap: 3 });
    doc.moveDown(1.2);

    // Guard against overflowing last page
    if (doc.y > doc.page.height - 80) {
      doc.addPage();
    }
  });

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - 38;
    doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY)
      .strokeColor(C.border).lineWidth(0.5).stroke();
    doc.fillColor(C.textMuted).fontSize(7).font("Helvetica")
      .text(
        `AI-HIDS Forensic Report  •  Report ID: ${reportId}  •  Page ${i + 1} of ${range.count}  •  CONFIDENTIAL`,
        50, footerY + 8, { align: "center", width: doc.page.width - 100 }
      );
  }

  doc.end();
}

// ── Controller ────────────────────────────────────────────────────────────────
const generateAlertReport = async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      status: "error",
      message: "GEMINI_API_KEY is not configured. Add it to your .env file to enable PDF report generation."
    });
  }

  try {
    // 1. Resolve alert — try DB first, accept body fallback (for mock data)
    let alert = null;
    const { id } = req.params;
    const isMockId = id.length < 20;   // real ObjectIds are 24 chars

    if (!isMockId) {
      try {
        alert = await Alert.findById(id).lean();
      } catch (_) { /* invalid ObjectId shape — fall through */ }
    }

    // Use request body alert data as fallback (frontend sends it for mock/offline alerts)
    if (!alert) {
      alert = req.body?.alert;
    }

    if (!alert) {
      return res.status(404).json({
        status: "error",
        message: "Alert not found. Pass the full alert object in the request body for mock alerts."
      });
    }

    // 2. Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(buildPrompt(alert));
    const geminiText = result.response.text();

    // 3. Generate report ID and build PDF
    const reportId = `HIDS-${Date.now()}-PID${alert.pid}`;
    buildPDF(res, alert, geminiText, reportId);

  } catch (err) {
    console.error("[!] Report generation error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ status: "error", message: `Report generation failed: ${err.message}` });
    }
  }
};

module.exports = { generateAlertReport };
