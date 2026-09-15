import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PublicClientApplication } from "@azure/msal-node";

loadLocalEnv();

const tenantId = process.env.M365_TENANT_ID || "ecd40e14-b48a-4861-9586-38cdc9ee127d";
const clientId = process.env.M365_CLIENT_ID || "8a10a0c2-e04a-4f32-8e62-233180baaee8";
const port = Number(process.env.PORT || 8787);

const sharePointHostname = process.env.M365_SHAREPOINT_HOSTNAME || "eternet.sharepoint.com";
const sharePointSitePath = process.env.M365_SHAREPOINT_SITE_PATH || "/sites/RecuperodeBajas";
const sharePointListName = process.env.M365_SHAREPOINT_LIST_NAME || "Solicitudes de baja";
const bajasYear = process.env.M365_BAJAS_YEAR || "2026";
const eternetApiBaseUrl = process.env.ETERNET_API_BASE_URL || "https://api.eternet.cc";
const eternetApiKey = process.env.ETERNET_API_KEY || process.env.ETERNET_API_TOKEN || "";
const eternetApiKeyHeader = process.env.ETERNET_API_KEY_HEADER || "X-API-Key";
const eternetApiKeyPrefix = process.env.ETERNET_API_KEY_PREFIX || "";
const eternetAltasGetPath = process.env.ETERNET_ALTAS_GET_PATH || "/Installations";

const graphScopes = [
  "User.Read",
  "Sites.ReadWrite.All",
  "offline_access"
];

const publicDir = resolve("dist");
const redirectUri = process.env.M365_REDIRECT_URI || `http://localhost:${port}`;
const msal = new PublicClientApplication({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`
  }
});

let graphAuthResult = null;
let pendingLogin = null;
let lastDeviceMessage = "";
let lastDeviceCode = "";
let lastVerificationUri = "";
let loginState = "";
let lastAuthUrl = "";
let cachedSite = null;
let cachedList = null;

function loadLocalEnv() {
  const envPath = resolve(".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");

    if (!process.env[key.trim()]) {
      process.env[key.trim()] = value;
    }
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.searchParams.has("code")) {
      await completeBrowserLogin(url);
      sendHtml(res, authCompletePage());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/m365/auth/start") {
      startDeviceCodeLogin();
      sendJson(res, 200, {
        ok: true,
        message: lastDeviceMessage || "Generando codigo de Microsoft...",
        userCode: lastDeviceCode,
        verificationUri: lastVerificationUri
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/m365/auth/device-code") {
      startDeviceCodeLogin();
      sendJson(res, 200, {
        ok: true,
        message: lastDeviceMessage || "Login iniciado. Volve a consultar en unos segundos."
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/m365/auth/status") {
      sendJson(res, 200, {
        authenticated: hasValidGraphAuth(),
        pending: Boolean(pendingLogin),
        message: lastDeviceMessage,
        authUrl: lastAuthUrl,
        userCode: lastDeviceCode,
        verificationUri: lastVerificationUri
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/auth/callback") {
      await completeBrowserLogin(url);
      sendHtml(res, authCompletePage());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/m365/me") {
      const token = await getGraphToken();
      sendJson(res, 200, await getGraphJson("/me", token));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/sharepoint/bajas/metadata") {
      const token = await getGraphToken();
      const { site, list } = await getSharePointTargets(token);
      sendJson(res, 200, {
        source: {
          hostname: sharePointHostname,
          sitePath: sharePointSitePath,
          listName: sharePointListName
        },
        site,
        list
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/sharepoint/bajas/items") {
      const token = await getGraphToken();
      const top = Number(url.searchParams.get("top") || 999);
      const year = url.searchParams.get("year") || bajasYear;
      const { site, list } = await getSharePointTargets(token);
      const filter = `fields/Fecha ge '${year}-01-01T00:00:00Z' and fields/Fecha lt '${Number(year) + 1}-01-01T00:00:00Z'`;
      const graphPath = `/sites/${encodeURIComponent(site.id)}/lists/${encodeURIComponent(list.id)}/items?$expand=fields&$filter=${encodeURIComponent(filter)}&$top=${top}`;
      const items = await getGraphPagedItems(graphPath, token);

      sendJson(res, 200, {
        source: {
          hostname: sharePointHostname,
          sitePath: sharePointSitePath,
          listName: sharePointListName,
          year
        },
        count: items.length,
        value: items.map(simplifyListItem)
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/altas/installations") {
      const month = url.searchParams.get("month") || "";
      const range = getMonthRange(month);
      const payload = await getInstallations(range.dateFrom, range.dateTo);

      sendJson(res, 200, {
        source: {
          api: eternetApiBaseUrl,
          endpoint: `/Jobs/GetInstallations/${range.dateFrom}/${range.dateTo}`,
          month
        },
        count: payload.length,
        value: payload
      });
      return;
    }

    if (req.method === "GET") {
      serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    sendJson(res, 500, {
      error: "server_error",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}).listen(port, () => {
  console.log(`CMR Comercial M365 listo en http://localhost:${port}`);
});

async function startBrowserLogin() {
  if (graphAuthResult || pendingLogin) {
    return;
  }

  loginState = randomUUID();
  const authUrl = await msal.getAuthCodeUrl({
    scopes: graphScopes,
    redirectUri,
    state: loginState,
    prompt: "select_account"
  });

  lastAuthUrl = authUrl;
  lastDeviceMessage = "Se abrio la ventana de autenticacion de Microsoft.";
  pendingLogin = Promise.resolve(null);
  openSystemBrowser(authUrl);
}

async function completeBrowserLogin(url) {
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    pendingLogin = null;
    lastDeviceMessage = `${error}: ${errorDescription || "Error de autenticacion"}`;
    throw new Error(lastDeviceMessage);
  }

  if (!code || state !== loginState) {
    pendingLogin = null;
    lastDeviceMessage = "Callback de autenticacion invalido.";
    throw new Error(lastDeviceMessage);
  }

  try {
    graphAuthResult = await msal.acquireTokenByCode({
      code,
      scopes: graphScopes,
      redirectUri
    });
    pendingLogin = null;
    lastAuthUrl = "";
    lastDeviceMessage = "Login completo.";
  } catch (error) {
    pendingLogin = null;
    lastDeviceMessage = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

function startDeviceCodeLogin() {
  if (hasValidGraphAuth() || pendingLogin) {
    return;
  }

  if (graphAuthResult && !hasValidGraphAuth()) {
    clearGraphAuth("Sesion de Microsoft vencida. Generando nuevo codigo...");
  }

  lastDeviceCode = "";
  lastVerificationUri = "";
  lastDeviceMessage = "Generando codigo de Microsoft...";
  pendingLogin = msal.acquireTokenByDeviceCode({
    scopes: graphScopes,
    deviceCodeCallback: (response) => {
      lastDeviceCode = response.userCode;
      lastVerificationUri = response.verificationUri;
      lastDeviceMessage = response.message;
      console.log(response.message);
    }
  }).then((result) => {
    graphAuthResult = result;
    pendingLogin = null;
    lastDeviceMessage = "Login completo.";
    lastDeviceCode = "";
    lastVerificationUri = "";
    return result;
  }).catch((error) => {
    pendingLogin = null;
    lastDeviceMessage = error instanceof Error ? error.message : String(error);
    return null;
  });
}

function openSystemBrowser(url) {
  const platform = process.platform;

  if (platform === "win32") {
    execFile("cmd", ["/c", "start", "", url], { windowsHide: true });
    return;
  }

  if (platform === "darwin") {
    execFile("open", [url]);
    return;
  }

  execFile("xdg-open", [url]);
}

async function getGraphToken() {
  if (graphAuthResult && !hasValidGraphAuth()) {
    clearGraphAuth("Sesion de Microsoft vencida. Inicia sesion nuevamente.");
  }

  if (!graphAuthResult && !pendingLogin) {
    await startBrowserLogin();
  }

  if (pendingLogin) {
    await pendingLogin;
  }

  if (!graphAuthResult?.accessToken) {
    throw new Error("No hay token de Microsoft Graph. Ejecuta login primero.");
  }

  return graphAuthResult.accessToken;
}

function hasValidGraphAuth() {
  if (!graphAuthResult?.accessToken) return false;
  const expiresOn = graphAuthResult.expiresOn ? new Date(graphAuthResult.expiresOn).getTime() : 0;
  return expiresOn > Date.now() + 60_000;
}

function clearGraphAuth(message = "") {
  graphAuthResult = null;
  pendingLogin = null;
  lastAuthUrl = "";
  lastDeviceCode = "";
  lastVerificationUri = "";
  cachedSite = null;
  cachedList = null;
  if (message) lastDeviceMessage = message;
}

async function getSharePointTargets(accessToken) {
  if (!cachedSite) {
    cachedSite = await getGraphJson(
      `/sites/${sharePointHostname}:${sharePointSitePath}`,
      accessToken
    );
  }

  if (!cachedList) {
    const lists = await getGraphJson(
      `/sites/${encodeURIComponent(cachedSite.id)}/lists?$filter=displayName eq '${escapeODataString(sharePointListName)}'`,
      accessToken
    );

    cachedList = Array.isArray(lists.value) ? lists.value[0] : null;
  }

  if (!cachedList?.id) {
    throw new Error(`No se encontro la lista de SharePoint: ${sharePointListName}`);
  }

  return {
    site: {
      id: cachedSite.id,
      name: cachedSite.name,
      displayName: cachedSite.displayName,
      webUrl: cachedSite.webUrl
    },
    list: {
      id: cachedList.id,
      name: cachedList.name,
      displayName: cachedList.displayName,
      webUrl: cachedList.webUrl
    }
  };
}

async function getGraphJson(path, accessToken) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  const text = await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      clearGraphAuth("Sesion de Microsoft vencida. Inicia sesion nuevamente.");
    }
    throw new Error(`Graph ${path} -> HTTP ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function getGraphPagedItems(path, accessToken) {
  const items = [];
  let nextUrl = `https://graph.microsoft.com/v1.0${path}`;

  while (nextUrl) {
    const payload = await getGraphJsonByUrl(nextUrl, accessToken);
    if (Array.isArray(payload.value)) {
      items.push(...payload.value);
    }
    nextUrl = payload["@odata.nextLink"] || "";
  }

  return items;
}

async function getGraphJsonByUrl(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  const text = await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      clearGraphAuth("Sesion de Microsoft vencida. Inicia sesion nuevamente.");
    }
    throw new Error(`Graph paged request -> HTTP ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

function simplifyListItem(item) {
  return {
    id: item.id,
    webUrl: item.webUrl,
    createdDateTime: item.createdDateTime,
    lastModifiedDateTime: item.lastModifiedDateTime,
    fields: item.fields || {}
  };
}

function escapeODataString(value) {
  return String(value).replaceAll("'", "''");
}

function getMonthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Elegí un mes válido para consultar altas.");
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const dateFrom = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const dateTo = `${year}-${String(monthNumber).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { dateFrom, dateTo };
}

async function getInstallations(dateFrom, dateTo) {
  if (!eternetApiKey) {
    throw new Error("Falta configurar ETERNET_API_KEY para consultar api.eternet.cc.");
  }

  const endpoint = buildAltasGetEndpoint(dateFrom, dateTo);
  const attempts = getApiKeyHeaderAttempts();
  let lastStatus = 0;
  let lastText = "";

  for (const headers of attempts) {
    const response = await fetch(`${eternetApiBaseUrl}${endpoint}`, {
      method: "GET",
      headers
    });
    const text = await response.text();

    if (response.ok) {
      const payload = text ? JSON.parse(text) : [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.value)) return payload.value;
      if (Array.isArray(payload.items)) return payload.items;
      if (Array.isArray(payload.results)) return payload.results;
      if (Array.isArray(payload.data)) return payload.data;
      return payload ? [payload] : [];
    }

    lastStatus = response.status;
    lastText = text;

    if (response.status !== 401 && response.status !== 403) {
      break;
    }
  }

  throw new Error(`API Eternet ${endpoint} -> HTTP ${lastStatus}: ${lastText}`);
}

function buildAltasGetEndpoint(dateFrom, dateTo) {
  const path = eternetAltasGetPath
    .replaceAll("{DateFrom}", encodeURIComponent(dateFrom))
    .replaceAll("{DateTo}", encodeURIComponent(dateTo))
    .replaceAll("{dateFrom}", encodeURIComponent(dateFrom))
    .replaceAll("{dateTo}", encodeURIComponent(dateTo));

  if (path.includes("?") || path.includes("{")) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}DateFrom=${encodeURIComponent(dateFrom)}&DateTo=${encodeURIComponent(dateTo)}`;
}

function getApiKeyHeaderAttempts() {
  const baseHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  const configuredValue = eternetApiKeyPrefix
    ? `${eternetApiKeyPrefix} ${eternetApiKey}`
    : eternetApiKey;
  const attempts = [
    { ...baseHeaders, [eternetApiKeyHeader]: configuredValue },
    { ...baseHeaders, Authorization: `Bearer ${eternetApiKey}` },
    { ...baseHeaders, Authorization: `ApiKey ${eternetApiKey}` },
    { ...baseHeaders, "X-API-Key": eternetApiKey },
    { ...baseHeaders, "x-api-key": eternetApiKey },
    { ...baseHeaders, ApiKey: eternetApiKey },
    { ...baseHeaders, "api-key": eternetApiKey }
  ];
  const seen = new Set();

  return attempts.filter((headers) => {
    const signature = JSON.stringify(headers);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function serveStatic(pathname, res) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(publicDir, cleanPath));

  if (!filePath.startsWith(publicDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentType(filePath)
  });
  createReadStream(filePath).pipe(res);
}

function authCompletePage() {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="1; url=/?connected=1">
  <title>Microsoft 365 conectado</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 40px; color: #142326; background: #eef3f1; }
    main { max-width: 680px; margin: 0 auto; background: white; border: 1px solid #d8e1df; border-radius: 8px; padding: 24px; }
  </style>
</head>
<body>
  <main>
    <h1>Microsoft 365 conectado</h1>
    <p>Volviendo al tablero comercial para cargar la lista de SharePoint...</p>
  </main>
  <script>setTimeout(() => location.replace("/?connected=1"), 600);</script>
</body>
</html>`;
}

function contentType(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(body, null, 2));
}
