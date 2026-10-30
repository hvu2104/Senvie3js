// Game content. DRAFT: every statement and explanation must be reviewed by a dermatologist before launch.

export const ZONES = [
  { id: "z1", name: "NHẬN RA", game: "Oil Rush", color: "#fcdc31", key: "Chìa Vàng",
    how: "Da bé Sen đang đổ dầu! Vuốt lên các vệt bóng dầu để làm sạch trước khi da bị bí. Nhớ nhẹ tay: chà quá mạnh làm da kích ứng. Trụ 40 giây." },
  { id: "z2", name: "THẤU HIỂU", game: "Đúng hay Sai", color: "#e4b5d2", key: "Chìa Hồng",
    how: "Tin skincare trên mạng bay tới! Vuốt phải (hoặc phím →) nếu ĐÚNG, vuốt trái (phím ←) nếu SAI. Càng nhanh càng tốt." },
  { id: "z3", name: "DUY TRÌ", game: "30 ngày cùng Sen", color: "#a8cf52", key: "Chìa Lime",
    how: "Giúp bé Sen giữ thói quen tốt suốt 30 ngày. Đổi làn bằng vuốt hoặc phím ← →. Nhặt thói quen tốt, né thói quen xấu. Có 3 tim." },
];

export const POINTS = { action: 10, referral: 5 };
// Upper bounds the server also enforces (see supabase/setup.sql _cfg('max_score')).
export const MAX_SCORE = 1300;

// Zone 2 deck: a = true when the statement is correct.
export const STATEMENTS = [
  { s: "Nặn mụn giúp mụn nhanh khỏi hơn.", a: false, e: "Nặn mụn dễ đẩy vi khuẩn sâu hơn, gây viêm, thâm và sẹo." },
  { s: "Bôi kem đánh răng lên mụn giúp trị mụn.", a: false, e: "Kem đánh răng không dành cho da, dễ gây kích ứng và khô rát." },
  { s: "Rửa mặt càng nhiều lần, da càng ít mụn.", a: false, e: "Rửa quá nhiều làm da khô, da lại tiết dầu nhiều hơn. 2 lần/ngày là đủ." },
  { s: "Da dầu vẫn cần dưỡng ẩm.", a: true, e: "Da dầu vẫn có thể thiếu nước. Chọn dưỡng ẩm mỏng nhẹ, không bít tắc." },
  { s: "Rửa xong thấy 'sạch kin kít' là da đã sạch tốt.", a: false, e: "Kin kít thường do sữa rửa mặt quá mạnh, lấy mất lớp dầu bảo vệ da." },
  { s: "Trời râm vẫn nên dùng kem chống nắng.", a: true, e: "Tia UV vẫn xuyên qua mây. Chống nắng mỗi ngày giúp hạn chế thâm." },
  { s: "Đắp chanh lên mặt giúp mờ thâm an toàn.", a: false, e: "Chanh có tính axit mạnh, dễ gây bỏng rát khi ra nắng." },
  { s: "Thay vỏ gối thường xuyên giúp da sạch hơn.", a: true, e: "Vỏ gối giữ dầu, mồ hôi và vi khuẩn. Thay thường xuyên giúp hạn chế mụn." },
  { s: "Càng nhiều bước skincare, da càng đẹp.", a: false, e: "Tuổi teen chỉ cần làm sạch, dưỡng ẩm, chống nắng. Nhiều bước dễ kích ứng." },
  { s: "Mụn viêm nhiều, đau nên đi khám bác sĩ da liễu.", a: true, e: "Khám sớm giúp hạn chế sẹo và tổn thương lâu dài." },
  { s: "Kem trộn làm trắng nhanh là an toàn.", a: false, e: "Kem trộn không rõ thành phần, có thể chứa chất gây hại cho da." },
  { s: "Nên thử sản phẩm mới trên vùng da nhỏ trước.", a: true, e: "Thử vài ngày sau tai hoặc quai hàm để xem da có kích ứng không." },
  { s: "Nổi mụn tuổi dậy thì là do bạn ở bẩn.", a: false, e: "Mụn tuổi dậy thì chủ yếu do hormone thay đổi, không phải do bạn bẩn." },
  { s: "Ngủ đủ giấc tốt cho làn da.", a: true, e: "Ngủ đủ giúp cơ thể cân bằng và da phục hồi tốt hơn." },
  { s: "Dùng chung khăn mặt với cả nhà cũng không sao.", a: false, e: "Khăn dùng chung dễ lây vi khuẩn. Mỗi người nên có khăn riêng." },
  { s: "Rửa mặt 2 lần mỗi ngày là đủ với đa số bạn.", a: true, e: "Sáng và tối, thêm lần nữa khi ra nhiều mồ hôi là vừa." },
];
export const DECK_SIZE = 12;

// Zone 3 runner items
export const GOOD = [["💧", "Uống nước"], ["🧴", "Chống nắng"], ["😴", "Ngủ đủ"], ["🫧", "Rửa mặt"], ["🥦", "Ăn rau"], ["🛏️", "Vỏ gối sạch"]];
export const BAD = [["🌙", "Thức khuya"], ["🍟", "Đồ chiên"], ["✋", "Sờ mặt"], ["🧪", "Kem trộn"], ["📱", "Lướt đêm"]];
export const RUN_DAYS = 30;
