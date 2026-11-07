import { prisma, assert, assertEq, makeFundedUser } from "./helpers";
import { md5Hex, partnerKeyOf } from "../src/modules/charging";
import { signWithRequest, signNoRequest, verifyCompatSign } from "../src/modules/compat";
import { applyForApiClient, approveApiClient, rejectApiClient } from "../src/modules/api-applications";
import { applyForAgent, approveAgentApplication, rejectAgentApplication } from "../src/modules/agent-applications";
import { apiTypeAllows } from "../src/lib/api-types";
import { decryptSecret } from "../src/lib/crypto";
import { countAvailable } from "../src/modules/cards";
import { POST as rechargePOST } from "../src/app/api/rechargews/route";
import { POST as cardwsPOST } from "../src/app/api/cardws/route";
import { GET as cardProductsGET } from "../src/app/api/cardws/products/route";
import type { DB } from "../src/modules/ledger";

const db = prisma as unknown as DB;
const DEMO_ID = "demo-partner";
const DEMO_KEY = "sc_demo_secret_0001";

function jsonReq(url: string, body: Record<string, unknown>) {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function callRecharge(body: Record<string, unknown>) {
  const res = await rechargePOST(jsonReq("http://localhost/api/rechargews", body));
  return (await res.json()) as any;
}
async function callCardws(body: Record<string, unknown>) {
  const res = await cardwsPOST(jsonReq("http://localhost/api/cardws", body));
  return (await res.json()) as any;
}

export async function run() {
  // 1) Công thức sign compat
  {
    assertEq(signWithRequest("K", "P1", "topup", "R9"), md5Hex("KP1topupR9"), "signWithRequest = md5(key+partner+command+request)");
    assertEq(signNoRequest("K", "P1", "getbalance"), md5Hex("KP1getbalance"), "signNoRequest = md5(key+partner+command)");
    assert(verifyCompatSign("K", "P1", "topup", "R9", signWithRequest("K", "P1", "topup", "R9")), "verify sign đúng");
    assert(!verifyCompatSign("K", "P1", "topup", "R9", md5Hex("sai")), "verify sign sai -> false");
    assert(apiTypeAllows("FULL", "RECHARGE") && apiTypeAllows("CHARGING", "CHARGING") && !apiTypeAllows("CHARGING", "SOFTCARD"), "apiTypeAllows theo module");
    console.log("PASS compat sign formulas + apiType gate");
  }

  // 2) Luồng đăng ký -> duyệt -> cấp key; từ chối không cấp key
  const applicant = await makeFundedUser(20_000_000n);
  let partnerId = "";
  let partnerKey = "";
  {
    const client = await applyForApiClient(applicant.id, { apiType: "FULL", callbackUrl: "https://example.com/callback", callbackMethod: "POST", ipAllowlist: "" });
    assertEq(client.status, "PENDING", "đăng ký mới ở trạng thái PENDING");
    assert(/^SC\d{8}$/.test(client.clientId), "partner_id dạng SC + 8 số");
    const keysBefore = await prisma.apiKey.count({ where: { clientId: client.id } });
    assertEq(keysBefore, 0, "chờ duyệt thì CHƯA có key");

    await approveApiClient("admin-test", client.id, "OK");
    const approved = await prisma.apiClient.findUnique({ where: { id: client.id } });
    assertEq(approved?.status, "ACTIVE", "duyệt xong -> ACTIVE");
    const key = await prisma.apiKey.findFirst({ where: { clientId: client.id } });
    assert(!!key?.keyEnc && !!key?.secretEnc, "key + secret được lưu mã hoá để xem lại");
    assert(decryptSecret(key!.keyEnc!).startsWith("sc_live_"), "api key gốc giải mã được");
    partnerId = client.clientId;
    partnerKey = (await partnerKeyOf(db, approved)) ?? "";
    assertEq(partnerKey, decryptSecret(key!.secretEnc!), "partnerKeyOf trả đúng secret đã cấp");

    const rejected = await applyForApiClient(applicant.id, { apiType: "CHARGING", callbackUrl: "https://example.com/cb2" });
    await rejectApiClient("admin-test", rejected.id, "Thiếu giấy tờ");
    const rj = await prisma.apiClient.findUnique({ where: { id: rejected.id } });
    assertEq(rj?.status, "REJECTED", "từ chối -> REJECTED");
    assertEq(await prisma.apiKey.count({ where: { clientId: rejected.id } }), 0, "bị từ chối thì không có key");
    console.log("PASS approval flow (apply -> pending -> approve/reject)");
  }

  // 3) rechargews bằng client demo (FULL)
  {
    const bal = await callRecharge({ command: "getbalance", partner_id: DEMO_ID, sign: signNoRequest(DEMO_KEY, DEMO_ID, "getbalance") });
    assertEq(bal.status, "success", "recharge getbalance success");
    assert(typeof bal.data.balance === "number", "recharge getbalance có số dư");
    const bad = await callRecharge({ command: "getbalance", partner_id: DEMO_ID, sign: md5Hex("sai") });
    assertEq(bad.status, "wrong_signature", "recharge sai sign -> wrong_signature");
    const pl = await callRecharge({ command: "productlist", partner_id: DEMO_ID, sign: signNoRequest(DEMO_KEY, DEMO_ID, "productlist") });
    assertEq(pl.status, "success", "recharge productlist success");
    assert(Array.isArray(pl.data) && pl.data.length > 0, "productlist có game");
    const fee = await callRecharge({ command: "feetopup", partner_id: DEMO_ID, sign: signNoRequest(DEMO_KEY, DEMO_ID, "feetopup") });
    assertEq(fee.status, "success", "recharge feetopup success");
    const nf = await callRecharge({ command: "getstatus", partner_id: DEMO_ID, request_id: "KHONG-CO-123", sign: signWithRequest(DEMO_KEY, DEMO_ID, "getstatus", "KHONG-CO-123") });
    assertEq(nf.status, "order_not_found", "getstatus đơn không có -> order_not_found");
    console.log("PASS rechargews getbalance/productlist/feetopup/errors");
  }

  // 4) rechargews topup + getstatus (dùng client vừa duyệt của applicant đã nạp tiền)
  {
    const product = await prisma.product.findFirst({ where: { type: "GAME_TOPUP", isActive: true } });
    assert(!!product, "có product GAME_TOPUP");
    const variant = await prisma.productVariant.findFirst({ where: { productId: product!.id, isActive: true }, orderBy: { faceValueMinor: "asc" } });
    assert(!!variant, "có variant topup");
    const rid = `TEST-TOPUP-${Date.now()}`;
    const body = {
      command: "topup", partner_id: partnerId, request_id: rid, service_code: product!.code,
      amount: Number(variant!.faceValueMinor), account_info: JSON.stringify({ uid: "123456789", server: "VN" }),
      sign: signWithRequest(partnerKey, partnerId, "topup", rid),
    };
    const r = await callRecharge(body);
    assertEq(r.status, "success", `recharge topup success (got ${JSON.stringify(r).slice(0, 200)})`);
    assert(!!r.data.order_code, "topup trả order_code");
    assert(["completed", "pending"].includes(r.data.status), "topup status completed/pending");
    const st = await callRecharge({ command: "getstatus", partner_id: partnerId, request_id: rid, sign: signWithRequest(partnerKey, partnerId, "getstatus", rid) });
    assertEq(st.status, "success", "getstatus sau topup success");
    assertEq(st.data.order_code, r.data.order_code, "getstatus khớp order_code");
    console.log("PASS rechargews topup + getstatus");
  }

  // 5) cardws: products, checkavailable, buycard + redownload bằng client vừa duyệt
  {
    const res = await cardProductsGET(new Request(`http://localhost/api/cardws/products?partner_id=${partnerId}`));
    const list = (await res.json()) as any[];
    assert(Array.isArray(list) && list.length > 0, "cardws products có dữ liệu");
    assert(list.every((p) => Array.isArray(p.cardvalue)), "products có cardvalue");

    // Chọn variant thẻ còn hàng nhất
    const cardProducts = await prisma.product.findMany({ where: { type: "CARD_PIN", isActive: true } });
    const prodMap = new Map(cardProducts.map((p) => [p.id, p]));
    const variants = (await prisma.productVariant.findMany({
      where: { isActive: true, productId: { in: cardProducts.map((p) => p.id) } },
    })).map((v) => ({ ...v, product: prodMap.get(v.productId)! }));
    let best: (typeof variants)[number] | null = null; let bestCount = 0;
    for (const v of variants) {
      const c = await countAvailable(db, v.id);
      if (c > bestCount) { bestCount = c; best = v; }
    }
    assert(!!best && bestCount >= 1, "có variant thẻ còn hàng để test buycard");
    const serviceCode = best!.product.code;
    const value = Number(best!.faceValueMinor);

    const chk = await callCardws({ command: "checkavailable", partner_id: partnerId, service_code: serviceCode, value, qty: 1, sign: signNoRequest(partnerKey, partnerId, "checkavailable") });
    assertEq(chk.status, 1, "checkavailable status 1");
    assertEq(chk.stock_available, true, "checkavailable còn hàng");

    const rid = `TEST-CARD-${Date.now()}`;
    const buy = await callCardws({
      command: "buycard", partner_id: partnerId, request_id: rid, service_code: serviceCode, value, qty: 1,
      sign: signWithRequest(partnerKey, partnerId, "buycard", rid),
    });
    assertEq(buy.status, 1, `buycard status 1 (got ${JSON.stringify(buy).slice(0, 200)})`);
    assert(Array.isArray(buy.data.cards) && buy.data.cards.length === 1, "buycard trả đúng 1 thẻ");
    assert(!!buy.data.cards[0].serial && !!buy.data.cards[0].code, "thẻ có serial + code");

    const again = await callCardws({
      command: "redownload", partner_id: partnerId, request_id: rid,
      sign: signWithRequest(partnerKey, partnerId, "redownload", rid),
    });
    assertEq(again.status, 1, "redownload status 1");
    assertEq(again.data.cards[0].serial, buy.data.cards[0].serial, "redownload trả cùng thẻ (idempotent)");

    const badSign = await callCardws({ command: "getbalance", partner_id: partnerId, sign: md5Hex("sai") });
    assertEq(badSign.status, 116, "cardws sai sign -> 116");
    const bal = await callCardws({ command: "getbalance", partner_id: partnerId, sign: signNoRequest(partnerKey, partnerId, "getbalance") });
    assertEq(bal.status, 1, "cardws getbalance status 1");
    console.log("PASS cardws products/checkavailable/buycard/redownload/getbalance");
  }

  // 6) Đăng ký đại lý: nộp form -> chờ duyệt -> duyệt tạo Agent; từ chối không tạo
  {
    const candidate = await makeFundedUser(0n);
    const app = await applyForAgent(candidate.id, { fullName: "Nguyễn Văn Test", phone: "0901234567", email: candidate.email, region: "TP.HCM", note: "Muốn bán thẻ" });
    assertEq(app.status, "PENDING", "đăng ký đại lý -> PENDING");
    let dupErr = "";
    try { await applyForAgent(candidate.id, { fullName: "Nguyễn Văn Test", phone: "0901234567", email: candidate.email }); } catch (e: any) { dupErr = String(e?.message); }
    assertEq(dupErr, "ALREADY_PENDING", "đang chờ duyệt không nộp trùng được");
    const agent = await approveAgentApplication("admin-test", app.id);
    assert(/^DL/.test(agent.code), "duyệt tạo Agent có mã DL");
    const portalAgent = await prisma.agent.findUnique({ where: { userId: candidate.id } });
    assert(!!portalAgent, "sau duyệt user có Agent (vào được cổng đại lý)");
    let agentErr = "";
    try { await applyForAgent(candidate.id, { fullName: "Nguyễn Văn Test", phone: "0901234567", email: candidate.email }); } catch (e: any) { agentErr = String(e?.message); }
    assertEq(agentErr, "ALREADY_AGENT", "đã là đại lý không đăng ký lại");

    const candidate2 = await makeFundedUser(0n);
    const app2 = await applyForAgent(candidate2.id, { fullName: "Trần Thị Test", phone: "0912345678", email: candidate2.email });
    await rejectAgentApplication("admin-test", app2.id, "Chưa đủ thông tin");
    assertEq(await prisma.agent.count({ where: { userId: candidate2.id } }), 0, "bị từ chối thì không tạo Agent");
    console.log("PASS agent application flow (apply -> approve creates agent / reject)");
  }
}
