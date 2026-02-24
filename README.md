# ⚙ Salesforce CPQ Toolkit

> A free, open-source Chrome extension for Salesforce CPQ professionals.  
> Inspect, explore, and understand your CPQ implementation — without touching production data.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-4285F4?style=flat-square&logo=google-chrome)](https://chrome.google.com/webstore)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Privacy: Zero Data Collection](https://img.shields.io/badge/Privacy-Zero_Data_Collection-brightgreen?style=flat-square)](#privacy--security)

---

## What Is This?

**Salesforce CPQ Toolkit** is a Chrome extension that gives CPQ admins, architects, developers, and sales ops professionals a set of inspection and exploration tools for their Salesforce CPQ org.

Inspired by the incredible [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded), this toolkit is laser-focused on CPQ-specific workflows.

---

## 🛠 Tools

### 🔁 Twin Field Explorer
Scan your org and see every **twin field pair** across `SBQQ__QuoteLine__c` and `OpportunityLineItem`.

Twin fields are fields with matching API names on both objects. When CPQ syncs a quote to an opportunity, these fields are automatically mirrored. This tool helps you:
- See all twin field pairs at a glance
- Identify **type mismatches** that could cause sync failures
- Filter by custom vs. standard fields
- Export results to CSV for documentation or review

**Reference:** [Salesforce Help — CPQ Twin Fields](https://help.salesforce.com/s/articleView?id=sales.cpq_twin_fields.htm&type=5)

---

### 📋 SKU Quote Explorer
Select one or more active products and see a **simulated quote preview** — no actual Quote record created.

- Browse and search all active products in your org
- Select multiple SKUs and build a quote preview
- Adjust quantities and discounts interactively
- See all active **Price Rules**, **Product Rules**, and **Approval Rules** that are configured in your org
- Export the line-item preview as a CSV

This helps reps and admins understand CPQ pricing behavior for specific products before building a real quote.

---

## 🔒 Privacy & Security

This extension is built on the same principles of trust that make Salesforce Inspector so widely adopted:

| Principle | How We Implement It |
|---|---|
| **Zero external data transmission** | All API calls go from your browser directly to your Salesforce org |
| **No credentials stored** | Uses your existing browser session — no tokens, passwords, or keys ever stored |
| **No analytics or telemetry** | No usage tracking, crash reporting, or event logging of any kind |
| **No external servers** | We don't have backend servers. Period. |
| **Open source** | Full code is here. Audit it yourself. |
| **Session-only storage** | Only your org's domain is stored, cleared when you close your browser |

The only external network request is to Google Fonts CDN for the Funnel Sans typeface.

---

## 🚀 Installation

### From Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store listing](#) *(link coming soon)*
2. Click **Add to Chrome**
3. Navigate to any Salesforce page — the extension icon will activate

### Developer Mode (Manual Install)
1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/salesforce-cpq-toolkit.git
   ```
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer Mode** (top right toggle)
4. Click **Load unpacked**
5. Select the cloned repository folder
6. Navigate to your Salesforce org — the ⚙ icon will appear in your toolbar

---

## 🗂 Project Structure

```
salesforce-cpq-toolkit/
├── manifest.json              # Chrome extension manifest (MV3)
├── background.js              # Service worker — minimal, no data access
├── content.js                 # Content script — bridges popup to SFDC API
├── popup/
│   ├── popup.html             # Extension popup UI
│   └── popup.js               # Popup logic — detects Salesforce org
├── tools/
│   ├── sfdc-api.js            # Shared Salesforce REST API client
│   ├── twin-field-explorer.html
│   ├── twin-field-explorer.js
│   ├── sku-quote-explorer.html
│   ├── sku-quote-explorer.js
│   └── privacy.html
├── styles/
│   └── shared.css             # Design system — Funnel Sans, #c92228 / #E09F3E
├── assets/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    ├── CHROME_STORE_GUIDE.md  # How to publish to the Chrome Web Store
    └── GITHUB_GUIDE.md        # How to set up this repository
```

---

## 🧩 Adding New Tools

The architecture is designed to make adding tools straightforward:

1. **Create the tool files** in `/tools/`:
   - `your-tool.html` — UI shell (copy an existing tool's HTML as a template)
   - `your-tool.js` — Logic (import `sfdc-api.js` for Salesforce calls)

2. **Add the tool card** to `popup/popup.html`:
   ```html
   <a class="tool-card" id="openYourTool" href="#">
     <div class="tool-icon crimson">🔬</div>
     <div class="tool-info">
       <div class="tool-name">Your Tool Name</div>
       <div class="tool-desc">What it does in one line</div>
     </div>
     <span class="tool-arrow">›</span>
   </a>
   ```

3. **Wire up the click handler** in `popup/popup.js`:
   ```js
   document.getElementById("openYourTool").addEventListener("click", (e) => {
     e.preventDefault();
     openToolInTab("tools/your-tool.html", info.origin);
     window.close();
   });
   ```

4. **Use the shared API client** in your tool JS:
   ```js
   import { SalesforceAPI, getAPIFromUrl } from "./sfdc-api.js";
   const api = getAPIFromUrl();
   const records = await api.query("SELECT Id, Name FROM SBQQ__Quote__c LIMIT 10");
   ```

That's it. No build system required.

---

## 💡 Ideas for Future Tools

Contributions are very welcome! Here are some ideas for tools that would fit this extension:

- **CPQ Config Auditor** — Check your SBQQ settings for common misconfigurations
- **Product Option Visualizer** — Tree view of product bundles and options
- **Quote Template Inspector** — Explore quote templates and their field mappings
- **Proration Calendar** — Visualize subscription proration dates
- **Approval Chain Explorer** — Interactive diagram of all approval chains
- **Price Book Comparator** — Compare prices across multiple pricebooks

Open an issue to propose or claim a tool!

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-tool-name`
3. Make your changes
4. Test against a real Salesforce org with CPQ installed
5. Submit a pull request with a description of what the tool does

Please follow the existing code style and the **privacy principles** above — no external calls, ever.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

Free to use, modify, and distribute. If this saves you hours of work, consider giving it a ⭐ on GitHub.

---

## Acknowledgments

This project was inspired by [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded) by Thomas Prouvot and the original [Salesforce Inspector](https://github.com/sorenkrabbe/Chrome-Salesforce-inspector) by Søren Krabbe. Their commitment to open-source, privacy-first tooling for the Salesforce ecosystem is the model for this project.
