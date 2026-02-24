/**
 * Salesforce CPQ Toolkit — Popup Script
 *
 * Detects the active Salesforce org and routes users to the appropriate tools.
 */

// Matches any Salesforce-hosted domain broadly
function isSalesforceUrl(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host.includes("salesforce.com") || host.includes("force.com");
  } catch {
    return false;
  }
}

function extractOrgInfo(url) {
  try {
    const u = new URL(url);
    return { host: u.host, origin: u.origin };
  } catch {
    return null;
  }
}

function openToolInTab(toolPath, orgOrigin) {
  const extensionUrl = chrome.runtime.getURL(toolPath);
  chrome.tabs.create({
    url: `${extensionUrl}?org=${encodeURIComponent(orgOrigin)}`,
  });
}

function init() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    console.log("tab object:", JSON.stringify(tab));

    const statusDot = document.getElementById("statusDot");
    const orgName = document.getElementById("orgName");
    const orgUrl = document.getElementById("orgUrl");
    const sfdcContent = document.getElementById("sfdcContent");
    const notSfdc = document.getElementById("notSfdc");

    if (!tab) {
      orgName.textContent = "No tab found";
      notSfdc.classList.remove("hidden");
      return;
    }

    // Try getting URL from the tab directly first
    const tabUrl = tab.url || tab.pendingUrl || "";
    console.log("tabUrl:", tabUrl);

    if (tabUrl && isSalesforceUrl(tabUrl)) {
      handleSalesforceTab(tabUrl, statusDot, orgName, orgUrl, sfdcContent);
      return;
    }

    // Fallback: inject a script into the page to get its URL
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => window.location.href,
      },
      (results) => {
        console.log("scripting result:", JSON.stringify(results));
        const url = results && results[0] && results[0].result;
        console.log("url from page:", url);

        if (url && isSalesforceUrl(url)) {
          handleSalesforceTab(url, statusDot, orgName, orgUrl, sfdcContent);
        } else {
          statusDot.className = "status-dot inactive";
          orgName.textContent = "Not on Salesforce";
          orgUrl.textContent = url || "—";
          notSfdc.classList.remove("hidden");
        }
      }
    );
  });

  document.getElementById("openGithub").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://github.com/YOUR_USERNAME/salesforce-cpq-toolkit" });
  });

  document.getElementById("openPrivacy").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("tools/privacy.html") });
  });
}

function handleSalesforceTab(url, statusDot, orgName, orgUrl, sfdcContent) {
  const info = extractOrgInfo(url);
  statusDot.className = "status-dot active";
  orgName.textContent = info ? info.host : "Salesforce Org";
  orgUrl.textContent = info ? info.origin : url;
  sfdcContent.classList.remove("hidden");

  document.getElementById("openTwinField").addEventListener("click", (e) => {
    e.preventDefault();
    openToolInTab("tools/twin-field-explorer.html", info.origin);
    window.close();
  });

  document.getElementById("openSkuQuote").addEventListener("click", (e) => {
    e.preventDefault();
    openToolInTab("tools/sku-quote-explorer.html", info.origin);
    window.close();
  });
}

document.addEventListener("DOMContentLoaded", init);