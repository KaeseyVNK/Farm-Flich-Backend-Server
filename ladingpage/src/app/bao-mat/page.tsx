import { LegalChrome } from "@/components/landing/legal-chrome";

export default function PrivacyPage() {
  return (
    <LegalChrome title="Chính sách bảo mật">
      <p>
        Chúng tôi chỉ lưu email bạn gửi qua form giữ chỗ, mã mở sớm gắn với
        email đó, và thời điểm đăng ký. Không bán danh sách. Không dùng cho
        quảng cáo bên thứ ba.
      </p>
      <p>
        Dữ liệu nằm trên máy chủ của dự án (SQLite). Khi có yêu cầu xóa, gửi
        lại đúng email đã đăng ký qua form — chúng tôi xóa bản ghi waitlist.
      </p>
      <p id="cookie">
        Cookie: trang không đặt cookie quảng cáo. Trình duyệt có thể lưu phiên
        kỹ thuật của host. Không dùng pixel theo dõi bên thứ ba trên landing.
      </p>
      <p>Cập nhật lần cuối: 11/09/2026.</p>
    </LegalChrome>
  );
}
