# SunCard — Security Checklist (đối chiếu SunCard Enterprise Security Specification v1.0)

Nguồn yêu cầu: `docs/spec/SunCard_Enterprise_Security_Specification.md` (20 mục, 22 bảng).
Trạng thái ghi trung thực theo bản dựng hiện tại; "bằng chứng" là test tự động trong `test/`
(chạy `npm test`) hoặc file/kiểm chứng cụ thể. Các mục hạ tầng phụ thuộc môi trường triển khai
thật (WAF, KMS/HSM, pentest độc lập) ghi rõ là việc vận hành — chưa thể kết luận trong repo.

## Ánh xạ tiêu chí nghiệm thu SEC-AC (bảng 20 của spec)

| ID | Tiêu chí | Trạng thái | Bằng chứng / ghi chú |
|---|---|---|---|
| SEC-AC-01 | Mật khẩu không xuất hiện dạng rõ trong DB/log/response | ĐÃ LÀM | Argon2id (hash-wasm, PHC `$argon2id$`) — `src/modules/password.ts`; test "SEC-AC-01 Argon2id" + "SEC-API-01 no secret in responses" PASS |
| SEC-AC-02 | MFA bắt buộc cho Admin; thao tác nhạy cảm xác thực lại | ĐÃ LÀM | TOTP RFC 6238 (`src/modules/totp.ts`); cổng ở `requirePermission` (MFA_REQUIRED) + Admin layout redirect trang thiết lập MFA; step-up (mật khẩu/TOTP) cho reveal, đổi Vault Lock, đổi mật khẩu; test "SEC-AC-02 Admin MFA gate", "login TOTP + DB session" PASS |
| SEC-CV-01 | Mã thẻ lưu mã hoá; không plaintext trong log/queue/analytics | ĐÃ LÀM | AES-256-GCM envelope `v1.` (`src/lib/crypto.ts`); DB chỉ có ciphertext + HMAC fingerprint; log/audit mask tự động (`sanitizeForAudit`); test "audit no plaintext" PASS |
| SEC-CV-02 | Nhân viên không quyền không giải mã được mã qua UI/API | ĐÃ LÀM | Reveal chỉ chủ delivery + step-up; test âm: khách B (IDOR) bị chặn, tài khoản Support reveal mã khách → PERMISSION_DENIED. Xuất mã: tắt mặc định + duyệt kép + giới hạn số lượng |
| SEC-CV-03 | Mỗi reveal/delivery có audit event không chứa mã | ĐÃ LÀM | `card_access_audit` (actor, order, card, purpose, correlation_id) + `audit_logs`; test PASS |
| SEC-PY-01 | Webhook sai chữ ký/replay bị từ chối + ghi nhận | ĐÃ LÀM | Provider webhook HMAC + dedupe `(provider, event_id)`; Partner API nonce chống replay; test "SEC-PY-01 webhook signature + dedupe", "HMAC partner + replay" PASS |
| SEC-PY-02 | Request lặp không tạo giao dịch/giao mã trùng | ĐÃ LÀM | Idempotency ở order/ledger/charging request_id; test core + charging PASS |
| SEC-API-01 | Secret không trong frontend bundle/source/response | ĐÃ LÀM (phạm vi repo) | Secret chỉ qua env; provider credential chỉ lưu REFERENCE (`env:`/`vault:`); test kiểm response đăng nhập. Quét secret trên repo bằng git grep khi release |
| SEC-API-02 | API có auth, authorization, schema validation, rate limit | ĐÃ LÀM | HMAC + RBAC cho /v1; session + RBAC web API; rate limit: middleware (/api, /chargingws) + per-client (/v1) + login throttle |
| SEC-LOG-01 | Log có timestamp, actor, action, result, correlation ID | ĐÃ LÀM | `audit_logs` theo bảng 17: event_id, actor_type/id, action, resource, result, source_ip, device_id, correlation_id, reason/approval_id, before_after_summary (đã mask). Append-only: không có API/UI sửa/xoá |
| SEC-INF-01 | DB/Redis/Card Vault không public Internet | MỘT PHẦN (theo môi trường) | docker-compose: postgres/redis không publish port ra ngoài (chỉ app publish 3000). Khi lên VPS phải giữ nguyên tắc này + firewall — việc vận hành, xem DEPLOY.md |
| SEC-DR-01 | Backup mã hoá + bằng chứng restore test | MỘT PHẦN | Có `scripts/backup.sh` (dump nén + checksum, hướng dẫn mã hoá offsite) và `scripts/restore-test.sh` (restore vào DB tạm + in bằng chứng). Việc chạy định kỳ + lưu offsite thật là vận hành — chưa diễn tập trên hạ tầng production |
| SEC-TEST-01 | Không còn lỗ hổng Critical/High chưa xử lý trước go-live | CHƯA KẾT LUẬN | Cần pentest độc lập + SAST/DAST trên staging (spec 17.1) — ngoài phạm vi bản dựng; không tự tuyên bố đạt |

## Các nhóm yêu cầu khác

### Tài khoản & phiên (mục 5, ACC-03..10)
- ACC-03 Login throttling theo tài khoản+IP+thiết bị, khóa tăng dần (15 phút × 2^n) — `login_throttles`, ngưỡng trong settings. Test PASS.
- ACC-04 Lỗi đăng nhập dùng chung một message, không tiết lộ tài khoản tồn tại. Test PASS (so sánh response email không tồn tại).
- ACC-05 Cookie HttpOnly + SameSite=Lax + Secure (production); phiên ghi DB, rotate sau đăng nhập (theo thiết bị) và sau thay đổi quyền/MFA; thu hồi được.
- ACC-06 Cảnh báo đăng nhập thiết bị mới qua Notification + audit.
- ACC-07 Trang `/tai-khoan/phien`: xem + thu hồi phiên; TTL Admin 120 phút < khách 7 ngày (settings).
- ACC-08 Đổi mật khẩu bắt buộc mật khẩu hiện tại (+ TOTP nếu bật), thu hồi phiên khác. Đổi email: chưa có tính năng đổi email ở bản này.
- ACC-09 Reset password: token dùng 1 lần, hạn 30 phút, chỉ lưu hash, thu hồi mọi phiên sau reset.
- ACC-10 Risk-based challenge: Risk Engine (dưới đây) — Medium yêu cầu step-up, High giữ, Critical chặn.

### Admin (mục 6)
- MFA TOTP bắt buộc mọi vai trò quản trị (chưa bật → không vào /admin, ép thiết lập).
- IP allowlist Admin: setting `security.admin_ip_allowlist` (tuỳ chọn, rỗng = tắt).
- Dual approval (maker ≠ checker, enforced ở finance decision): điều chỉnh số dư, hoàn tiền vượt ngưỡng (`finance.dual_refund_threshold_minor`), đổi role/permission (cấm tự nâng quyền mình + cấm checker duyệt cho chính mình), đổi provider secret (chỉ reference), xuất mã (mặc định TẮT; bật vẫn duyệt kép + giới hạn `cards.export_max_per_request`).
- Support không xem plaintext mã (test âm PASS); audit không ai sửa/xoá được.

### Card Vault (mục 7)
- Vòng đời đúng bảng 9: IMPORTED → VALIDATED → AVAILABLE → RESERVED → DELIVERED; QUARANTINED → AVAILABLE/VOIDED theo phê duyệt (route quarantine-decision); DELIVERED không về AVAILABLE (test PASS).
- Secure Reveal đủ 9 bước (7.2) trong `revealCard`: phiên → chủ sở hữu → trạng thái thanh toán từ server (đơn SUCCESS) → trạng thái mã → Risk Engine → chỉ giải mã mã được yêu cầu → không qua URL (POST) → audit đầy đủ → cập nhật nhất quán trong transaction.
- Emergency Vault Lock: setting `cards.vault_locked` + API `/api/admin/vault-lock` (step-up + audit). Test: bật → reveal/deliver bị chặn; tắt → hoạt động lại. PASS.

### Risk Engine (mục 9)
- `src/modules/risk.ts`: điểm 0–100 từ tín hiệu account (tuổi TK, đăng nhập sai), device (thiết bị mới), network (IP dùng chung — trọng số 5, không chặn cứng), payment/order (velocity, giá trị lớn), delivery (reveal velocity), refund (tranh chấp 30 ngày). Ngưỡng + trọng số trong settings `risk.*`.
- 4 mức: Low tự động; Medium step-up/giới hạn; High giữ giao mã + vào fraud queue (`risk_reviews`, trang `/admin/rui-ro` kèm điểm + tín hiệu từng đơn); Critical chặn + thu hồi toàn bộ phiên + audit incident.
- Đơn thẻ bị giữ: Admin duyệt ở fraud queue → giao tiếp (`deliverHeldCardOrder`); từ chối → huỷ + hoàn hold.

### Thanh toán (PAY-01..10)
- PAY-01 Chỉ backend verify: MockPay callback ký HMAC mới cộng tiền; trạng thái client không được tin (không có đường giao mã theo redirect/receipt).
- PAY-02 Webhook: chữ ký + dedupe + replay window (timestamp/nonce ở Partner API).
- PAY-03 Idempotency khắp nơi. PAY-04 Transaction DB cho hold/settle/ledger.
- PAY-05 3-D Secure: N/A — chưa tích hợp cổng thanh toán thật (chỉ Manual + MockPay sandbox).
- PAY-06 Velocity: `payments.max_intents_per_hour` cho payment intent + rate limit đăng nhập/đơn qua Risk Engine.
- PAY-07 Refund: tham chiếu đơn gốc, ≤ số đã thu, idempotent, vượt ngưỡng duyệt kép.
- PAY-08 Gói bằng chứng: `order_fulfillments` kind `EVIDENCE_PACK` (order + delivery ids + ledger tx codes + audit count) cho mọi đơn SUCCESS.
- PAY-09 Đối soát provider có run/case (module reconciliation).
- PAY-10 Không lưu PAN/CVV — hệ thống không xử lý thẻ thanh toán ngân hàng.

### Web/API security (mục 10/12)
- Headers: HSTS, CSP (có frame-ancestors 'self'), X-Content-Type-Options, Referrer-Policy, Permissions-Policy (next.config).
- CSRF: SameSite cookie + middleware kiểm Origin cho request đổi trạng thái qua /api (bỏ qua callback có chữ ký).
- SSRF: `assertEgressAllowed` chặn host nội bộ/metadata khi gửi webhook/callback, trừ khi Admin bật `security.allow_private_egress` (dev).
- Upload: bản này không có upload file; import thẻ qua JSON có kiểm định dạng/độ dài + quarantine. (MIME/quét malware: khi có upload ở giai đoạn sau.)
- Open redirect: app không nhận tham số redirect từ người dùng ngoài các route nội bộ cố định.
- Log masking: `sanitizeForAudit` + quy ước chỉ log masked/hash (`maskSecret`, fingerprint).

### Backup/DR (mục 15)
- Mục tiêu RPO ≤ 15 phút, RTO ≤ 4 giờ cho dịch vụ cốt lõi — ghi trong DEPLOY.md là **mục tiêu baseline cần xác nhận bằng diễn tập**, chưa kiểm chứng trên production.
- `scripts/backup.sh`, `scripts/restore-test.sh`, quy trình key recovery trong DEPLOY.md.

## Test âm (negative) đã chạy — `test/security.test.ts`
1. IDOR: khách B mở/reveal mã của khách A → bị chặn (PERMISSION_DENIED).
2. Support reveal mã khách → bị chặn.
3. Vault Lock bật → reveal + delivery bị chặn (VAULT_LOCKED).
4. Webhook sai chữ ký → 401 SIGNATURE_INVALID; trùng event → deduped, xử lý đúng 1 lần.
5. Replay nonce Partner API → REPLAY_DETECTED (suite core).
6. Secret/hash không xuất hiện trong response đăng nhập; audit không chứa plaintext mã.
7. Admin chưa MFA → requirePermission trả MFA_REQUIRED; layout /admin redirect thiết lập MFA.
8. Login throttling: 5 lần sai → khóa 429; email không tồn tại trả lỗi giống hệt.
