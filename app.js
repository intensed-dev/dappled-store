const STORE_CONFIG = {
  // After deploying worker/src/index.js, paste its public URL here.
  orderEndpoint: "",
  productsUrl: "./data/products.json",
  discountsUrl: "./data/discounts.json"
};

const PACKS = [
  { id: "tip", name: "TRINKGELD", output: 5, diamonds: 2, normal: 2, tagline: "Der kleine Einstieg", note: "Kein Website-Rabatt", symbol: "D$", featured: false },
  { id: "handful", name: "HANDVOLL", output: 15, diamonds: 4, normal: 5, tagline: "Ein bisschen extra", note: "1 Dia Website-Rabatt", symbol: "15", featured: false },
  { id: "chest", name: "TRUHE VOLL", output: 30, diamonds: 9, normal: 10, tagline: "Der Klassiker", note: "5 D$ geschenkt", symbol: "30", featured: true },
  { id: "double-chest", name: "DOPPELKISTE VOLL", output: 60, diamonds: 19, normal: 20, tagline: "Für große Projekte", note: "10 D$ geschenkt", symbol: "60", featured: false }
];

const state = {
  products: [],
  discounts: { discounts: [], creators: [] },
  cart: loadCart(),
  category: "all",
  query: "",
  creator: null,
  discount: null,
  player: "",
  playerValid: false
};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = (value) => `${Number(value || 0).toLocaleString("de-DE", { maximumFractionDigits: 2 })} D$`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const slugName = (id) => String(id || "").split(":").pop().replaceAll("_", " ");
const imageFor = (product) => product.image || `https://mc.nerothe.com/img/1.21.4/minecraft_${encodeURIComponent(slugName(product.itemId))}.png`;

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("dappled-store-cart") || "[]");
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.id === "string" && Number(item.quantity) > 0).slice(0, 80) : [];
  } catch { return []; }
}
function saveCart() {
  try { localStorage.setItem("dappled-store-cart", JSON.stringify(state.cart)); } catch {}
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}
function navigate(view) {
  const valid = ["home", "packs", "shop", "checkout"];
  const target = valid.includes(view) ? view : "home";
  $$(".view").forEach(node => node.classList.toggle("active", node.dataset.view === target));
  $$(".main-nav a").forEach(link => link.classList.toggle("active", link.dataset.nav === target));
  $("#main-nav").classList.remove("open");
  $("#menu-toggle").setAttribute("aria-expanded", "false");
  if (location.hash !== `#${target}`) history.replaceState(null, "", `#${target}`);
  if (target === "checkout") renderCheckout();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function addToCart(item) {
  const existing = state.cart.find(entry => entry.id === item.id);
  if (existing) existing.quantity = Math.min(999, existing.quantity + 1);
  else state.cart.push({ ...item, quantity: 1 });
  saveCart();
  renderCart();
  showToast(`${item.name} zum Warenkorb hinzugefügt`);
}
function updateQuantity(id, delta) {
  const item = state.cart.find(entry => entry.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) state.cart = state.cart.filter(entry => entry.id !== id);
  else item.quantity = Math.min(999, item.quantity);
  saveCart();
  renderCart();
  renderCheckout();
}
function removeFromCart(id) {
  state.cart = state.cart.filter(item => item.id !== id);
  saveCart();
  renderCart();
  renderCheckout();
}
function totals() {
  const products = state.cart.filter(item => item.kind !== "pack");
  const packs = state.cart.filter(item => item.kind === "pack");
  const subtotal = products.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = state.discount ? Math.round(subtotal * state.discount.value) / 100 : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const diamondTotal = packs.reduce((sum, item) => sum + item.diamonds * item.quantity, 0);
  const dollarOutput = packs.reduce((sum, item) => sum + item.output * item.quantity, 0);
  return { subtotal, discountAmount, total, diamondTotal, dollarOutput };
}
function renderPacks() {
  $("#pack-grid").innerHTML = PACKS.map(pack => `
    <article class="pack-card ${pack.featured ? "popular" : ""}">
      ${pack.featured ? '<span class="pack-ribbon">BELIEBT</span>' : ""}
      <span class="pack-kicker">DAPPLED DOLLAR / ${pack.id.toUpperCase()}</span>
      <div class="pack-art"><span>${pack.symbol}</span></div>
      <h3>${pack.name}</h3>
      <div class="pack-output">+${pack.output}<small> D$</small></div>
      <p class="pack-value">${pack.tagline} · ${pack.note}</p>
      <div class="pack-price"><strong>${pack.diamonds} Dias ${pack.diamonds < pack.normal ? `<del>${pack.normal}</del>` : ""}</strong><span>${pack.diamonds < pack.normal ? "WEB-PREIS" : "NORMALPREIS"}</span></div>
      <button class="button ${pack.featured ? "button-primary" : "button-secondary"}" data-add-pack="${pack.id}">Pack vormerken <span>＋</span></button>
    </article>`).join("");
  $$("[data-add-pack]").forEach(button => button.addEventListener("click", () => {
    const pack = PACKS.find(entry => entry.id === button.dataset.addPack);
    if (!pack) return;
    addToCart({ id: `pack-${pack.id}`, kind: "pack", name: `Dappled Dollar: ${pack.name}`, price: 0, diamonds: pack.diamonds, output: pack.output, itemId: "minecraft:gold_nugget", image: "https://mc.nerothe.com/img/1.21.4/minecraft_gold_nugget.png" });
  }));
}
function renderCategories() {
  const categories = ["all", ...new Set(state.products.map(product => product.category || "Sonstiges"))];
  $("#category-filters").innerHTML = categories.map(category => `<button class="filter-chip ${state.category === category ? "active" : ""}" data-category="${escapeHtml(category)}">${category === "all" ? "Alles" : escapeHtml(category)}</button>`).join("");
  $$("[data-category]").forEach(button => button.addEventListener("click", () => {
    state.category = button.dataset.category;
    renderCategories();
    renderProducts();
  }));
}
function renderProducts() {
  const filtered = state.products.filter(product => {
    const categoryMatch = state.category === "all" || (product.category || "Sonstiges") === state.category;
    const search = state.query.toLowerCase();
    const queryMatch = !search || `${product.name} ${product.description || ""} ${product.itemId} ${product.category || ""}`.toLowerCase().includes(search);
    return product.active !== false && categoryMatch && queryMatch;
  });
  $("#result-count").textContent = `${filtered.length} ARTIKEL`;
  $("#empty-state").classList.toggle("hidden", filtered.length > 0);
  $("#product-grid").classList.toggle("hidden", filtered.length === 0);
  $("#product-grid").innerHTML = filtered.map(product => `
    <article class="product-card">
      <div class="product-image"><span class="product-category">${escapeHtml(product.category || "Sonstiges")}</span><img src="${escapeHtml(imageFor(product))}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="item-fallback" hidden>▧</span></div>
      <div class="product-details"><h3>${escapeHtml(product.name)}</h3><div class="product-id">${escapeHtml(product.itemId)}</div>
      <div class="product-bottom"><span class="product-price">${money(product.price)} <small>/ Stück</small></span><button class="add-button" data-add-product="${escapeHtml(product.id)}" aria-label="${escapeHtml(product.name)} hinzufügen">＋</button></div></div>
    </article>`).join("");
  $$("[data-add-product]").forEach(button => button.addEventListener("click", () => {
    const product = state.products.find(entry => entry.id === button.dataset.addProduct);
    if (product) addToCart({ ...product, kind: "product", image: imageFor(product) });
  }));
}
function cartItemImage(item) {
  return item.image || `https://mc.nerothe.com/img/1.21.4/minecraft_${encodeURIComponent(slugName(item.itemId))}.png`;
}
function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  $("#cart-count").textContent = count;
  $("#drawer-count").textContent = count ? `(${count})` : "";
  $("#drawer-empty").classList.toggle("hidden", state.cart.length > 0);
  $("#drawer-items").classList.toggle("hidden", state.cart.length === 0);
  $(".drawer-footer").classList.toggle("hidden", state.cart.length === 0);
  $("#drawer-items").innerHTML = state.cart.map(item => `
    <div class="drawer-item">
      <img src="${escapeHtml(cartItemImage(item))}" alt="" onerror="this.style.visibility='hidden'">
      <div><h4>${escapeHtml(item.name)}</h4><small>${item.kind === "pack" ? `${item.output} D$ · ${item.diamonds} Dias ingame` : money(item.price)}</small>
        <div class="quantity-control"><button data-qty="${escapeHtml(item.id)}" data-delta="-1" aria-label="Menge verringern">−</button><span>${item.quantity}</span><button data-qty="${escapeHtml(item.id)}" data-delta="1" aria-label="Menge erhöhen">＋</button><button class="remove-item" data-remove="${escapeHtml(item.id)}">Entfernen</button></div>
      </div><div class="drawer-item-price">${item.kind === "pack" ? `${item.diamonds * item.quantity} Dias` : money(item.price * item.quantity)}</div>
    </div>`).join("");
  const total = totals();
  $("#drawer-total").textContent = money(total.total);
  $$("[data-qty]").forEach(button => button.addEventListener("click", () => updateQuantity(button.dataset.qty, Number(button.dataset.delta))));
  $$("[data-remove]").forEach(button => button.addEventListener("click", () => removeFromCart(button.dataset.remove)));
}
function openCart() {
  $("#cart-drawer").classList.add("open");
  $("#cart-drawer").setAttribute("aria-hidden", "false");
  $("#cart-backdrop").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeCart() {
  $("#cart-drawer").classList.remove("open");
  $("#cart-drawer").setAttribute("aria-hidden", "true");
  $("#cart-backdrop").classList.add("hidden");
  document.body.style.overflow = "";
}
function validateCodes() {
  const creatorCode = $("#creator-code").value.trim().toUpperCase();
  const discountCode = $("#discount-code").value.trim().toUpperCase();
  state.creator = creatorCode ? state.discounts.creators.find(item => item.active && item.code.toUpperCase() === creatorCode) || null : null;
  state.discount = discountCode ? state.discounts.discounts.find(item => item.active && item.code.toUpperCase() === discountCode) || null : null;
  $("#creator-status").textContent = creatorCode ? (state.creator ? "Code erkannt" : "Unbekannter Code") : "";
  $("#creator-status").style.color = state.creator ? "var(--green)" : "#e59c87";
  const messages = [];
  if (creatorCode) messages.push(state.creator ? `Creator-Code ${creatorCode} erkannt.` : `Creator-Code „${escapeHtml(creatorCode)}“ ist nicht gültig.`);
  if (discountCode) messages.push(state.discount ? `Rabattcode ${discountCode} erkannt (${state.discount.value}% Rabatt).` : `Rabattcode „${escapeHtml(discountCode)}“ ist nicht gültig oder deaktiviert.`);
  $("#code-message").innerHTML = messages.join(" ");
  $("#code-message").classList.toggle("error", (creatorCode && !state.creator) || (discountCode && !state.discount));
  renderCheckout();
}
function renderCheckout() {
  const products = state.cart;
  $("#checkout-items").innerHTML = products.length ? products.map(item => `
    <div class="checkout-item"><img src="${escapeHtml(cartItemImage(item))}" alt="" onerror="this.style.visibility='hidden'"><div class="checkout-item-info"><strong>${escapeHtml(item.name)} × ${item.quantity}</strong><small>${item.kind === "pack" ? `Pack: ${item.output * item.quantity} D$ gegen ${item.diamonds * item.quantity} Dias ingame` : `${money(item.price)} je Stück`}</small></div><strong>${item.kind === "pack" ? `${item.diamonds * item.quantity} Dias` : money(item.price * item.quantity)}</strong></div>`).join("") : '<p class="field-hint">Dein Warenkorb ist leer. Füge erst Produkte hinzu.</p>';
  const total = totals();
  $("#checkout-total").textContent = money(total.total);
  $("#aside-subtotal").textContent = money(total.subtotal);
  $("#aside-discount").textContent = total.discountAmount ? `− ${money(total.discountAmount)}` : "− 0 D$";
  $("#aside-total").textContent = money(total.total);
  $("#submit-order").disabled = !products.length;
  $("#submit-order").style.opacity = products.length ? "1" : ".5";
}
function showPlayerPreview() {
  const name = $("#minecraft-name").value.trim();
  state.player = name;
  state.playerValid = /^[A-Za-z0-9_]{3,16}$/.test(name);
  const preview = $("#player-preview");
  if (!state.playerValid) {
    preview.classList.add("hidden");
    showToast("Bitte einen gültigen Minecraft-Namen (3–16 Zeichen) eingeben.");
    return false;
  }
  const imageUrl = `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`;
  preview.innerHTML = `<img src="${imageUrl}" alt="Minecraft-Kopf von ${escapeHtml(name)}"><div><strong>${escapeHtml(name)}</strong><small>Minecraft-Spielerprofil-Vorschau</small></div>`;
  preview.classList.remove("hidden");
  return true;
}
async function submitOrder() {
  const message = $("#order-message");
  message.textContent = "";
  if (!state.cart.length) { message.textContent = "Dein Warenkorb ist leer."; return; }
  if (!showPlayerPreview()) { message.textContent = "Bitte gib einen gültigen Minecraft-Namen ein."; return; }
  if (!state.creator && $("#creator-code").value.trim()) { message.textContent = "Bitte korrigiere den Creator-Code oder entferne ihn."; return; }
  if (!state.discount && $("#discount-code").value.trim()) { message.textContent = "Bitte korrigiere den Rabattcode oder entferne ihn."; return; }
  const button = $("#submit-order");
  button.disabled = true;
  button.textContent = "Bestellanfrage wird vorbereitet …";
  const total = totals();
  const order = {
    player: state.player,
    items: state.cart.map(item => ({ id: item.id, name: item.name, itemId: item.itemId, quantity: item.quantity, price: item.kind === "pack" ? 0 : item.price, kind: item.kind, diamonds: item.diamonds || 0, output: item.output || 0 })),
    subtotal: total.subtotal,
    discountAmount: total.discountAmount,
    total: total.total,
    creatorCode: state.creator?.code || "",
    creatorCommissionPercent: state.creator?.commissionPercent || 0,
    discountCode: state.discount?.code || "",
    payment: "manual_ingame"
  };
  try {
    if (!STORE_CONFIG.orderEndpoint) {
      message.textContent = "Die Bestellung ist noch nicht live: Der sichere Discord-Worker muss erst deployed und seine URL in app.js bei STORE_CONFIG.orderEndpoint eingetragen werden. Deine Auswahl bleibt im Warenkorb gespeichert.";
      return;
    }
    const response = await fetch(STORE_CONFIG.orderEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "Bestellung konnte nicht übermittelt werden.");
    state.cart = [];
    saveCart();
    renderCart();
    renderCheckout();
    message.textContent = `Bestellanfrage gesendet. ${result.message || "Die Bezahlung erfolgt manuell ingame."}`;
    message.style.color = "var(--green)";
    showToast("Bestellanfrage übermittelt");
  } catch (error) {
    message.textContent = error.message || "Netzwerkfehler. Bitte später erneut versuchen.";
    message.style.color = "#e59c87";
  } finally {
    button.disabled = false;
    button.innerHTML = 'Bestellung anfragen <span>↗</span>';
  }
}
async function loadData() {
  try {
    const [productsResponse, discountsResponse] = await Promise.all([
      fetch(STORE_CONFIG.productsUrl),
      fetch(STORE_CONFIG.discountsUrl)
    ]);
    if (!productsResponse.ok || !discountsResponse.ok) throw new Error("Shopdaten nicht erreichbar");
    const productData = await productsResponse.json();
    state.products = Array.isArray(productData.products) ? productData.products : [];
    state.discounts = await discountsResponse.json();
  } catch (error) {
    console.error("Dappled Store data load failed:", error);
    $("#product-grid").innerHTML = '<p class="field-hint">Das Sortiment konnte nicht geladen werden. Bitte lade die Seite erneut.</p>';
  }
}
function bindEvents() {
  window.addEventListener("hashchange", () => navigate(location.hash.slice(1)));
  $("#menu-toggle").addEventListener("click", () => {
    const open = $("#main-nav").classList.toggle("open");
    $("#menu-toggle").setAttribute("aria-expanded", String(open));
  });
  $("#open-cart").addEventListener("click", openCart);
  $("#close-cart").addEventListener("click", closeCart);
  $("#cart-backdrop").addEventListener("click", closeCart);
  $("#browse-products").addEventListener("click", () => { closeCart(); navigate("shop"); });
  $("#go-checkout").addEventListener("click", () => {
    closeCart();
    if (!state.cart.length) { showToast("Dein Warenkorb ist noch leer."); return; }
    navigate("checkout");
  });
  $("#product-search").addEventListener("input", event => { state.query = event.target.value; renderProducts(); });
  $("#preview-player").addEventListener("click", showPlayerPreview);
  $("#minecraft-name").addEventListener("keydown", event => { if (event.key === "Enter") showPlayerPreview(); });
  $("#apply-codes").addEventListener("click", validateCodes);
  $("#creator-code").addEventListener("change", validateCodes);
  $("#discount-code").addEventListener("change", validateCodes);
  $("#submit-order").addEventListener("click", submitOrder);
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeCart(); });
}
async function init() {
  $("#year").textContent = new Date().getFullYear();
  await loadData();
  renderPacks();
  renderCategories();
  renderProducts();
  renderCart();
  bindEvents();
  navigate(location.hash.slice(1) || "home");
}
init();