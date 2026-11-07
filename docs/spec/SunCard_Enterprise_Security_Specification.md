[Normal] SUNCARD
[Title] ENTERPRISE
SECURITY SPECIFICATION
[Normal] ĐẶC TẢ KIẾN TRÚC VÀ YÊU CẦU BẢO MẬT
[Normal] Nền tảng bán Card / Gift Card / Game Card / Top-up Card / Digital Code
[Normal] Phiên bản 1.0  |  Ngày 06/11/2026
Trạng thái: Bản đặc tả đề xuất
[Heading 1] Thông tin tài liệu
[Heading 2] Lịch sử phiên bản
[Heading 1] Mục lục
[List Bullet] 1. Tổng quan và mục tiêu bảo mật
[List Bullet] 2. Phạm vi hệ thống và tài sản cần bảo vệ
[List Bullet] 3. Nguyên tắc thiết kế bảo mật
[List Bullet] 4. Kiến trúc bảo mật tổng thể
[List Bullet] 5. Bảo mật tài khoản khách hàng
[List Bullet] 6. Bảo mật Admin và nhân viên
[List Bullet] 7. Card Vault – bảo vệ kho mã thẻ
[List Bullet] 8. Bảo mật thanh toán và đơn hàng
[List Bullet] 9. Fraud Detection & Risk Engine
[List Bullet] 10. Bảo mật API và Provider Integration
[List Bullet] 11. Bảo mật dữ liệu và cơ sở dữ liệu
[List Bullet] 12. Bảo mật ứng dụng web
[List Bullet] 13. Bảo mật hạ tầng và vận hành
[List Bullet] 14. Audit Log, Monitoring và Incident Response
[List Bullet] 15. Backup, Disaster Recovery và Business Continuity
[List Bullet] 16. Phân quyền và ma trận quyền hạn
[List Bullet] 17. Yêu cầu phi chức năng và tiêu chí nghiệm thu
[List Bullet] 18. Lộ trình triển khai
[List Bullet] 19. Checklist phát hành
[List Bullet] 20. Tài liệu tham chiếu
[Heading 1] 1. Tổng quan và mục tiêu bảo mật
[Normal] SunCard là nền tảng thương mại điện tử số có thể lưu trữ, phân phối và giao mã thẻ điện tử. Các tài sản có giá trị cao gồm mã thẻ/PIN, số dư khách hàng, dữ liệu thanh toán, thông tin xác thực của nhà cung cấp, tài khoản quản trị và dữ liệu đơn hàng.
[Normal] Tài liệu này xác định baseline bảo mật Enterprise cho toàn bộ vòng đời từ đăng ký, đăng nhập, thanh toán, xử lý đơn hàng, lấy mã từ kho hoặc nhà cung cấp, giao mã cho khách hàng, hỗ trợ sau bán và hoàn tiền.
[Heading 2] 1.1 Mục tiêu
[List Bullet] Bảo vệ tính bí mật, toàn vẹn và khả dụng của hệ thống.
[List Bullet] Ngăn truy cập trái phép vào mã thẻ và dữ liệu nhạy cảm.
[List Bullet] Ngăn giao mã khi chưa xác minh thanh toán hợp lệ.
[List Bullet] Giảm gian lận, chargeback, lạm dụng hoàn tiền và thất thoát tồn kho.
[List Bullet] Giới hạn quyền nhân viên theo nguyên tắc tối thiểu cần thiết.
[List Bullet] Đảm bảo mọi thao tác nhạy cảm có thể truy vết và kiểm toán.
[List Bullet] Khôi phục dịch vụ và dữ liệu trong thời gian mục tiêu đã xác định.
[Heading 2] 1.2 Phạm vi
[Heading 1] 2. Phạm vi hệ thống và tài sản cần bảo vệ
[Heading 1] 3. Nguyên tắc thiết kế bảo mật
[List Bullet] Security by Design: yêu cầu bảo mật phải được thiết kế từ đầu, không bổ sung ở giai đoạn cuối.
[List Bullet] Least Privilege: người dùng, nhân viên và dịch vụ chỉ có quyền tối thiểu cần thiết.
[List Bullet] Zero Trust: không mặc định tin cậy theo vị trí mạng; xác minh danh tính, thiết bị và quyền ở mỗi ranh giới quan trọng.
[List Bullet] Defense in Depth: nhiều lớp kiểm soát độc lập; một lớp bị vượt qua không làm lộ toàn bộ hệ thống.
[List Bullet] Fail Secure: khi xác minh thất bại hoặc dịch vụ bảo mật không khả dụng, không giao mã và không thực hiện giao dịch nhạy cảm.
[List Bullet] Separation of Duties: người tạo và người phê duyệt thao tác nhạy cảm phải tách biệt khi phù hợp.
[List Bullet] Secure by Default: cấu hình mặc định phải an toàn; tính năng nhạy cảm không tự bật quyền rộng.
[List Bullet] Traceability: mọi thao tác liên quan tiền, mã thẻ, quyền và cấu hình phải có audit trail.
[Heading 1] 4. Kiến trúc bảo mật tổng thể
[Normal] Kiến trúc khuyến nghị chia thành các vùng tin cậy độc lập. Card Vault và hệ thống quản lý secret không được đặt chung ranh giới truy cập với frontend hoặc các dịch vụ nghiệp vụ thông thường.
[Heading 1] 5. Bảo mật tài khoản khách hàng
[Heading 1] 6. Bảo mật Admin và nhân viên
[Normal] Admin Portal phải được bảo vệ ở mức cao hơn khu vực khách hàng. Tài khoản quản trị không dùng chung; mỗi nhân viên có danh tính riêng.
[List Bullet] Bắt buộc MFA cho toàn bộ tài khoản Admin; ưu tiên passkey hoặc security key cho Super Admin.
[List Bullet] Phân quyền RBAC kết hợp permission theo từng hành động và phạm vi dữ liệu.
[List Bullet] Giới hạn truy cập Admin qua VPN/ZTNA hoặc IP allowlist khi phù hợp; không xem IP allowlist là biện pháp duy nhất.
[List Bullet] Re-authentication hoặc step-up MFA trước khi đổi quyền, đổi cấu hình thanh toán, hoàn tiền lớn, xuất dữ liệu hoặc xem mã thẻ.
[List Bullet] Session Admin có thời hạn ngắn hơn session khách hàng; thu hồi phiên khi nhân viên nghỉ việc hoặc đổi vai trò.
[List Bullet] Áp dụng dual approval cho các thao tác có tác động tài chính hoặc rủi ro cao.
[List Bullet] Nhân viên hỗ trợ không được mặc định xem toàn bộ mã thẻ; quyền giải mã phải được cấp theo ticket hoặc quy trình được phê duyệt.
[List Bullet] Không cho phép chỉnh sửa/xóa audit log bởi người dùng Admin thông thường.
[Heading 2] 6.1 Kiểm soát thao tác nhạy cảm
[Heading 1] 7. Card Vault – bảo vệ kho mã thẻ
[Normal] Card Vault là vùng dữ liệu có mức độ nhạy cảm cao nhất. Mục tiêu là giảm tối đa số dịch vụ, nhân viên và quy trình có thể truy cập plaintext của mã thẻ.
[Heading 2] 7.1 Yêu cầu lưu trữ
[List Bullet] Mã thẻ/PIN phải được mã hóa khi lưu trữ bằng authenticated encryption, ví dụ AES-256-GCM hoặc thuật toán tương đương được tổ chức phê duyệt.
[List Bullet] Khóa mã hóa được quản lý tách biệt khỏi database; ưu tiên KMS/HSM hoặc Secret Manager có kiểm soát truy cập.
[List Bullet] Thiết kế envelope encryption: data encryption key (DEK) mã hóa dữ liệu; key encryption key (KEK) được quản lý trong KMS.
[List Bullet] Không ghi plaintext mã thẻ vào log, exception, analytics, tracing, queue payload hoặc email thông thường.
[List Bullet] Chỉ lưu plaintext trong bộ nhớ trong khoảng thời gian tối thiểu cần thiết; không cache plaintext.
[List Bullet] Phân vùng Card Vault khỏi database nghiệp vụ; truy cập qua service identity và network policy.
[List Bullet] Phát hiện mã trùng bằng fingerprint/HMAC có khóa riêng, không dùng hash không khóa nếu mã có entropy thấp.
[Heading 2] 7.2 Quy trình Secure Reveal / Secure Delivery
[List Number] Backend nhận yêu cầu xem hoặc giao mã từ một phiên đã xác thực.
[List Number] Order Service xác minh người yêu cầu là chủ đơn hoặc service identity được phép.
[List Number] Kiểm tra trạng thái thanh toán từ nguồn đáng tin cậy; không tin trạng thái do trình duyệt gửi lên.
[List Number] Kiểm tra trạng thái mã thẻ: tồn kho, đã giữ, đã giao, bị thu hồi hoặc đang điều tra.
[List Number] Risk Engine đánh giá rủi ro; đơn rủi ro cao được giữ lại để kiểm tra.
[List Number] Card Vault kiểm tra quyền truy cập và chỉ giải mã mã cụ thể được yêu cầu.
[List Number] Delivery Service trả mã qua kênh bảo mật; hạn chế dữ liệu trả về và không đưa mã vào URL.
[List Number] Ghi audit event gồm actor, order ID, card ID, mục đích, thời gian, kết quả và correlation ID; tuyệt đối không ghi plaintext.
[List Number] Đánh dấu trạng thái giao hàng nhất quán trong transaction hoặc workflow có khả năng phục hồi.
[Heading 2] 7.3 Trạng thái vòng đời mã thẻ
[Heading 2] 7.4 Chống rò rỉ nội bộ
[List Bullet] Che mã thẻ trong danh sách, bảng dữ liệu và màn hình hỗ trợ.
[List Bullet] Không cung cấp API export plaintext cho nhân viên thông thường.
[List Bullet] Phát hiện truy cập hàng loạt, truy cập ngoài giờ hoặc truy cập nhiều đơn không liên quan.
[List Bullet] Áp dụng just-in-time access: cấp quyền tạm thời, có lý do và tự hết hạn.
[List Bullet] Định kỳ rà soát quyền Card Vault và kiểm tra log giải mã.
[List Bullet] Emergency Vault Lock phải có khả năng ngừng mọi hoạt động reveal/delivery nếu nghi ngờ rò rỉ.
[Heading 1] 8. Bảo mật thanh toán và đơn hàng
[Heading 1] 9. Fraud Detection & Risk Engine
[Normal] Risk Engine kết hợp rule-based detection và tín hiệu hành vi. Điểm rủi ro chỉ hỗ trợ quyết định; không nên dùng một tín hiệu đơn lẻ như VPN hoặc IP dùng chung để tự động kết luận gian lận.
[Heading 2] 9.1 Mức xử lý đề xuất
[Normal] Nếu triển khai thang điểm 0–100, ngưỡng ban đầu phải được hiệu chỉnh bằng dữ liệu thật, theo dõi false positive/false negative và có cơ chế nhân viên xem xét khiếu nại.
[Heading 1] 10. Bảo mật API và Provider Integration
[List Bullet] API key/secret phải được lưu trong Secret Manager hoặc kho secret tương đương; mã hóa khi lưu và giới hạn quyền đọc.
[List Bullet] Không trả secret về frontend, không đặt secret trong source code, repository, URL hoặc log.
[List Bullet] Phân tách credential theo môi trường development/staging/production và theo từng Provider.
[List Bullet] Ưu tiên request signing, timestamp, nonce và replay protection nếu Provider hỗ trợ.
[List Bullet] Webhook phải xác minh chữ ký hoặc cơ chế xác thực chính thức; nếu không có chữ ký, dùng xác minh bổ sung qua API server-to-server.
[List Bullet] Giới hạn IP outbound/inbound khi Provider hỗ trợ; dùng egress allowlist.
[List Bullet] Rate limit, timeout, retry có backoff và circuit breaker; không retry thao tác không idempotent một cách mù quáng.
[List Bullet] Validate schema, kích thước payload và kiểu dữ liệu; không tin dữ liệu trả về từ Provider.
[List Bullet] Thực hiện secret rotation và thu hồi credential khi có nghi ngờ lộ lọt.
[List Bullet] Provider Adapter phải cô lập lỗi; một Provider bị xâm nhập không được có quyền truy cập toàn hệ thống.
[Heading 1] 11. Bảo mật dữ liệu và cơ sở dữ liệu
[Normal] Đối với dữ liệu thẻ thanh toán, nên dùng hosted checkout hoặc tokenization của payment provider. Việc lưu, xử lý hoặc truyền dữ liệu thẻ có thể kéo theo phạm vi tuân thủ PCI DSS; cần đánh giá với đơn vị chuyên môn và acquiring/payment provider.
[Heading 1] 12. Bảo mật ứng dụng web
[Normal] Áp dụng security headers tối thiểu phù hợp với ứng dụng: Strict-Transport-Security, Content-Security-Policy, X-Content-Type-Options, Referrer-Policy và chính sách frame-ancestors. Kiểm thử tương thích trước khi bật CSP ở chế độ enforce.
[Heading 1] 13. Bảo mật hạ tầng và vận hành
[Heading 1] 14. Audit Log, Monitoring và Incident Response
[Heading 2] 14.1 Sự kiện phải ghi log
[List Bullet] Đăng nhập thành công/thất bại, MFA failure, reset password và thu hồi session.
[List Bullet] Thay đổi email, thông tin khôi phục, thiết bị tin cậy và quyền tài khoản.
[List Bullet] Tạo/sửa/xóa role, permission, cấu hình thanh toán hoặc Provider.
[List Bullet] Xem, giải mã, giao, thu hồi, cách ly hoặc xuất mã thẻ.
[List Bullet] Tạo đơn, thanh toán, hoàn tiền, điều chỉnh ledger và đối soát.
[List Bullet] Webhook không hợp lệ, API authentication failure, rate limit và provider anomaly.
[List Bullet] Truy cập database/admin console, thay đổi hạ tầng và thao tác backup/restore.
[Heading 2] 14.2 Trường dữ liệu audit tối thiểu
[Heading 2] 14.3 Incident response
[List Number] Detect: phát hiện qua alert, báo cáo khách hàng, Provider hoặc monitoring.
[List Number] Contain: khóa token/session, dừng giao mã, cô lập service hoặc kích hoạt Vault Lock.
[List Number] Investigate: bảo toàn log, xác định phạm vi, thời điểm, tài khoản và dữ liệu bị ảnh hưởng.
[List Number] Eradicate: vá lỗ hổng, xoay khóa/secret, loại bỏ persistence và khôi phục cấu hình an toàn.
[List Number] Recover: khôi phục dịch vụ theo từng bước, kiểm tra tính toàn vẹn dữ liệu và giao dịch.
[List Number] Notify & review: thông báo theo nghĩa vụ pháp lý/hợp đồng; lập post-incident report và hành động phòng ngừa.
[Heading 1] 15. Backup, Disaster Recovery và Business Continuity
[Normal] RPO/RTO là mục tiêu đề xuất để lập kế hoạch, không phải cam kết đã được kiểm chứng. Cần xác nhận bằng thiết kế, tải thực tế và diễn tập.
[Heading 1] 16. Phân quyền và ma trận quyền hạn
[Normal] Mọi quyền phải được cấp theo permission key cụ thể, có owner, lý do, ngày cấp và ngày rà soát. Tài khoản dịch vụ phải có identity riêng, không dùng chung credential với nhân viên.
[Heading 1] 17. Yêu cầu phi chức năng và tiêu chí nghiệm thu
[Heading 2] 17.1 Kiểm thử bắt buộc trước go-live
[List Bullet] Threat modeling cho luồng thanh toán, giao mã, hoàn tiền, nhập kho và quản trị.
[List Bullet] SAST, dependency scanning, secret scanning và container/image scanning.
[List Bullet] DAST trên staging với cấu hình gần production.
[List Bullet] Kiểm thử phân quyền ngang/dọc (IDOR/BOLA, privilege escalation).
[List Bullet] Kiểm thử race condition, idempotency, double spending và duplicate delivery.
[List Bullet] Kiểm thử webhook signature, replay, timeout và provider failure.
[List Bullet] Penetration test độc lập cho các thành phần Internet-facing và Card Vault.
[List Bullet] Kiểm tra restore backup và diễn tập incident response.
[Heading 1] 18. Lộ trình triển khai
[Heading 1] 19. Checklist phát hành
[Heading 2] Identity & Admin
[List Bullet] ☐ MFA được bật bắt buộc cho Admin và Super Admin.
[List Bullet] ☐ RBAC/permission đã được kiểm thử; tài khoản dùng chung đã loại bỏ.
[List Bullet] ☐ Session, password reset và account recovery đã được kiểm thử.
[List Bullet] ☐ Quy trình break-glass và thu hồi quyền nhân viên đã được định nghĩa.
[Heading 2] Card Vault & Inventory
[List Bullet] ☐ Mã thẻ/PIN được mã hóa bằng cơ chế authenticated encryption.
[List Bullet] ☐ Khóa được quản lý tách biệt; có rotation và recovery procedure.
[List Bullet] ☐ Không có plaintext mã thẻ trong log, queue, analytics hoặc backup không mã hóa.
[List Bullet] ☐ Secure reveal/delivery có authorization và audit.
[List Bullet] ☐ Bulk export bị tắt mặc định và cần phê duyệt.
[Heading 2] Payment & Order
[List Bullet] ☐ Backend xác minh thanh toán; webhook có xác thực.
[List Bullet] ☐ Idempotency và chống giao hàng trùng đã được kiểm thử.
[List Bullet] ☐ Refund/chargeback workflow có hạn mức và audit.
[List Bullet] ☐ Đối soát thanh toán được vận hành.
[Heading 2] API & Infrastructure
[List Bullet] ☐ Secret không nằm trong code hoặc frontend.
[List Bullet] ☐ WAF, rate limit, firewall và private networking đã cấu hình.
[List Bullet] ☐ Dependency/image scanning và quy trình vá lỗi hoạt động.
[List Bullet] ☐ Backup mã hóa và restore test thành công.
[Heading 2] Monitoring & Response
[List Bullet] ☐ Audit log và alert cho sự kiện nhạy cảm đã hoạt động.
[List Bullet] ☐ Incident response owner và liên hệ khẩn cấp đã được xác định.
[List Bullet] ☐ Penetration test đã hoàn thành; Critical/High đã xử lý hoặc có risk acceptance.
[List Bullet] ☐ RPO/RTO đã được xác nhận qua diễn tập.
[Heading 1] 20. Tài liệu tham chiếu
[List Bullet] OWASP Application Security Verification Standard (ASVS) – dùng làm khung yêu cầu và kiểm chứng bảo mật ứng dụng.
[List Bullet] OWASP Top 10 – tham khảo các nhóm rủi ro phổ biến của ứng dụng web.
[List Bullet] OWASP Cheat Sheet Series – hướng dẫn triển khai cho authentication, session, secrets, logging, cryptographic storage và các chủ đề liên quan.
[List Bullet] NIST Cybersecurity Framework – tham khảo quản trị rủi ro, bảo vệ, phát hiện, phản ứng và phục hồi.
[List Bullet] PCI DSS – đánh giá phạm vi áp dụng nếu SunCard lưu trữ, xử lý hoặc truyền dữ liệu thẻ thanh toán.
[Heading 1] Phụ lục A – Quyết định thiết kế cần chốt
[Heading 1] Phụ lục B – Tuyên bố và giới hạn
[Normal] Đây là tài liệu đặc tả kỹ thuật và vận hành ở mức định hướng Enterprise, không phải chứng nhận bảo mật, ý kiến pháp lý hoặc cam kết tuân thủ. Các lựa chọn mã hóa, kiến trúc, thời hạn lưu trữ, RPO/RTO và kiểm soát thanh toán cần được Tech Lead/Security Engineer xác minh theo nền tảng triển khai, nhà cung cấp, thị trường và yêu cầu pháp lý thực tế.
[Normal] Không triển khai cơ chế mã hóa tự thiết kế. Ưu tiên thư viện mật mã đã được kiểm chứng, dịch vụ KMS/HSM và hướng dẫn bảo mật chính thức của nền tảng đang sử dụng.

[TABLE 1]
Thuộc tính | Giá trị
Tên tài liệu | SunCard – Enterprise Security Specification
Phiên bản | 1.0
Ngày phát hành | 06/11/2026
Phạm vi | Website bán mã thẻ số, gift card, game card, top-up card và sản phẩm digital code
Đối tượng đọc | Product Owner, Tech Lead, Backend/Frontend Engineer, DevOps, Security Engineer, QA, Operations
Mục tiêu | Định nghĩa yêu cầu, kiểm soát, kiến trúc và quy trình bảo vệ tài khoản, thanh toán, kho mã thẻ, API và hạ tầng

[TABLE 2]
Phiên bản | Ngày | Nội dung
1.0 | 06/11/2026 | Phát hành bản đặc tả bảo mật Enterprise đầu tiên.

[TABLE 3]
Trong phạm vi | Ngoài phạm vi / cần dự án riêng
Website khách hàng, Admin Portal, API backend, Wallet/Ledger nếu có, Order Engine, Card Vault, Payment Gateway, Provider Adapter, database, queue, cache, cloud/server, logging và backup. | Đánh giá pháp lý theo từng quốc gia; chứng nhận PCI DSS nếu mô hình xử lý dữ liệu thẻ yêu cầu; kiểm toán độc lập; điều tra pháp chứng chuyên sâu; bảo mật nội bộ của nhà cung cấp bên thứ ba.

[TABLE 4]
Tài sản | Mức độ | Rủi ro chính
Mã thẻ, PIN, serial, redemption code | Critical | Rò rỉ, bị sử dụng trước khách hàng, nhân viên trích xuất hàng loạt
Thông tin thanh toán và giao dịch | Critical | Thanh toán giả, chargeback, lộ dữ liệu, xử lý trùng
API key/secret của Provider và Payment Gateway | Critical | Chiếm quyền API, đặt đơn trái phép, truy cập dữ liệu
Tài khoản Super Admin và nhân viên | Critical | Chiếm quyền quản trị, thay đổi cấu hình hoặc lấy mã
Wallet balance và ledger | Critical | Cộng/trừ tiền trái phép, double spending, sửa lịch sử
Dữ liệu cá nhân khách hàng | High | Lộ dữ liệu, truy cập sai mục đích
Đơn hàng và lịch sử giao mã | High | Sửa trạng thái, giao nhầm, tranh chấp
Hạ tầng, backup, source code | High | Ransomware, xâm nhập, phá hoại hoặc gián đoạn

[TABLE 5]
Lớp | Thành phần | Trách nhiệm bảo mật
Edge | DNS, CDN, WAF, DDoS protection | Lọc lưu lượng, chặn bot/tấn công phổ biến, bảo vệ origin
Application Gateway | API Gateway, authentication, rate limit | Xác thực, phân luồng, giới hạn tốc độ, kiểm tra schema
Application Services | Account, Order, Payment, Wallet, Catalog | Nghiệp vụ theo quyền; xác thực trạng thái và điều kiện giao dịch
Sensitive Services | Card Vault, Secret Manager, Key Management | Giải mã mã thẻ có kiểm soát; quản lý khóa và bí mật
Data Layer | Database, Redis, object storage, queue | Phân vùng mạng, mã hóa, kiểm soát truy cập và backup
Security Operations | Audit, SIEM, alerting, incident management | Phát hiện, cảnh báo, điều tra và phản ứng sự cố

[TABLE 6]
Nguyên tắc kiến trúc | Frontend không được kết nối trực tiếp database, Card Vault, Redis hoặc Provider. Mọi truy cập phải đi qua backend service được xác thực và cấp quyền. Card Vault chỉ giải mã mã thẻ cho luồng giao hàng được phép.

[TABLE 7]
Mã | Yêu cầu | Mô tả / tiêu chí
ACC-01 | Password hashing | Dùng Argon2id hoặc thuật toán password hashing hiện hành; không lưu mật khẩu dạng rõ hoặc mã hóa có thể giải ngược.
ACC-02 | MFA | Hỗ trợ TOTP/passkey; yêu cầu MFA cho thao tác nhạy cảm và có thể bắt buộc theo mức rủi ro.
ACC-03 | Login throttling | Giới hạn theo tài khoản, IP và tín hiệu thiết bị; tăng độ trễ hoặc CAPTCHA khi có dấu hiệu bot.
ACC-04 | Credential stuffing | Phát hiện đăng nhập hàng loạt bằng thông tin rò rỉ; không tiết lộ tài khoản có tồn tại hay không.
ACC-05 | Session security | Cookie Secure, HttpOnly, SameSite; rotate session sau đăng nhập và thay đổi quyền.
ACC-06 | New device alert | Cảnh báo khi đăng nhập từ thiết bị hoặc vị trí bất thường.
ACC-07 | Session management | Hiển thị phiên hoạt động; cho phép thu hồi phiên; tự hết hạn theo chính sách.
ACC-08 | Sensitive changes | Đổi email, mật khẩu, MFA và thông tin khôi phục cần xác thực lại.
ACC-09 | Account recovery | Quy trình khôi phục chống chiếm đoạt; token dùng một lần, thời hạn ngắn.
ACC-10 | Risk-based challenge | Yêu cầu xác minh bổ sung khi rủi ro cao, không chỉ dựa vào IP.

[TABLE 8]
Thao tác | Kiểm soát tối thiểu
Xem mã thẻ | Kiểm tra quyền, trạng thái đơn, người sở hữu; step-up authentication khi cần; ghi audit log.
Xuất kho / export mã | Tắt mặc định; yêu cầu quyền riêng, phê duyệt kép, giới hạn số lượng và lưu dấu vết.
Hoàn tiền | Kiểm tra trạng thái giao mã, chính sách hoàn tiền, hạn mức và phê duyệt.
Điều chỉnh số dư | Ledger transaction có reference; lý do bắt buộc; dual approval theo ngưỡng.
Thay đổi Provider/API secret | Quyền chuyên biệt; secret không hiển thị lại; ghi nhận người thay đổi và thời điểm.
Thay đổi role/permission | Chỉ cấp bởi người có quyền; không tự nâng quyền; ghi log trước/sau.

[TABLE 9]
Trạng thái | Ý nghĩa | Chuyển trạng thái hợp lệ
IMPORTED | Mã vừa nhập vào hệ thống | VALIDATED / QUARANTINED
VALIDATED | Đã kiểm tra định dạng và trùng lặp | AVAILABLE / QUARANTINED
AVAILABLE | Sẵn sàng bán | RESERVED
RESERVED | Đã giữ cho đơn hàng | AVAILABLE / DELIVERED / QUARANTINED
DELIVERED | Đã giao cho khách | Không quay lại AVAILABLE; xử lý tranh chấp bằng trạng thái riêng
QUARANTINED | Tạm cách ly để điều tra | AVAILABLE / VOIDED theo phê duyệt
VOIDED | Hủy, không được bán | Trạng thái kết thúc

[TABLE 10]
Mã | Kiểm soát | Yêu cầu
PAY-01 | Server-side verification | Chỉ backend xác minh trạng thái thanh toán từ gateway/API/webhook đáng tin cậy.
PAY-02 | Webhook signature | Kiểm tra chữ ký, timestamp, nguồn gửi và replay window theo tài liệu gateway.
PAY-03 | Idempotency | Mỗi thao tác thanh toán/giao hàng có idempotency key hoặc business reference duy nhất.
PAY-04 | Atomicity | Cập nhật payment, order, inventory và ledger theo transaction hoặc saga có cơ chế bù trừ.
PAY-05 | 3-D Secure | Sử dụng khi gateway và loại giao dịch hỗ trợ; không tự tuyên bố loại bỏ chargeback.
PAY-06 | Velocity rules | Giới hạn số lần thử thanh toán, số đơn, giá trị và số lượng trong khoảng thời gian.
PAY-07 | Refund control | Hoàn tiền phải đối chiếu trạng thái thanh toán và giao mã; có hạn mức, lý do và phê duyệt.
PAY-08 | Chargeback evidence | Lưu bằng chứng đơn hàng, trạng thái giao mã, xác minh và trao đổi hỗ trợ theo chính sách lưu trữ.
PAY-09 | Reconciliation | Đối soát giao dịch nội bộ với báo cáo gateway định kỳ.
PAY-10 | No sensitive card data | Không lưu PAN/CVV nếu không cần; ưu tiên hosted checkout/tokenization của nhà cung cấp.

[TABLE 11]
Quy tắc giao hàng | Không giao mã dựa trên redirect URL, ảnh chụp biên lai hoặc trạng thái do client tự gửi. Chỉ giao sau khi backend xác minh giao dịch thành công và đã chống xử lý lặp.

[TABLE 12]
Nhóm tín hiệu | Ví dụ | Phản ứng
Account | Tuổi tài khoản, xác minh email, lịch sử vi phạm | Yêu cầu xác minh bổ sung hoặc giới hạn
Device | Thiết bị mới, nhiều tài khoản dùng chung thiết bị | Tăng risk score, xem xét thủ công
Network | IP reputation, ASN, tốc độ thay đổi vị trí | Thử thách bổ sung; tránh chặn cứng chỉ vì VPN
Payment | Số lần thử, BIN/country mismatch nếu được phép, chargeback history | Giữ đơn, yêu cầu xác minh hoặc từ chối theo rule
Order | Giá trị cao, số lượng lớn, mua liên tục, sản phẩm rủi ro cao | Giới hạn số lượng hoặc manual review
Delivery | Yêu cầu reveal lặp, thay đổi tài khoản ngay sau mua | Tạm giữ giao mã và điều tra
Refund | Yêu cầu hoàn tiền bất thường, nhiều tranh chấp | Chuyển kiểm tra và áp dụng chính sách

[TABLE 13]
Mức | Hành động
Low risk | Tự động xử lý nếu mọi điều kiện thanh toán và tồn kho hợp lệ.
Medium risk | Step-up verification, giới hạn giao dịch hoặc giữ đơn ngắn hạn để kiểm tra.
High risk | Tạm giữ giao mã; chuyển manual review; ghi rõ lý do và bằng chứng.
Critical / confirmed abuse | Chặn giao dịch, thu hồi phiên/API token liên quan, kích hoạt incident workflow.

[TABLE 14]
Khu vực | Yêu cầu
Data in transit | TLS hiện hành cho website, API, kết nối service-to-service và quản trị.
Data at rest | Mã hóa database, backup, object storage và volume; quản lý khóa tách biệt.
Password | Hash bằng Argon2id hoặc thuật toán phù hợp; salt riêng; không thể giải ngược.
Personal data | Thu thập tối thiểu, phân loại, giới hạn mục đích và thời gian lưu trữ.
Database access | Không public Internet; tài khoản service riêng; quyền theo schema/table khi phù hợp.
Secrets | Không lưu chung với source code hoặc bản backup không mã hóa.
Logs | Mask dữ liệu cá nhân, token, mã thẻ và thông tin thanh toán nhạy cảm.
Deletion | Có quy trình xóa/ẩn danh theo chính sách lưu trữ và nghĩa vụ pháp lý áp dụng.

[TABLE 15]
Rủi ro | Kiểm soát bắt buộc
SQL Injection | Parameterized queries, ORM an toàn, không nối chuỗi truy vấn từ input.
XSS | Output encoding theo context, sanitize HTML, Content Security Policy.
CSRF | CSRF token, SameSite cookie và kiểm tra Origin/Referer khi phù hợp.
SSRF | Egress filtering, allowlist đích, chặn metadata endpoint và mạng nội bộ.
Clickjacking | CSP frame-ancestors và X-Frame-Options phù hợp.
Path traversal | Chuẩn hóa đường dẫn, allowlist file và sandbox upload.
Malicious upload | Kiểm tra MIME thực, kích thước, quét malware, lưu ngoài webroot.
Open redirect | Allowlist redirect URL; không chuyển hướng tùy ý theo input.
Deserialization | Không deserialize dữ liệu không tin cậy; schema validation.
Business logic abuse | Kiểm tra quyền và điều kiện ở server; không dựa vào ẩn nút frontend.

[TABLE 16]
Thành phần | Yêu cầu
Cloudflare/CDN/WAF | Ẩn origin, WAF managed/custom rules, DDoS protection, bot controls và rate limit.
Server/OS | Hardening, cập nhật bản vá, tắt dịch vụ không dùng, firewall inbound/outbound.
SSH/Admin access | SSH key, MFA/VPN hoặc ZTNA, không dùng mật khẩu yếu, không mở SSH rộng.
Container | Image tối thiểu, non-root, scan image, giới hạn capability và filesystem.
Kubernetes (nếu dùng) | RBAC, network policy, secret management, admission policy và audit.
Redis/Queue | Private network, authentication/ACL, TLS khi phù hợp, không public.
CI/CD | Branch protection, code review, secret scanning, dependency scanning, artifact provenance.
Dependencies | Theo dõi CVE, cập nhật thư viện, lockfile và quy trình xử lý lỗ hổng.
Monitoring | Theo dõi CPU, memory, error rate, login anomalies, API abuse và security events.

[TABLE 17]
Trường | Mô tả
event_id | ID duy nhất của sự kiện
timestamp | Thời điểm UTC đồng bộ
actor_type / actor_id | User, staff, admin, service hoặc system
action / resource | Hành động và đối tượng bị tác động
result | Success, denied, failed hoặc pending
source_ip / device_id | Nguồn truy cập; tuân thủ chính sách riêng tư
correlation_id | Liên kết các log trong cùng request/workflow
reason / approval_id | Lý do và phê duyệt nếu là thao tác nhạy cảm
before_after_summary | Tóm tắt thay đổi, không chứa secret hoặc plaintext mã thẻ

[TABLE 18]
Yêu cầu | Đề xuất baseline
Backup database | Tự động, mã hóa, phân quyền riêng và kiểm tra tính toàn vẹn.
Backup Card Vault | Mã hóa bằng khóa được quản lý độc lập; quy trình khôi phục được kiểm soát kép.
Immutable/offsite copy | Có bản backup bất biến hoặc tách biệt tài khoản/hạ tầng chính.
Restore test | Kiểm thử khôi phục định kỳ; không chỉ kiểm tra job backup thành công.
RPO | Mục tiêu ban đầu đề xuất ≤ 15 phút cho dữ liệu giao dịch quan trọng, cần xác nhận theo chi phí và kiến trúc.
RTO | Mục tiêu ban đầu đề xuất ≤ 4 giờ cho dịch vụ cốt lõi, cần xác nhận bằng diễn tập.
Key recovery | Có quy trình khôi phục KMS/keys có kiểm soát; mất khóa có thể làm dữ liệu không thể giải mã.
DR exercise | Diễn tập ít nhất hàng năm và sau thay đổi kiến trúc lớn.

[TABLE 19]
Vai trò | Quyền mặc định | Không được phép mặc định
Customer | Xem hồ sơ, đơn hàng, lịch sử và mã của đơn thuộc sở hữu hợp lệ | Xem đơn/mã của người khác; truy cập kho nội bộ
Support | Xem thông tin đơn đã mask, hỗ trợ ticket | Xem plaintext mã thẻ hàng loạt; chỉnh sửa ledger
Sales/Operations | Quản lý catalog và đơn theo phạm vi | Đọc API secret; xuất mã thẻ hàng loạt
Warehouse | Nhập, kiểm tra, cách ly tồn kho theo quyền | Tự phê duyệt export lớn; thay đổi thanh toán
Finance | Đối soát, xem giao dịch, xử lý hoàn tiền theo hạn mức | Đọc plaintext mã thẻ không cần thiết
Security Analyst | Xem security events, điều tra theo phạm vi | Tự ý sửa giao dịch hoặc cấp quyền quản trị
Admin | Quản lý chức năng được cấp | Tự nâng quyền; xóa audit log; bypass approval
Super Admin | Quản trị hệ thống với MFA mạnh và audit đầy đủ | Không được bỏ qua logging hoặc quy trình break-glass

[TABLE 20]
ID | Tiêu chí nghiệm thu
SEC-AC-01 | Mật khẩu không xuất hiện dạng rõ trong database, log hoặc response.
SEC-AC-02 | MFA bắt buộc cho Admin; thao tác nhạy cảm yêu cầu xác thực lại theo policy.
SEC-CV-01 | Mã thẻ lưu trong database ở dạng mã hóa; không có plaintext trong log, queue hoặc analytics.
SEC-CV-02 | Nhân viên không có quyền không thể giải mã mã thẻ qua UI hoặc API.
SEC-CV-03 | Mỗi lần reveal/delivery tạo audit event không chứa mã thẻ.
SEC-PY-01 | Webhook sai chữ ký hoặc replay bị từ chối và ghi nhận.
SEC-PY-02 | Request thanh toán/giao hàng lặp không tạo giao dịch hoặc giao mã trùng.
SEC-API-01 | Secret không xuất hiện trong frontend bundle, source repo hoặc response.
SEC-API-02 | API có authentication, authorization, schema validation và rate limit.
SEC-LOG-01 | Log bảo mật có timestamp, actor, action, result và correlation ID.
SEC-INF-01 | Database, Redis và Card Vault không public Internet.
SEC-DR-01 | Backup được mã hóa và có bằng chứng restore test.
SEC-TEST-01 | Không còn lỗ hổng Critical/High chưa được xử lý hoặc chấp nhận rủi ro chính thức trước go-live.

[TABLE 21]
Giai đoạn | Phạm vi | Kết quả
Phase 1 – Foundation | TLS, WAF, secure coding, password hashing, MFA Admin, RBAC, session, database private network | Baseline bảo mật và kiểm soát truy cập
Phase 2 – Money & Inventory | Payment verification, idempotency, ledger, Card Vault encryption, secure delivery, audit | Bảo vệ tiền, đơn hàng và mã thẻ
Phase 3 – Detection | Risk Engine, velocity rules, device/IP signals, fraud queue, alerting | Phát hiện và xử lý gian lận
Phase 4 – Enterprise Operations | KMS, SIEM, immutable logs, incident response, backup/DR, dual approval | Vận hành bảo mật và khả năng phục hồi
Phase 5 – Assurance | Penetration test, ASVS verification, remediation, compliance assessment | Bằng chứng kiểm thử và sẵn sàng phát hành

[TABLE 22]
Chủ đề | Quyết định cần xác nhận
Mô hình thanh toán | Hosted checkout/tokenization hay mô hình xử lý thẻ trực tiếp; phạm vi PCI DSS tương ứng.
Card Vault | KMS cloud, HSM hay secret vault; chiến lược envelope encryption và key rotation.
Xác minh khách hàng | MFA bắt buộc ở thao tác nào; ngưỡng step-up verification.
Fraud policy | Ngưỡng risk score, hạn mức theo sản phẩm/quốc gia/phương thức thanh toán.
Retention | Thời hạn lưu audit, dữ liệu giao dịch, dữ liệu cá nhân và bằng chứng chargeback.
Availability | RPO/RTO, vùng triển khai, chiến lược DR và mức chi phí chấp nhận.
Compliance | Quốc gia phục vụ, nghĩa vụ privacy, consumer protection, tax và payment compliance.