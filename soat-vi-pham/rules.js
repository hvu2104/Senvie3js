// Text rules shared by video (OCR, speech) and design checks. Tools/soat-vi-pham-tiktok.html has an older subset (no profanity, brands).
export const SRC = {
  cg: 'https://www.tiktok.com/safety/vi-VN/policies-and-engagement/overview',
  fyf: 'https://www.tiktok.com/safety/vi-VN/policies-and-engagement/fyf-standards',
  ads: 'https://ads.tiktok.com/help/article/tiktok-ads-policy-healthcare-pharmaceuticals',
  disc: 'https://ads.tiktok.com/help/article/about-the-commercial-content-disclosure-setting-for-advertisers',
  nd342: 'https://lsvn.vn/nhung-diem-moi-cua-nghi-dinh-342-2025-nd-cp-quy-dinh-chi-tiet-luat-quang-cao-a169273.html',
};
export const SEV = { block: 'Chặn', warn: 'Cảnh báo', tip: 'Gợi ý' };
export const RANK = { block: 0, warn: 1, tip: 2 };

export const RULES = [
  { id: 'medical', sev: 'block', name: 'Tuyên bố chữa bệnh',
    terms: ['trị mụn', 'trị thâm', 'trị nám', 'trị sẹo', 'trị dứt điểm', 'điều trị', 'đặc trị', 'chữa', 'chữa khỏi', 'khỏi hẳn', 'dứt điểm', 'tận gốc', 'vĩnh viễn', 'thuốc', 'kê đơn', 'liệu trình điều trị', 'viêm da', 'chàm', 'vảy nến', 'viêm nang lông', 'diệt khuẩn', 'sát khuẩn'],
    why: 'Mỹ phẩm không được quảng cáo như thuốc hoặc hứa chữa bệnh. TikTok gỡ hoặc từ chối quảng cáo có tuyên bố y khoa.',
    fix: '“làm sạch dịu nhẹ”, “hỗ trợ da thông thoáng”, “phù hợp da dầu, dễ nổi mụn”.', src: SRC.ads },
  { id: 'promise', sev: 'block', name: 'Cam kết kết quả',
    terms: ['cam kết', 'hiệu quả ngay', 'thần dược', 'trắng bật tông', 'trắng cấp tốc', 'hết mụn', 'sạch mụn', /100\s?%/, /(?:sau|trong|chỉ)\s+\d+\s+(?:ngày|tuần|giờ)/],
    why: 'Hứa kết quả cụ thể hoặc theo mốc thời gian dễ bị coi là gây hiểu nhầm, vi phạm luật quảng cáo mỹ phẩm.',
    fix: 'Kể trải nghiệm thật: “dùng 2 tuần, mình thấy da đỡ bóng dầu hơn”. Bỏ con số cam kết.', src: SRC.nd342 },
  { id: 'authority', sev: 'block', name: 'Mượn danh chuyên gia',
    terms: ['bác sĩ khuyên dùng', 'bác sĩ chứng nhận', 'được bác sĩ', 'bộ y tế chứng nhận', 'chuyên gia da liễu khuyên'],
    why: 'Dùng danh nghĩa bác sĩ, cơ quan y tế để quảng cáo mỹ phẩm là nội dung bị cấm nếu không có xác nhận hợp lệ.',
    fix: '“Nội dung được chuyên gia của nhãn hàng duyệt” nếu có chuyên gia thật đứng tên.', src: SRC.nd342 },
  { id: 'superlative', sev: 'warn', name: 'So sánh tuyệt đối',
    terms: ['tốt nhất', 'số 1', 'số một', 'duy nhất', 'an toàn tuyệt đối', 'không tác dụng phụ', 'không gây kích ứng', 'hoàn tiền nếu không hiệu quả'],
    why: 'Từ “nhất”, “duy nhất”, “tuyệt đối” cần tài liệu chứng minh. Không có thì dễ bị coi là quảng cáo sai sự thật.',
    fix: '“dịu nhẹ, đã kiểm nghiệm da liễu” (chỉ khi có kết quả kiểm nghiệm).', src: SRC.nd342 },
  { id: 'shaming', sev: 'warn', name: 'Chê bai ngoại hình',
    terms: ['da xấu', 'da hỏng', 'mặt mụn', 'xấu xí', 'mặt rỗ', 'ghê tởm', 'kinh tởm', 'đen nhẻm', 'béo ú', 'mập ú'],
    why: 'Nhận xét hạ thấp ngoại hình có thể bị xếp vào quấy rối hoặc hình ảnh cơ thể có hại, dễ bị hạn chế đề xuất.',
    fix: '“da đang thay đổi”, “da đang cần được chăm”, “những ngày da hơi dỗi”.', src: SRC.cg },
  { id: 'profanity', sev: 'block', name: 'Từ ngữ tục tĩu, chửi thề',
    terms: ['địt', 'đụ', 'đéo', 'lồn', 'buồi', 'cặc', 'đĩ', 'đmm', 'đcm', 'dcm', 'đm', 'dm', 'dmm', 'vcl', 'vkl', 'vl', 'clgt', 'cmm', 'cmn', 'cc', 'đỉ mẹ', 'con mẹ mày', 'mẹ mày', 'đụ má', 'địt mẹ', 'dit me', 'du ma', 'vãi lồn', 'vãi cả lồn', 'óc chó', 'đồ chó', 'thằng chó', 'con chó cái', 'súc vật'],
    why: 'Ngôn từ tục tĩu, chửi thề, xúc phạm bị TikTok hạn chế đề xuất hoặc gỡ, nhất là với nội dung hướng tới người dưới 18 tuổi.',
    fix: 'Cắt đoạn đó hoặc chèn tiếng bíp và che chữ.', src: SRC.cg },
  { id: 'rude', sev: 'warn', name: 'Từ ngữ thô hoặc xúc phạm nhẹ',
    terms: ['đếch', 'vãi', 'vãi chưởng', 'mất dạy', 'khốn nạn', 'chết tiệt', 'ngu như bò', 'đồ ngu', 'thằng ngu', 'con ngu', 'câm mồm', 'cút', 'láo toét'],
    why: 'Từ thô làm sai tone nhẹ nhàng, không phán xét mà nội dung chăm da cần và có thể bị xếp vào quấy rối, bắt nạt.',
    fix: 'Đổi sang cách nói nhẹ hơn, hoặc bỏ.', src: SRC.cg },
  { id: 'brand', sev: 'warn', name: 'Xuất hiện thương hiệu khác',
    terms: ['la roche-posay', 'la roche posay', 'cerave', 'cetaphil', 'bioderma', 'some by mi', 'innisfree', 'the ordinary', 'garnier', 'senka', 'hada labo', 'neutrogena', 'eucerin', 'vichy', 'avène', 'avene', 'cocoon', 'klairs', "paula's choice", 'obagi', 'skin1004', 'anessa', 'sunplay', 'bioré', 'biore', 'nivea', "pond's", 'olay', "l'oréal", 'loreal', 'maybelline', "kiehl's", 'clinique', 'estée lauder', 'dior', 'chanel', 'gucci', 'louis vuitton', 'nike', 'adidas', 'coca-cola', 'pepsi', 'starbucks', 'highlands coffee', 'phúc long', 'shopee', 'lazada', 'tiki', 'tiktok shop', 'hasaki', 'guardian', 'watsons'],
    why: 'Tên hoặc logo thương hiệu khác xuất hiện mà không có thoả thuận có thể vi phạm quyền sở hữu trí tuệ, quy định quảng cáo so sánh, và bị coi là quảng cáo không công bố.',
    fix: 'Che logo, bỏ tên thương hiệu khỏi chữ và lời thoại. Nếu là đối tác có hợp đồng thì bỏ qua và bật nhãn nội dung thương mại.', src: SRC.cg },
  { id: 'diet', sev: 'block', name: 'Giảm cân nguy hiểm',
    terms: ['giảm cân cấp tốc', 'nhịn ăn', 'thải độc', 'detox cấp tốc'],
    why: 'TikTok không cho phép cổ xúy phương pháp giảm cân nguy hiểm, đặc biệt với người xem tuổi teen.',
    fix: 'Bỏ nội dung này khỏi video chăm da.', src: SRC.cg },
  { id: 'minorinfo', sev: 'warn', name: 'Thông tin cá nhân của học sinh',
    terms: [/trường\s+(?:thcs|thpt|tiểu học)\s+[\p{L}\d]+/u, /lớp\s+\d{1,2}[a-z]\d?/u],
    why: 'Nêu trường, lớp cụ thể của học sinh là chia sẻ thông tin cá nhân có thể gây hại.',
    fix: 'Chỉ ghi tên đầu hoặc biệt danh, bỏ trường và lớp.', src: SRC.cg },
  { id: 'contact', sev: 'tip', name: 'Kéo người xem ra ngoài TikTok',
    terms: ['zalo', 'inbox shop', 'ib shop', /(?:\+84|0)\d{9}/],
    why: 'Số điện thoại, Zalo có thể làm lộ thông tin cá nhân. Theo kinh nghiệm của người làm nội dung (TikTok chưa công bố chính thức), video kéo người xem ra ngoài thường được đề xuất ít hơn.',
    fix: 'Dẫn về tin nhắn của kênh hoặc link trong bio.', src: SRC.fyf },
  { id: 'commercial', sev: 'tip', name: 'Có yếu tố quảng bá',
    terms: ['mua ngay', 'giảm giá', 'mã giảm giá', 'freeship', 'link bio', 'đặt hàng', 'sale', 'voucher'],
    why: 'Video quảng bá sản phẩm hoặc thương hiệu phải bật cài đặt “Nội dung thương mại”.',
    fix: 'Đối chiếu với mục “Nhãn nội dung thương mại” trong checklist.', src: SRC.disc },
  { id: 'ai', sev: 'tip', name: 'Nhắc tới công cụ AI',
    terms: ['veo', 'gemini', 'seedance', 'kling', 'runway', 'midjourney', 'ai tạo', 'tạo bằng ai'],
    why: 'Nội dung AI mô tả người hoặc cảnh giống thật phải gắn nhãn AI.',
    fix: 'Đối chiếu với mục “Nhãn nội dung AI” trong checklist.', src: SRC.cg },
];

// Per-character strip keeps string length, so match indexes stay valid on the original text.
export const strip = (s) => [...s].map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').replace('đ', 'd')).join('');
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
const wrapB = (body) => new RegExp('(?<![\\p{L}\\p{N}])(?:' + body + ')(?![\\p{L}\\p{N}])', 'giu');
const COMPILED = RULES.map((r) => ({
  ...r,
  res: r.terms.map((t) => t instanceof RegExp ? new RegExp(t.source, 'giu')
    : { exact: wrapB(reEsc(t)), loose: t.trim().includes(' ') ? wrapB(reEsc(strip(t))) : null }),
}));

// Returns non-overlapping hits {rule, start, end}; plain terms match whole words, multi-word terms also without diacritics.
export function scan(text) {
  const src = text.normalize('NFC').toLowerCase(), loose = strip(src), hits = [];
  for (const r of COMPILED) for (const re of r.res) {
    const pairs = re instanceof RegExp ? [[re, src]] : [[re.exact, src], ...(re.loose ? [[re.loose, loose]] : [])];
    for (const [rx, hay] of pairs) for (const m of hay.matchAll(rx)) hits.push({ rule: r, start: m.index, end: m.index + m[0].length });
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end || RANK[a.rule.sev] - RANK[b.rule.sev]);
  let end = -1;
  return hits.filter((h) => h.start >= end && (end = h.end, true));
}

{
  const ids = (t) => scan(t).map((h) => h.rule.id);
  console.assert(ids('Trị mụn dứt điểm').includes('medical'), 'medical exact');
  console.assert(ids('tri mun dut diem').includes('medical'), 'medical without diacritics');
  console.assert(!ids('trí nhớ tốt').includes('medical'), 'single word not loose-matched');
  console.assert(ids('chỉ sau 7 ngày').includes('promise'), 'time promise');
  console.assert(!ids('sales').includes('commercial'), 'no partial word match');
  console.assert(scan('da xấu xí').length === 1, 'overlap collapsed');
  console.assert(ids('đm vcl thật').filter((i) => i === 'profanity').length === 2, 'profanity acronyms');
  console.assert(!ids('đeo kính, dmca').includes('profanity'), 'no profanity false hit');
  console.assert(ids('Dùng thử La Roche-Posay').includes('brand'), 'brand');
}
