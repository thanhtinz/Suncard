import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/modules/password";
import crypto from "crypto";

// Seed SunCard — dữ liệu mẫu chạy thử ngay. Mật khẩu mọi tài khoản demo: Suncard@123 (CHỈ demo).
// Số liệu phí gạch thẻ: lấy từ khảo sát thị trường 06/11/2026 (docs/research/card-exchange-sites.md),
// là GIÁ TRỊ MẪU — sửa ở Admin → Cài đặt / bảng exchange_fee_rules khi có nguồn thật.

const prisma = new PrismaClient();

function sha256(s: string) { return crypto.createHash("sha256").update(s).digest("hex"); }
function encKey() { return crypto.createHash("sha256").update(process.env.CARD_ENCRYPTION_KEY || "suncard-local-card-key-please-change-0123456789abcdef").digest(); }
function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${ct.toString("base64")}`;
}
function fingerprint(value: string): string {
  return crypto.createHmac("sha256", process.env.CARD_FINGERPRINT_KEY || "suncard-local-fingerprint-key-please-change").update(value.trim()).digest("hex");
}
const bps = (amount: bigint, b: number) => (amount * BigInt(b)) / 10000n;

// ---------- Ma trận gạch thẻ theo nghiên cứu thị trường ----------
const DENOMS: Record<string, number[]> = {
  VIETTEL: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000],
  VINAPHONE: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
  MOBIFONE: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
  VNMOBI: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
  ZING: [10000, 20000, 50000, 100000, 200000, 500000, 1000000],
  GARENA: [5000, 10000, 20000, 50000, 100000, 200000, 500000],
  VCOIN: [10000, 20000, 50000, 100000, 200000, 300000, 500000, 1000000, 2000000, 5000000, 10000000],
  GATE: [10000, 20000, 50000, 100000, 200000, 300000, 500000, 1000000, 2000000, 5000000, 10000000],
  SCOIN: [10000, 20000, 50000, 100000, 200000, 300000, 500000, 1000000, 2000000, 5000000],
};
function memberFeeBps(telco: string, v: number): number {
  switch (telco) {
    case "VIETTEL": return v <= 30000 ? 2050 : v === 50000 ? 1550 : v <= 300000 ? 1450 : 1750;
    case "VINAPHONE": return v === 10000 ? 1900 : v <= 30000 ? 1600 : v <= 300000 ? 1200 : 1300;
    case "MOBIFONE": return v === 20000 ? 1900 : 1800;
    case "VNMOBI": return 3800;
    case "ZING": return v >= 1000000 ? 1350 : 1300;
    case "GARENA": return 1400;
    case "VCOIN": return v <= 500000 ? 1500 : v === 1000000 ? 1600 : v === 2000000 ? 1700 : 1900;
    case "GATE": return 1750;
    case "SCOIN": return 2650;
    default: return 1800;
  }
}

const PERMISSIONS: { code: string; name: string; group: string }[] = [
  ["dashboard.view", "Xem tổng quan", "admin"], ["users.manage", "Quản lý người dùng", "admin"],
  ["agents.manage", "Quản lý đại lý", "admin"], ["products.manage", "Quản lý sản phẩm", "catalog"],
  ["cards.import", "Nhập kho thẻ", "cards"], ["cards.view", "Xem kho thẻ", "cards"],
  ["exchange.review", "Duyệt gạch thẻ", "exchange"], ["orders.view", "Xem đơn hàng", "orders"],
  ["orders.inquiry", "Inquiry đơn UNKNOWN", "orders"], ["orders.refund", "Hoàn tiền", "orders"],
  ["providers.manage", "Quản lý nhà cung cấp", "provider"], ["pricing.manage", "Quản lý giá", "catalog"],
  ["wallets.view", "Xem ví & ledger", "finance"], ["finance.approve", "Duyệt tài chính (checker)", "finance"],
  ["finance.adjust", "Tạo điều chỉnh số dư (maker)", "finance"], ["credit.manage", "Quản lý công nợ", "finance"],
  ["commissions.manage", "Quản lý hoa hồng", "finance"], ["disputes.manage", "Xử lý tranh chấp", "support"],
  ["reconciliation.run", "Chạy đối soát", "provider"], ["reports.view", "Xem báo cáo", "admin"],
  ["docs.manage", "Quản lý tài liệu", "admin"], ["roles.manage", "Quản lý phân quyền", "admin"],
  ["audit.view", "Xem nhật ký kiểm toán", "admin"], ["risk.review", "Duyệt hàng chờ rủi ro", "support"], ["settings.update", "Sửa cài đặt", "admin"],
  ["api_clients.manage", "Quản lý API clients", "admin"], ["tickets.handle", "Xử lý ticket hỗ trợ", "support"],
].map(([code, name, group]) => ({ code, name, group }));

const ROLE_PERMS: Record<string, string[] | "*"> = {
  SUPER_ADMIN: "*",
  SYSTEM_ADMIN: ["dashboard.view", "users.manage", "agents.manage", "roles.manage", "audit.view", "settings.update", "api_clients.manage", "docs.manage"],
  OPS: ["dashboard.view", "orders.view", "orders.inquiry", "exchange.review", "cards.view", "tickets.handle", "disputes.manage", "users.manage", "risk.review"],
  FINANCE: ["dashboard.view", "wallets.view", "finance.approve", "finance.adjust", "credit.manage", "commissions.manage", "reports.view", "reconciliation.run"],
  SUPPORT: ["dashboard.view", "tickets.handle", "orders.view", "disputes.manage"],
  PRODUCT_MANAGER: ["dashboard.view", "products.manage", "pricing.manage", "cards.import", "cards.view", "docs.manage"],
  PROVIDER_MANAGER: ["dashboard.view", "providers.manage", "reconciliation.run", "orders.inquiry", "orders.view"],
  RISK: ["dashboard.view", "disputes.manage", "reconciliation.run", "audit.view", "wallets.view", "users.manage", "risk.review"],
  AUDITOR: ["dashboard.view", "audit.view", "wallets.view", "reports.view", "orders.view"],
  CUSTOMER: [],
  AGENT: [],
};

async function main() {
  const already = await prisma.setting.findUnique({ where: { key: "__seeded" } });
  if (already) { console.log("Seed đã chạy trước đó — bỏ qua."); return; }

  // Settings mặc định (đồng bộ DEFAULT_SETTINGS trong code, ghi DB để Admin sửa)
  const { DEFAULT_SETTINGS } = await import("../src/modules/settings");
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.create({ data: { key, value: def.value as never, group: def.group, description: def.description } });
  }

  // Roles + permissions
  const permByCode = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const row = await prisma.permission.create({ data: p });
    permByCode.set(p.code, row.id);
  }
  const roleByCode = new Map<string, string>();
  for (const [code, perms] of Object.entries(ROLE_PERMS)) {
    const role = await prisma.role.create({ data: { code, name: code, isSystem: true } });
    roleByCode.set(code, role.id);
    const list = perms === "*" ? PERMISSIONS.map((p) => p.code) : perms;
    for (const pc of list) {
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permByCode.get(pc)! } });
    }
  }

  const passwordHash = await hashPassword("Suncard@123");
  async function makeUser(email: string, fullName: string, roleCode: string, kyc = "NONE") {
    const u = await prisma.user.create({ data: { email, passwordHash, kycStatus: kyc } });
    await prisma.userProfile.create({ data: { userId: u.id, fullName } });
    await prisma.userRole.create({ data: { userId: u.id, roleId: roleByCode.get(roleCode)! } });
    await prisma.wallet.create({ data: { userId: u.id } });
    await prisma.ledgerAccount.create({ data: { code: `WALLET:${u.id}:AVAILABLE`, ownerType: "USER", ownerId: u.id, kind: "AVAILABLE" } });
    await prisma.ledgerAccount.create({ data: { code: `WALLET:${u.id}:HELD`, ownerType: "USER", ownerId: u.id, kind: "HELD" } });
    return u;
  }
  const superadmin = await makeUser("superadmin@suncard.vn", "Super Admin", "SUPER_ADMIN", "VERIFIED");
  await makeUser("ops@suncard.vn", "Vận hành", "OPS", "VERIFIED");
  await makeUser("finance@suncard.vn", "Tài chính", "FINANCE", "VERIFIED");
  const khach = await makeUser("khach@suncard.vn", "Khách hàng mẫu", "CUSTOMER", "VERIFIED");
  const agentUser = await makeUser("agent@suncard.vn", "Đại lý Gold mẫu", "AGENT", "VERIFIED");

  // Genesis deposit đúng quy trình double-entry: Deposit APPROVED (maker system, checker superadmin) + post ledger.
  async function genesisDeposit(userId: string, amount: bigint) {
    const dep = await prisma.deposit.create({
      data: { userId, method: "BANK_TRANSFER", amountMinor: amount, status: "APPROVED", makerId: "system:seed", checkerId: superadmin.id, idempotencyKey: `seed-deposit:${userId}`, reference: "SEED" },
    });
    const tx = await prisma.ledgerTransaction.create({ data: { code: `TXSEED${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 999)}`, type: "GENESIS", refType: "DEPOSIT", refId: dep.id, idempotencyKey: `deposit:${dep.id}`, description: "Nạp genesis (seed)" } });
    const cash = await prisma.ledgerAccount.upsert({ where: { code: "PLATFORM:CASH" }, create: { code: "PLATFORM:CASH", ownerType: "PLATFORM", kind: "CASH" }, update: {} });
    const avail = await prisma.ledgerAccount.findUnique({ where: { code: `WALLET:${userId}:AVAILABLE` } });
    const cashAfter = (cash.balanceMinor as bigint) - amount;
    await prisma.ledgerEntry.create({ data: { transactionId: tx.id, accountId: cash.id, direction: "DEBIT", amountMinor: amount, balanceAfterMinor: cashAfter } });
    await prisma.ledgerAccount.update({ where: { id: cash.id }, data: { balanceMinor: cashAfter } });
    await prisma.ledgerEntry.create({ data: { transactionId: tx.id, accountId: avail!.id, direction: "CREDIT", amountMinor: amount, balanceAfterMinor: amount } });
    await prisma.ledgerAccount.update({ where: { id: avail!.id }, data: { balanceMinor: amount } });
    await prisma.deposit.update({ where: { id: dep.id }, data: { ledgerTxId: tx.id } });
  }
  await genesisDeposit(khach.id, 5_000_000n);
  await genesisDeposit(agentUser.id, 20_000_000n);

  // Agent levels + agents (closure)
  const levelDefs = [
    { code: "MEMBER", name: "Member", rank: 1, discountBps: 0, credit: 0n },
    { code: "SILVER", name: "Silver", rank: 2, discountBps: 100, credit: 5_000_000n },
    { code: "GOLD", name: "Gold", rank: 3, discountBps: 200, credit: 20_000_000n },
    { code: "DIAMOND", name: "Diamond", rank: 4, discountBps: 300, credit: 50_000_000n },
    { code: "MASTER", name: "Master", rank: 5, discountBps: 400, credit: 200_000_000n },
    { code: "DISTRIBUTOR", name: "Distributor", rank: 6, discountBps: 500, credit: 500_000_000n },
  ];
  const levelByCode = new Map<string, string>();
  for (const l of levelDefs) {
    const row = await prisma.agentLevel.create({ data: { code: l.code, name: l.name, rank: l.rank, discountBps: l.discountBps, creditLimitMinor: l.credit } });
    levelByCode.set(l.code, row.id);
  }
  async function makeAgent(userId: string, levelCode: string, parentId: string | null, code: string) {
    const ag = await prisma.agent.create({ data: { userId, levelId: levelByCode.get(levelCode)!, parentId, code } });
    // closure: self + ancestors
    await prisma.agentClosure.create({ data: { ancestorId: ag.id, descendantId: ag.id, depth: 0 } });
    if (parentId) {
      const rows = await prisma.agentClosure.findMany({ where: { descendantId: parentId } });
      for (const r of rows) await prisma.agentClosure.create({ data: { ancestorId: r.ancestorId, descendantId: ag.id, depth: r.depth + 1 } });
    }
    await prisma.agentRelationHistory.create({ data: { agentId: ag.id, newParentId: parentId, reason: "SEED" } });
    return ag;
  }
  const goldAgent = await makeAgent(agentUser.id, "GOLD", null, "AGGOLD01");
  const sub1User = await makeUser("subagent1@suncard.vn", "Đại lý con 1 (Silver)", "AGENT", "VERIFIED");
  const sub2User = await makeUser("subagent2@suncard.vn", "Đại lý con 2 (Member)", "AGENT", "NONE");
  await makeAgent(sub1User.id, "SILVER", goldAgent.id, "AGSILVER01");
  await makeAgent(sub2User.id, "MEMBER", goldAgent.id, "AGMEMBER01");
  await prisma.creditAccount.create({ data: { userId: agentUser.id, agentId: goldAgent.id, limitMinor: 50_000_000n } });

  // Categories + card products
  const catCard = await prisma.category.create({ data: { code: "THE-CAO", name: "Thẻ cào điện thoại & game", kind: "CARD", sortOrder: 1 } });
  const catGame = await prisma.category.create({ data: { code: "NAP-GAME", name: "Nạp game trực tiếp", kind: "GAME", sortOrder: 2 } });
  const cardProducts: Record<string, { name: string; denoms: number[] }> = {
    VIETTEL: { name: "Thẻ Viettel", denoms: DENOMS.VIETTEL.filter((v) => v <= 500000) },
    MOBIFONE: { name: "Thẻ Mobifone", denoms: DENOMS.MOBIFONE },
    VINAPHONE: { name: "Thẻ Vinaphone", denoms: DENOMS.VINAPHONE },
    GARENA: { name: "Thẻ Garena", denoms: DENOMS.GARENA },
    ZING: { name: "Thẻ Zing", denoms: DENOMS.ZING.filter((v) => v <= 500000) },
  };
  const variantByKey = new Map<string, string>();
  for (const [telco, def] of Object.entries(cardProducts)) {
    const product = await prisma.product.create({ data: { categoryId: catCard.id, code: `CARD-${telco}`, name: def.name, type: "CARD_PIN", description: `Mã thẻ ${def.name} — giao mã ngay sau thanh toán.` } });
    let i = 0;
    for (const v of def.denoms) {
      const face = BigInt(v);
      const variant = await prisma.productVariant.create({
        data: { productId: product.id, sku: `${telco}-${v}`, name: `${def.name} ${v.toLocaleString("vi-VN")}đ`, faceValueMinor: face, basePriceMinor: face - bps(face, 300), sortOrder: i++, metadata: { costBps: 9500, telco } },
      });
      variantByKey.set(`${telco}-${v}`, variant.id);
    }
  }

  // Games + packages
  const games: { slug: string; name: string; publisher: string; currencyName: string; packs: [string, number][]; regions: string[]; servers: string[]; needsServer: boolean }[] = [
    { slug: "lien-quan-mobile", name: "Liên Quân Mobile", publisher: "Garena", currencyName: "Quân Huy", packs: [["Gói 16 Quân Huy", 10000], ["Gói 40 Quân Huy", 20000], ["Gói 102 Quân Huy", 50000], ["Gói 210 Quân Huy", 100000], ["Gói 430 Quân Huy", 200000], ["Gói 1075 Quân Huy", 500000]], regions: ["VN"], servers: ["Máy chủ Việt Nam"], needsServer: false },
    { slug: "free-fire", name: "Free Fire", publisher: "Garena", currencyName: "Kim Cương", packs: [["100 Kim Cương", 20000], ["310 Kim Cương", 50000], ["520 Kim Cương", 100000], ["1060 Kim Cương", 200000], ["2180 Kim Cương", 500000]], regions: ["VN", "ASIA"], servers: ["VN", "ASIA"], needsServer: true },
    { slug: "genshin-impact", name: "Genshin Impact", publisher: "HoYoverse", currencyName: "Đá Sáng Thế", packs: [["Thẻ Nguyệt Thệ", 119000], ["60 Đá Sáng Thế", 25000], ["330 Đá Sáng Thế", 119000], ["1090 Đá Sáng Thế", 379000], ["2240 Đá Sáng Thế", 749000]], regions: ["ASIA", "AMERICA", "EUROPE"], servers: ["Asia", "America", "Europe"], needsServer: true },
    { slug: "pubg-mobile", name: "PUBG Mobile", publisher: "Level Infinite", currencyName: "UC", packs: [["60 UC", 23000], ["300 UC", 115000], ["600 UC", 230000], ["1500 UC", 575000]], regions: ["VN", "GLOBAL"], servers: ["Asia"], needsServer: false },
  ];
  const mockProviderProducts: { variantId: string; sku: string; name: string; cost: bigint }[] = [];
  for (const g of games) {
    const product = await prisma.product.create({ data: { categoryId: catGame.id, code: `GAME-${g.slug.toUpperCase()}`, name: g.name, type: "GAME_TOPUP", description: `Nạp ${g.currencyName} cho ${g.name} qua UID.` } });
    const game = await prisma.gameCatalog.create({ data: { productId: product.id, slug: g.slug, publisher: g.publisher, currencyName: g.currencyName } });
    for (const r of g.regions) await prisma.gameRegion.create({ data: { gameId: game.id, code: r, name: r } });
    for (const s of g.servers) await prisma.gameServer.create({ data: { gameId: game.id, code: s.toUpperCase().replace(/\s+/g, "_"), name: s } });
    await prisma.productField.create({ data: { productId: product.id, key: "uid", label: "UID / ID người chơi", sortOrder: 1 } });
    if (g.needsServer) await prisma.productField.create({ data: { productId: product.id, key: "server", label: "Máy chủ", type: "select", options: g.servers, sortOrder: 2 } });
    let i = 0;
    for (const [packName, price] of g.packs) {
      const variant = await prisma.productVariant.create({
        data: { productId: product.id, sku: `${g.slug.toUpperCase()}-${i}-${price}`, name: packName, faceValueMinor: BigInt(price), basePriceMinor: BigInt(price), sortOrder: i++, metadata: { costBps: 9600 } },
      });
      mockProviderProducts.push({ variantId: variant.id, sku: variant.sku, name: packName, cost: bps(BigInt(price), 9600) });
    }
  }

  // Pricing plans + rules
  const defaultPlan = await prisma.pricingPlan.create({ data: { code: "DEFAULT", name: "Giá mặc định", scopeType: "DEFAULT", priority: 100 } });
  await prisma.priceRule.create({ data: { planId: defaultPlan.id, discountBps: 0 } });
  for (const l of levelDefs) {
    const plan = await prisma.pricingPlan.create({ data: { code: `LEVEL-${l.code}`, name: `Giá cấp ${l.name}`, scopeType: "AGENT_LEVEL", scopeId: levelByCode.get(l.code), priority: 50 } });
    await prisma.priceRule.create({ data: { planId: plan.id, discountBps: l.discountBps } });
  }

  // Commission plan
  const plan = await prisma.commissionPlan.create({ data: { code: "DEFAULT", name: "Hoa hồng mặc định" } });
  await prisma.commissionRule.create({ data: { planId: plan.id, beneficiaryType: "AGENT_SELF", levelRank: 0, base: "MARGIN", rateBps: 3000 } });
  await prisma.commissionRule.create({ data: { planId: plan.id, beneficiaryType: "AGENT_UPLINE", levelRank: 1, base: "MARGIN", rateBps: 1000 } });
  await prisma.commissionRule.create({ data: { planId: plan.id, beneficiaryType: "AGENT_UPLINE", levelRank: 2, base: "MARGIN", rateBps: 500 } });

  await prisma.fxRate.create({ data: { fromCurrency: "USD", toCurrency: "VND", rate: "25000" } });

  // Providers MANUAL + MOCK
  const manual = await prisma.provider.create({ data: { code: "MANUAL", name: "Xử lý thủ công", type: "MANUAL", priority: 200 } });
  const mock = await prisma.provider.create({ data: { code: "MOCK", name: "Mock Sandbox", type: "MOCK", priority: 10 } });
  // Provider gạch thẻ ra upstream theo chuẩn /chargingws/v2 (Phase 2): tạo sẵn nhưng TẮT.
  // Admin điền config {baseUrl, partnerId, signMode} + partner_key (qua duyệt kép) rồi mới bật.
  const httpCharging = await prisma.provider.create({
    data: {
      code: "HTTP_CHARGING", name: "Upstream gạch thẻ HTTP (chargingws/v2)", type: "API", priority: 50, status: "DISABLED",
      config: JSON.stringify({ baseUrl: "", partnerId: "", signMode: "extended" }),
    },
  });
  await prisma.providerCapability.create({ data: { providerId: httpCharging.id, productType: "EXCHANGE", region: "VN", currency: "VND", supported: true } });
  for (const p of [manual, mock]) {
    await prisma.providerCapability.create({ data: { providerId: p.id, productType: "GAME_TOPUP", region: "VN", currency: "VND", supported: true } });
    await prisma.providerCapability.create({ data: { providerId: p.id, productType: "EXCHANGE", region: "VN", currency: "VND", supported: true } });
  }
  await prisma.providerCapability.create({ data: { providerId: manual.id, productType: "CARD_PIN", region: "VN", currency: "VND", supported: true } });
  await prisma.providerCredential.create({ data: { providerId: mock.id, name: "Mock sandbox key", secretRef: "env:MOCK_PROVIDER_SECRET" } });
  for (const mp of mockProviderProducts) {
    await prisma.providerProduct.create({ data: { providerId: mock.id, variantId: mp.variantId, externalSku: mp.sku, name: mp.name, costMinor: mp.cost, stock: 9999 } });
  }

  // Card batches mẫu (mã hoá AES-256-GCM). Thẻ demo đầu tiên: serial 100088001234567 / pin 1234567890123 (Viettel 10.000).
  const viettel10k = variantByKey.get("VIETTEL-10000")!;
  const batch = await prisma.cardBatch.create({ data: { code: "BATCH-DEMO-VIETTEL-10K", variantId: viettel10k, importedBy: superadmin.id, note: "Lô mẫu demo" } });
  const demoCards: { serial: string; pin: string }[] = [{ serial: "100088001234567", pin: "1234567890123" }];
  for (let i = 1; i < 30; i++) demoCards.push({ serial: `100088001234${String(600 + i)}`, pin: `1234567890${String(200 + i)}` });
  for (const c of demoCards) {
    await prisma.cardInventory.create({
      data: {
        batchId: batch.id, variantId: viettel10k,
        serialEnc: encryptSecret(c.serial), pinEnc: encryptSecret(c.pin),
        serialFingerprint: fingerprint(`serial:${c.serial}`), pinFingerprint: fingerprint(`pin:${viettel10k}:${c.pin}`),
        status: "AVAILABLE",
      },
    });
  }
  await prisma.cardBatch.update({ where: { id: batch.id }, data: { totalCards: demoCards.length } });
  const garena50k = variantByKey.get("GARENA-50000")!;
  const batch2 = await prisma.cardBatch.create({ data: { code: "BATCH-DEMO-GARENA-50K", variantId: garena50k, importedBy: superadmin.id, note: "Lô mẫu demo" } });
  for (let i = 0; i < 10; i++) {
    const serial = `200099002345${String(100 + i)}`;
    const pin = `9876543210${String(300 + i)}`;
    await prisma.cardInventory.create({
      data: { batchId: batch2.id, variantId: garena50k, serialEnc: encryptSecret(serial), pinEnc: encryptSecret(pin), serialFingerprint: fingerprint(`serial:${serial}`), pinFingerprint: fingerprint(`pin:${garena50k}:${pin}`), status: "AVAILABLE" },
    });
  }
  await prisma.cardBatch.update({ where: { id: batch2.id }, data: { totalCards: 10 } });

  // Bảng phí gạch thẻ (nghiên cứu thị trường 06/11/2026 — dữ liệu mẫu, sửa ở Admin)
  for (const [telco, denoms] of Object.entries(DENOMS)) {
    for (const v of denoms) {
      const member = memberFeeBps(telco, v);
      const rows: { group: string; fee: number; active: boolean }[] = [
        { group: "MEMBER", fee: member, active: telco !== "SCOIN" },
        { group: "AGENT", fee: telco === "VNMOBI" ? 3700 : Math.max(0, member - 50), active: telco !== "SCOIN" },
      ];
      if (!["VNMOBI", "GATE", "GARENA", "SCOIN"].includes(telco)) rows.push({ group: "API", fee: Math.max(0, member - 150), active: true });
      if (telco === "SCOIN") rows.push({ group: "API", fee: member - 100, active: false });
      for (const r of rows) {
        await prisma.exchangeFeeRule.create({
          data: { telco, faceValueMinor: BigInt(v), groupCode: r.group, feeBps: r.fee, penaltyBps: 5000, isActive: r.active },
        });
      }
    }
  }

  // API client demo (Partner API HMAC + Charging compat dùng chung)
  const client = await prisma.apiClient.create({
    data: { userId: agentUser.id, name: "Demo Partner", clientId: "demo-partner", environment: "SANDBOX", feeGroup: "API", callbackMethod: "POST" },
  });
  await prisma.apiKey.create({
    data: {
      clientId: client.id, keyPrefix: "sc_demo", keyHash: sha256("sc_demo_key_0001"),
      secretHash: sha256("sc_demo_secret_0001"), secretEnc: encryptSecret("sc_demo_secret_0001"),
      scopes: ["orders", "wallet", "cards", "exchange", "agents"],
    },
  });

  // Documents mẫu
  const docs: { slug: string; title: string; audience: string; content: string }[] = [
    { slug: "huong-dan-nap-game", title: "Hướng dẫn nạp game", audience: "PUBLIC", content: "Chọn game, nhập UID, hệ thống kiểm tra nickname, chọn gói và thanh toán bằng ví SunCard. Đơn ở trạng thái Đang xác minh (UNKNOWN) sẽ được đối soát tự động — không bị trừ tiền hai lần." },
    { slug: "huong-dan-gach-the", title: "Hướng dẫn gạch thẻ & bảng phí", audience: "PUBLIC", content: "Phí gạch thẻ theo nhà mạng/mệnh giá/nhóm người dùng được công bố ở trang Gạch thẻ và API getfee. Khai sai mệnh giá: thẻ được tính theo mệnh giá thật và bị trừ phạt 50% mệnh giá nhỏ hơn (cấu hình được ở Admin)." },
    { slug: "handbook-dai-ly", title: "Sổ tay đại lý", audience: "AGENT", content: "Đại lý có giá theo cấp, hoa hồng theo margin (bị cap theo chính sách), công nợ theo hạn mức cấp. Mạng lưới 1 parent trực tiếp, không giới hạn tầng." },
  ];
  for (const d of docs) {
    const doc = await prisma.document.create({ data: { slug: d.slug, title: d.title, audience: d.audience } });
    const ver = await prisma.documentVersion.create({ data: { documentId: doc.id, version: 1, content: d.content, createdBy: superadmin.id } });
    await prisma.document.update({ where: { id: doc.id }, data: { currentVersionId: ver.id } });
  }

  await prisma.setting.create({ data: { key: "__seeded", value: true as never, group: "system", description: "Đánh dấu đã seed" } });
  console.log("Seed xong: users demo (Suncard@123), fee matrix, catalog, providers MANUAL/MOCK, API client demo-partner.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
