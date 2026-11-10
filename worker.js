export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Ignore browser favicon requests
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 2. Decode the raw request URL to handle encoded %3F and %3D
    let rawUrl = decodeURIComponent(request.url);
    let target = null;

    if (rawUrl.includes("url=")) {
      target = rawUrl.split("url=")[1];
    } else if (rawUrl.includes("quest=")) {
      target = rawUrl.split("quest=")[1];
    } else {
      // Direct pass-through if URL is appended after domain
      const pathOnly = rawUrl.replace(url.origin + "/", "");
      if (pathOnly.startsWith("http://") || pathOnly.startsWith("https://")) {
        target = pathOnly;
      }
    }

    if (!target || !target.startsWith("http")) {
      return new Response("Missing target URL", {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    // Force HTTPS for Boomlings
    if (target.startsWith("http://www.boomlings.com")) {
      target = target.replace("http://", "https://");
    }

    // 3. Strip browser headers that cause RobTop's Cloudflare WAF to drop requests
    const newHeaders = new Headers();
    const dropHeaders = ["origin", "referer", "host", "cf-connecting-ip", "cf-ipcountry", "x-forwarded-for", "cf-ray", "cf-visitor"];
    for (const [key, value] of request.headers.entries()) {
      if (!dropHeaders.includes(key.toLowerCase())) {
        newHeaders.set(key, value);
      }
    }

    newHeaders.set("Host", "www.boomlings.com");
    newHeaders.set("Accept", "*/*");
    newHeaders.set("User-Agent", "");

    // 4. Preserve body for POST requests
    const body = (request.method !== "GET" && request.method !== "HEAD")
      ? await request.arrayBuffer()
      : undefined;

    try {
      const response = await fetch(target, {
        method: request.method,
        headers: newHeaders,
        body: body,
        redirect: "follow",
      });

      const resBody = await response.arrayBuffer();
      const resHeaders = new Headers(response.headers);

      resHeaders.set("Access-Control-Allow-Origin", "*");
      resHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      resHeaders.set("Access-Control-Allow-Headers", "*");

      return new Response(resBody, {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders,
      });
    } catch (err) {
      return new Response("Proxy error: " + err.message, {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
  },
};
