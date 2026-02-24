# 📦 Publishing to the Chrome Web Store — Step-by-Step Guide

This guide is written for someone who has never published a Chrome extension before.
It covers every step from creating your developer account to seeing your extension live.

---

## Part 1: Set Up Your Developer Account

### Step 1: Create a Google Developer Account

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Sign in with your Google account (use a Gmail you plan to keep — this is your public developer identity)
3. You'll be prompted to pay a **one-time $5 USD registration fee**. This is a spam prevention measure by Google. Pay it — it's required.
4. Accept the developer agreement

### Step 2: Verify your identity (if prompted)
Google may ask you to verify your identity, especially for new accounts. Follow the prompts — usually involves confirming your phone number or email.

---

## Part 2: Prepare Your Extension Package

### Step 3: Make sure the code is ready

Before packaging, do the following:

- **Update the GitHub URL** in `popup/popup.js`:
  ```js
  chrome.tabs.create({ url: "https://github.com/YOUR_USERNAME/salesforce-cpq-toolkit" });
  ```
  Replace `YOUR_USERNAME` with your actual GitHub username.

- **Test the extension locally** (see Testing section below)

- **Verify manifest.json** has the correct version number (start with `"version": "1.0.0"`)

### Step 4: Create the ZIP file

The Chrome Web Store requires a ZIP of your extension folder (not the folder itself, but its contents).

**On Mac/Linux:**
```bash
cd /path/to/salesforce-cpq-toolkit
zip -r ../sfcpq-toolkit-v1.0.0.zip . --exclude "*.git*" --exclude "docs/*" --exclude "*.md" --exclude "__MACOSX"
```

**On Windows:**
1. Open the `salesforce-cpq-toolkit` folder
2. Select all files (`Ctrl+A`)
3. Right-click → Send to → Compressed (zipped) folder
4. Name it `sfcpq-toolkit-v1.0.0.zip`

> ⚠️ **Important:** Do NOT zip the folder itself — zip the *contents* of the folder. When you unzip, you should see `manifest.json` at the top level, not `salesforce-cpq-toolkit/manifest.json`.

### Step 5: Prepare store assets

You'll need the following images for your store listing. Create these before uploading:

| Asset | Size | Notes |
|---|---|---|
| Store icon | 128×128 PNG | Already in `/assets/icon128.png` |
| Small tile | 440×280 PNG | Used in the Chrome Web Store browse view |
| Large promo tile | 920×680 PNG | Optional but recommended |
| Screenshots | 1280×800 or 640×400 PNG | Minimum 1, up to 5 recommended |

**Creating screenshots:**
1. Install the extension in Developer Mode (see below)
2. Navigate to a Salesforce org with CPQ
3. Open each tool
4. Use your OS screenshot tool (Command+Shift+4 on Mac, Snipping Tool on Windows)
5. Crop to 1280×800

**Designing promo tiles:**
Use Figma, Canva, or even Google Slides. Use the brand colors:
- Background: `#0f1117` (dark)
- Primary accent: `#c92228` (crimson)
- Secondary accent: `#E09F3E` (gold)
- Font: Funnel Sans (download from Google Fonts)

---

## Part 3: Test Before Publishing

### Step 6: Load the extension locally

1. Open Chrome
2. Navigate to `chrome://extensions`
3. Toggle **Developer Mode** ON (top right corner)
4. Click **Load unpacked**
5. Select your `salesforce-cpq-toolkit` folder
6. The extension should appear in the list with the ⚙ icon

### Step 7: Test each tool

1. Navigate to your Salesforce org (must be logged in)
2. Click the ⚙ icon in the Chrome toolbar
3. You should see your org's URL detected in the status chip
4. Click **Twin Field Explorer** → verify it loads and scans
5. Click **SKU Quote Explorer** → verify products load and quote preview works
6. Try on a Salesforce org that does NOT have CPQ installed — the tools should fail gracefully with helpful error messages

### Common issues to check:
- Does the extension activate on `.my.salesforce.com` domains? ✓
- Does the popup correctly show "Not on Salesforce" when on other pages? ✓
- Does the CSV export work? ✓
- Is there no console.log with sensitive data? (Check DevTools) ✓

---

## Part 4: Submit to the Chrome Web Store

### Step 8: Create a new item

1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Click **+ New Item**
3. Upload your `sfcpq-toolkit-v1.0.0.zip`
4. Wait for it to process (usually a few seconds)

### Step 9: Fill in the store listing

**Store listing fields:**

**Name:** `Salesforce CPQ Toolkit`

**Short description** (132 chars max):
```
Free tools for Salesforce CPQ professionals — Twin Field Explorer, SKU Quote Explorer, and more. Privacy-first, open source.
```

**Detailed description** (use this template):
```
Salesforce CPQ Toolkit is a free, open-source Chrome extension for Salesforce CPQ professionals — admins, architects, developers, and sales ops teams.

🔁 TWIN FIELD EXPLORER
Scan your org and discover every "twin field" pair between SBQQ__QuoteLine__c and OpportunityLineItem. Identify type mismatches that cause sync failures, filter by custom vs. standard fields, and export results to CSV.

📋 SKU QUOTE EXPLORER  
Select active products and build a simulated quote preview without creating an actual Salesforce Quote record. See how your pricing rules, product rules, and approval thresholds interact for any combination of SKUs.

🔒 PRIVACY FIRST
✓ Zero data collection — no analytics, no telemetry, ever
✓ All API calls go directly from your browser to your own Salesforce org
✓ No external servers — we don't have any
✓ No credentials stored — uses your existing browser session
✓ Full source code on GitHub for auditing

🧩 BUILT TO GROW
The extension is designed for easy extensibility. New tools can be added without rewriting the codebase. Contributions welcome on GitHub.

Inspired by Salesforce Inspector Reloaded.
```

**Category:** `Productivity`

**Language:** English

### Step 10: Set permissions justification

The Chrome Web Store will ask you to justify each permission. Here's what to write:

| Permission | Justification |
|---|---|
| `storage` | Store the active Salesforce org URL in session storage only — cleared on browser close |
| `activeTab` | Detect the current Salesforce org URL to know which org the user is working in |
| `https://*.salesforce.com/*` | Make authenticated API calls to the user's Salesforce org using their existing session |
| `https://*.force.com/*` | Same as above — covers custom Salesforce domains |
| `https://*.my.salesforce.com/*` | Same as above — covers My Domain URLs |

### Step 11: Privacy practices

In the **Privacy** tab, answer:
- **Does your extension collect user data?** → No
- **Does your extension use remote code?** → No
- **Single purpose:** "Provides tools for inspecting and exploring Salesforce CPQ configuration and data"

### Step 12: Submit for review

Click **Submit for Review**.

**What happens next:**
- Google's automated systems will review the extension (usually 1–3 business days for new submissions)
- You'll receive an email when approved or if there are issues
- First submissions occasionally get flagged for human review — this can take up to 2 weeks
- If rejected, the rejection email will explain why — it's usually fixable

---

## Part 5: After Publishing

### Step 13: Monitor and iterate

Once live:
- Share the Chrome Web Store link on LinkedIn, Salesforce community forums (Trailblazer Community), and Twitter/X
- Monitor the **Reviews** tab — respond to all reviews, especially critical ones
- Use the **Stats** tab to see install trends

### Step 14: Updating the extension

When you make changes:
1. Increment the version in `manifest.json` (e.g., `1.0.0` → `1.0.1`)
2. Create a new ZIP
3. In the Developer Dashboard, click your listing → **Package** tab → **Upload new package**
4. Submit for review again (updates are usually reviewed faster than initial submissions)

---

## Troubleshooting Common Rejection Reasons

| Rejection reason | Fix |
|---|---|
| "Overly broad host permissions" | Add a justification in the listing explaining why each domain is needed |
| "Single purpose policy violation" | Make sure your description clearly states the one thing the extension does |
| "Missing privacy policy" | Link to your GitHub privacy.html page in the Privacy URL field |
| "Remote code execution" | Make sure you're not using `eval()` or loading scripts from external URLs |

---

## Privacy Policy URL

When the store asks for a Privacy Policy URL, use your GitHub Pages URL:
```
https://YOUR_USERNAME.github.io/salesforce-cpq-toolkit/tools/privacy.html
```
Or the raw GitHub file:
```
https://raw.githubusercontent.com/YOUR_USERNAME/salesforce-cpq-toolkit/main/tools/privacy.html
```

Or the simplest approach: host it as a file on GitHub Pages (covered in the GitHub guide).
