const json = (data, status = 200, origin = "*") => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type"
  }
});

const clean = (value, max = 80) => String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": allowedOrigin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type"
      }});
    }
    if (origin && allowedOrigin && origin !== allowedOrigin) return json({ error: "Origin nicht erlaubt." }, 403, allowedOrigin);
    // Public health check only. Never expose DISCORD_WEBHOOK_URL to browser clients.
    if (request.method === "GET") return json({ ok: true, service: "Dappled Store", message: "Bestellservice erreichbar. Bestellungen werden per POST übermittelt." }, 200, allowedOrigin);
    if (request.method !== "POST") return json({ error: "Nur GET und POST sind erlaubt." }, 405, allowedOrigin);
    if (!env.DISCORD_WEBHOOK_URL) return json({ error: "Bestellservice ist noch nicht konfiguriert." }, 503, allowedOrigin);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400, allowedOrigin); }
    const player = clean(body.player, 16);
    const items = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
    if (!/^[A-Za-z0-9_]{3,16}$/.test(player)) return json({ error: "Bitte einen gültigen Minecraft-Namen angeben." }, 400, allowedOrigin);
    if (!items.length) return json({ error: "Der Warenkorb ist leer." }, 400, allowedOrigin);

    // Treat the storefront as untrusted. Prices and discounts must be reloaded and recalculated
    // from server-owned catalogue data before this endpoint is used for real orders.
    // This starter endpoint intentionally does not accept a client-supplied total as authoritative.
    const lines = items.map(item => {
      const name = clean(item.name, 90);
      const qty = Math.max(1, Math.min(999, Number.parseInt(item.quantity, 10) || 1));
      const price = Math.max(0, Math.min(100000, Number(item.price) || 0));
      return { name, qty, price };
    });
    const estimated = lines.reduce((sum, item) => sum + item.qty * item.price, 0);
    const creator = clean(body.creatorCode, 32) || "—";
    const discount = clean(body.discountCode, 32) || "—";
    const details = lines.map(line => `• ${line.qty}× ${line.name} — ${(line.qty * line.price).toFixed(2)} D$`).join("\n");
    const payload = {
      username: "Dappled Store",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: "Neue Bestellanfrage · Dappled Store",
        color: 0xB7D879,
        fields: [
          { name: "Minecraft-Spieler", value: player, inline: true },
          { name: "Geschätzter Warenwert", value: `${estimated.toFixed(2)} D$`, inline: true },
          { name: "Creator-Code", value: creator, inline: true },
          { name: "Rabattcode", value: discount, inline: true },
          { name: "Bestellte Produkte", value: details.slice(0, 1000) || "Keine Artikel" }
        ],
        footer: { text: "Manuelle Bezahlung ingame · Bestellanfrage, keine Zahlungsbestätigung" },
        timestamp: new Date().toISOString()
      }]
    };
    const discord = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!discord.ok) return json({ error: "Die Bestellanfrage konnte nicht übermittelt werden. Bitte später erneut versuchen." }, 502, allowedOrigin);
    return json({ ok: true, message: "Bestellanfrage übermittelt. Die Bezahlung erfolgt manuell ingame." }, 200, allowedOrigin);
  }
};
