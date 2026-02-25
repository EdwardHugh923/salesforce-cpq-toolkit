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

const TWIN_PAIRS = [
  { source: 'Contract',                  target: 'Opportunity' },
  { source: 'ServiceContract',           target: 'Opportunity' },
  { source: 'OpportunityLineItem',       target: 'SBQQ__QuoteLine__c' },
  { source: 'Product2',                  target: 'SBQQ__QuoteLine__c' },
  { source: 'SBQQ__ProductOption__c',    target: 'SBQQ__QuoteLine__c' },
  { source: 'SBQQ__Quote__c',            target: 'Order' },
  { source: 'SBQQ__QuoteLine__c',        target: 'OrderItem' },
  { source: 'SBQQ__QuoteLine__c',        target: 'OpportunityLineItem' },
  { source: 'SBQQ__QuoteLine__c',        target: 'SBQQ__Subscription__c' },
  { source: 'SBQQ__QuoteLine__c',        target: 'Asset' },
  { source: 'SBQQ__QuoteLine__c',        target: 'ContractLineItem' },
  { source: 'SBQQ__Subscription__c',     target: 'SBQQ__QuoteLine__c' },
  { source: 'ContractLineItem',          target: 'SBQQ__QuoteLine__c' },
  { source: 'OrderItem',                 target: 'blng__InvoiceLine__c' },
  { source: 'Asset',                     target: 'SBQQ__QuoteLine__c' },
  { source: 'SBQQ__ConfigurationAttribute__c', target: 'SBQQ__QuoteLine__c' }
];

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
    allPairs = [];

    for (const pair of TWIN_PAIRS) {
      try {
        setLoadingMsg(`Fetching ${pair.source} fields…`);
        const sourceDescribe = await api.describe(pair.source);

        setLoadingMsg(`Fetching ${pair.target} fields…`);
        const targetDescribe = await api.describe(pair.target);

        setLoadingMsg(`Computing twins for ${pair.source} → ${pair.target}…`);
        const twins = computeTwinPairs(
          sourceDescribe.fields,
          targetDescribe.fields,
          pair.source,
          pair.target
        );
        allPairs.push(...twins);
      } catch (e) {
        console.warn(`Skipping pair ${pair.source} → ${pair.target}: ${e.message}`);
        continue;
      }
    }

    renderStats(allPairs);
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
function computeTwinPairs(sourceFields, targetFields, sourceObj, targetObj) {
  const sourceMap = new Map(sourceFields.map(f => [f.name.toLowerCase(), f]));
  const targetMap = new Map(targetFields.map(f => [f.name.toLowerCase(), f]));

  const pairs = [];

  for (const [key, sourceField] of sourceMap.entries()) {
    if (targetMap.has(key)) {
      const targetField = targetMap.get(key);
      const typesMatch = sourceField.type === targetField.type;

      pairs.push({
        apiName: sourceField.name,
        sourceObj,
        targetObj,
        pairLabel: `${sourceObj} → ${targetObj}`,
        // source side
        sourceLabel: sourceField.label,
        sourceType: sourceField.type,
        sourceLength: sourceField.length,
        sourcePrecision: sourceField.precision,
        sourceScale: sourceField.scale,
        sourceRequired: !sourceField.nillable && !sourceField.defaultedOnCreate,
        sourceFormula: sourceField.calculated,
        // target side
        targetLabel: targetField.label,
        targetType: targetField.type,
        targetLength: targetField.length,
        targetPrecision: targetField.precision,
        targetScale: targetField.scale,
        targetRequired: !targetField.nillable && !targetField.defaultedOnCreate,
        targetFormula: targetField.calculated,
        typesMatch,
        isCustom: sourceField.custom || targetField.custom,
        isTwin: true
      });
    }
  }

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
        const hay = `${p.apiName} ${p.sourceLabel} ${p.targetLabel} ${p.pairLabel} ${p.sourceObj} ${p.targetObj}`.toLowerCase();
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
        <td>${escHtml(pair.pairLabel)}</td>
        <td>${escHtml(pair.sourceLabel)}</td>
        <td>${escHtml(pair.targetLabel)}</td>
        <td>${typeBadge}</td>
        <td>${customBadge}</td>
      `;

    // Detail row (hidden by default)
    const detailRow = document.createElement("tr");
    detailRow.id = `detail-${idx}`;
    detailRow.style.display = "none";
    detailRow.innerHTML = `
      <td colspan="5">
        <strong>${escHtml(pair.sourceObj)}</strong><br/>
        ${renderFieldDetail(pair, "source")}

        <strong>${escHtml(pair.targetObj)}</strong><br/>
        ${renderFieldDetail(pair, "target")}
        ${!pair.typesMatch ? '<p class="warning">Type mismatch — value may not sync correctly.</p>' : ''}
      </td>
    `;

    mainRow.addEventListener("click", () => toggleDetail(idx));

    tbody.appendChild(mainRow);
    tbody.appendChild(detailRow);
  });
}

function renderFieldDetail(pair, side) {
  const prefix = side === 'source' ? 'source' : 'target';
  return `
    <div class="field-detail">
      <div><strong>Label:</strong> ${escHtml(pair[`${prefix}Label`])}</div>
      <div><strong>Type:</strong> ${escHtml(pair[`${prefix}Type`])}</div>
      <div><strong>Length:</strong> ${pair[`${prefix}Length`] || '-'}</div>
      <div><strong>Precision/Scale:</strong> ${pair[`${prefix}Precision`] || '-'} / ${pair[`${prefix}Scale`] || '-'}</div>
      <div><strong>Required:</strong> ${pair[`${prefix}Required`] ? 'Yes' : 'No'}</div>
      <div><strong>Formula:</strong> ${pair[`${prefix}Formula`] ? 'Yes' : 'No'}</div>
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
function renderStats(allPairs) {
  const uniquePairs = new Set(allPairs.map(p => p.pairLabel)).size;
    document.getElementById('statsBar').innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${allPairs.length}</div>
        <div class="stat-label">Twin Fields Found</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${uniquePairs}</div>
        <div class="stat-label">Object Pairs</div>
      </div>
    `;
}

// ── Export CSV ─────────────────────────────────────────────────────────────
function exportCSV() {
  const headers = [
    'Pair', 'API Name',
    'Source Object', 'Source Label', 'Source Type',
    'Target Object', 'Target Label', 'Target Type',
    'Types Match', 'Custom'
  ];
  const rows = allPairs.map(p => [
    p.pairLabel,
    p.apiName,
    p.sourceObj,
    p.sourceLabel,
    p.sourceType,
    p.targetObj,
    p.targetLabel,
    p.targetType,
    p.typesMatch ? 'Yes' : 'No',
    p.isCustom ? 'Yes' : 'No'
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
