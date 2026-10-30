# Sen Quest: hướng dẫn chạy và đưa lên mạng

Game web, không cần cài app. Thư mục này chứa toàn bộ game.

| File | Nội dung |
|---|---|
| `index.html` | Giao diện, màn hình, nút bấm |
| `main.js` | Đi trong booth (phím mũi tên / núm xoay), chặng, nộp điểm, chia sẻ, bảng xếp hạng |
| `games.js` | 3 mini-game: Oil Rush, Đúng hay Sai, 30 ngày cùng Sen |
| `questions.js` | Nội dung: 16 câu Đúng/Sai, thói quen tốt/xấu, luật điểm (**cần chuyên gia duyệt**) |
| `scene.js` | Booth 3D, vị trí các khu và vật cản |
| `backend.js` + `config.js` | Lưu điểm: chế độ thử (trên máy) hoặc Supabase |
| `supabase/setup.sql` | Tạo bảng điểm và luật tính điểm trên Supabase |

## 1. Chạy thử trên máy

Cần chạy qua server local (mở thẳng file `index.html` sẽ không chạy):

```
python -m http.server 8771
```

Rồi mở `http://127.0.0.1:8771/`. Khi `config.js` để trống, game chạy **chế độ thử**: điểm chỉ lưu trên máy đó, bảng xếp hạng có vài người chơi mẫu.

Thêm `?debug=1` vào link để rút ngắn mỗi mini-game (dùng khi kiểm tra nhanh, không dùng khi chạy thật).

## 2. Bật bảng xếp hạng thật (Supabase, miễn phí)

1. Tạo tài khoản và project mới tại supabase.com.
2. Vào **SQL Editor**, dán toàn bộ `supabase/setup.sql`, bấm **Run**.
3. Vào **Project Settings → API**, chép **Project URL** và khóa **anon public**.
4. Dán vào `config.js`:
   ```js
   export const SUPABASE_URL = "https://xxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ...";
   ```
   Khóa anon được phép công khai: trình duyệt chỉ gọi được 4 hàm trong `setup.sql`, không đọc hay sửa thẳng bảng điểm được.
5. Đưa lên mạng (mục 3).

**Xem và xuất danh sách:** Supabase → Table Editor → `players` → Export CSV.
**Xóa dữ liệu chơi thử trước ngày ra mắt:** SQL Editor → `truncate public.players;`

## 3. Đưa lên GitHub Pages

Chép cả thư mục này vào repo (ví dụ thư mục `game/`) rồi push. Link sẽ là `https://<tên>.github.io/<repo>/game/`.

## Luật điểm (đổi ở đâu)

- Mỗi hành động đúng +10 (`POINTS.action` trong `questions.js`).
- Mỗi bạn đăng ký bằng mã và chơi xong +5 cho người mời, mỗi máy chỉ tính 1 lần (`POINTS.referral`, và `per_referral` trong `setup.sql`).
- Tính lượt chơi tốt nhất; bằng điểm thì ai nhanh hơn xếp trên.
- Điểm một lượt tối đa 1300, thời gian tối thiểu 60 giây để chặn số ảo (`MAX_SCORE`, `MIN_TIME_MS`, và `max_score`, `min_time_ms` trong `setup.sql`). Đổi ở cả hai nơi cho khớp.
- Muốn cộng +5 ngay khi bạn bè đăng ký (không cần chơi xong): đổi `REFERRAL_CREDIT` trong `config.js` **và** `referral_credit` trong `setup.sql` thành `register`.
