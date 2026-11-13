/**
 * =========================================================================
 * GOOGLE APPS SCRIPT BACKEND CHO WEBSITE MMO FC (PHIÊN BẢN VÔ ĐỊCH - TỰ DÒ SHEET)
 * =========================================================================
 * Ưu điểm vượt trội:
 * 1. TỰ ĐỘNG TÌM ĐÚNG SHEET: Bất kể tab tên là "Kèo thi đấu", "Lịch thi đấu", 
 *    "Matches", "Cáp kèo", "Requests", "Trang tính 1"... script đều tự quét và nhận diện!
 * 2. TỰ ĐỘNG ĐỌC CỘT THÔNG MINH: Dù thứ tự cột trên Sheet của bạn sắp xếp thế nào,
 *    script tự tìm theo tên tiêu đề (Home, Away, SĐT, Ngày, Giờ...) không bao giờ bị lệch dữ liệu!
 * 3. BẢO VỆ DỮ LIỆU CŨ: Không bao giờ xóa hay làm mất danh sách kèo cọt cũ của bạn.
 * 4. ĐIỂM DANH THÔNG MINH: Tự động cập nhật dòng cũ nếu cầu thủ đổi ý.
 * =========================================================================
 */

// GMAIL NHẬN THÔNG BÁO KHI CÓ ĐỘI BẮT KÈO (Tùy chọn)
const ADMIN_NOTIFICATION_EMAIL = "";

// =========================================================================
// HÀM KHỞI TẠO BẢNG TỨC THÌ (CHỈ TẠO NẾU CHƯA CÓ)
// =========================================================================
function khoiTaoBang() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 0. Tab Matches (Lịch thi đấu chính của MMO FC)
  let matchSheet = ss.getSheetByName("Matches");
  if (!matchSheet) {
    matchSheet = ss.insertSheet("Matches");
    matchSheet.appendRow(["Ngày", "Giờ", "Đội Nhà", "Đội Khách", "Sân Thi Đấu", "Thể Thức", "Trạng Thái", "Bàn Thắng Nhà", "Bàn Thắng Khách", "Cầu Thủ Ghi Bàn"]);
    matchSheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#d71920").setFontColor("#ffffff");
    matchSheet.setFrozenRows(1);
    Logger.log("✓ Đã tạo tab: Matches");
  }

  // 1. Tab DiemDanh
  let attSheet = ss.getSheetByName("DiemDanh");
  if (!attSheet) {
    attSheet = ss.insertSheet("DiemDanh");
    attSheet.appendRow(["Thời Gian Cập Nhật", "Mã Trận Đấu", "Ngày Đá", "Đối Thủ", "Tên Cầu Thủ", "Trạng Thái"]);
    attSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#d71920").setFontColor("#ffffff");
    attSheet.setFrozenRows(1);
    Logger.log("✓ Đã tạo tab: DiemDanh");
  }

  // 2. Tab Requests (nếu chưa có bất kỳ tab kèo nào)
  const existingReqSheet = findRequestSheet(ss, null);
  if (!existingReqSheet) {
    let reqSheet = ss.insertSheet("Requests");
    reqSheet.appendRow(["Thời Gian Nhận", "Tên Đội Khách", "Số Điện Thoại", "Ngày Muốn Đá", "Sân Thi Đấu", "Ghi Chú", "Trạng Thái"]);
    reqSheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
    reqSheet.setFrozenRows(1);
    Logger.log("✓ Đã tạo tab: Requests");
  }

  // 3. Tab ThongKeCauThu
  let statsSheet = ss.getSheetByName("ThongKeCauThu");
  if (!statsSheet) {
    statsSheet = ss.insertSheet("ThongKeCauThu");
    statsSheet.appendRow(["STT", "Cầu Thủ", "Số Áo", "Vị Trí", "Trận Ra Sân", "Trận Vắng", "Tỉ Lệ Chuyên Cần (%)", "Bàn Thắng", "Cập Nhật Lúc"]);
    statsSheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#d71920").setFontColor("#ffffff");
    statsSheet.setFrozenRows(1);
    Logger.log("✓ Đã tạo tab: ThongKeCauThu");
  }

  // 4. Tab CauThu (Danh sách cầu thủ & link ảnh)
  let playerSheet = ss.getSheetByName("CauThu");
  if (!playerSheet) {
    playerSheet = ss.insertSheet("CauThu");
    playerSheet.appendRow(["Tên Cầu Thủ", "Số Áo", "Vị Trí", "Ảnh Đại Diện", "Bàn Thắng Khởi Điểm", "Trận Ra Sân Khởi Điểm", "Trận Vắng Khởi Điểm", "Ngày Thêm"]);
    playerSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#d71920").setFontColor("#ffffff");
    playerSheet.setFrozenRows(1);
    Logger.log("✓ Đã tạo tab: CauThu");
  }

  // 5. Tab PhongCup (Quản lý Cúp & Danh hiệu)
  let cupSheet = ss.getSheetByName("PhongCup");
  if (!cupSheet) {
    cupSheet = ss.insertSheet("PhongCup");
    cupSheet.appendRow(["Mã Cúp", "Tên Cúp / Giải Đấu", "Năm", "Loại", "Danh Hiệu", "Ảnh Cúp", "Mô Tả", "Số Trận", "Bàn Thắng", "Ngày Cập Nhật"]);
    cupSheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#eab308").setFontColor("#000000");
    cupSheet.setFrozenRows(1);
    Logger.log("✓ Đã tạo tab: PhongCup (Sạch sẽ - Chờ admin nhập cúp thật)");
  }

  // 6. Tab KhoanhKhac (Bộ sưu tập & Album ảnh gắn kết)
  let momentSheet = ss.getSheetByName("KhoanhKhac");
  if (!momentSheet) {
    momentSheet = ss.insertSheet("KhoanhKhac");
    momentSheet.appendRow(["Mã Khoảnh Khắc", "Tiêu Đề", "Ngày", "Chủ Đề", "Tên Chủ Đề", "Ảnh Bìa", "Album Ảnh (JSON)", "Địa Điểm", "Nội Dung / Lời Bình", "Ngày Cập Nhật"]);
    momentSheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#ff4757").setFontColor("#ffffff");
    momentSheet.setFrozenRows(1);
    Logger.log("✓ Đã tạo tab: KhoanhKhac (Sạch sẽ - Chờ admin nạp album thật)");
  }

  // 7. Tab CauHinh (Cấu hình ảnh bìa và hệ thống)
  let configSheet = ss.getSheetByName("CauHinh");
  if (!configSheet) {
    configSheet = ss.insertSheet("CauHinh");
    configSheet.appendRow(["Khoá Cấu Hình", "Giá Trị", "Mô Tả", "Cập Nhật Lúc"]);
    configSheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#0284c7").setFontColor("#ffffff");
    configSheet.setFrozenRows(1);
    configSheet.appendRow(["trophiesCover", "img/anh chinh.jpg", "Ảnh bìa Phòng Truyền Thống Cúp", "2026"]);
    configSheet.appendRow(["tacticsCover", "img/chinh3.jpg", "Ảnh bìa Sa Bàn Đội Hình", "2026"]);
    configSheet.appendRow(["matchdayCover", "img/chinh5.jpg", "Ảnh bìa Khoảnh Khắc Sân Cỏ", "2026"]);
    Logger.log("✓ Đã tạo tab: CauHinh");
  }

  // 8. Khởi tạo sẵn thư mục lưu ảnh trên Google Drive
  try {
    let folder;
    const folders = DriveApp.getFoldersByName("MMO_FC_Photos");
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder("MMO_FC_Photos");
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    Logger.log("✓ Đã kết nối thư mục Google Drive: MMO_FC_Photos");
    Logger.log("📂 Link xem thư mục ảnh trên Drive của bạn: " + folder.getUrl());
  } catch (driveErr) {
    Logger.log("Lưu ý quyền Google Drive: " + driveErr.toString());
  }

  Logger.log("==========================================");
  Logger.log("✓ KIỂM TRA HỆ THỐNG THÀNH CÔNG!");
  Logger.log("Các Sheet đang có trên file của bạn: " + ss.getSheets().map(s => s.getName()).join(", "));
  Logger.log("==========================================");
}

// =========================================================================
// 1. XỬ LÝ LẤY DỮ LIỆU (GET / JSONP) CHO WEBSITE & ADMIN
// =========================================================================
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. TỰ ĐỘNG TÌM ĐÚNG SHEET LỊCH THI ĐẤU
    const matchSheet = findMatchSheet(ss);
    const matchData = readMatchesFromSheet(matchSheet);

    // 2. TỰ ĐỘNG TÌM ĐÚNG SHEET YÊU CẦU CÁP KÈO (KÈO CỌT)
    const reqSheet = findRequestSheet(ss, matchSheet);
    const reqData = readRequestsFromSheet(reqSheet);

    // 3. LẤY DỮ LIỆU ĐIỂM DANH
    const attSheet = ss.getSheetByName("DiemDanh");
    const attData = readAttendanceFromSheet(attSheet);

    // 4. LẤY DANH SÁCH CẦU THỦ TỰ THÊM TỪ ADMIN (TAB CauThu)
    const customPlayers = readPlayersFromSheet(ss);

    // 5. TÍNH TOÁN BẢNG THỐNG KÊ CẦU THỦ
    const playerStats = computePlayerStats(matchData, attData);

    // 6. LẤY DANH SÁCH CÚP & KHOẢNH KHẮC & ẢNH BÌA
    const trophies = readTrophiesFromSheet(ss);
    const moments = readMomentsFromSheet(ss);
    const highlightsConfig = readHighlightsConfigFromSheet(ss);

    // Bảng debug danh sách sheet
    const allSheetNames = ss.getSheets().map(s => s.getName());

    const responsePayload = {
      success: true,
      debug: {
        allSheets: allSheetNames,
        matchSheet: matchSheet ? matchSheet.getName() : "None",
        requestSheet: reqSheet ? reqSheet.getName() : "None",
        playerSheet: ss.getSheetByName("CauThu") ? "CauThu" : "None"
      },
      matches: matchData,
      attendance: attData,
      requests: reqData,
      players: customPlayers,
      playerStats: playerStats,
      trophies: trophies,
      moments: moments,
      highlightsConfig: highlightsConfig
    };

    return outputJsonpOrJson(e, responsePayload);

  } catch (err) {
    const errPayload = {
      success: false,
      message: err.toString(),
      matches: [],
      attendance: [],
      requests: []
    };
    return outputJsonpOrJson(e, errPayload);
  }
}

// =========================================================================
// 2. XỬ LÝ GHI DỮ LIỆU (POST) TỪ WEBSITE & ADMIN
// =========================================================================
function doPost(e) {
  try {
    let data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    }

    const action = data.action || "";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ---------------------------------------------------------------------
    // A. ĐIỂM DANH RA SÂN THÔNG MINH
    // ---------------------------------------------------------------------
    if (action === "submit_attendance") {
      let sheet = ss.getSheetByName("DiemDanh");
      if (!sheet) {
        sheet = ss.insertSheet("DiemDanh");
        sheet.appendRow(["Thời Gian Cập Nhật", "Mã Trận Đấu", "Ngày Đá", "Đối Thủ", "Tên Cầu Thủ", "Trạng Thái"]);
        sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#d71920").setFontColor("#ffffff");
      }

      const playerName = String(data.playerName || "").trim();
      const matchKey = String(data.matchKey || "").trim();
      const matchDate = String(data.matchDate || "").trim();
      const matchOpponent = String(data.matchOpponent || "").trim();
      const status = String(data.status || "yes").trim();
      const now = new Date();

      if (!playerName) {
        return jsonResponse({ status: "error", message: "Thiếu tên cầu thủ" });
      }

      let isUpdated = false;
      const lastRow = sheet.getLastRow();

      if (lastRow > 1) {
        const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
        for (let i = 0; i < rows.length; i++) {
          const rowMatchKey = String(rows[i][1] || "").trim();
          const rowPlayer = String(rows[i][4] || "").trim();
          const rowDate = String(rows[i][2] || "").trim();

          const isSameMatch = (matchKey && rowMatchKey === matchKey) || (matchDate && rowDate === matchDate);
          const isSamePlayer = rowPlayer.toLowerCase() === playerName.toLowerCase();

          if (isSameMatch && isSamePlayer) {
            const targetRow = i + 2;
            sheet.getRange(targetRow, 1).setValue(now);
            sheet.getRange(targetRow, 6).setValue(status);
            isUpdated = true;
            break;
          }
        }
      }

      if (!isUpdated) {
        sheet.appendRow([now, matchKey, matchDate, matchOpponent, playerName, status]);
      }

      try {
        const currentMatches = readMatchesFromSheet(findMatchSheet(ss));
        const currentAtt = readAttendanceFromSheet(sheet);
        syncPlayerStatsSheet(ss, computePlayerStats(currentMatches, currentAtt));
      } catch (syncErr) {}

      return jsonResponse({
        status: "success",
        action: isUpdated ? "updated_existing" : "created_new",
        player: playerName,
        attendanceStatus: status
      });
    }

    // ---------------------------------------------------------------------
    // B. NHẬN KÈO THI ĐẤU TỪ ĐỘI KHÁCH
    // ---------------------------------------------------------------------
    if (action === "book_match") {
      let sheet = findRequestSheet(ss, findMatchSheet(ss));
      if (!sheet) {
        sheet = ss.insertSheet("Requests");
        sheet.appendRow(["Thời Gian Nhận", "Tên Đội Khách", "Số Điện Thoại", "Link Facebook", "Ngày Muốn Đá", "Khung Giờ", "Sân Thi Đấu", "Ghi Chú", "Trạng Thái"]);
        sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
        sheet.setFrozenRows(1);
      }

      const oppName = String(data.opponentName || "").trim();
      const oppPhone = String(data.opponentPhone || "").trim();
      const oppFb = String(data.opponentFb || data.facebook || data.fb || "").trim();
      const mDate = String(data.matchDate || "").trim();
      const mTime = String(data.matchTime || "19:00").trim();
      const pitch = String(data.pitch || "").trim();
      const note = String(data.note || "").trim();

      // Kiểm tra tiêu đề cột của sheet
      let lastCol = Math.max(sheet.getLastColumn(), 9);
      let headers = [];
      if (sheet.getLastRow() >= 1) {
        headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim().toLowerCase());
      }

      let fbCol = headers.findIndex(h => h.includes("fb") || h.includes("facebook"));
      let timeCol = headers.findIndex(h => h.includes("khung giờ") || h.includes("giờ đá") || (h.includes("giờ") && !h.includes("thời gian")));

      if (fbCol !== -1 || timeCol !== -1) {
        let newRow = new Array(headers.length).fill("");
        newRow[0] = new Date();
        let oppIdx = headers.findIndex(h => h.includes("tên") || h.includes("đội"));
        let phoneIdx = headers.findIndex(h => h.includes("thoại") || h.includes("sđt") || h.includes("phone"));
        let dateIdx = headers.findIndex(h => h.includes("ngày") && !h.includes("thời gian"));
        let pitchIdx = headers.findIndex(h => h.includes("sân") || h.includes("địa điểm"));
        let noteIdx = headers.findIndex(h => h.includes("ghi chú") || h.includes("note") || h.includes("lời nhắn"));
        let statusIdx = headers.findIndex(h => h.includes("trạng thái") || h.includes("status"));

        if (oppIdx !== -1) newRow[oppIdx] = oppName;
        if (phoneIdx !== -1) newRow[phoneIdx] = oppPhone;
        if (fbCol !== -1) newRow[fbCol] = oppFb;
        if (dateIdx !== -1) newRow[dateIdx] = mDate;
        if (timeCol !== -1) newRow[timeCol] = mTime;
        if (pitchIdx !== -1) newRow[pitchIdx] = pitch;
        if (noteIdx !== -1) newRow[noteIdx] = note;
        if (statusIdx !== -1) newRow[statusIdx] = "PENDING";
        sheet.appendRow(newRow);
      } else {
        sheet.appendRow([new Date(), oppName, oppPhone, oppFb, mDate, mTime, pitch, note, "PENDING"]);
      }

      if (ADMIN_NOTIFICATION_EMAIL && ADMIN_NOTIFICATION_EMAIL.includes("@")) {
        try {
          const subject = "🔥 [MMO FC] CÓ YÊU CẦU BẮT KÈO MỚI TỪ: " + oppName;
          const body = 
            "Chào Ban Quản Trị MMO FC,\n\n" +
            "Website vừa nhận được một yêu cầu cáp kèo mới:\n" +
            "• Đội bóng: " + oppName + "\n" +
            "• Số điện thoại: " + oppPhone + "\n" +
            "• Link Facebook: " + (oppFb || "Chưa cung cấp") + "\n" +
            "• Ngày đề xuất: " + mDate + "\n" +
            "• Khung giờ muốn đá: " + mTime + "\n" +
            "• Địa điểm / Sân: " + pitch + "\n" +
            "• Lời nhắn: " + note + "\n";
          MailApp.sendEmail(ADMIN_NOTIFICATION_EMAIL, subject, body);
        } catch (mailErr) {}
      }

      return jsonResponse({ status: "success", message: "Đã ghi nhận yêu cầu bắt kèo" });
    }

    // ---------------------------------------------------------------------
    // C. TẠO TRẬN ĐẤU MỚI (TỪ TRANG ADMIN) - TỰ ĐỘNG KHỚP CỘT THÔNG MINH
    // ---------------------------------------------------------------------
    if (action === "add_match" || action === "add_finished_match" || action === "create_match") {
      let sheet = findMatchSheet(ss);
      if (!sheet) {
        sheet = ss.insertSheet("Matches");
        sheet.appendRow(["Ngày", "Giờ", "Đội Nhà", "Đội Khách", "Sân Thi Đấu", "Thể Thức", "Trạng Thái", "Bàn Thắng Nhà", "Bàn Thắng Khách", "Cầu Thủ Ghi Bàn"]);
        sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#d71920").setFontColor("#ffffff");
        sheet.setFrozenRows(1);
      }

      // Đọc tiêu đề cột hiện có trên sheet của người dùng
      let lastCol = Math.max(sheet.getLastColumn(), 10);
      let headers = [];
      if (sheet.getLastRow() >= 1) {
        headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim().toLowerCase());
      }

      let dateIdx = headers.findIndex(h => h.includes("date") || h.includes("ngày"));
      let timeIdx = headers.findIndex(h => h.includes("time") || h.includes("giờ"));
      let homeIdx = headers.findIndex(h => h.includes("home") || h.includes("nhà") || h.includes("đội 1") || h.includes("mmo"));
      let awayIdx = headers.findIndex(h => h.includes("away") || h.includes("khách") || h.includes("đội 2") || h.includes("đối thủ"));
      let locIdx = headers.findIndex(h => h.includes("location") || h.includes("sân") || h.includes("địa điểm"));
      let tournIdx = headers.findIndex(h => h.includes("tourn") || h.includes("giải") || h.includes("thể thức"));
      let statusIdx = headers.findIndex(h => h.includes("status") || h.includes("trạng thái"));

      // Nếu sheet chưa có tiêu đề hoặc rỗng
      if (dateIdx === -1 && homeIdx === -1 && awayIdx === -1) {
        sheet.clear();
        sheet.appendRow(["Ngày", "Giờ", "Đội Nhà", "Đội Khách", "Sân Thi Đấu", "Thể Thức", "Trạng Thái", "Bàn Thắng Nhà", "Bàn Thắng Khách", "Cầu Thủ Ghi Bàn"]);
        sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#d71920").setFontColor("#ffffff");
        sheet.setFrozenRows(1);
        dateIdx = 0; timeIdx = 1; homeIdx = 2; awayIdx = 3; locIdx = 4; tournIdx = 5; statusIdx = 6;
      } else {
        if (dateIdx === -1) dateIdx = 0;
        if (timeIdx === -1) timeIdx = 1;
        if (homeIdx === -1) homeIdx = 2;
        if (awayIdx === -1) awayIdx = 3;
        if (locIdx === -1) locIdx = 4;
        if (tournIdx === -1) tournIdx = 5;
        if (statusIdx === -1) statusIdx = 6;
      }

      let homeScoreIdx = headers.findIndex(h => h.includes("nhà") && (h.includes("bàn") || h.includes("tỉ số") || h.includes("score")));
      if (homeScoreIdx === -1) homeScoreIdx = 7;
      let awayScoreIdx = headers.findIndex(h => h.includes("khách") && (h.includes("bàn") || h.includes("tỉ số") || h.includes("score")));
      if (awayScoreIdx === -1) awayScoreIdx = 8;
      let scorersIdx = headers.findIndex(h => h.includes("ghi bàn") || h.includes("cầu thủ") || h.includes("scorer"));
      if (scorersIdx === -1) scorersIdx = 9;

      const totalCols = Math.max(lastCol, 10);
      const newRow = new Array(totalCols).fill("");
      newRow[dateIdx] = data.Date || "";
      newRow[timeIdx] = data.Time || "";
      newRow[homeIdx] = data.Home || "MMO FC";
      newRow[awayIdx] = data.Away || "Đối thủ";
      newRow[locIdx] = data.Location || "";
      newRow[tournIdx] = data.Tournament || "Giao hữu";

      const isFinished = (data.Status && String(data.Status).toUpperCase() === "FINISHED") || (data.HomeScore !== undefined && data.AwayScore !== undefined && String(data.HomeScore) !== "");
      newRow[statusIdx] = isFinished ? "FINISHED" : "UPCOMING";
      if (isFinished) {
        newRow[homeScoreIdx] = data.HomeScore || "0";
        newRow[awayScoreIdx] = data.AwayScore || "0";
        newRow[scorersIdx] = data.Scorers || "";
      }

      sheet.appendRow(newRow);

      if (isFinished) {
        try {
          const currentMatches = readMatchesFromSheet(sheet);
          const currentAtt = readAttendanceFromSheet(ss.getSheetByName("DiemDanh"));
          syncPlayerStatsSheet(ss, computePlayerStats(currentMatches, currentAtt));
        } catch (syncErr) {}
      }

      return jsonResponse({ status: "success", message: isFinished ? "Đã thêm kết quả trận đã đấu vào Google Sheet" : "Đã thêm trận đấu mới vào đúng cột" });
    }

    // ---------------------------------------------------------------------
    // D. KẾT THÚC TRẬN ĐẤU & CẬP NHẬT TỈ SỐ (TỪ TRANG ADMIN)
    // ---------------------------------------------------------------------
    if (action === "finish_match") {
      let sheet = findMatchSheet(ss);
      if (!sheet) return jsonResponse({ status: "error", message: "Không tìm thấy sheet trận đấu" });

      const lastRow = sheet.getLastRow();
      const lastCol = Math.max(sheet.getLastColumn(), 10);
      const sheetRows = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      const headers = sheetRows[0].map(h => String(h || "").trim().toLowerCase());

      let homeIdx = headers.findIndex(h => h.includes("home") || h.includes("nhà") || h.includes("đội 1") || h.includes("mmo"));
      let awayIdx = headers.findIndex(h => h.includes("away") || h.includes("khách") || h.includes("đội 2") || h.includes("đối thủ"));
      let dateIdx = headers.findIndex(h => h.includes("date") || h.includes("ngày"));
      let timeIdx = headers.findIndex(h => h.includes("time") || h.includes("giờ"));
      let locIdx = headers.findIndex(h => h.includes("location") || h.includes("sân") || h.includes("địa điểm"));
      let tournIdx = headers.findIndex(h => h.includes("tourn") || h.includes("giải") || h.includes("thể thức"));
      let statusIdx = headers.findIndex(h => h.includes("status") || h.includes("trạng thái"));
      let homeScoreIdx = headers.findIndex(h => h.includes("homescore") || h.includes("bàn nhà") || h.includes("tỉ số nhà"));
      let awayScoreIdx = headers.findIndex(h => h.includes("awayscore") || h.includes("bàn khách") || h.includes("tỉ số khách"));
      let scorersIdx = headers.findIndex(h => h.includes("scorer") || h.includes("ghi bàn") || h.includes("cầu thủ ghi bàn"));

      if (homeIdx === -1) homeIdx = 0;
      if (awayIdx === -1) awayIdx = 1;
      if (dateIdx === -1) dateIdx = 2;
      if (timeIdx === -1) timeIdx = 3;
      if (locIdx === -1) locIdx = 4;
      if (tournIdx === -1) tournIdx = 5;
      if (statusIdx === -1) {
        statusIdx = 6;
        try { sheet.getRange(1, 7).setValue("Trạng Thái").setFontWeight("bold"); } catch (e) {}
      }
      if (homeScoreIdx === -1) {
        homeScoreIdx = 7;
        try { sheet.getRange(1, 8).setValue("Bàn Thắng Nhà").setFontWeight("bold"); } catch (e) {}
      }
      if (awayScoreIdx === -1) {
        awayScoreIdx = 8;
        try { sheet.getRange(1, 9).setValue("Bàn Thắng Khách").setFontWeight("bold"); } catch (e) {}
      }
      if (scorersIdx === -1) {
        scorersIdx = 9;
        try { sheet.getRange(1, 10).setValue("Cầu Thủ Ghi Bàn").setFontWeight("bold"); } catch (e) {}
      }

      const targetHome = String(data.Home || "MMO FC").trim().toLowerCase();
      const targetAway = String(data.Away || "").trim().toLowerCase();
      const targetDate = String(data.Date || "").trim().toLowerCase();

      let targetRowIndex = -1;

      if (lastRow > 1) {
        for (let i = 1; i < sheetRows.length; i++) {
          const row = sheetRows[i];
          const rHome = String(row[homeIdx] || "").trim().toLowerCase();
          const rAway = String(row[awayIdx] || "").trim().toLowerCase();
          const rDateRaw = String(row[dateIdx] || "").trim().toLowerCase();
          const rDateFormatted = safeFormatDate(row[dateIdx], "dd/MM/yyyy").toLowerCase();

          const isAwayMatch = targetAway && (rAway.includes(targetAway) || targetAway.includes(rAway));
          const isDateMatch = targetDate && (rDateRaw.includes(targetDate) || targetDate.includes(rDateRaw) || rDateFormatted === targetDate);

          if ((rHome && targetHome && isAwayMatch) || (isAwayMatch && isDateMatch) || isAwayMatch) {
            targetRowIndex = i + 1;
            break;
          }
        }
      }

      // Thử tìm theo ngày nếu chưa khớp
      if (targetRowIndex === -1 && targetDate && lastRow > 1) {
        for (let i = 1; i < sheetRows.length; i++) {
          const row = sheetRows[i];
          const rDateRaw = String(row[dateIdx] || "").trim().toLowerCase();
          const rDateFormatted = safeFormatDate(row[dateIdx], "dd/MM/yyyy").toLowerCase();
          if (rDateRaw.includes(targetDate) || targetDate.includes(rDateRaw) || rDateFormatted === targetDate) {
            targetRowIndex = i + 1;
            break;
          }
        }
      }

      if (targetRowIndex !== -1) {
        sheet.getRange(targetRowIndex, statusIdx + 1).setValue("FINISHED");
        sheet.getRange(targetRowIndex, homeScoreIdx + 1).setValue(data.HomeScore || "0");
        sheet.getRange(targetRowIndex, awayScoreIdx + 1).setValue(data.AwayScore || "0");
        sheet.getRange(targetRowIndex, scorersIdx + 1).setValue(data.Scorers || "");
      } else {
        // Nếu chưa có dòng này trên sheet, tự động thêm mới vào để không bao giờ bị mất dữ liệu
        sheet.appendRow([
          data.Home || "MMO FC",
          data.Away || "Đối thủ",
          data.Date || "",
          data.Time || "",
          data.Location || "Sân bóng",
          data.Tournament || "Giao hữu",
          "FINISHED",
          data.HomeScore || "0",
          data.AwayScore || "0",
          data.Scorers || ""
        ]);
        targetRowIndex = sheet.getLastRow();
      }

      try {
        const currentMatches = readMatchesFromSheet(sheet);
        const currentAtt = readAttendanceFromSheet(ss.getSheetByName("DiemDanh"));
        syncPlayerStatsSheet(ss, computePlayerStats(currentMatches, currentAtt));
      } catch (syncErr) {}

      return jsonResponse({
        status: "success",
        message: "Đã cập nhật tỉ số & bàn thắng thành công",
        rowIndex: targetRowIndex,
        scorers: data.Scorers || ""
      });
    }

    // ---------------------------------------------------------------------
    // D2. XÓA TRẬN ĐẤU (TỪ TRANG ADMIN)
    // ---------------------------------------------------------------------
    if (action === "delete_match") {
      let sheet = findMatchSheet(ss);
      if (!sheet) return jsonResponse({ status: "error", message: "Không tìm thấy sheet trận đấu" });

      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return jsonResponse({ status: "success", message: "Sheet chưa có trận đấu nào" });

      const lastCol = Math.max(sheet.getLastColumn(), 10);
      const sheetRows = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      const headers = sheetRows[0].map(h => String(h || "").trim().toLowerCase());

      let homeIdx = headers.findIndex(h => h.includes("home") || h.includes("nhà") || h.includes("đội 1") || h.includes("mmo"));
      let awayIdx = headers.findIndex(h => h.includes("away") || h.includes("khách") || h.includes("đội 2") || h.includes("đối thủ"));
      let dateIdx = headers.findIndex(h => h.includes("date") || h.includes("ngày"));

      if (homeIdx === -1) homeIdx = 0;
      if (awayIdx === -1) awayIdx = 1;
      if (dateIdx === -1) dateIdx = 2;

      const targetHome = String(data.Home || "").trim().toLowerCase();
      const targetAway = String(data.Away || "").trim().toLowerCase();
      const targetDate = String(data.Date || "").trim().toLowerCase();

      let deletedRowsCount = 0;
      // Duyệt ngược từ dưới lên để xoá dòng an toàn không làm lệch thứ tự dòng
      for (let i = sheetRows.length - 1; i >= 1; i--) {
        const row = sheetRows[i];
        const rHome = String(row[homeIdx] || "").trim().toLowerCase();
        const rAway = String(row[awayIdx] || "").trim().toLowerCase();
        const rDateRaw = String(row[dateIdx] || "").trim().toLowerCase();
        const rDateFormatted = safeFormatDate(row[dateIdx], "dd/MM/yyyy").toLowerCase();

        const isAwayMatch = targetAway && (rAway.includes(targetAway) || targetAway.includes(rAway));
        const isDateMatch = targetDate && (rDateRaw.includes(targetDate) || targetDate.includes(rDateRaw) || rDateFormatted === targetDate);
        const isHomeMatch = targetHome && (rHome.includes(targetHome) || targetHome.includes(rHome));

        if ((isAwayMatch && isDateMatch) || (isHomeMatch && isAwayMatch) || (isAwayMatch && !targetDate)) {
          sheet.deleteRow(i + 1);
          deletedRowsCount++;
        }
      }

      try {
        const currentMatches = readMatchesFromSheet(sheet);
        const currentAtt = readAttendanceFromSheet(ss.getSheetByName("DiemDanh"));
        syncPlayerStatsSheet(ss, computePlayerStats(currentMatches, currentAtt));
      } catch (syncErr) {}

      return jsonResponse({
        status: "success",
        message: "Đã xóa trận đấu thành công khỏi Google Sheet",
        deletedCount: deletedRowsCount
      });
    }

    // ---------------------------------------------------------------------
    // E. CẬP NHẬT TRẠNG THÁI YÊU CẦU CÁP KÈO (TỪ TRANG ADMIN)
    // ---------------------------------------------------------------------
    if (action === "update_request_status") {
      let sheet = findRequestSheet(ss, findMatchSheet(ss));
      if (sheet) {
        const rowId = parseInt(data.rowId, 10);
        if (rowId && rowId > 0 && rowId < sheet.getLastRow()) {
          let statusCol = 7;
          if (sheet.getLastColumn() >= 1) {
            const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || "").trim().toLowerCase());
            const sIdx = headers.findIndex(h => h.includes("trạng thái") || h.includes("status"));
            if (sIdx !== -1) statusCol = sIdx + 1;
          }
          sheet.getRange(rowId + 1, statusCol).setValue(data.status || "PENDING");
          return jsonResponse({ status: "success", message: "Đã cập nhật trạng thái yêu cầu" });
        }
      }
      return jsonResponse({ status: "error", message: "Không tìm thấy yêu cầu cần sửa" });
    }

    // ---------------------------------------------------------------------
    // E2. TỪ CHỐI & XÓA HẲN YÊU CẦU CÁP KÈO (TỪ TRANG ADMIN)
    // ---------------------------------------------------------------------
    if (action === "delete_request") {
      let sheet = findRequestSheet(ss, findMatchSheet(ss));
      if (sheet) {
        const rowId = parseInt(data.rowId, 10);
        if (rowId && rowId > 0 && rowId < sheet.getLastRow()) {
          sheet.deleteRow(rowId + 1);
          return jsonResponse({ status: "success", message: "Đã xóa vĩnh viễn yêu cầu cáp kèo khỏi danh sách" });
        }
      }
      return jsonResponse({ status: "error", message: "Không tìm thấy yêu cầu cần xóa" });
    }

    // ---------------------------------------------------------------------
    // F. THÊM THÀNH VIÊN / CẦU THỦ MỚI (TỪ TRANG ADMIN)
    // ---------------------------------------------------------------------
    if (action === "add_player") {
      let sheet = ss.getSheetByName("CauThu");
      if (!sheet) {
        sheet = ss.insertSheet("CauThu");
        sheet.appendRow(["Tên Cầu Thủ", "Số Áo", "Vị Trí", "Ảnh Đại Diện", "Bàn Thắng Khởi Điểm", "Trận Ra Sân Khởi Điểm", "Trận Vắng Khởi Điểm", "Ngày Thêm"]);
        sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#d71920").setFontColor("#ffffff");
        sheet.setFrozenRows(1);
      }

      const pName = String(data.name || "").trim();
      const pNum = String(data.num || "#").trim();
      const pPos = String(data.pos || "Cầu thủ").trim();
      let pPhoto = String(data.photo || "").trim();
      const pGoals = parseInt(data.baseGoals, 10) || 0;
      const pAttended = parseInt(data.baseAttended, 10) || 0;
      const pAbsent = parseInt(data.baseAbsent, 10) || 0;

      if (!pName) {
        return jsonResponse({ status: "error", message: "Thiếu tên cầu thủ" });
      }

      // TỰ ĐỘNG LƯU FILE ẢNH VÀO GOOGLE DRIVE VÀ TẠO LINK TRỰC TIẾP
      if (data.photoBase64) {
        try {
          const drivePhotoUrl = saveImageToDrive(data.photoBase64, (pName.replace(/\s+/g, "_") + "_" + Date.now() + ".jpg"), data.photoMime);
          if (drivePhotoUrl) {
            pPhoto = drivePhotoUrl;
          }
        } catch (driveErr) {
          Logger.log("Lỗi lưu ảnh Drive: " + driveErr.toString());
        }
      } else if (pPhoto && pPhoto.indexOf("drive.google.com") !== -1) {
        // Tự động nhận diện nếu người dùng dán link chia sẻ Google Drive
        const fileMatch = pPhoto.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || pPhoto.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileMatch && fileMatch[1]) {
          pPhoto = "https://drive.google.com/thumbnail?id=" + fileMatch[1] + "&sz=w1000";
        }
      }

      sheet.appendRow([
        pName,
        pNum,
        pPos,
        pPhoto,
        pGoals,
        pAttended,
        pAbsent,
        Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy")
      ]);

      try {
        const currentMatches = readMatchesFromSheet(findMatchSheet(ss));
        const currentAtt = readAttendanceFromSheet(ss.getSheetByName("DiemDanh"));
        syncPlayerStatsSheet(ss, computePlayerStats(currentMatches, currentAtt));
      } catch (syncErr) {}

      return jsonResponse({
        status: "success",
        message: "Đã thêm cầu thủ " + pName + " vào hệ thống MMO FC",
        photoUrl: pPhoto,
        player: { name: pName, num: pNum, pos: pPos, photo: pPhoto }
      });
    }

    // ---------------------------------------------------------------------
    // G. XÓA CẦU THỦ KHỎI ĐỘI BÓNG (TỪ TRANG ADMIN)
    // ---------------------------------------------------------------------
    if (action === "delete_player") {
      let sheet = ss.getSheetByName("CauThu");
      const targetName = String(data.name || "").trim().toLowerCase();
      let isDeleted = false;

      if (sheet && sheet.getLastRow() > 1 && targetName) {
        const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
        for (let i = 0; i < rows.length; i++) {
          if (String(rows[i][0] || "").trim().toLowerCase() === targetName) {
            sheet.deleteRow(i + 2);
            isDeleted = true;
            break;
          }
        }
      }

      try {
        const currentMatches = readMatchesFromSheet(findMatchSheet(ss));
        const currentAtt = readAttendanceFromSheet(ss.getSheetByName("DiemDanh"));
        syncPlayerStatsSheet(ss, computePlayerStats(currentMatches, currentAtt));
      } catch (syncErr) {}

      return jsonResponse({
        status: isDeleted ? "success" : "not_found",
        message: isDeleted ? "Đã xóa cầu thủ khỏi danh sách" : "Không tìm thấy cầu thủ trên sheet"
      });
    }

    // ---------------------------------------------------------------------
    // G2. CHỈNH SỬA THÔNG TIN CẦU THỦ (EDIT PLAYER - CRUD ĐẦY ĐỦ)
    // ---------------------------------------------------------------------
    if (action === "edit_player") {
      let sheet = ss.getSheetByName("CauThu");
      if (!sheet) {
        sheet = ss.insertSheet("CauThu");
        sheet.appendRow(["Tên Cầu Thủ", "Số Áo", "Vị Trí", "Ảnh Đại Diện", "Bàn Thắng Khởi Điểm", "Trận Ra Sân Khởi Điểm", "Trận Vắng Khởi Điểm", "Ngày Thêm"]);
        sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#d71920").setFontColor("#ffffff");
        sheet.setFrozenRows(1);
      }

      const oldName = String(data.oldName || data.name || "").trim().toLowerCase();
      const newName = String(data.name || "").trim();
      const newNum = String(data.num || "#").trim();
      const newPos = String(data.pos || "Cầu thủ MMO FC").trim();
      let newPhoto = String(data.photo || "").trim();
      const newGoals = parseInt(data.baseGoals, 10) || 0;
      const newAttended = parseInt(data.baseAttended, 10) || 0;
      const newAbsent = parseInt(data.baseAbsent, 10) || 0;

      if (data.photoBase64) {
        try {
          const driveUrl = saveImageToDrive(data.photoBase64, (newName.replace(/\s+/g, "_") + "_" + Date.now() + ".jpg"), data.photoMime);
          if (driveUrl) newPhoto = driveUrl;
        } catch (e) {
          Logger.log("Lỗi lưu ảnh edit_player: " + e.toString());
        }
      } else if (newPhoto && newPhoto.indexOf("drive.google.com") !== -1) {
        const fileMatch = newPhoto.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || newPhoto.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileMatch && fileMatch[1]) {
          newPhoto = "https://drive.google.com/thumbnail?id=" + fileMatch[1] + "&sz=w1000";
        }
      }

      let isUpdated = false;
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const rows = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (let i = 0; i < rows.length; i++) {
          if (String(rows[i][0] || "").trim().toLowerCase() === oldName) {
            const rowIdx = i + 2;
            sheet.getRange(rowIdx, 1).setValue(newName);
            sheet.getRange(rowIdx, 2).setValue(newNum);
            sheet.getRange(rowIdx, 3).setValue(newPos);
            sheet.getRange(rowIdx, 4).setValue(newPhoto);
            sheet.getRange(rowIdx, 5).setValue(newGoals);
            sheet.getRange(rowIdx, 6).setValue(newAttended);
            sheet.getRange(rowIdx, 7).setValue(newAbsent);
            isUpdated = true;
            break;
          }
        }
      }

      if (!isUpdated && newName) {
        sheet.appendRow([
          newName,
          newNum,
          newPos,
          newPhoto,
          newGoals,
          newAttended,
          newAbsent,
          Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy")
        ]);
      }

      try {
        const currentMatches = readMatchesFromSheet(findMatchSheet(ss));
        const currentAtt = readAttendanceFromSheet(ss.getSheetByName("DiemDanh"));
        syncPlayerStatsSheet(ss, computePlayerStats(currentMatches, currentAtt));
      } catch (syncErr) {}

      return jsonResponse({
        status: "success",
        message: "Đã cập nhật cầu thủ " + newName,
        player: { name: newName, num: newNum, pos: newPos, photo: newPhoto, baseGoals: newGoals, baseAttended: newAttended }
      });
    }

    // ---------------------------------------------------------------------
    // H. CẬP NHẬT ẢNH CHO CẦU THỦ VÀO GOOGLE DRIVE
    // ---------------------------------------------------------------------
    if (action === "update_player_photo") {
      let sheet = ss.getSheetByName("CauThu");
      if (!sheet) {
        sheet = ss.insertSheet("CauThu");
        sheet.appendRow(["Tên Cầu Thủ", "Số Áo", "Vị Trí", "Ảnh Đại Diện", "Bàn Thắng Khởi Điểm", "Trận Ra Sân Khởi Điểm", "Trận Vắng Khởi Điểm", "Ngày Thêm"]);
        sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#d71920").setFontColor("#ffffff");
        sheet.setFrozenRows(1);
      }

      const rawName = String(data.name || "").trim();
      const pName = rawName.toLowerCase();
      let newPhotoUrl = String(data.photo || "").trim();

      if (data.photoBase64) {
        try {
          const driveUrl = saveImageToDrive(data.photoBase64, (rawName.replace(/\s+/g, "_") + "_" + Date.now() + ".jpg"), data.photoMime);
          if (driveUrl) newPhotoUrl = driveUrl;
        } catch (e) {
          Logger.log("Lỗi lưu ảnh update_player_photo: " + e.toString());
        }
      } else if (newPhotoUrl && newPhotoUrl.indexOf("drive.google.com") !== -1) {
        // Tự động nhận diện nếu người dùng dán link chia sẻ Google Drive
        const fileMatch = newPhotoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || newPhotoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileMatch && fileMatch[1]) {
          newPhotoUrl = "https://drive.google.com/thumbnail?id=" + fileMatch[1] + "&sz=w1000";
        }
      }

      if (rawName && newPhotoUrl) {
        const lastRow = sheet.getLastRow();
        let found = false;
        if (lastRow > 1) {
          const rows = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
          for (let i = 0; i < rows.length; i++) {
            if (String(rows[i][0] || "").trim().toLowerCase() === pName) {
              sheet.getRange(i + 2, 4).setValue(newPhotoUrl);
              found = true;
              break;
            }
          }
        }
        if (!found) {
          sheet.appendRow([
            rawName,
            data.num || "#",
            data.pos || "Cầu thủ MMO FC",
            newPhotoUrl,
            0, 0, 0,
            Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy")
          ]);
        }
      }

      return jsonResponse({ status: "success", photoUrl: newPhotoUrl, name: rawName });
    }

    // ---------------------------------------------------------------------
    // I. ĐỒNG BỘ / LƯU PHÒNG TRUYỀN THỐNG CÚP & DANH HIỆU (TROPHY ROOM)
    // ---------------------------------------------------------------------
    if (action === "sync_trophies" || action === "save_trophies") {
      const list = data.trophies || [];
      saveTrophiesToSheet(ss, list);
      return jsonResponse({ status: "success", count: list.length, message: "Đã lưu danh sách cúp lên Google Sheet" });
    }

    // ---------------------------------------------------------------------
    // J. ĐỒNG BỘ / LƯU KHOẢNH KHẮC & ALBUM GẮN KẾT (BROTHERHOOD GALLERY)
    // ---------------------------------------------------------------------
    if (action === "sync_moments" || action === "save_moments") {
      const list = data.moments || [];
      saveMomentsToSheet(ss, list);
      return jsonResponse({ status: "success", count: list.length, message: "Đã lưu danh sách khoảnh khắc lên Google Sheet" });
    }

    // ---------------------------------------------------------------------
    // K. LƯU ẢNH BÌA 3 MỤC HIGHLIGHTS
    // ---------------------------------------------------------------------
    if (action === "save_highlights_covers") {
      saveHighlightsConfigToSheet(ss, data);
      return jsonResponse({ status: "success", message: "Đã lưu 3 ảnh bìa lên Google Sheet" });
    }

    return jsonResponse({ status: "error", message: "Action không hợp lệ: " + action });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// =========================================================================
// CÁC HÀM TÌM SHEET & ĐỌC DỮ LIỆU ĐA NĂNG
// =========================================================================

// 1. Tự động nhận diện Sheet Trận đấu
function findMatchSheet(ss) {
  const allSheets = ss.getSheets();
  
  // 1. Tên ưu tiên tuyệt đối (nếu đã có tab tên Matches hoặc Lịch thi đấu thì dùng ngay)
  const priority = ["Matches", "LichThiDau", "Lịch thi đấu", "Lịch Thi Đấu", "TranDau", "Trận đấu"];
  for (let i = 0; i < priority.length; i++) {
    let s = ss.getSheetByName(priority[i]);
    if (s) return s;
  }

  // 2. Quét header tìm sheet có cột Home / Away / Ngày / Giờ
  for (let i = 0; i < allSheets.length; i++) {
    const s = allSheets[i];
    const sName = s.getName().trim().toLowerCase();
    if (sName === "diemdanh" || sName === "attendance" || sName === "requests" || sName === "thongkecauthu" || sName === "cauthu" || sName.includes("guide")) continue;
    if (s.getLastRow() >= 1 && s.getLastColumn() >= 2) {
      const hRow = s.getRange(1, 1, 1, Math.min(s.getLastColumn(), 10)).getValues()[0].map(c => String(c).toLowerCase());
      if (hRow.some(h => h.includes("home") || h.includes("away") || h.includes("nhà") || h.includes("khách") || h.includes("đối thủ") || h.includes("mmo") || h.includes("ngày") || h.includes("date"))) {
        return s;
      }
    }
  }

  // 3. Ưu tiên tab Kèo Thi Đấu nếu có
  let keoSheet = ss.getSheetByName("Kèo Thi Đấu") || ss.getSheetByName("Kèo thi đấu") || ss.getSheetByName("Kèo");
  if (keoSheet) return keoSheet;

  // 4. Fallback: sheet nhiều dòng nhất trừ DiemDanh, Requests, ThongKeCauThu, CauThu, Guide
  let maxRows = 0;
  let best = null;
  for (let i = 0; i < allSheets.length; i++) {
    const s = allSheets[i];
    const sName = s.getName().trim().toLowerCase();
    if (sName !== "diemdanh" && sName !== "attendance" && sName !== "requests" && sName !== "thongkecauthu" && sName !== "cauthu" && !sName.includes("guide")) {
      if (s.getLastRow() > maxRows) {
        maxRows = s.getLastRow();
        best = s;
      }
    }
  }
  return best || allSheets[0];
}

// 2. Tự động nhận diện Sheet Yêu cầu cáp kèo
function findRequestSheet(ss, matchSheet) {
  const allSheets = ss.getSheets();
  const matchSheetName = matchSheet ? matchSheet.getName().toLowerCase() : "";

  const priority = ["Requests", "YeuCauCapKeo", "Cáp kèo", "CapKeo", "Yêu cầu", "Đăng ký"];
  for (let i = 0; i < priority.length; i++) {
    let s = ss.getSheetByName(priority[i]);
    if (s && s.getName().toLowerCase() !== matchSheetName) return s;
  }

  // Quét header tìm cột Phone / SĐT
  for (let i = 0; i < allSheets.length; i++) {
    const s = allSheets[i];
    const sName = s.getName().trim().toLowerCase();
    if (sName === "diemdanh" || sName === "attendance" || sName === matchSheetName || sName === "matches") continue;
    if (s.getLastRow() >= 1 && s.getLastColumn() >= 2) {
      const hRow = s.getRange(1, 1, 1, Math.min(s.getLastColumn(), 10)).getValues()[0].map(c => String(c).toLowerCase());
      if (hRow.some(h => h.includes("sđt") || h.includes("phone") || h.includes("thoại") || h.includes("zalo") || h.includes("đội khách"))) {
        return s;
      }
    }
  }

  return ss.getSheetByName("Requests");
}

// 3. Đọc dữ liệu Trận đấu động theo Header & Tự động sửa lỗi lệch cột
function readMatchesFromSheet(sheet) {
  if (!sheet || sheet.getLastRow() <= 1 || sheet.getLastColumn() < 1) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 10);
  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = data[0].map(h => String(h || "").trim().toLowerCase());

  let dateIdx = headers.findIndex(h => h.includes("date") || h.includes("ngày"));
  let timeIdx = headers.findIndex(h => h.includes("time") || h.includes("giờ"));
  let homeIdx = headers.findIndex(h => h.includes("home") || h.includes("nhà") || h.includes("đội 1") || h.includes("mmo"));
  let awayIdx = headers.findIndex(h => h.includes("away") || h.includes("khách") || h.includes("đội 2") || h.includes("đối thủ"));
  let locIdx = headers.findIndex(h => h.includes("location") || h.includes("sân") || h.includes("địa điểm"));
  let tournIdx = headers.findIndex(h => h.includes("tourn") || h.includes("giải") || h.includes("thể thức"));
  let statusIdx = headers.findIndex(h => h.includes("status") || h.includes("trạng thái"));
  let homeScoreIdx = headers.findIndex(h => h.includes("homescore") || h.includes("bàn nhà") || h.includes("tỉ số nhà"));
  let awayScoreIdx = headers.findIndex(h => h.includes("awayscore") || h.includes("bàn khách") || h.includes("tỉ số khách"));
  let scorersIdx = headers.findIndex(h => h.includes("scorer") || h.includes("ghi bàn") || h.includes("cầu thủ ghi bàn"));

  // Mặc định chuẩn bóng đá phong trào: Ngày(0), Giờ(1), Đội Nhà(2), Đội Khách(3)
  if (dateIdx === -1) dateIdx = 0;
  if (timeIdx === -1) timeIdx = 1;
  if (homeIdx === -1) homeIdx = 2;
  if (awayIdx === -1) awayIdx = 3;
  if (locIdx === -1) locIdx = 4;
  if (tournIdx === -1) tournIdx = 5;
  if (statusIdx === -1) statusIdx = 6;
  if (homeScoreIdx === -1) homeScoreIdx = 7;
  if (awayScoreIdx === -1) awayScoreIdx = 8;
  if (scorersIdx === -1) scorersIdx = 9;

  const matches = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    let home = String(row[homeIdx] || "").trim();
    let away = String(row[awayIdx] || "").trim();
    let rawDate = row[dateIdx];
    let rawTime = row[timeIdx];

    // PHÁT HIỆN TỰ ĐỘNG & SỬA LỖI NẾU CỘT BỊ ĐẢO (AUTO-HEAL)
    // Dấu hiệu đảo: home/away chứa Date/GMT/1899 hoặc rawDate/rawTime chứa "MMO" / "FC" / "CLB"
    const isHomeDate = (home && (home.includes("GMT") || home.includes("1899") || home.includes("2026") || (row[homeIdx] instanceof Date)));
    const isDateTeam = (rawDate && (String(rawDate).toUpperCase().includes("MMO") || String(rawDate).toUpperCase().includes("FC") || String(rawDate).toUpperCase().includes("CLB")));
    const isAwayTime = (away && (away.includes("GMT") || away.includes("1899") || (row[awayIdx] instanceof Date)));
    const isTimeTeam = (rawTime && (String(rawTime).toUpperCase().includes("FC") || String(rawTime).toUpperCase().includes("CLB") || String(rawTime).toUpperCase().includes("ĐỘI")));

    if (isHomeDate || isDateTeam || isAwayTime || isTimeTeam) {
      // Đảo lại cho chuẩn: Đội nhà lấy từ rawDate, Đội khách lấy từ rawTime
      const correctedHome = String(rawDate || "").trim();
      const correctedAway = String(rawTime || "").trim();
      rawDate = row[homeIdx];
      rawTime = row[awayIdx];
      home = correctedHome || "MMO FC";
      away = correctedAway || "Đối thủ";
    }

    if (home || away || rawDate) {
      matches.push({
        Home: home || "MMO FC",
        Away: away || "Chưa có đối thủ",
        Date: safeFormatDate(rawDate, "dd/MM/yyyy"),
        Time: safeFormatTime(rawTime),
        Location: String(row[locIdx] || "").trim(),
        Tournament: String(row[tournIdx] || "Giao hữu").trim(),
        Status: String(row[statusIdx] || "UPCOMING").trim().toUpperCase(),
        HomeScore: row[homeScoreIdx] !== "" && row[homeScoreIdx] !== undefined ? String(row[homeScoreIdx]) : "",
        AwayScore: row[awayScoreIdx] !== "" && row[awayScoreIdx] !== undefined ? String(row[awayScoreIdx]) : "",
        Scorers: String(row[scorersIdx] || "").trim()
      });
    }
  }
  return matches;
}

// 4. Đọc dữ liệu Yêu cầu cáp kèo động theo Header
function readRequestsFromSheet(sheet) {
  if (!sheet || sheet.getLastRow() <= 1 || sheet.getLastColumn() < 1) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 10);
  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = data[0].map(h => String(h || "").trim().toLowerCase());

  let timeIdx = headers.findIndex(h => h.includes("thời gian") || h.includes("created") || h.includes("ngày gửi") || h.includes("timestamp"));
  let oppIdx = headers.findIndex(h => h.includes("tên") || h.includes("đội") || h.includes("opponent"));
  let phoneIdx = headers.findIndex(h => h.includes("thoại") || h.includes("sđt") || h.includes("phone") || h.includes("zalo") || h.includes("liên hệ"));
  let fbIdx = headers.findIndex(h => h.includes("fb") || h.includes("facebook") || h.includes("mạng xã hội") || h.includes("link") || h.includes("trang cá nhân"));
  let dateIdx = headers.findIndex(h => (h.includes("ngày") && !h.includes("thời gian") && !h.includes("ngày gửi")) || h.includes("date"));
  let matchTimeIdx = headers.findIndex(h => h.includes("khung giờ") || h.includes("giờ đá") || (h.includes("giờ") && !h.includes("thời gian")));
  let pitchIdx = headers.findIndex(h => h.includes("sân") || h.includes("pitch") || h.includes("địa điểm") || h.includes("sân bãi"));
  let noteIdx = headers.findIndex(h => h.includes("ghi chú") || h.includes("note") || h.includes("lời nhắn") || h.includes("thể thức"));
  let statusIdx = headers.findIndex(h => h.includes("trạng thái") || h.includes("status"));

  // Thứ tự cột tiêu chuẩn: [0: Thời gian gửi, 1: Tên đội, 2: SĐT, 3: Link Facebook, 4: Ngày đá, 5: Khung giờ, 6: Sân, 7: Ghi chú, 8: Trạng thái]
  if (timeIdx === -1) timeIdx = 0;
  if (oppIdx === -1) oppIdx = 1;
  if (phoneIdx === -1) phoneIdx = 2;
  if (fbIdx === -1) fbIdx = 3;
  if (dateIdx === -1) dateIdx = 4;
  if (matchTimeIdx === -1) matchTimeIdx = 5;
  if (pitchIdx === -1) pitchIdx = 6;
  if (noteIdx === -1) noteIdx = 7;
  if (statusIdx === -1) statusIdx = 8;

  const reqs = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    let oppName = String(row[oppIdx] || "").trim();
    let oppPhone = String(row[phoneIdx] || "").trim();
    let oppFb = fbIdx !== -1 ? String(row[fbIdx] || "").trim() : "";
    let rawDate = row[dateIdx];
    let rawTime = matchTimeIdx !== -1 ? String(row[matchTimeIdx] || "").trim() : "";
    let pitch = pitchIdx !== -1 ? String(row[pitchIdx] || "").trim() : "";
    let note = noteIdx !== -1 ? String(row[noteIdx] || "").trim() : "";
    let status = statusIdx !== -1 ? String(row[statusIdx] || "PENDING").trim().toUpperCase() : "PENDING";

    // Tự động nhận diện thông minh nội dung (Tránh lệch cột nếu người dùng đổi vị trí cột trên Google Sheet):
    // 1. Quét tìm Link Facebook trong các ô nếu oppFb chưa có hoặc bị nhầm sang ô khác
    if (!oppFb.includes("facebook.com") && !oppFb.includes("fb.me") && !oppFb.includes("http")) {
      for (let c = 0; c < row.length; c++) {
        const valStr = String(row[c] || "").trim();
        if (valStr.includes("facebook.com") || valStr.includes("fb.com") || valStr.includes("fb.me")) {
          oppFb = valStr;
          // Nếu ô date đang bị gán link FB thì xóa bỏ
          if (c === dateIdx) rawDate = "";
          break;
        }
      }
    }

    // 2. Quét tìm Ngày đá nếu rawDate bị rỗng hoặc đang giữ link FB
    if (!rawDate || String(rawDate).includes("facebook.com") || String(rawDate).includes("http")) {
      for (let c = 0; c < row.length; c++) {
        if (c === timeIdx || c === oppIdx || c === phoneIdx) continue;
        const val = row[c];
        if (val instanceof Date) {
          rawDate = val;
          break;
        }
        const valStr = String(val || "").trim();
        if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(valStr)) {
          rawDate = valStr;
          break;
        }
      }
    }

    // 3. Quét tìm Khung giờ đá (VD: 17:30, 19:00, 14:00)
    if (!rawTime || rawTime.length > 20 || String(rawDate) === rawTime) {
      for (let c = 0; c < row.length; c++) {
        if (c === timeIdx || c === oppIdx || c === phoneIdx) continue;
        const val = row[c];
        if (val instanceof Date) {
          // Trích xuất HH:mm từ đối tượng Date
          const h = String(val.getHours()).padStart(2, "0");
          const m = String(val.getMinutes()).padStart(2, "0");
          if (h !== "00" || m !== "00") {
            rawTime = h + ":" + m;
            break;
          }
        }
        const valStr = String(val || "").trim();
        if (/^\d{1,2}[:h]\d{2}/i.test(valStr)) {
          rawTime = valStr;
          break;
        }
      }
    }

    if (oppName || oppPhone) {
      reqs.push({
        id: r,
        createdAt: safeFormatDate(row[timeIdx], "HH:mm dd/MM/yyyy"),
        opponentName: oppName,
        opponentPhone: oppPhone,
        opponentFb: oppFb,
        matchDate: safeFormatDate(rawDate, "dd/MM/yyyy"),
        matchTime: rawTime || "19:00",
        pitch: pitch,
        note: note,
        status: status || "PENDING"
      });
    }
  }
  return reqs;
}

// 5. Đọc dữ liệu điểm danh
function readAttendanceFromSheet(sheet) {
  if (!sheet || sheet.getLastRow() <= 1 || sheet.getLastColumn() < 1) return [];
  const lastRow = sheet.getLastRow();
  const maxCol = Math.max(sheet.getLastColumn(), 6);
  const rows = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();
  const attData = [];
  rows.forEach(r => {
    if (r[4]) {
      let ts = 0;
      if (r[0] instanceof Date && !isNaN(r[0].getTime())) {
        ts = r[0].getTime();
      } else if (r[0]) {
        const parsed = new Date(r[0]);
        if (!isNaN(parsed.getTime())) ts = parsed.getTime();
      }
      attData.push({
        time: safeFormatDate(r[0], "HH:mm dd/MM"),
        timestamp: ts,
        matchKey: String(r[1] || "").trim(),
        matchDate: String(r[2] || "").trim(),
        matchOpponent: String(r[3] || "").trim(),
        playerName: String(r[4] || "").trim(),
        status: String(r[5] || "yes").trim()
      });
    }
  });
  return attData;
}

// 6. Chuyển đổi giờ an toàn chuẩn bóng đá Việt Nam: "17h30", "11h30", "19h00"
function safeFormatTime(val) {
  if (!val && val !== 0) return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, "GMT+7", "HH'h'mm");
  }
  let s = String(val).trim();
  if (!s) return "";

  let hour = null;
  let min = 0;
  let period = null;

  const lower = s.toLowerCase();
  if (lower.includes("am")) period = "AM";
  if (lower.includes("pm")) period = "PM";

  const gmtMatch = s.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$|\()/);
  if (s.includes("GMT") || s.includes("1899") || s.includes("1900") || s.includes("T")) {
    if (gmtMatch) {
      hour = parseInt(gmtMatch[1], 10);
      min = parseInt(gmtMatch[2], 10);
    }
  } else {
    const stdMatch = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (stdMatch) {
      hour = parseInt(stdMatch[1], 10);
      min = parseInt(stdMatch[2], 10);
    } else {
      const hMatch = s.match(/^(\d{1,2})[hH](\d{0,2})/);
      if (hMatch) {
        hour = parseInt(hMatch[1], 10);
        min = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
      } else if (gmtMatch) {
        hour = parseInt(gmtMatch[1], 10);
        min = parseInt(gmtMatch[2], 10);
      }
    }
  }

  if (hour === null || isNaN(hour)) return s;

  if (period === "PM" && hour < 12) hour += 12;
  else if (period === "AM" && hour === 12) hour = 0;

  const hourStr = hour < 10 ? "0" + hour : "" + hour;
  const minStr = min < 10 ? "0" + min : "" + min;

  return hourStr + "h" + minStr;
}

// 7. Chuyển đổi ngày tháng an toàn
function safeFormatDate(val, format) {
  if (!val) return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    // Tránh ô Time có năm 1899 bị lọt vào cột ngày
    if (val.getFullYear() < 1970) return "";
    return Utilities.formatDate(val, "GMT+7", format || "dd/MM/yyyy");
  }
  let s = String(val).trim();
  if (s.includes("1899") || s.includes("1900")) return "";

  try {
    const d = new Date(val);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 1970) {
      return Utilities.formatDate(d, "GMT+7", format || "dd/MM/yyyy");
    }
  } catch (e) {}
  return s;
}

function outputJsonpOrJson(e, payload) {
  const callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    const output = callback + "(" + JSON.stringify(payload) + ");";
    return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// HÀM LƯU ẢNH TRỰC TIẾP VÀO GOOGLE DRIVE (TẠO LINK CÔNG KHAI TẢI NHANH)
// =========================================================================
function saveImageToDrive(base64Data, fileName, mimeType) {
  if (!base64Data) return "";

  try {
    const folderName = "MMO_FC_Photos";
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    let cleanBase64 = base64Data;
    let type = mimeType || "image/jpeg";
    if (base64Data.includes(",")) {
      const parts = base64Data.split(",");
      cleanBase64 = parts[1];
      const headerMatch = parts[0].match(/:(.*?);/);
      if (headerMatch) type = headerMatch[1];
    }

    const decoded = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decoded, type, fileName || ("mmo_player_" + Date.now() + ".jpg"));
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    // Link CDN thumbnail độ nét cao của Google: tải cực nhanh, không lỗi CORS, hiển thị trên mọi trình duyệt
    return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1000";
  } catch (err) {
    Logger.log("Lỗi saveImageToDrive: " + err.toString());
    return "";
  }
}

// 8. Đọc danh sách cầu thủ từ tab CauThu (Do Admin tự thêm)
function readPlayersFromSheet(ss) {
  if (!ss) return [];
  const sheet = ss.getSheetByName("CauThu");
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 8);
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const players = [];
  rows.forEach(r => {
    const name = String(r[0] || "").trim();
    if (name) {
      players.push({
        name: name,
        num: String(r[1] || "#").trim(),
        pos: String(r[2] || "Cầu thủ MMO FC").trim(),
        role: String(r[2] || "Cầu thủ MMO FC").trim(),
        photo: String(r[3] || "").trim(),
        baseGoals: parseInt(r[4], 10) || 0,
        baseAttended: parseInt(r[5], 10) || 0,
        baseAbsent: parseInt(r[6], 10) || 0
      });
    }
  });
  return players;
}

// =========================================================================
// 9. TÍNH TOÁN VÀ ĐỒNG BỘ THỐNG KÊ CẦU THỦ VÀO TAB "ThongKeCauThu"
// =========================================================================
function computePlayerStats(matchData, attData) {
  let roster = [
    { name: "Nguyen sida", num: "C", pos: "Coach / HLV Trưởng", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    { name: "Thôi Nghé", num: "27", pos: "Tiền vệ Trung tâm", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    { name: "Thịnh Bánh Mỳ", num: "07", pos: "Tiền vệ Cánh", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    { name: "Lê Huy", num: "25", pos: "Trung vệ Thép", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    { name: "Ngô Hiếu", num: "99", pos: "Hậu vệ Biên", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    { name: "Bin cunha", num: "17", pos: "Tiền vệ Tấn công", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    { name: "Khải futsal", num: "13", pos: "Tiền vệ Điều tiết", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    { name: "Sỹ sancho", num: "12", pos: "Tiền đạo Cánh", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    { name: "Quang bamboo", num: "10", pos: "Tiền đạo Mục tiêu", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    { name: "Vũ Đệ", num: "47", pos: "Hậu vệ Thòng", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    { name: "Quốc DeGea", num: "08", pos: "Thủ môn", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    { name: "MMO", num: "00", pos: "Đội Trưởng", baseGoals: 0, baseAttended: 0, baseAbsent: 0 }
  ];

  // Nạp thêm cầu thủ do Admin thêm vào tab CauThu
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const customList = readPlayersFromSheet(ss);
    const existing = new Set(roster.map(p => p.name.toLowerCase()));
    customList.forEach(cp => {
      if (!existing.has(cp.name.toLowerCase())) {
        roster.push(cp);
        existing.add(cp.name.toLowerCase());
      }
    });
  } catch (e) {}

  // 1. Tính bàn thắng từ các trận FINISHED
  const goalsMap = {};
  (matchData || []).forEach(m => {
    if (String(m.Status || "").toUpperCase() === "FINISHED" && m.Scorers) {
      const parts = String(m.Scorers).split(/[,;\n]+/);
      parts.forEach(p => {
        const matchRegex = p.match(/(.*?)[(:]([0-9]+)[)]?/);
        if (matchRegex) {
          const name = matchRegex[1].trim().toLowerCase();
          const goals = parseInt(matchRegex[2], 10) || 1;
          goalsMap[name] = (goalsMap[name] || 0) + goals;
        } else if (p.trim()) {
          const name = p.trim().toLowerCase();
          goalsMap[name] = (goalsMap[name] || 0) + 1;
        }
      });
    }
  });

  // 2. Tính số trận ra sân và vắng từ điểm danh
  const attMap = {};
  (attData || []).forEach(r => {
    const pName = String(r.playerName || "").trim().toLowerCase();
    if (!pName) return;
    const mKey = String(r.matchKey || r.matchDate || "m").trim();
    if (!attMap[pName]) attMap[pName] = { attended: {}, absent: {} };
    if (r.status === "yes") {
      attMap[pName].attended[mKey] = true;
      delete attMap[pName].absent[mKey];
    } else if (r.status === "no") {
      attMap[pName].absent[mKey] = true;
      delete attMap[pName].attended[mKey];
    }
  });

  // Tự động bổ sung bất kỳ thành viên mới nào có trong dữ liệu điểm danh mà chưa có trong danh sách cứng
  const existingNames = roster.map(p => p.name.toLowerCase());
  for (const [pName, rec] of Object.entries(attMap)) {
    if (!existingNames.some(en => en.includes(pName) || pName.includes(en))) {
      roster.push({
        name: pName,
        num: "#",
        pos: "Cầu thủ MMO FC",
        baseGoals: 0,
        baseAttended: 0,
        baseAbsent: 0
      });
      existingNames.push(pName);
    }
  }

  const finishedCount = (matchData || []).filter(m => String(m.Status || "").toUpperCase() === "FINISHED").length;

  return roster.map(p => {
    const norm = p.name.toLowerCase();
    let goals = Number(p.baseGoals) || 0;
    for (const [k, v] of Object.entries(goalsMap)) {
      if (k.includes(norm) || norm.includes(k)) goals += v;
    }

    let attended = Number(p.baseAttended) || 0;
    let absent = Number(p.baseAbsent) || 0;
    for (const [k, rec] of Object.entries(attMap)) {
      if (k.includes(norm) || norm.includes(k)) {
        attended += Object.keys(rec.attended).length;
        absent += Object.keys(rec.absent).length;
      }
    }

    if (attended === 0 && goals > 0) {
      attended = Math.max(1, Math.min(finishedCount || 1, goals));
    }

    const total = attended + absent;
    const rate = total > 0 ? Math.round((attended / total) * 100) : (attended > 0 ? 100 : 0);

    return {
      name: p.name,
      num: p.num,
      pos: p.pos,
      attended: attended,
      absent: absent,
      rate: rate,
      goals: goals
    };
  });
}

function syncPlayerStatsSheet(ss, playerStats) {
  try {
    let sheet = ss.getSheetByName("ThongKeCauThu");
    if (!sheet) {
      sheet = ss.insertSheet("ThongKeCauThu");
      sheet.appendRow(["STT", "Cầu Thủ", "Số Áo", "Vị Trí", "Trận Ra Sân", "Trận Vắng", "Tỉ Lệ Chuyên Cần (%)", "Bàn Thắng", "Cập Nhật Lúc"]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#d71920").setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    // Xóa nội dung dữ liệu cũ từ dòng 2
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 9).clearContent();
    }

    const nowStr = Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy");
    const rows = (playerStats || []).map((p, idx) => [
      idx + 1,
      p.name,
      p.num,
      p.pos,
      p.attended,
      p.absent,
      p.rate + "%",
      p.goals,
      nowStr
    ]);

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 9).setValues(rows);
    }
  } catch (e) {
    Logger.log("Lỗi syncPlayerStatsSheet: " + e.toString());
  }
}

// =========================================================================
// 9. QUẢN LÝ PHÒNG TRUYỀN THỐNG CÚP (TROPHY ROOM)
// =========================================================================
function readTrophiesFromSheet(ss) {
  if (!ss) return [];
  const sheet = ss.getSheetByName("PhongCup") || ss.getSheetByName("Trophies");
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 10);
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const trophies = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row[0] || "").trim() || ("cup_" + (i + 1));
    const title = String(row[1] || "").trim();
    if (!title) continue;
    // Bỏ qua các cúp mẫu giả định nếu còn sót lại từ trước
    if (["cup_1", "cup_2", "cup_3"].includes(id) && (title.includes("TỨ HÙNG") || title.includes("MIỀN BẮC") || title.includes("FAIR-PLAY"))) {
      continue;
    }
    trophies.push({
      id: id,
      title: title,
      year: String(row[2] || "2026").trim(),
      type: String(row[3] || "gold").trim(),
      typeLabel: String(row[4] || "🏆 QUÁN QUÂN - VÔ ĐỊCH").trim(),
      photo: String(row[5] || "").trim(),
      desc: String(row[6] || "").trim(),
      matches: String(row[7] || "").trim(),
      goals: String(row[8] || "").trim(),
      updatedAt: String(row[9] || "").trim()
    });
  }
  return trophies;
}

function saveTrophiesToSheet(ss, trophies) {
  if (!ss || !Array.isArray(trophies)) return false;
  let sheet = ss.getSheetByName("PhongCup");
  if (!sheet) {
    sheet = ss.insertSheet("PhongCup");
    sheet.appendRow(["Mã Cúp", "Tên Cúp / Giải Đấu", "Năm", "Loại", "Danh Hiệu", "Ảnh Cúp", "Mô Tả", "Số Trận", "Bàn Thắng", "Ngày Cập Nhật"]);
    sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#eab308").setFontColor("#000000");
    sheet.setFrozenRows(1);
  }

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 10);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }

  if (trophies.length === 0) return true;

  const nowStr = Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy");
  const rows = trophies.map(t => [
    t.id || ("cup_" + Date.now()),
    t.title || "",
    t.year || "2026",
    t.type || "gold",
    t.typeLabel || "🏆 QUÁN QUÂN - VÔ ĐỊCH",
    t.photo || "img/anh chinh.jpg",
    t.desc || "",
    t.matches || "",
    t.goals || "",
    nowStr
  ]);

  sheet.getRange(2, 1, rows.length, 10).setValues(rows);
  return true;
}

// =========================================================================
// 10. QUẢN LÝ KHOẢNH KHẮC SÂN CỎ & TẬP THỂ GẮN KẾT (BROTHERHOOD GALLERY)
// =========================================================================
function readMomentsFromSheet(ss) {
  if (!ss) return [];
  const sheet = ss.getSheetByName("KhoanhKhac") || ss.getSheetByName("Moments");
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 10);
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const moments = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row[0] || "").trim() || ("moment_" + (i + 1));
    const title = String(row[1] || "").trim();
    if (!title) continue;

    let photos = [];
    const photosJson = String(row[6] || "").trim();
    if (photosJson.startsWith("[") && photosJson.endsWith("]")) {
      try {
        photos = JSON.parse(photosJson);
      } catch (e) {}
    }
    const coverPhoto = String(row[5] || "").trim() || (photos[0] || "img/chinh5.jpg");
    if (!photos || photos.length === 0) {
      photos = [coverPhoto];
    }

    moments.push({
      id: id,
      title: title,
      date: String(row[2] || "2026").trim(),
      category: String(row[3] || "celebration").trim(),
      categoryLabel: String(row[4] || "🎉 Ăn mừng chiến thắng").trim(),
      photo: coverPhoto,
      photos: photos,
      location: String(row[7] || "").trim(),
      desc: String(row[8] || "").trim(),
      updatedAt: String(row[9] || "").trim()
    });
  }
  return moments;
}

function saveMomentsToSheet(ss, moments) {
  if (!ss || !Array.isArray(moments)) return false;
  let sheet = ss.getSheetByName("KhoanhKhac");
  if (!sheet) {
    sheet = ss.insertSheet("KhoanhKhac");
    sheet.appendRow(["Mã Khoảnh Khắc", "Tiêu Đề", "Ngày", "Chủ Đề", "Tên Chủ Đề", "Ảnh Bìa", "Album Ảnh (JSON)", "Địa Điểm", "Nội Dung / Lời Bình", "Ngày Cập Nhật"]);
    sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#ff4757").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 10).clearContent();
  }

  if (moments.length === 0) return true;

  const nowStr = Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy");
  const rows = moments.map(m => {
    const photosList = Array.isArray(m.photos) && m.photos.length > 0 ? m.photos : (m.photo ? [m.photo] : ["img/chinh5.jpg"]);
    return [
      m.id || ("moment_" + Date.now()),
      m.title || "",
      m.date || "2026",
      m.category || "celebration",
      m.categoryLabel || "🎉 Ăn mừng chiến thắng",
      m.photo || photosList[0] || "img/chinh5.jpg",
      JSON.stringify(photosList),
      m.location || "",
      m.desc || "",
      nowStr
    ];
  });

  sheet.getRange(2, 1, rows.length, 10).setValues(rows);
  return true;
}

// =========================================================================
// 11. QUẢN LÝ CẤU HÌNH ẢNH BÌA HIGHLIGHTS (MỤC 04)
// =========================================================================
function readHighlightsConfigFromSheet(ss) {
  if (!ss) return null;
  const sheet = ss.getSheetByName("CauHinh");
  if (!sheet || sheet.getLastRow() <= 1) return null;

  const lastRow = sheet.getLastRow();
  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const cfg = {};
  for (let i = 0; i < rows.length; i++) {
    const k = String(rows[i][0] || "").trim();
    const v = String(rows[i][1] || "").trim();
    if (k && v) cfg[k] = v;
  }
  return Object.keys(cfg).length > 0 ? cfg : null;
}

function saveHighlightsConfigToSheet(ss, cfg) {
  if (!ss || !cfg) return false;
  let sheet = ss.getSheetByName("CauHinh");
  if (!sheet) {
    sheet = ss.insertSheet("CauHinh");
    sheet.appendRow(["Khoá Cấu Hình", "Giá Trị", "Mô Tả", "Cập Nhật Lúc"]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#0284c7").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }

  const nowStr = Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy");
  const keys = ["trophiesCover", "tacticsCover", "matchdayCover"];
  
  const lastRow = sheet.getLastRow();
  const existingMap = {};
  if (lastRow > 1) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (let i = 0; i < rows.length; i++) {
      existingMap[String(rows[i][0] || "").trim()] = i + 2;
    }
  }

  keys.forEach(k => {
    if (cfg[k]) {
      if (existingMap[k]) {
        sheet.getRange(existingMap[k], 2).setValue(cfg[k]);
        sheet.getRange(existingMap[k], 4).setValue(nowStr);
      } else {
        sheet.appendRow([k, cfg[k], "Ảnh bìa mục " + k, nowStr]);
      }
    }
  });
  return true;
}
