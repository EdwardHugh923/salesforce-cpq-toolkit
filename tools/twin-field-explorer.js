/**
 * Twin Field Explorer — Logic
 *
 * Discovers "twin fields" in a Salesforce CPQ org by comparing
 * the field metadata of SBQQ__QuoteLine__c vs OpportunityLineItem.
 *
 * A "twin field" is a field whose API name appears on BOTH objects.
 * When CPQ syncs a quote to an opportunity, these matching fields
 * carry values from the quote line to the opportunity line item.
 *
 * Reference: https://help.salesforce.com/s/articleView?id=sales.cpq_twin_fields.htm&type=5
 */

import { SalesforceAPI, getAPIFromUrl, formatFieldType } from "./sfdc-api.js";

// ── State ──────────────────────────────────────────────────────────────────
let allPairs = [];
let filteredPairs = [];
let activeFilter = "all";
let sortCol = "apiName";
let sortAsc = true;
let api = null;

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  api = getAPIFromUrl();
  if (!api) {
    showError(
      "Could not determine Salesforce org URL. Please close this tab and reopen the tool from the extension popup."
    );
    return;
  }

  document.getElementById("orgChipLabel").textContent = new URL(api.orgOrigin).hostname;

  // Wire up controls
  document.getElementById("runScanBtn").addEventListener("click", runScan);
  document.getElementById("exportBtn").addEventListener("click", exportCSV);
  document.getElementById("searchInput").addEventListener("input", applyFilters);

  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      applyFilters();
    });
  });

  // Column sorting
  document.querySelectorAll("th[data-col]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortAsc = !sortAsc;
      } else {
        sortCol = col;
        sortAsc = true;
      }
      document.querySelectorAll("th.sorted").forEach((t) => t.classList.remove("sorted"));
      th.classList.add("sorted");
      applyFilters();
    });
  });
}

// ── Scan ───────────────────────────────────────────────────────────────────
async function runScan() {
  showState("loading");
  setLoadingMsg("Connecting to Salesforce…");
  document.getElementById("runScanBtn").disabled = true;
  document.getElementById("exportBtn").disabled = true;

  try {
    setLoadingMsg("Fetching Quote Line (SBQQ__QuoteLine__c) field metadata…");
    const qlDescribe = await api.describe("SBQQ__QuoteLine__c");

    setLoadingMsg("Fetching Opportunity Line Item field metadata…");
    const oliDescribe = await api.describe("OpportunityLineItem");

    setLoadingMsg("Computing twin field pairs…");
    allPairs = computeTwinPairs(qlDescribe.fields, oliDescribe.fields);

    renderStats(qlDescribe.fields, oliDescribe.fields, allPairs);
    applyFilters();
    showState("results");
    document.getElementById("exportBtn").disabled = false;
  } catch (err) {
    showError(err.message || "An unexpected error occurred.");
  } finally {
    document.getElementById("runScanBtn").disabled = false;
  }
}

/**
 * Compare fields between the two objects.
 * A twin pair exists when the API name matches (case-insensitive).
 *
 * We also include fields that ONLY exist on one side with a flag,
 * so users can see near-matches or candidates.
 */
function computeTwinPairs(qlFields, oliFields) {
  // Build lookup maps
  const qlMap = new Map(qlFields.map((f) => [f.name.toLowerCase(), f]));
  const oliMap = new Map(oliFields.map((f) => [f.name.toLowerCase(), f]));

  const pairs = [];

  // Find all fields that exist on BOTH objects (true twin fields)
  for (const [key, qlField] of qlMap.entries()) {
    if (oliMap.has(key)) {
      const oliField = oliMap.get(key);
      const typesMatch = qlField.type === oliField.type;
      pairs.push({
        apiName: qlField.name,
        // Quote Line side
        qlLabel: qlField.label,
        qlType: qlField.type,
        qlLength: qlField.length,
        qlPrecision: qlField.precision,
        qlScale: qlField.scale,
        qlRequired: !qlField.nillable && !qlField.defaultedOnCreate,
        qlFormula: qlField.calculated,
        // OLI side
        oliLabel: oliField.label,
        oliType: oliField.type,
        oliLength: oliField.length,
        oliPrecision: oliField.precision,
        oliScale: oliField.scale,
        oliRequired: !oliField.nillable && !oliField.defaultedOnCreate,
        oliFormula: oliField.calculated,
        // Analysis
        typesMatch,
        isCustom: qlField.custom || oliField.custom,
        isTwin: true,
      });
    }
  }

  // Sort by API name by default
  pairs.sort((a, b) => a.apiName.localeCompare(b.apiName));
  return pairs;
}

// ── Filtering & Rendering ──────────────────────────────────────────────────
function applyFilters() {
  const search = document.getElementById("searchInput").value.toLowerCase().trim();

  filteredPairs = allPairs.filter((p) => {
    // Filter chip
    if (activeFilter === "twin" && !p.isTwin) return false;
    if (activeFilter === "custom" && !p.isCustom) return false;
    if (activeFilter === "mismatch" && p.typesMatch) return false;

    // Search
    if (search) {
      const hay = `${p.apiName} ${p.qlLabel} ${p.oliLabel}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }

    return true;
  });

  // Sort
  filteredPairs.sort((a, b) => {
    let av = a[sortCol] ?? "";
    let bv = b[sortCol] ?? "";
    if (typeof av === "boolean") av = av ? 1 : 0;
    if (typeof bv === "boolean") bv = bv ? 1 : 0;
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortAsc ? cmp : -cmp;
  });

  renderTable();
  document.getElementById("resultsCount").textContent = `${filteredPairs.length} of ${allPairs.length} pairs`;
}

function renderTable() {
  const tbody = document.getElementById("resultsBody");
  tbody.innerHTML = "";

  if (filteredPairs.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="8" style="text-align:center;padding:32px;color:var(--color-text-muted)">No fields match your filters.</td>`;
    tbody.appendChild(tr);
    return;
  }

  filteredPairs.forEach((pair, idx) => {
    const mainRow = document.createElement("tr");
    mainRow.className = "expand-row";
    mainRow.dataset.idx = idx;

    const typeBadge = pair.typesMatch
      ? `<span class="badge badge-success">✓ Match</span>`
      : `<span class="badge badge-crimson">✗ Mismatch</span>`;

    const customBadge = pair.isCustom
      ? `<span class="badge badge-gold">Custom</span>`
      : `<span class="badge badge-muted">Standard</span>`;

    mainRow.innerHTML = `
      <td><span class="expand-icon" id="ei-${idx}">›</span></td>
      <td><code style="color:var(--color-crimson-light);font-size:12px">${escHtml(pair.apiName)}</code></td>
      <td>${escHtml(pair.qlLabel)}</td>
      <td><span class="badge badge-muted">${formatFieldType(pair.qlType, pair.qlLength, pair.qlPrecision, pair.qlScale)}</span></td>
      <td>${escHtml(pair.oliLabel)}</td>
      <td><span class="badge badge-muted">${formatFieldType(pair.oliType, pair.oliLength, pair.oliPrecision, pair.oliScale)}</span></td>
      <td>${typeBadge}</td>
      <td>${customBadge}</td>
    `;

    // Detail row (hidden by default)
    const detailRow = document.createElement("tr");
    detailRow.id = `detail-${idx}`;
    detailRow.style.display = "none";
    detailRow.innerHTML = `
      <td colspan="8" style="padding:0;background:var(--color-surface-2)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--color-border)">
          <div style="background:var(--color-surface-2);padding:16px">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--color-crimson);margin-bottom:10px">Quote Line (SBQQ__QuoteLine__c)</div>
            ${renderFieldDetail(pair, "ql")}
          </div>
          <div style="background:var(--color-surface-2);padding:16px">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--color-gold);margin-bottom:10px">Opportunity Line Item</div>
            ${renderFieldDetail(pair, "oli")}
          </div>
        </div>
        ${!pair.typesMatch ? `<div class="error-banner" style="margin:12px;border-radius:var(--radius-sm)">
          <span>⚠</span>
          <span><strong>Type Mismatch:</strong> The Quote Line field type (${formatFieldType(pair.qlType)}) does not match the OLI field type (${formatFieldType(pair.oliType)}). CPQ may not sync this twin field correctly. Review and align the field types.</span>
        </div>` : ""}
      </td>
    `;

    mainRow.addEventListener("click", () => toggleDetail(idx));

    tbody.appendChild(mainRow);
    tbody.appendChild(detailRow);
  });
}

function renderFieldDetail(pair, side) {
  const label = pair[`${side}Label`];
  const type = pair[`${side}Type`];
  const length = pair[`${side}Length`];
  const precision = pair[`${side}Precision`];
  const scale = pair[`${side}Scale`];
  const required = pair[`${side}Required`];
  const formula = pair[`${side}Formula`];

  return `
    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 16px;font-size:12px">
      <span style="color:var(--color-text-muted)">Label</span><span>${escHtml(label)}</span>
      <span style="color:var(--color-text-muted)">API Name</span><code style="color:var(--color-crimson-light)">${escHtml(pair.apiName)}</code>
      <span style="color:var(--color-text-muted)">Type</span><span><span class="badge badge-muted">${formatFieldType(type, length, precision, scale)}</span></span>
      <span style="color:var(--color-text-muted)">Required</span><span>${required ? '<span class="badge badge-crimson">Required</span>' : '<span class="badge badge-muted">Optional</span>'}</span>
      <span style="color:var(--color-text-muted)">Formula</span><span>${formula ? '<span class="badge badge-gold">Formula Field</span>' : '<span class="badge badge-muted">No</span>'}</span>
    </div>
  `;
}

function toggleDetail(idx) {
  const detailRow = document.getElementById(`detail-${idx}`);
  const icon = document.getElementById(`ei-${idx}`);
  const isOpen = detailRow.style.display !== "none";
  detailRow.style.display = isOpen ? "none" : "table-row";
  icon.classList.toggle("open", !isOpen);
}

// ── Stats ──────────────────────────────────────────────────────────────────
function renderStats(qlFields, oliFields, pairs) {
  const twinCount = pairs.length;
  const mismatchCount = pairs.filter((p) => !p.typesMatch).length;
  const customCount = pairs.filter((p) => p.isCustom).length;

  document.getElementById("statsBar").innerHTML = `
    <div class="stat-card">
      <div class="stat-value white">${twinCount}</div>
      <div class="stat-label">Total Twin Field Pairs</div>
    </div>
    <div class="stat-card">
      <div class="stat-value gold">${customCount}</div>
      <div class="stat-label">Custom Field Pairs</div>
    </div>
    <div class="stat-card">
      <div class="stat-value crimson">${mismatchCount}</div>
      <div class="stat-label">Type Mismatches</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:var(--color-text-muted)">${qlFields.length}</div>
      <div class="stat-label">Quote Line Total Fields</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:var(--color-text-muted)">${oliFields.length}</div>
      <div class="stat-label">OLI Total Fields</div>
    </div>
  `;
}

// ── Export CSV ─────────────────────────────────────────────────────────────
function exportCSV() {
  const headers = [
    "API Name",
    "Quote Line Label",
    "Quote Line Type",
    "Quote Line Required",
    "Quote Line Formula",
    "OLI Label",
    "OLI Type",
    "OLI Required",
    "OLI Formula",
    "Types Match",
    "Is Custom",
  ];

  const rows = filteredPairs.map((p) => [
    p.apiName,
    p.qlLabel,
    formatFieldType(p.qlType, p.qlLength, p.qlPrecision, p.qlScale),
    p.qlRequired,
    p.qlFormula,
    p.oliLabel,
    formatFieldType(p.oliType, p.oliLength, p.oliPrecision, p.oliScale),
    p.oliRequired,
    p.oliFormula,
    p.typesMatch,
    p.isCustom,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cpq-twin-fields-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── UI Helpers ─────────────────────────────────────────────────────────────
function showState(state) {
  ["preScanState", "loadingState", "errorState", "resultsState", "statsBar"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  const target = {
    loading: ["loadingState"],
    results: ["resultsState"],
    error: ["errorState"],
    pre: ["preScanState"],
  }[state];
  if (target) target.forEach((id) => document.getElementById(id)?.classList.remove("hidden"));
}

function setLoadingMsg(msg) {
  document.getElementById("loadingMsg").textContent = msg;
}

function showError(msg) {
  showState("error");
  document.querySelector("#errorText span:last-child").textContent = msg;
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

init();
