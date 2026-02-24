/**
 * Salesforce CPQ Toolkit — Background Service Worker
 *
 * This is the correct architecture used by Salesforce Inspector:
 * Read the "sid" session cookie directly from the browser using chrome.cookies API,
 * then make the API call directly from the background worker using that token
 * in the Authorization header. No CORS issues, no content script proxying needed.
 *
 * The sid cookie is the same session token your browser uses — we never store it
 * or send it anywhere except directly to your own Salesforce org.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SFDC_PROXY_REQUEST") {
    handleProxyRequest(message.payload)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async
  }
});

async function handleProxyRequest({ url, method, body }) {
  // Step 1: Extract the my.salesforce.com origin from the URL
  // so we look up the correct cookie domain
  const myDomainUrl = normalizeToMyDomain(url);
  const cookieDomain = new URL(myDomainUrl).hostname;

  // Step 2: Read the "sid" session cookie directly from the browser
  // This is exactly how Salesforce Inspector works
  const sid = await getSessionCookie(cookieDomain);

  if (!sid) {
    throw new Error(
      "Could not find Salesforce session cookie. Please make sure you are logged in to Salesforce and try again."
    );
  }

  // Step 3: Make the API call directly from the background worker
  // with the sid as a Bearer token — no CORS issues here
  const response = await fetch(myDomainUrl, {
    method: method || "GET",
    headers: {
      "Authorization": `Bearer ${sid}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    throw new Error("Unauthorized. Your Salesforce session may have expired. Please log in again.");
  }

  if (!response.ok) {
    let errMsg;
    try {
      const errJson = await response.json();
      errMsg = Array.isArray(errJson)
        ? errJson.map((e) => e.message).join(", ")
        : errJson.message || `HTTP ${response.status}`;
    } catch {
      errMsg = `HTTP ${response.status}`;
    }
    throw new Error(errMsg);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function getSessionCookie(domain) {
  // Try the exact domain first, then walk up subdomains
  const domainsToTry = [domain, `.${domain}`];

  for (const d of domainsToTry) {
    try {
      const cookie = await chrome.cookies.get({
        url: `https://${domain}`,
        name: "sid",
      });
      if (cookie && cookie.value) {
        return cookie.value;
      }
    } catch (e) {
      // continue
    }
  }

  // Also try searching all cookies for this domain
  try {
    const allCookies = await chrome.cookies.getAll({
      domain: domain,
      name: "sid",
    });
    if (allCookies && allCookies.length > 0) {
      return allCookies[0].value;
    }
  } catch (e) {
    // continue
  }

  return null;
}

/**
 * Convert any Salesforce Lightning URL to its My Domain equivalent.
 * API calls must go to my.salesforce.com to avoid redirect/CORS issues.
 *
 * petesmajor-dev-ed.develop.lightning.force.com
 *   → petesmajor-dev-ed.develop.my.salesforce.com
 */
function normalizeToMyDomain(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;

    if (host.endsWith(".lightning.force.com")) {
      // e.g. foo.develop.lightning.force.com → foo.develop.my.salesforce.com
      u.hostname = host.replace(".lightning.force.com", ".my.salesforce.com");
    }

    return u.toString();
  } catch {
    return url;
  }
}

function isSalesforceUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host.includes("salesforce.com") || host.includes("force.com");
  } catch {
    return false;
  }
}
