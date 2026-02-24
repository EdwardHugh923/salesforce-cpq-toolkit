/**
 * Salesforce CPQ Toolkit — API Utilities
 *
 * Sends API requests to the background service worker which reads
 * the Salesforce session cookie (sid) and makes the call directly.
 * This is the same approach used by Salesforce Inspector Reloaded.
 */

export class SalesforceAPI {
  constructor(orgOrigin) {
    if (!orgOrigin) throw new Error("orgOrigin is required");
    this.orgOrigin = normalizeToMyDomain(orgOrigin.replace(/\/$/, ""));
    this.apiVersion = "v59.0";
  }

  get baseUrl() {
    return `${this.orgOrigin}/services/data/${this.apiVersion}`;
  }

  async request(path, options = {}) {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "SFDC_PROXY_REQUEST",
          payload: {
            url,
            method: options.method || "GET",
            body: options.body || null,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response) {
            reject(new Error("No response from background worker."));
            return;
          }
          if (!response.success) {
            reject(new Error(response.error || "Unknown error"));
            return;
          }
          resolve(response.data);
        }
      );
    });
  }

  async query(soql) {
    const encoded = encodeURIComponent(soql);
    const result = await this.request(`/query/?q=${encoded}`);
    let records = result.records || [];
    let nextUrl = result.nextRecordsUrl;
    while (nextUrl) {
      const page = await this.request(normalizeToMyDomain(nextUrl));
      records = records.concat(page.records || []);
      nextUrl = page.nextRecordsUrl;
    }
    return records;
  }

  async describe(objectName) {
    return this.request(`/sobjects/${objectName}/describe`);
  }

  async toolingQuery(soql) {
    const encoded = encodeURIComponent(soql);
    const url = `${this.orgOrigin}/services/data/${this.apiVersion}/tooling/query/?q=${encoded}`;
    const result = await this.request(url);
    let records = result.records || [];
    let nextUrl = result.nextRecordsUrl;
    while (nextUrl) {
      const page = await this.request(normalizeToMyDomain(nextUrl));
      records = records.concat(page.records || []);
      nextUrl = page.nextRecordsUrl;
    }
    return records;
  }
}

export class APIError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
  }
}

export function normalizeToMyDomain(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".lightning.force.com")) {
      u.hostname = u.hostname.replace(".lightning.force.com", ".my.salesforce.com");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function getAPIFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const org = params.get("org");
  if (!org) return null;
  return new SalesforceAPI(decodeURIComponent(org));
}

export function formatFieldType(type, length, precision, scale) {
  switch (type) {
    case "string": return length ? `Text(${length})` : "Text";
    case "textarea": return "Text Area";
    case "picklist": return "Picklist";
    case "multipicklist": return "Multi-Select Picklist";
    case "boolean": return "Checkbox";
    case "double": return precision ? `Number(${precision},${scale})` : "Number";
    case "currency": return "Currency";
    case "percent": return "Percent";
    case "date": return "Date";
    case "datetime": return "Date/Time";
    case "reference": return "Lookup";
    case "id": return "ID";
    default: return type || "Unknown";
  }
}
