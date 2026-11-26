import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourcePath = fileURLToPath(
  new URL("../src/api/authenticatedFetch.ts", import.meta.url),
);
const source = await readFile(sourcePath, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const auth = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

async function loadIndependentAuthModule() {
  const isolatedSource = `${outputText}\n// ${Math.random()}`;
  return import(
    `data:text/javascript;base64,${Buffer.from(isolatedSource).toString("base64")}`
  );
}

function createToken(subject, exp) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ sub: subject, exp })}.signature`;
}

function installBrowser(fetchImplementation) {
  const values = new Map();
  const listeners = new Map();
  const assignments = [];
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = {
    location: {
      pathname: "/dashboard",
      assign: (path) => assignments.push(path),
    },
    dispatchEvent: (event) => {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
    addEventListener: (type, listener) => {
      const current = listeners.get(type) ?? [];
      current.push(listener);
      listeners.set(type, current);
    },
  };
  globalThis.fetch = fetchImplementation;
  return { values, assignments };
}

test("concurrent expired requests share refresh and retry once", async () => {
  let refreshRequests = 0;
  let apiRequests = 0;
  const nextToken = createToken("user-1", Math.floor(Date.now() / 1000) + 600);
  installBrowser(async (input, init) => {
    const url = String(input);
    if (url.includes("/api/Account/Refresh")) {
      refreshRequests++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return Response.json({ accessToken: nextToken });
    }

    apiRequests++;
    return new Response(null, {
      status: new Headers(init.headers).get("Authorization") === `Bearer ${nextToken}` ? 200 : 401,
    });
  });
  localStorage.setItem("jwt", createToken("user-1", 0));

  const responses = await Promise.all([
    auth.authenticatedFetch("https://api.example/api/data/one"),
    auth.authenticatedFetch("https://api.example/api/data/two"),
  ]);

  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(refreshRequests, 1);
  assert.equal(apiRequests, 4);
  assert.equal(localStorage.getItem("jwt"), nextToken);
});

test("refresh-token rotation is serialized across browser tabs", async () => {
  let refreshRequests = 0;
  const nextToken = createToken("user-1", Math.floor(Date.now() / 1000) + 600);
  installBrowser(async (input, init) => {
    if (String(input).includes("/api/Account/Refresh")) {
      refreshRequests++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return Response.json({ accessToken: nextToken });
    }

    return new Response(null, {
      status: new Headers(init.headers).get("Authorization") === `Bearer ${nextToken}` ? 200 : 401,
    });
  });
  let lockTail = Promise.resolve();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      onLine: true,
      locks: {
        async request(_name, callback) {
          const previousLock = lockTail;
          let releaseLock;
          lockTail = new Promise((resolve) => {
            releaseLock = resolve;
          });
          await previousLock;
          try {
            return await callback();
          } finally {
            releaseLock();
          }
        },
      },
    },
  });
  localStorage.setItem("jwt", createToken("user-1", 0));
  const otherTabAuth = await loadIndependentAuthModule();

  const responses = await Promise.all([
    auth.authenticatedFetch("https://api.example/api/data/one"),
    otherTabAuth.authenticatedFetch("https://api.example/api/data/two"),
  ]);

  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(refreshRequests, 1);
});

test("refresh failure clears access token and redirects to sign in", async () => {
  const browser = installBrowser(async (input) =>
    String(input).includes("/api/Account/Refresh")
      ? new Response(null, { status: 401 })
      : new Response(null, { status: 401 }),
  );
  localStorage.setItem("jwt", createToken("user-1", 0));

  const response = await auth.authenticatedFetch("https://api.example/api/data");

  assert.equal(response.status, 401);
  assert.equal(localStorage.getItem("jwt"), null);
  assert.deepEqual(browser.assignments, ["/login"]);
});

test("a request is not retried under a different account identity", async () => {
  let apiRequests = 0;
  installBrowser(async (input) => {
    if (String(input).includes("/api/Account/Refresh"))
      return Response.json({
        accessToken: createToken("account-b", Math.floor(Date.now() / 1000) + 600),
      });
    apiRequests++;
    return new Response(null, { status: 401 });
  });
  localStorage.setItem(
    "jwt",
    createToken("account-a", Math.floor(Date.now() / 1000) + 600),
  );

  await assert.rejects(
    auth.authenticatedFetch("https://api.example/api/display-settings", {}, "account-a"),
    { name: "AuthenticatedAccountChangedError" },
  );
  assert.equal(apiRequests, 1);
});

test("SignalR refreshes an expiring access token before connecting", async () => {
  const renewedToken = createToken("user-1", Math.floor(Date.now() / 1000) + 600);
  let refreshRequests = 0;
  installBrowser(async () => {
    refreshRequests++;
    return Response.json({ accessToken: renewedToken });
  });
  localStorage.setItem("jwt", createToken("user-1", 0));

  const token = await auth.getAccessTokenForSignalR();

  assert.equal(token, renewedToken);
  assert.equal(refreshRequests, 1);
  assert.equal(localStorage.getItem("jwt"), renewedToken);
});
