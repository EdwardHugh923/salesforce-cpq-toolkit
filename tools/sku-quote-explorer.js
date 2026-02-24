/**
 * SKU Quote Explorer — Logic
 *
 * Allows a rep to select active products and see a simulated quote preview
 * that reflects pricing rules, product rules, and approval thresholds —
 * all WITHOUT creating an actual Salesforce Quote record.
 *
 * All data is fetched directly from the user's own Salesforce org
 * using their authenticated browser session.
 * No data is sent anywhere outside of Salesforce.
 */

import { SalesforceAPI, getAPIFromUrl } from "./sfdc-api.js";

// ── State ──────────────────────────────────────────────────────────────────
let api = null;
let allProducts = [];
let displayedProducts = [];
let selectedProducts = new Map(); // id → product record
let quoteLines = []; // enriched quote lines with pricing
let priceRules = [];
let productRules = [];
let approvalRules = [];
let activeTab = "lines";
const PAGE_SIZE = 50;
let currentPage = 0;

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  api = getAPIFromUrl();
  if (!api) {
    showProductError("Could not determine Salesforce org URL. Reopen from the extension popup.");
    return;
  }

  document.getElementById("orgChipLabel").textContent = new URL(api.orgOrigin).hostname;

  // Controls
  document.getElementById("productSearch").addEventListener("input", onProductSearch);
  document.getElementById("buildQuoteBtn").addEventListener("click", buildQuotePreview);
  document.getElementById("exportQuoteBtn").addEventListener("click", exportQuote);
  document.getElementById("loadMoreBtn").addEventListener("click", loadMoreProducts);

  // Tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  loadProducts();
}

// ── Load Products ──────────────────────────────────────────────────────────
async function loadProducts() {
  try {
    // Fetch all active products with pricebook entries
    const records = await api.query(`
      SELECT Id, Name, ProductCode, Description, Family,
             IsActive, SBQQ__SubscriptionPricing__c,
             SBQQ__BillingType__c, SBQQ__ChargeType__c
      FROM Product2
      WHERE IsActive = true
      ORDER BY Name
      LIMIT 2000
    `);

    allProducts = records;
    currentPage = 0;
    renderProductPage(false);

    document.getElementById("productLoadingState").classList.add("hidden");
    document.getElementById("productListContainer").classList.remove("hidden");
  } catch (err) {
    showProductError(
      `Failed to load products: ${err.message}. Make sure you're logged in to Salesforce.`
    );
  }
}

function getFilteredProducts() {
  const search = document.getElementById("productSearch").value.toLowerCase().trim();
  if (!search) return allProducts;
  return allProducts.filter(
    (p) =>
      p.Name.toLowerCase().includes(search) ||
      (p.ProductCode && p.ProductCode.toLowerCase().includes(search)) ||
      (p.Family && p.Family.toLowerCase().includes(search))
  );
}

function renderProductPage(append = false) {
  const filtered = getFilteredProducts();
  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const page = filtered.slice(start, end);

  if (!append) {
    document.getElementById("productList").innerHTML = "";
  }

  page.forEach((product) => {
    const item = buildProductItem(product);
    document.getElementById("productList").appendChild(item);
  });

  displayedProducts = filtered.slice(0, end);

  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (end < filtered.length) {
    loadMoreBtn.classList.remove("hidden");
    loadMoreBtn.textContent = `Load more (${filtered.length - end} remaining)…`;
  } else {
    loadMoreBtn.classList.add("hidden");
  }
}

function loadMoreProducts() {
  currentPage++;
  renderProductPage(true);
}

function onProductSearch() {
  currentPage = 0;
  renderProductPage(false);
}

function buildProductItem(product) {
  const isSelected = selectedProducts.has(product.Id);
  const div = document.createElement("div");
  div.className = `product-item${isSelected ? " selected" : ""}`;
  div.dataset.id = product.Id;

  const badges = [];
  if (product.Family) badges.push(`<span class="badge badge-muted">${escHtml(product.Family)}</span>`);
  if (product.SBQQ__SubscriptionPricing__c) badges.push(`<span class="badge badge-gold">Subscription</span>`);
  if (product.SBQQ__ChargeType__c) badges.push(`<span class="badge badge-muted">${escHtml(product.SBQQ__ChargeType__c)}</span>`);

  div.innerHTML = `
    <div class="product-checkbox">
      <span class="product-checkbox-check">✓</span>
    </div>
    <div class="product-info">
      <div class="product-name">${escHtml(product.Name)}</div>
      <div class="product-meta">
        ${product.ProductCode ? `<code style="font-size:10px;color:var(--color-text-muted)">${escHtml(product.ProductCode)}</code>` : ""}
        ${badges.join("")}
      </div>
    </div>
  `;

  div.addEventListener("click", () => toggleProduct(product, div));
  return div;
}

function toggleProduct(product, el) {
  if (selectedProducts.has(product.Id)) {
    selectedProducts.delete(product.Id);
    el.classList.remove("selected");
  } else {
    selectedProducts.set(product.Id, product);
    el.classList.add("selected");
  }
  renderSelectedBar();
}

function renderSelectedBar() {
  const count = selectedProducts.size;
  document.getElementById("selectedCount").textContent = `${count} product${count !== 1 ? "s" : ""} selected`;

  const tagsContainer = document.getElementById("selectedTags");
  tagsContainer.innerHTML = "";
  selectedProducts.forEach((product) => {
    const tag = document.createElement("div");
    tag.className = "selected-tag";
    tag.innerHTML = `<span>${escHtml(product.Name)}</span><span class="tag-remove">×</span>`;
    tag.querySelector(".tag-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      selectedProducts.delete(product.Id);
      // Uncheck in list
      const listItem = document.querySelector(`.product-item[data-id="${product.Id}"]`);
      if (listItem) listItem.classList.remove("selected");
      renderSelectedBar();
    });
    tagsContainer.appendChild(tag);
  });

  document.getElementById("buildQuoteBtn").disabled = count === 0;
}

// ── Build Quote Preview ────────────────────────────────────────────────────
async function buildQuotePreview() {
  if (selectedProducts.size === 0) return;

  showQuoteState("loading");
  document.getElementById("exportQuoteBtn").disabled = true;

  try {
    const productIds = [...selectedProducts.keys()];
    const productIdList = productIds.map((id) => `'${id}'`).join(",");

    // Parallel load: pricebook entries + CPQ rules
    setQuoteLoadingMsg("Fetching pricebook entries…");
    const [pricebookEntries, fetchedPriceRules, fetchedProductRules, fetchedApprovalRules] =
      await Promise.all([
        fetchPricebookEntries(productIdList),
        fetchPriceRules(productIdList),
        fetchProductRules(productIdList),
        fetchApprovalRules(),
      ]);

    setQuoteLoadingMsg("Building quote lines…");
    quoteLines = buildQuoteLines(pricebookEntries, pricebookEntries);
    priceRules = fetchedPriceRules;
    productRules = fetchedProductRules;
    approvalRules = fetchedApprovalRules;

    renderQuoteResults();
    showQuoteState("results");
    document.getElementById("exportQuoteBtn").disabled = false;
  } catch (err) {
    // Fall back gracefully — show whatever we have
    console.error("[CPQ Toolkit] Error building quote preview:", err);
    showQuoteState("empty");
    alert(`Error: ${err.message}`);
  }
}

async function fetchPricebookEntries(productIdList) {
  try {
    return await api.query(`
      SELECT Id, Product2Id, Product2.Name, Product2.ProductCode, Product2.Family,
             Product2.Description, Product2.SBQQ__SubscriptionPricing__c,
             Product2.SBQQ__BillingType__c, Product2.SBQQ__ChargeType__c,
             UnitPrice, IsActive, Pricebook2.Name, Pricebook2.IsStandard
      FROM PricebookEntry
      WHERE Product2Id IN (${productIdList})
        AND IsActive = true
        AND Pricebook2.IsActive = true
      ORDER BY Pricebook2.IsStandard DESC, UnitPrice ASC
    `);
  } catch {
    // Return minimal stub if query fails (e.g. no pricebook access)
    return [...selectedProducts.values()].map((p) => ({
      Product2Id: p.Id,
      Product2: p,
      UnitPrice: 0,
      Pricebook2: { Name: "Unknown", IsStandard: true },
    }));
  }
}

async function fetchPriceRules(productIdList) {
  try {
    // Fetch active price rules and conditions associated with our products
    return await api.query(`
      SELECT Id, Name, SBQQ__Active__c, SBQQ__Conditions__c,
             SBQQ__ConditionsMet__c, SBQQ__ErrorMessage__c,
             SBQQ__EvaluationEvent__c, SBQQ__EvaluationOrder__c
      FROM SBQQ__PriceRule__c
      WHERE SBQQ__Active__c = true
      ORDER BY SBQQ__EvaluationOrder__c ASC NULLS LAST
      LIMIT 200
    `);
  } catch {
    return [];
  }
}

async function fetchProductRules(productIdList) {
  try {
    return await api.query(`
      SELECT Id, Name, SBQQ__Active__c, SBQQ__Type__c,
             SBQQ__Conditions__c, SBQQ__ConditionsMet__c,
             SBQQ__ErrorMessage__c, SBQQ__EvaluationEvent__c
      FROM SBQQ__ProductRule__c
      WHERE SBQQ__Active__c = true
      ORDER BY Name ASC
      LIMIT 200
    `);
  } catch {
    return [];
  }
}

async function fetchApprovalRules() {
  try {
    return await api.query(`
      SELECT Id, Name, SBQQ__Active__c, SBQQ__ApprovalStep__c,
             SBQQ__ApprovalChain__r.Name, SBQQ__Conditions__c,
             SBQQ__ConditionsMet__c
      FROM SBQQ__ApprovalRule__c
      WHERE SBQQ__Active__c = true
      ORDER BY SBQQ__ApprovalStep__c ASC NULLS LAST
      LIMIT 200
    `);
  } catch {
    return [];
  }
}

function buildQuoteLines(pricebookEntries) {
  // Deduplicate: keep best (standard pricebook) entry per product
  const seen = new Set();
  const lines = [];

  pricebookEntries.forEach((entry) => {
    if (seen.has(entry.Product2Id)) return;
    seen.add(entry.Product2Id);

    const product = entry.Product2 || selectedProducts.get(entry.Product2Id) || {};
    lines.push({
      productId: entry.Product2Id,
      productName: product.Name || "Unknown Product",
      productCode: product.ProductCode || "",
      family: product.Family || "",
      listPrice: entry.UnitPrice || 0,
      unitPrice: entry.UnitPrice || 0,
      quantity: 1,
      discount: 0,
      pricebookName: entry.Pricebook2?.Name || "Standard",
      subscriptionPricing: product.SBQQ__SubscriptionPricing__c,
      billingType: product.SBQQ__BillingType__c,
      chargeType: product.SBQQ__ChargeType__c,
      description: product.Description || "",
    });
  });

  return lines;
}

// ── Render Quote Results ───────────────────────────────────────────────────
function renderQuoteResults() {
  switchTab(activeTab);
}

function switchTab(tab) {
  activeTab = tab;

  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tab);
  });

  const content = document.getElementById("tabContent");

  switch (tab) {
    case "lines":
      renderLinesTab(content);
      break;
    case "priceRules":
      renderRulesTab(content, "Price Rules", priceRules, renderPriceRuleItem);
      break;
    case "productRules":
      renderRulesTab(content, "Product Rules", productRules, renderProductRuleItem);
      break;
    case "approvals":
      renderRulesTab(content, "Approval Rules", approvalRules, renderApprovalRuleItem);
      break;
  }
}

function renderLinesTab(container) {
  const total = calcTotal();
  const netTotal = calcNetTotal();

  container.innerHTML = `
    <div class="quote-summary">
      <div class="quote-summary-header">
        <div>
          <div style="font-size:14px;font-weight:700;margin-bottom:2px">📋 Simulated Quote Preview</div>
          <div style="font-size:12px;color:var(--color-text-muted)">${quoteLines.length} product${quoteLines.length !== 1 ? "s" : ""} · Prices from Standard Pricebook · No actual quote created</div>
        </div>
        <div class="quote-total">
          <div class="quote-total-label">Net Total</div>
          <div class="quote-total-amount" id="netTotalDisplay">${formatCurrency(netTotal)}</div>
        </div>
      </div>
      <div style="padding:12px 16px;display:flex;gap:24px;flex-wrap:wrap;border-bottom:1px solid var(--color-border)">
        <div>
          <div style="font-size:11px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.06em">List Total</div>
          <div style="font-size:16px;font-weight:700;color:var(--color-text)">${formatCurrency(total)}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.06em">Savings</div>
          <div style="font-size:16px;font-weight:700;color:var(--color-success)">${formatCurrency(total - netTotal)}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.06em">Avg Discount</div>
          <div style="font-size:16px;font-weight:700;color:var(--color-gold)">${calcAvgDiscount()}%</div>
        </div>
      </div>
      <div class="table-wrap" style="border:none;border-radius:0">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Code</th>
              <th>Qty</th>
              <th>List Price</th>
              <th>Discount %</th>
              <th>Net Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody id="quoteLinesBody"></tbody>
        </table>
      </div>
    </div>
    <div style="background:rgba(224,159,62,0.08);border:1px solid rgba(224,159,62,0.2);border-radius:var(--radius);padding:12px 16px;font-size:12px;color:var(--color-text-muted)">
      💡 <strong style="color:var(--color-gold-light)">Tip:</strong> Adjust quantities and discounts to explore different scenarios. CPQ price rules may override these values in production — check the Price Rules tab to see what's configured.
    </div>
  `;

  renderQuoteLineRows();
}

function renderQuoteLineRows() {
  const tbody = document.getElementById("quoteLinesBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  quoteLines.forEach((line, idx) => {
    const netPrice = line.unitPrice * (1 - line.discount / 100);
    const lineTotal = netPrice * line.quantity;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="font-weight:600;font-size:13px">${escHtml(line.productName)}</div>
        ${line.family ? `<div style="font-size:11px;color:var(--color-text-muted)">${escHtml(line.family)}</div>` : ""}
        ${line.subscriptionPricing ? `<span class="badge badge-gold" style="margin-top:3px">Subscription</span>` : ""}
      </td>
      <td><code style="font-size:11px;color:var(--color-text-muted)">${escHtml(line.productCode)}</code></td>
      <td><input type="number" class="qty-input" value="${line.quantity}" min="1" data-idx="${idx}" data-field="quantity"></td>
      <td>${formatCurrency(line.listPrice)}</td>
      <td><input type="number" class="discount-input" value="${line.discount}" min="0" max="100" step="0.5" data-idx="${idx}" data-field="discount">%</td>
      <td>${formatCurrency(netPrice)}</td>
      <td style="font-weight:700;color:var(--color-gold)">${formatCurrency(lineTotal)}</td>
    `;

    tbody.appendChild(tr);
  });

  // Wire up inputs
  tbody.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", onLineInputChange);
  });
}

function onLineInputChange(e) {
  const idx = parseInt(e.target.dataset.idx);
  const field = e.target.dataset.field;
  const val = parseFloat(e.target.value) || 0;

  if (field === "quantity") {
    quoteLines[idx].quantity = Math.max(1, Math.round(val));
    e.target.value = quoteLines[idx].quantity;
  } else if (field === "discount") {
    quoteLines[idx].discount = Math.min(100, Math.max(0, val));
    e.target.value = quoteLines[idx].discount;
  }

  // Recalculate totals
  document.getElementById("netTotalDisplay").textContent = formatCurrency(calcNetTotal());
  renderQuoteLineRows();
}

function renderRulesTab(container, title, rules, itemRenderer) {
  if (rules.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3 style="color:var(--color-text);font-size:16px">No ${title} Found</h3>
        <p style="max-width:320px">No active ${title.toLowerCase()} were found in your org. This could mean none are configured, or you may not have read access to the rule objects.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="margin-bottom:12px">
      <span class="badge badge-muted" style="font-size:12px">${rules.length} active rule${rules.length !== 1 ? "s" : ""}</span>
    </div>
    <div class="rule-card">
      <div class="rule-card-header">
        <span class="rule-card-icon">📐</span>
        <span class="rule-card-title">${escHtml(title)}</span>
        <span class="rule-card-count">${rules.length}</span>
      </div>
      <div class="rule-list" id="ruleList"></div>
    </div>
  `;

  const list = container.querySelector("#ruleList");
  rules.forEach((rule) => {
    list.appendChild(itemRenderer(rule));
  });
}

function renderPriceRuleItem(rule) {
  const div = document.createElement("div");
  div.className = "rule-item rule-active";
  div.innerHTML = `
    <span class="rule-item-icon">💲</span>
    <div class="rule-item-body">
      <div class="rule-item-name">${escHtml(rule.Name)}</div>
      <div class="rule-item-meta">
        ${rule.SBQQ__EvaluationEvent__c ? `Fires on: <strong>${escHtml(rule.SBQQ__EvaluationEvent__c)}</strong>` : ""}
        ${rule.SBQQ__EvaluationOrder__c ? ` · Order: ${rule.SBQQ__EvaluationOrder__c}` : ""}
        ${rule.SBQQ__ConditionsMet__c ? ` · Conditions: ${escHtml(rule.SBQQ__ConditionsMet__c)}` : ""}
      </div>
      ${rule.SBQQ__ErrorMessage__c ? `<div style="font-size:11px;color:var(--color-error);margin-top:2px">⚠ ${escHtml(rule.SBQQ__ErrorMessage__c)}</div>` : ""}
    </div>
  `;
  return div;
}

function renderProductRuleItem(rule) {
  const typeColors = {
    Alert: "badge-crimson",
    Validation: "badge-crimson",
    Selection: "badge-gold",
    Filter: "badge-muted",
  };
  const badgeClass = typeColors[rule.SBQQ__Type__c] || "badge-muted";

  const div = document.createElement("div");
  div.className = "rule-item rule-active";
  div.innerHTML = `
    <span class="rule-item-icon">🔧</span>
    <div class="rule-item-body">
      <div class="rule-item-name">${escHtml(rule.Name)}</div>
      <div class="rule-item-meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:3px">
        ${rule.SBQQ__Type__c ? `<span class="badge ${badgeClass}">${escHtml(rule.SBQQ__Type__c)}</span>` : ""}
        ${rule.SBQQ__EvaluationEvent__c ? `<span>Fires on: <strong>${escHtml(rule.SBQQ__EvaluationEvent__c)}</strong></span>` : ""}
        ${rule.SBQQ__ConditionsMet__c ? `<span>Conditions: ${escHtml(rule.SBQQ__ConditionsMet__c)}</span>` : ""}
      </div>
      ${rule.SBQQ__ErrorMessage__c ? `<div style="font-size:11px;color:var(--color-error);margin-top:4px">⚠ ${escHtml(rule.SBQQ__ErrorMessage__c)}</div>` : ""}
    </div>
  `;
  return div;
}

function renderApprovalRuleItem(rule) {
  const div = document.createElement("div");
  div.className = "rule-item rule-active";
  const chainName = rule.SBQQ__ApprovalChain__r?.Name || "";
  div.innerHTML = `
    <span class="rule-item-icon">✅</span>
    <div class="rule-item-body">
      <div class="rule-item-name">${escHtml(rule.Name)}</div>
      <div class="rule-item-meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:3px">
        ${rule.SBQQ__ApprovalStep__c ? `<span class="badge badge-muted">Step ${rule.SBQQ__ApprovalStep__c}</span>` : ""}
        ${chainName ? `<span>Chain: <strong>${escHtml(chainName)}</strong></span>` : ""}
        ${rule.SBQQ__ConditionsMet__c ? `<span>Conditions: ${escHtml(rule.SBQQ__ConditionsMet__c)}</span>` : ""}
      </div>
    </div>
  `;
  return div;
}

// ── Calculations ───────────────────────────────────────────────────────────
function calcTotal() {
  return quoteLines.reduce((sum, line) => sum + line.listPrice * line.quantity, 0);
}

function calcNetTotal() {
  return quoteLines.reduce(
    (sum, line) => sum + line.unitPrice * (1 - line.discount / 100) * line.quantity,
    0
  );
}

function calcAvgDiscount() {
  if (quoteLines.length === 0) return "0.00";
  const avg = quoteLines.reduce((s, l) => s + l.discount, 0) / quoteLines.length;
  return avg.toFixed(2);
}

// ── Export ─────────────────────────────────────────────────────────────────
function exportQuote() {
  const lines = quoteLines.map((line) => ({
    "Product Name": line.productName,
    "Product Code": line.productCode,
    Family: line.family,
    Quantity: line.quantity,
    "List Price": line.listPrice.toFixed(2),
    "Discount %": line.discount,
    "Net Price": (line.unitPrice * (1 - line.discount / 100)).toFixed(2),
    "Line Total": (line.unitPrice * (1 - line.discount / 100) * line.quantity).toFixed(2),
    "Subscription Pricing": line.subscriptionPricing || "",
    "Billing Type": line.billingType || "",
    "Charge Type": line.chargeType || "",
    Pricebook: line.pricebookName,
  }));

  if (lines.length === 0) return;

  const headers = Object.keys(lines[0]);
  const csv = [
    headers.join(","),
    ...lines.map((row) =>
      headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cpq-quote-preview-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── UI Helpers ─────────────────────────────────────────────────────────────
function showQuoteState(state) {
  ["quoteEmpty", "quoteLoading", "quoteResults"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("hidden");
      el.style.display = "";
    }
  });

  const el = document.getElementById(
    state === "empty" ? "quoteEmpty" : state === "loading" ? "quoteLoading" : "quoteResults"
  );

  if (el) {
    el.classList.remove("hidden");
    if (state === "results") el.style.display = "flex";
  }
}

function setQuoteLoadingMsg(msg) {
  const el = document.getElementById("quoteLoadingMsg");
  if (el) el.textContent = msg;
}

function showProductError(msg) {
  document.getElementById("productLoadingState").classList.add("hidden");
  document.getElementById("productErrorState").classList.remove("hidden");
  document.querySelector("#productErrorText span:last-child").textContent = msg;
}

function formatCurrency(amount) {
  if (typeof amount !== "number" || isNaN(amount)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

init();
