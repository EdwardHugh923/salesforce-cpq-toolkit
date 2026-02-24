# 🐙 GitHub Repository Setup Guide

This guide walks you through publishing the Salesforce CPQ Toolkit on GitHub so that:
- People can view, audit, and contribute to the code
- You have a professional portfolio piece to share
- Your project can receive community contributions and ideas

---

## Part 1: Create the Repository

### Step 1: Create a GitHub account (if you don't have one)

1. Go to [github.com](https://github.com)
2. Click **Sign up**
3. Choose a username that represents you professionally — this will be in all your project URLs
4. Verify your email

### Step 2: Create a new repository

1. From the GitHub homepage, click the **+** icon → **New repository**
2. Fill in the form:

   | Field | Value |
   |---|---|
   | **Repository name** | `salesforce-cpq-toolkit` |
   | **Description** | `Free Chrome extension with tools for Salesforce CPQ professionals — Twin Field Explorer, SKU Quote Explorer, and more.` |
   | **Visibility** | `Public` (required to be open source and for portfolio value) |
   | **Initialize with README** | ❌ Uncheck (we already have one) |
   | **Add .gitignore** | Select `Node` (covers common cruft) |
   | **License** | `MIT License` |

3. Click **Create repository**

---

## Part 2: Push Your Code

### Step 3: Install Git (if needed)

**Mac:** Git comes with Xcode Command Line Tools. Run:
```bash
git --version
```
If not installed, it'll prompt you to install.

**Windows:** Download from [git-scm.com](https://git-scm.com/download/win)

### Step 4: Configure Git (first-time setup)

```bash
git config --global user.name "Ed Larkin"
git config --global user.email "Edward.Hugh.Larkin@gmail.com"
```

### Step 5: Initialize and push the project

In your terminal, navigate to your project folder:

```bash
cd /Users/eddie/Downloads/CPQ Toolkit/salesforce-cpq-toolkit

# Initialize git
git init

# Add all files
git add .

# Create the first commit
git commit -m "feat: initial release — Twin Field Explorer and SKU Quote Explorer"

# Set the default branch name
git branch -M main

# Connect to your GitHub repository (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/salesforce-cpq-toolkit.git

# Push!
git push -u origin main
```

You may be prompted for your GitHub username and password. Use a **Personal Access Token** (not your password):
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Use this token as your "password" when Git prompts

---

## Part 3: Set Up the Repository Professionally

### Step 6: Add repository topics (tags)

Topics make your repository discoverable on GitHub.

1. On your repository page, click ⚙ next to **About** (top right of the description)
2. Add these topics:
   - `salesforce`
   - `salesforce-cpq`
   - `chrome-extension`
   - `salesforce-inspector`
   - `cpq`
   - `browser-extension`
   - `salesforce-admin`
   - `open-source`

### Step 7: Add a website link

In the same **About** section, add your Chrome Web Store URL once it's published.

### Step 8: Configure the repository settings

Go to **Settings** tab of your repository:

**General:**
- Enable **Issues** — lets users report bugs and request features
- Enable **Discussions** — great for community Q&A
- Disable **Wiki** (use docs/ folder instead)

**Branches:**
1. Go to Settings → Branches
2. Add a branch protection rule for `main`:
   - Require pull request reviews before merging
   - This is good practice even if you're the only contributor

---

## Part 4: Add Supporting Files

### Step 9: Create a .gitignore file

Create this file in your project root to avoid committing junk:

```gitignore
# macOS
.DS_Store
.AppleDouble
.LSOverride

# Windows
Thumbs.db
desktop.ini

# Editor files
.vscode/
.idea/
*.swp
*.swo

# Build artifacts (if you ever add a build step)
dist/
node_modules/

# Zip files (built for Chrome Web Store)
*.zip

# Environment files
.env
```

### Step 10: Create a CONTRIBUTING.md

```markdown
# Contributing to Salesforce CPQ Toolkit

Thank you for considering contributing! Here's how to get started.

## How to Contribute

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/salesforce-cpq-toolkit.git`
3. **Create a branch**: `git checkout -b feature/your-feature-name`
4. **Make your changes** and test them against a real Salesforce org
5. **Commit**: `git commit -m "feat: describe your change"`
6. **Push**: `git push origin feature/your-feature-name`
7. **Open a Pull Request** on GitHub

## What Makes a Good Contribution?

- Follows the privacy principles (zero external data, no credentials stored)
- Works without a build step — plain HTML/CSS/JS modules
- Tested against a Salesforce org with CPQ installed
- Includes a clear description of what the tool does

## Adding a New Tool

See the "Adding New Tools" section in README.md for the specific steps.

## Code Style

- Use ES modules (`import`/`export`)
- Prefer `async/await` over promise chains
- Use the shared `SalesforceAPI` class from `sfdc-api.js` for all API calls
- Follow the existing naming conventions

## Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Your Salesforce org type (Production, Sandbox, Developer Edition)
- Browser version
- Screenshots if helpful
```

### Step 11: Create issue templates

Create `.github/ISSUE_TEMPLATE/bug_report.md`:
```markdown
---
name: Bug Report
about: Something isn't working correctly
labels: bug
---

**Describe the bug**
A clear description of what went wrong.

**To Reproduce**
Steps to reproduce the behavior.

**Expected behavior**
What you expected to happen.

**Environment:**
- Salesforce org type: [Production / Sandbox / Dev Edition]
- CPQ version / package version:
- Chrome version:
- Extension version:

**Screenshots**
If applicable.
```

Create `.github/ISSUE_TEMPLATE/feature_request.md`:
```markdown
---
name: Feature Request / New Tool Idea
about: Suggest a new tool or improvement
labels: enhancement
---

**What would this tool/feature do?**
Describe the use case.

**Who would use it?**
Admin / Developer / Sales Rep / etc.

**Are you willing to build it?**
[ ] Yes, I'd like to contribute this
[ ] No, but I'd love to see it
```

---

## Part 5: Set Up GitHub Pages (for Privacy Policy Hosting)

The Chrome Web Store requires a publicly accessible privacy policy URL. GitHub Pages is perfect for this.

### Step 12: Enable GitHub Pages

1. Go to your repository → **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Select **Branch: main**, folder **/ (root)**
4. Click **Save**

After a minute, your site will be live at:
```
https://YOUR_USERNAME.github.io/salesforce-cpq-toolkit/
```

Your privacy policy will be at:
```
https://YOUR_USERNAME.github.io/salesforce-cpq-toolkit/tools/privacy.html
```

Use this URL in the Chrome Web Store privacy policy field.

---

## Part 6: Ongoing Maintenance

### Workflow for making updates

```bash
# Always start from an up-to-date main
git checkout main
git pull origin main

# Create a feature branch
git checkout -b fix/describe-the-fix

# Make your changes...

# Stage and commit
git add -A
git commit -m "fix: describe what you fixed"

# Push and create a PR (even for solo projects — good habit)
git push origin fix/describe-the-fix
```

### Version tagging

When you release a new version to the Chrome Web Store, tag it in Git:

```bash
git tag -a v1.0.1 -m "v1.0.1 — fix SKU search on sandboxes"
git push origin v1.0.1
```

Then create a **GitHub Release**:
1. Click **Releases** → **Create a new release**
2. Select your tag
3. Write release notes describing what changed
4. Attach the ZIP file (so people can install old versions if needed)

---

## Part 7: Making Your Project Shine as a Portfolio Piece

These steps will make your project stand out to engineers, hiring managers, and the Salesforce community:

### ✅ Write a good README (already done)
The README is what everyone sees first. Yours includes:
- Clear description of what each tool does
- A privacy section (builds trust)
- Architecture explanation
- How to add new tools
- Acknowledgments (professional and gracious)

### ✅ Show your work in issues
When you fix bugs or add features, link commits to issues:
```
git commit -m "fix: handle CPQ not installed gracefully (#12)"
```

### ✅ Share it
- **Salesforce Trailblazer Community** — post in the CPQ forum
- **LinkedIn** — write a post about why you built it and what you learned
- **Twitter/X** with hashtag `#SalesforceCPQ` and `#SalesforceOhana`
- **Reddit** — r/salesforce

### ✅ Add a demo GIF to the README
Record a short GIF of the tool in action (use [Kap](https://getkap.co/) on Mac or [ScreenToGif](https://www.screentogif.com/) on Windows) and add it to the README:
```markdown
![Twin Field Explorer Demo](docs/demo-twin-fields.gif)
```

### ✅ Respond to issues promptly
Even a simple "Thanks for reporting, looking into it" builds community trust.

---

## Quick Reference: Common Git Commands

| Action | Command |
|---|---|
| Check status | `git status` |
| Stage all changes | `git add -A` |
| Commit | `git commit -m "message"` |
| Push current branch | `git push` |
| Pull latest changes | `git pull` |
| Create a new branch | `git checkout -b branch-name` |
| Switch branches | `git checkout branch-name` |
| See commit history | `git log --oneline` |
| Undo last commit (keep changes) | `git reset HEAD~1` |
| View what changed | `git diff` |
