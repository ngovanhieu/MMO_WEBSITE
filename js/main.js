const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
        const isOpen = mainNav.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.querySelectorAll(".main-nav a").forEach(link => {
        link.addEventListener("click", () => {
            mainNav.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
        });
    });
}

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const sections = document.querySelectorAll("main section[id]");
const navLinks = document.querySelectorAll(".main-nav a");
window.addEventListener("scroll", () => {
    let current = "home";
    sections.forEach(section => {
        if (window.scrollY >= section.offsetTop - 130) current = section.id;
    });
    navLinks.forEach(link => {
        link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
    });
});

const API_URL = "https://script.google.com/macros/s/AKfycbym-j1Hp6bgonbsv_fDhNK-QJe6pVoinXecpathGa4GRvTKcvr7jISCXtOtkNOwitjY/exec";

let matchData = [];

// ========================================
// ĐỊNH NGHĨA THỨ & ĐỊNH DẠNG NGÀY GIỜ TIẾNG VIỆT ĐƠN GIẢN
// ========================================

const VIETNAMESE_DAYS = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy"
];

// Làm sạch và định dạng giờ thi đấu chuẩn bóng đá phong trào Việt Nam (ví dụ: "17h30", "11h30", "19h00")
// Tự động loại bỏ hoàn toàn các chuỗi rác kiểu "Sun Dec 31 1899 11:30:00 GMT+0700..."
function formatDisplayTime(timeStr) {
    if (!timeStr && timeStr !== 0) return "Sẽ cập nhật";
    let s = String(timeStr).trim();
    if (!s || s === "--:--" || s.toLowerCase().includes("sẽ cập nhật") || s.toLowerCase().includes("chưa")) {
        return "Sẽ cập nhật";
    }

    let hour = null;
    let min = 0;
    let period = null;

    const lower = s.toLowerCase();
    if (lower.includes("am")) period = "AM";
    if (lower.includes("pm")) period = "PM";

    // 1. Xử lý chuỗi Date đầy đủ (ví dụ: "Sun Dec 31 1899 11:30:00 GMT+0700 (GMT+07:00)")
    const gmtMatch = s.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$|\()/);
    if (s.includes("GMT") || s.includes("1899") || s.includes("1900") || s.includes("T")) {
        if (gmtMatch) {
            hour = parseInt(gmtMatch[1], 10);
            min = parseInt(gmtMatch[2], 10);
        }
    } else {
        // 2. Chuẩn hóa định dạng "17:30" hoặc "17:30:00" hoặc "19:00"
        const stdMatch = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
        if (stdMatch) {
            hour = parseInt(stdMatch[1], 10);
            min = parseInt(stdMatch[2], 10);
        } else {
            // 3. Chuẩn hóa dạng "17h30", "19h", "19H"
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

    if (hour === null || isNaN(hour)) {
        return s;
    }

    // Nếu chuỗi gốc có ghi AM/PM (ví dụ: 5:30 PM -> 17h30)
    if (period === "PM" && hour < 12) {
        hour += 12;
    } else if (period === "AM" && hour === 12) {
        hour = 0;
    }

    const hourStr = hour.toString().padStart(2, "0");
    const minStr = min.toString().padStart(2, "0");

    return `${hourStr}h${minStr}`;
}

// Làm sạch và định dạng ngày thi đấu tiếng Việt thân thiện (ví dụ: "Thứ Bảy, 15/11/2026")
function formatDisplayDate(dateStr, timeStr) {
    if (!dateStr) return "Chưa có lịch";
    let str = String(dateStr).trim();
    if (!str || str.toLowerCase().includes("chưa") || str.toLowerCase().includes("coming")) {
        return "Chưa có lịch";
    }

    // Loại bỏ chuỗi rác năm 1899/1900 nếu Google Sheet bị lệch ô
    if (str.includes("1899") || str.includes("1900")) {
        return "Chưa có lịch";
    }

    // Nếu đã có sẵn "Thứ..." hoặc "Chủ Nhật"
    const lower = str.toLowerCase();
    if (lower.includes("thứ") || lower.includes("chủ nhật") || lower.includes("cn")) {
        return str;
    }

    // Tính thứ trong tuần từ ngày và giờ
    const ts = parseMatchDateTime(str, timeStr || "19:00");
    if (ts) {
        const d = new Date(ts);
        const dayOfWeek = VIETNAMESE_DAYS[d.getDay()];
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        if (dayOfWeek && year >= 2020) {
            return `${dayOfWeek}, ${day}/${month}/${year}`;
        }
    }

    return str;
}

// ========================================
// BỘ PHÂN TÍCH NGÀY GIỜ TOÀN DIỆN (BULLETPROOF DATE & TIME PARSER)
// ========================================

function parseMatchDateTime(dateStr, timeStr) {
    if (!dateStr && dateStr !== 0) return null;

    let str = String(dateStr).trim();
    if (!str || str.toLowerCase().includes("chưa") || str.toLowerCase().includes("coming")) {
        return null;
    }

    // 1. Phân tích giờ phút (ưu tiên timeStr, sau đó tìm trong dateStr nếu có)
    let hour = 19;
    let min = 0;
    let hasExplicitTime = false;

    function extractTime(t) {
        if (!t) return false;
        const s = String(t).trim().toLowerCase();
        if (s.includes("chưa") || s.includes("sẽ cập nhật") || s === "--:--") return false;

        // Trích xuất: 17h30, 17:30, 5:30 pm, 17h, 17 giờ 30, lúc 17h30
        const m = s.match(/(?:lúc\s*)?(\d{1,2})(?:[:hH]|(?:\s*giờ\s*))(\d{1,2})?(?:\s*(am|pm))?/i);
        if (m) {
            let h = parseInt(m[1], 10);
            let mi = m[2] ? parseInt(m[2], 10) : 0;
            const period = (m[3] || "").toLowerCase();
            if (period === "pm" && h < 12) h += 12;
            if (period === "am" && h === 12) h = 0;
            if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) {
                hour = h;
                min = mi;
                hasExplicitTime = true;
                return true;
            }
        }
        return false;
    }

    if (timeStr) extractTime(timeStr);
    if (!hasExplicitTime) extractTime(str);

    // 2. Nếu dateStr là chuỗi Date hợp lệ (e.g. ISO hoặc GMT)
    if ((str.includes("T") || str.includes("GMT") || str.includes("Z")) && !isNaN(Date.parse(str))) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            if (hasExplicitTime) {
                d.setHours(hour, min, 0, 0);
            }
            return d.getTime();
        }
    }

    // 3. Trích xuất Ngày, Tháng, Năm bằng Regular Expression chính xác
    // Bỏ qua mọi tiền tố chữ như "Chủ Nhật,", "Thứ 7,", "CN,", "Ngày 15/11/2026", v.v.
    let day = null, month = null, year = null;
    const currentYear = new Date().getFullYear();

    // Pattern 1: YYYY-MM-DD hoặc YYYY/MM/DD hoặc YYYY.MM.DD
    const ymdMatch = str.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (ymdMatch) {
        year = parseInt(ymdMatch[1], 10);
        month = parseInt(ymdMatch[2], 10);
        day = parseInt(ymdMatch[3], 10);
    } else {
        // Pattern 2: DD/MM/YYYY hoặc DD-MM-YYYY hoặc DD.MM.YYYY
        const dmyMatch = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (dmyMatch) {
            day = parseInt(dmyMatch[1], 10);
            month = parseInt(dmyMatch[2], 10);
            year = parseInt(dmyMatch[3], 10);
            if (year < 100) year += 2000;
        } else {
            // Pattern 3: DD/MM (không có năm, mặc định năm hiện tại)
            const dmMatch = str.match(/(\d{1,2})[\/\-\.](\d{1,2})/);
            if (dmMatch) {
                day = parseInt(dmMatch[1], 10);
                month = parseInt(dmMatch[2], 10);
                year = currentYear;
            }
        }
    }

    if (!day || !month || !year) {
        const timestamp = Date.parse(str);
        return isNaN(timestamp) ? null : timestamp;
    }

    // Xử lý trường hợp tháng > 12 (Google Sheets US locale MM/DD/YYYY)
    if (month > 12 && day <= 12) {
        const temp = month;
        month = day;
        day = temp;
    }

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const targetDate = new Date(year, month - 1, day, hour, min, 0, 0);
    return targetDate.getTime();
}

function parseMatchDate(dateString) {
    const timestamp = parseMatchDateTime(dateString, "00:00");
    return timestamp ? new Date(timestamp) : new Date(0);
}

// ========================================
// TẢI DỮ LIỆU BẰNG JSONP
// ========================================

function loadGoogleSheets() {
    return new Promise((resolve, reject) => {
        const callbackName = "handleMatches_" + Date.now();
        const script = document.createElement("script");

        const timeout = setTimeout(() => {
            delete window[callbackName];
            script.remove();
            reject(new Error("Hết thời gian chờ Google Sheets"));
        }, 15000);

        window[callbackName] = function (data) {
            clearTimeout(timeout);
            script.remove();
            delete window[callbackName];
            resolve(data);
        };

        script.onerror = function () {
            clearTimeout(timeout);
            delete window[callbackName];
            script.remove();
            reject(new Error("Không thể tải dữ liệu Google Sheets"));
        };

        script.src = API_URL + "?callback=" + callbackName;
        document.body.appendChild(script);
    });
}

// ========================================
// HỢP NHẤT DỮ LIỆU ĐIỂM SỐ & BÀN THẮNG ĐÃ LƯU TỪ ADMIN
// ========================================
// KIỂM TRA TRẬN ĐẤU ĐÃ BỊ XÓA BỞI ADMIN
// ========================================
function isMatchDeleted(match, deletedList) {
    if (!match || !Array.isArray(deletedList) || deletedList.length === 0) return false;
    const h = String(match.Home || "").trim().toLowerCase();
    const a = String(match.Away || "").trim().toLowerCase();
    const d = String(match.Date || "").trim().toLowerCase();

    const sig1 = (h + "_" + a + "_" + d).replace(/\s+/g, "_");
    const sig2 = (a + "_" + h + "_" + d).replace(/\s+/g, "_");

    return deletedList.some(item => {
        const k = String(item || "").trim().toLowerCase().replace(/\s+/g, "_");
        if (!k) return false;
        if (sig1 === k || sig2 === k) return true;
        if (sig1.includes(k) || k.includes(sig1)) return true;
        if (a && k.includes(a) && d && (k.includes(d) || d.includes(k))) return true;
        return false;
    });
}

// ========================================
// TỰ ĐỘNG DỌN DẸP DỮ LIỆU ĐẤU MẪU CŨ (FC FRIENDS, TEAM A, TEAM B)
// ========================================
function purgeLegacyDemoMatches(list) {
    if (!Array.isArray(list)) return [];
    const demoKeywords = ["fc friends", "friends", "team a", "team b", "team_a", "team_b", "duy tân fc", "duy tan fc", "duy tân", "duy tan"];
    return list.filter(m => {
        if (!m) return false;
        const away = String(m.Away || m.away || "").trim().toLowerCase();
        const home = String(m.Home || m.home || "").trim().toLowerCase();
        const isDemo = demoKeywords.some(k => away === k || home === k || away.includes(k) || home.includes(k));
        return !isDemo;
    });
}

function purgeLegacyScoresSync() {
    try {
        let scoresSync = JSON.parse(localStorage.getItem("mmo_scores_sync")) || {};
        let changed = false;
        const demoKeywords = ["fc friends", "friends", "team a", "team b", "team_a", "team_b", "duy tân fc", "duy tan fc", "duy tân", "duy tan"];
        for (const [k, v] of Object.entries(scoresSync)) {
            if (!v || typeof v !== "object") { delete scoresSync[k]; changed = true; continue; }
            const away = String(v.Away || "").trim().toLowerCase();
            const home = String(v.Home || "").trim().toLowerCase();
            const keyLower = k.toLowerCase();
            const isDemo = demoKeywords.some(d => away === d || home === d || keyLower.includes(d));
            if (isDemo) {
                delete scoresSync[k];
                changed = true;
            }
        }
        if (changed) {
            localStorage.setItem("mmo_scores_sync", JSON.stringify(scoresSync));
        }
    } catch (e) {}
}

// ========================================
// ÁP DỤNG ĐIỀU CHỈNH TỈ SỐ & BÀN THẮNG TỪ LOCALSTORAGE
// ========================================
function applyScoresOverride(matches) {
    if (!matches || !Array.isArray(matches)) return matches || [];

    // 0. Dọn dẹp triệt để các dữ liệu mẫu cũ (FC Friends, Team A, Team B)
    purgeLegacyScoresSync();
    matches = purgeLegacyDemoMatches(matches);

    let deletedList = [];
    try {
        deletedList = JSON.parse(localStorage.getItem("mmo_deleted_matches")) || [];
    } catch (e) {}

    // Lọc bỏ triệt để các trận đã bị xoá bởi admin
    matches = matches.filter(m => !isMatchDeleted(m, deletedList));

    let scoresSync = {};
    try {
        scoresSync = JSON.parse(localStorage.getItem("mmo_scores_sync")) || {};
    } catch (e) {}

    matches.forEach(m => {
        const cleanHome = String(m.Home || "").trim().toLowerCase();
        const cleanAway = String(m.Away || "").trim().toLowerCase();
        const cleanDate = String(m.Date || "").trim().toLowerCase();
        const mKey = (cleanHome + "_" + cleanAway + "_" + cleanDate).replace(/\s+/g, "_");

        for (const [sKey, sVal] of Object.entries(scoresSync)) {
            if (!sVal || typeof sVal !== "object") continue;
            const targetAway = String(sVal.Away || "").trim().toLowerCase();
            const targetDate = String(sVal.Date || "").trim().toLowerCase();
            const awayMatches = cleanAway && targetAway && (cleanAway === targetAway);
            const dateMatches = cleanDate && targetDate && (cleanDate === targetDate);
            const isMatch = (mKey === sKey) || (awayMatches && (dateMatches || !cleanDate || !targetDate));

            if (isMatch) {
                if (sVal.Scorers !== undefined) m.Scorers = sVal.Scorers;
                if (sVal.HomeScore !== undefined && sVal.HomeScore !== "") m.HomeScore = sVal.HomeScore;
                if (sVal.AwayScore !== undefined && sVal.AwayScore !== "") m.AwayScore = sVal.AwayScore;
                if (sVal.Status) m.Status = sVal.Status;
            }
        }
    });

    // Auto-heal: Trận đấu không có tỉ số hoặc là trận sắp tới tuyệt đối không được gán FINISHED
    matches.forEach(m => {
        const hasH = m.HomeScore !== undefined && m.HomeScore !== null && String(m.HomeScore).trim() !== "";
        const hasA = m.AwayScore !== undefined && m.AwayScore !== null && String(m.AwayScore).trim() !== "";
        if (!hasH || !hasA) {
            m.Status = "UPCOMING";
            m.HomeScore = "";
            m.AwayScore = "";
            m.Scorers = "";
        }
    });

    // Bổ sung trận đấu có trong scoresSync nhưng chưa có trong matches (chỉ khi có tỉ số hợp lệ & chưa bị xóa)
    for (const [sKey, sVal] of Object.entries(scoresSync)) {
        if (!sVal || typeof sVal !== "object") continue;
        if (isMatchDeleted(sVal, deletedList)) continue;
        const targetAway = String(sVal.Away || "").trim().toLowerCase();
        const targetDate = String(sVal.Date || "").trim().toLowerCase();
        const exists = matches.some(m => {
            const cleanAway = String(m.Away || "").trim().toLowerCase();
            const cleanDate = String(m.Date || "").trim().toLowerCase();
            const awayMatches = cleanAway && targetAway && (cleanAway === targetAway);
            const dateMatches = cleanDate && targetDate && (cleanDate === targetDate);
            return awayMatches && (dateMatches || !cleanDate || !targetDate);
        });
        if (!exists && sVal) {
            const valStatus = String(sVal.Status || "").toUpperCase();
            matches.unshift({
                Home: sVal.Home || "MMO FC",
                Away: sVal.Away || "Đối thủ",
                Date: sVal.Date || "",
                Time: sVal.Time || "",
                Location: sVal.Location || "",
                Tournament: sVal.Tournament || "Giao hữu",
                Status: valStatus === "UPCOMING" ? "UPCOMING" : (valStatus || "FINISHED"),
                HomeScore: sVal.HomeScore !== undefined ? sVal.HomeScore : "",
                AwayScore: sVal.AwayScore !== undefined ? sVal.AwayScore : "",
                Scorers: sVal.Scorers || ""
            });
        }
    }

    return matches;
}

// ========================================
// TRÍCH XUẤT & ĐỒNG BỘ DỮ LIỆU TRẬN ĐẤU
// ========================================

function parseMatchesFromJSON(json) {
    if (!json) return [];
    let deletedList = [];
    try {
        deletedList = JSON.parse(localStorage.getItem("mmo_deleted_matches")) || [];
    } catch (e) {}

    const list = [];
    if (json.upcoming && json.upcoming.away && !json.upcoming.away.toLowerCase().includes("duy t")) {
        const upObj = {
            Home: json.upcoming.home || "MMO FC",
            Away: json.upcoming.away,
            Date: json.upcoming.date || "",
            Time: json.upcoming.time || "17:30",
            Location: json.upcoming.location || "Sân bóng",
            Tournament: json.upcoming.tournament || json.upcoming.type || "Giao hữu",
            Status: "UPCOMING",
            HomeScore: "",
            AwayScore: "",
            Scorers: ""
        };
        if (!isMatchDeleted(upObj, deletedList)) list.push(upObj);
    }
    if (Array.isArray(json.history)) {
        json.history.forEach(h => {
            const finObj = {
                Home: h.home || "MMO FC",
                Away: h.away || "Đối thủ",
                Date: h.date || "",
                Time: "19:00",
                Location: "Sân bóng",
                Tournament: "Giao hữu",
                Status: "FINISHED",
                HomeScore: String(h.homeScore !== undefined ? h.homeScore : "0"),
                AwayScore: String(h.awayScore !== undefined ? h.awayScore : "0"),
                Scorers: ""
            };
            if (!isMatchDeleted(finObj, deletedList)) list.push(finObj);
        });
    }
    return list;
}

function renderMatchesUI(matches) {
    if (!Array.isArray(matches)) matches = [];

    function getDateValue(dateString, timeString) {
        return parseMatchDateTime(dateString, timeString) || Infinity;
    }

    const upcomingMatches = matches
        .filter(match => String(match.Status || "").trim().toUpperCase() === "UPCOMING")
        .sort((a, b) => getDateValue(a.Date, a.Time) - getDateValue(b.Date, b.Time));

    const finishedMatches = matches
        .filter(match => String(match.Status || "").trim().toUpperCase() === "FINISHED")
        .sort((a, b) => getDateValue(b.Date, b.Time) - getDateValue(a.Date, a.Time));

    upcomingMatchesList = upcomingMatches;
    selectedMatchIndex = 0;
    renderMatchPickerDropdown(upcomingMatchesList);

    if (upcomingMatches.length > 0) {
        displayUpcomingMatch(upcomingMatches[0]);
    } else {
        document.getElementById("matchStatus").textContent = "NO UPCOMING MATCH";
        document.getElementById("matchDate").textContent = "CHƯA CÓ LỊCH";
        document.getElementById("matchTime").textContent = "--:--";
        document.getElementById("matchLocation").textContent = "CHƯA CẬP NHẬT";

        loadAttendance({
            Home: "MMO FC",
            Away: "ĐANG TÌM ĐỐI THỦ",
            Date: "Chưa có lịch",
            Time: "--:--",
            Location: "Sẽ cập nhật sân",
            Tournament: "Giao hữu"
        });
        startMatchCountdown(null, null);
    }

    if (finishedMatches.length > 0) {
        displayLatestResult(finishedMatches[0]);
    } else {
        const latestScore = document.getElementById("latestScore");
        const latestMatch = document.getElementById("latestMatch");
        if (latestScore) latestScore.textContent = "— : —";
        if (latestMatch) latestMatch.textContent = "Chưa có dữ liệu trận đấu";
    }

    updateClubStats(matches);
}

// ========================================
// TẢI VÀ XỬ LÝ LỊCH THI ĐẤU
// ========================================

async function loadMatches() {
    try {
        console.log("MMO FC: Đang nạp dữ liệu trận đấu...");

        // 1. NẠP TỨC THÌ TỪ CACHE HOẶC matches.json ĐỂ ĐỒNG HỒ ĐẾM NGƯỢC CHẠY NGAY
        purgeLegacyScoresSync();
        let initialList = [];
        try {
            const cached = localStorage.getItem("mmo_matches_cache");
            if (cached) initialList = JSON.parse(cached);
        } catch (e) {}

        let deletedList = [];
        try {
            deletedList = JSON.parse(localStorage.getItem("mmo_deleted_matches")) || [];
        } catch (e) {}

        if (Array.isArray(initialList)) {
            initialList = purgeLegacyDemoMatches(initialList).filter(m => !isMatchDeleted(m, deletedList));
        }

        if (Array.isArray(initialList) && initialList.length > 0) {
            matchData = applyScoresOverride(initialList);
            try {
                localStorage.setItem("mmo_matches_cache", JSON.stringify(matchData));
            } catch (e) {}
            renderMatchesUI(matchData);
        } else {
            try {
                const res = await fetch("matches.json");
                if (res.ok) {
                    const json = await res.json();
                    const list = parseMatchesFromJSON(json);
                    if (list.length > 0) {
                        matchData = applyScoresOverride(list);
                        try {
                            localStorage.setItem("mmo_matches_cache", JSON.stringify(matchData));
                        } catch (e) {}
                        renderMatchesUI(matchData);
                    }
                }
            } catch (e) {}
        }

        // 2. KẾT NỐI GOOGLE SHEETS ĐỒNG BỘ DỮ LIỆU ĐÁM MÂY MỚI NHẤT
        const data = await loadGoogleSheets();

        if (data && data.success === false) {
            throw new Error(data.message || "Lỗi tải dữ liệu từ Google Sheets");
        }

        let cloudMatches = Array.isArray(data) ? data : (data && data.matches ? data.matches : []);

        // AUTO-HEAL: Khắc phục trường hợp cột bị đảo
        cloudMatches.forEach(m => {
            let h = String(m.Home || "").trim();
            let a = String(m.Away || "").trim();
            let d = String(m.Date || "").trim();
            let t = String(m.Time || "").trim();

            const isHomeDate = h.includes("GMT") || h.includes("1899") || d.toUpperCase().includes("MMO");
            const isAwayTime = a.includes("GMT") || a.includes("1899") || t.toUpperCase().includes("FC") || t.toUpperCase().includes("HÀ NỘI");

            if (isHomeDate || isAwayTime) {
                m.Home = d || "MMO FC";
                m.Away = t || "Đối thủ";
                m.Date = h;
                m.Time = a;
            }
        });

        if (data && data.success === true) {
            if (cloudMatches && cloudMatches.length > 0) {
                matchData = applyScoresOverride(cloudMatches);
            } else {
                matchData = [];
            }
            try {
                localStorage.setItem("mmo_matches_cache", JSON.stringify(matchData));
            } catch (e) {}
            renderMatchesUI(matchData);
        } else if (matchData && matchData.length > 0) {
            renderMatchesUI(matchData);
        } else {
            renderMatchesUI([]);
        }

        // ĐỒNG BỘ ĐIỂM DANH TỪ GOOGLE SHEET NẾU CÓ
        if (data && data.attendance && Array.isArray(data.attendance)) {
            syncAttendanceFromCloud(data.attendance);
        }

        // ĐỒNG BỘ CẦU THỦ MỚI TỪ GOOGLE SHEET NẾU CÓ
        if (data && data.players && Array.isArray(data.players)) {
            syncCustomPlayers(data.players);
        }

        // ĐỒNG BỘ PHÒNG TRUYỀN THỐNG CÚP TỪ GOOGLE SHEET
        if (data && Array.isArray(data.trophies)) {
            try {
                const cleanTrophies = data.trophies.filter(t => !["cup_1", "cup_2", "cup_3"].includes(t.id));
                localStorage.setItem("mmo_trophies_list", JSON.stringify(cleanTrophies));
                renderTrophyYearFilters();
                renderTrophiesSlider();
            } catch (e) {}
        }

        // ĐỒNG BỘ KHOẢNH KHẮC & TẬP THỂ GẮN KẾT TỪ GOOGLE SHEET
        if (data && Array.isArray(data.moments)) {
            try {
                const cleanMoments = data.moments.filter(m => !["NÂNG CÚP TỨ HÙNG VÀ BỮA TIỆC ĂN MỪNG CHIẾN THẮNG", "SÁT CÁNH CHIẾN ĐẤU - TINH THẦN ĐỒNG ĐỘI", "ANH EM MỘT NHÀ - TẬP THỂ GẮN KẾT BẤT DIỆT"].includes(m.title));
                localStorage.setItem("mmo_moments_list", JSON.stringify(cleanMoments));
                renderMomentFilters();
                if (currentMomentsViewMode === "grid") {
                    renderMomentsGrid();
                } else {
                    renderMomentsSlider();
                }
            } catch (e) {}
        }

        // ĐỒNG BỘ ẢNH BÌA HIGHLIGHTS TỪ GOOGLE SHEET
        if (data && data.highlightsConfig && typeof data.highlightsConfig === "object") {
            try {
                localStorage.setItem("mmo_highlights_config", JSON.stringify(data.highlightsConfig));
                loadHighlightsCovers();
            } catch (e) {}
        }

    } catch (error) {
        console.warn("MMO FC: Google Sheets offline hoặc timeout, tiếp tục với dữ liệu sẵn có:", error);

        if (!matchData || matchData.length === 0) {
            let fallbackMatches = [];
            try {
                const cached = localStorage.getItem("mmo_matches_cache");
                if (cached) fallbackMatches = JSON.parse(cached);
            } catch (e) {}

            if (fallbackMatches && fallbackMatches.length > 0) {
                matchData = applyScoresOverride(fallbackMatches);
                renderMatchesUI(matchData);
            }
        }
    }
}

// ========================================
// HIỂN THỊ TRẬN SẮP TỚI
// ========================================

function displayUpcomingMatch(match) {
    document.getElementById("matchType").textContent =
        match.Tournament || "FRIENDLY MATCH";

    document.getElementById("matchStatus").textContent =
        match.Status;

    document.getElementById("homeTeam").textContent =
        match.Home;

    document.getElementById("awayTeam").textContent =
        match.Away;

    document.getElementById("matchDate").textContent =
        formatDisplayDate(match.Date, match.Time);

    document.getElementById("matchTime").textContent =
        formatDisplayTime(match.Time);

    document.getElementById("matchLocation").textContent =
        match.Location || "Sẽ cập nhật";

    document.getElementById("matchTournament").textContent =
        match.Tournament || "Giao hữu";

    // Kích hoạt đồng hồ đếm ngược và điểm danh cho trận này
    startMatchCountdown(match.Date, match.Time);
    loadAttendance(match);
}

// ========================================
// HIỂN THỊ KẾT QUẢ GẦN NHẤT
// ========================================

function displayLatestResult(match) {
    const latestScore = document.getElementById("latestScore");
    const latestMatch = document.getElementById("latestMatch");

    if (!match && Array.isArray(matchData)) {
        match = matchData.find(m => String(m.Status || "").trim().toUpperCase() === "FINISHED");
    }

    if (!match) {
        if (latestScore) latestScore.textContent = "— : —";
        if (latestMatch) latestMatch.textContent = "Chưa có dữ liệu trận đấu mùa này";
        return;
    }

    const homeScore = (match.HomeScore !== undefined && match.HomeScore !== null && String(match.HomeScore).trim() !== "") ? match.HomeScore : "0";
    const awayScore = (match.AwayScore !== undefined && match.AwayScore !== null && String(match.AwayScore).trim() !== "") ? match.AwayScore : "0";

    if (latestScore) latestScore.textContent = homeScore + " : " + awayScore;
    if (latestMatch) {
        const homeName = match.Home || "MMO FC";
        const awayName = match.Away || "ĐỐI THỦ";
        const dateStr = match.Date ? (" - " + formatDisplayDate(match.Date, null)) : "";
        latestMatch.textContent = homeName + " vs " + awayName + dateStr;
    }
}

// ========================================
// TỰ ĐỘNG TÍNH TOÁN THÀNH TÍCH TỪ GOOGLE SHEET
// ========================================

function updateClubStats(matches) {
    if (!matches || !Array.isArray(matches)) return;

    // CHỈ TÍNH CÁC TRẬN ĐÃ KẾT THÚC (FINISHED) CÓ TỈ SỐ HỢP LỆ
    // TUYỆT ĐỐI KHÔNG TÍNH CÁC TRẬN SẮP ĐÁ (UPCOMING / CHƯA ĐÁ)
    let finishedMatches = matches.filter(m => {
        const st = String(m.Status || "").trim().toUpperCase();
        if (st === "UPCOMING") return false;
        if (st === "FINISHED") {
            const hasH = m.HomeScore !== undefined && m.HomeScore !== null && String(m.HomeScore).trim() !== "";
            const hasA = m.AwayScore !== undefined && m.AwayScore !== null && String(m.AwayScore).trim() !== "";
            return hasH && hasA;
        }
        return false;
    });

    let total = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let scored = 0;
    let conceded = 0;
    let recentForm = [];

    if (finishedMatches.length > 0) {
        // Sắp xếp các trận đã kết thúc theo ngày mới nhất lên đầu
        const sorted = [...finishedMatches].sort((a, b) => 
            parseMatchDate(b.Date) - parseMatchDate(a.Date)
        );

        sorted.forEach(match => {
            const home = String(match.Home || "").trim();
            const away = String(match.Away || "").trim();

            const isHome = home.toUpperCase().includes("MMO");
            const isAway = away.toUpperCase().includes("MMO");

            // Nếu trận này không có MMO tham gia thì bỏ qua
            if (!isHome && !isAway) return;

            total++;
            const mmoScore = Number(isHome ? match.HomeScore : match.AwayScore) || 0;
            const oppScore = Number(isHome ? match.AwayScore : match.HomeScore) || 0;

            scored += mmoScore;
            conceded += oppScore;

            if (mmoScore > oppScore) {
                wins++;
                if (recentForm.length < 5) recentForm.push("W");
            } else if (mmoScore < oppScore) {
                losses++;
                if (recentForm.length < 5) recentForm.push("L");
            } else {
                draws++;
                if (recentForm.length < 5) recentForm.push("D");
            }
        });
    }

    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const diff = scored - conceded;

    // Cập nhật DOM
    const winRateEl = document.getElementById("statWinRate");
    const totalEl = document.getElementById("statTotalMatches");
    const winsEl = document.getElementById("statWins");
    const drawsEl = document.getElementById("statDraws");
    const lossesEl = document.getElementById("statLosses");
    const scoredEl = document.getElementById("statGoalsScored");
    const concededEl = document.getElementById("statGoalsConceded");
    const diffEl = document.getElementById("statGoalDiff");

    if (winRateEl) winRateEl.textContent = winRate + "%";
    if (totalEl) totalEl.textContent = total;
    if (winsEl) winsEl.textContent = wins + "T";
    if (drawsEl) drawsEl.textContent = draws + "H";
    if (lossesEl) lossesEl.textContent = losses + "B";
    if (scoredEl) scoredEl.textContent = scored;
    if (concededEl) concededEl.textContent = conceded;
    if (diffEl) diffEl.textContent = (diff > 0 ? "+" : "") + diff;

    // Cập nhật thanh Progress bar tỉ lệ
    const barWin = document.getElementById("barWin");
    const barDraw = document.getElementById("barDraw");
    const barLoss = document.getElementById("barLoss");

    if (total > 0) {
        if (barWin) barWin.style.width = ((wins / total) * 100) + "%";
        if (barDraw) barDraw.style.width = ((draws / total) * 100) + "%";
        if (barLoss) barLoss.style.width = ((losses / total) * 100) + "%";
    } else {
        if (barWin) barWin.style.width = "0%";
        if (barDraw) barDraw.style.width = "0%";
        if (barLoss) barLoss.style.width = "0%";
    }

    // Cập nhật huy hiệu 5 trận gần nhất
    const badgeWrap = document.getElementById("recentFormBadges");
    if (badgeWrap) {
        if (recentForm.length === 0) {
            badgeWrap.innerHTML = '<span class="badge-empty">Chưa có trận đấu nào kết thúc</span>';
        } else {
            badgeWrap.innerHTML = recentForm.map(f => {
                const cls = f === "W" ? "win" : (f === "D" ? "draw" : "loss");
                const text = f === "W" ? "T" : (f === "D" ? "H" : "B");
                const title = f === "W" ? "Thắng" : (f === "D" ? "Hòa" : "Thua");
                return `<span class="form-badge ${cls}" title="${title}">${text}</span>`;
            }).join("");
        }
    }

    // CẬP NHẬT BẢNG VÀNG VUA PHÁ LƯỚI
    updateTopScorers(matches);
}

// ========================================
// ĐỒNG HỒ ĐẾM NGƯỢC GIỜ BÓNG LĂN
// ========================================

let countdownTimer = null;

function startMatchCountdown(dateStr, timeStr) {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }

    const daysEl = document.getElementById("cdDays");
    const hoursEl = document.getElementById("cdHours");
    const minsEl = document.getElementById("cdMins");
    const secsEl = document.getElementById("cdSecs");
    const badgeTextEl = document.getElementById("cdBadgeText");
    const titleTextEl = document.getElementById("cdTitleText");
    const pulseDotEl = document.querySelector(".cd-pulse-dot");

    if (!daysEl) return;

    const matchTime = parseMatchDateTime(dateStr, timeStr);

    if (!matchTime) {
        daysEl.textContent = "--";
        hoursEl.textContent = "--";
        minsEl.textContent = "--";
        secsEl.textContent = "--";
        if (titleTextEl) titleTextEl.textContent = "CHƯA CÓ LỊCH THI ĐẤU MỚI";
        if (badgeTextEl) badgeTextEl.textContent = "WAITING FIXTURE";
        return;
    }

    function update() {
        const now = Date.now();
        const diff = matchTime - now;

        // Trường hợp 1: Trận đấu đang diễn ra trong vòng 2 tiếng kể từ giờ bóng lăn
        if (diff <= 0 && diff > -2 * 60 * 60 * 1000) {
            daysEl.textContent = "00";
            hoursEl.textContent = "00";
            minsEl.textContent = "00";
            secsEl.textContent = "00";
            if (badgeTextEl) badgeTextEl.textContent = "MATCH IN PROGRESS";
            if (titleTextEl) titleTextEl.textContent = "🔥 TRẬN ĐẤU ĐANG DIỄN RA TRÊN SÂN!";
            if (pulseDotEl) {
                pulseDotEl.style.background = "#22c55e";
                pulseDotEl.style.boxShadow = "0 0 10px #22c55e";
            }
            return;
        }

        // Trường hợp 2: Trận đấu đã qua hơn 2 tiếng (Đã kết thúc)
        if (diff <= -2 * 60 * 60 * 1000) {
            daysEl.textContent = "00";
            hoursEl.textContent = "00";
            minsEl.textContent = "00";
            secsEl.textContent = "00";
            if (badgeTextEl) badgeTextEl.textContent = "FULL TIME";
            if (titleTextEl) titleTextEl.textContent = "TRẬN ĐẤU ĐÃ KẾT THÚC";
            if (pulseDotEl) {
                pulseDotEl.style.background = "#888";
                pulseDotEl.style.boxShadow = "none";
            }
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
            return;
        }

        // Trường hợp 3: Trận đấu sắp tới -> Đếm ngược chính xác Ngày, Giờ, Phút, Giây
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        daysEl.textContent = String(Math.max(0, days)).padStart(2, "0");
        hoursEl.textContent = String(Math.max(0, hours)).padStart(2, "0");
        minsEl.textContent = String(Math.max(0, mins)).padStart(2, "0");
        secsEl.textContent = String(Math.max(0, secs)).padStart(2, "0");

        if (days === 0) {
            if (badgeTextEl) badgeTextEl.textContent = "MATCHDAY • HÔM NAY";
            if (titleTextEl) titleTextEl.textContent = "🔥 BÓNG LĂN HÔM NAY - ĐẾM NGƯỢC GIỜ RA SÂN";
        } else {
            if (badgeTextEl) badgeTextEl.textContent = "KICK-OFF COUNTDOWN";
            if (titleTextEl) titleTextEl.textContent = "ĐẾM NGƯỢC GIỜ BÓNG LĂN";
        }
        if (pulseDotEl) {
            pulseDotEl.style.background = "#ff4757";
            pulseDotEl.style.boxShadow = "0 0 8px #ff4757";
        }
    }

    update();
    countdownTimer = setInterval(update, 1000);
}

// ========================================
// HỆ THỐNG ĐIỂM DANH RA SÂN (PRO ATHLETIC ROSTER)
// ========================================

const MMO_ROSTER_INFO = {
    "Nguyen sida": { num: "C", role: "Coach / HLV Trưởng", photo: "img/Nguyen.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    "Thôi Nghé": { num: "27", role: "Tiền vệ Trung tâm", photo: "img/Thoi.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    "Thịnh Bánh Mỳ": { num: "07", role: "Tiền vệ Cánh", photo: "img/lethinh.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    "Lê Huy": { num: "25", role: "Trung vệ Thép", photo: "img/Huy.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    "Ngô Hiếu": { num: "99", role: "Hậu vệ Biên", photo: "img/hiu.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    "Bin cunha": { num: "17", role: "Tiền vệ Tấn công", photo: "img/thinh.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    "Khải futsal": { num: "13", role: "Tiền vệ Điều tiết", photo: "img/Khải.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    "Sỹ sancho": { num: "12", role: "Tiền đạo Cánh", photo: "img/Sysancho.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    "Quang bamboo": { num: "10", role: "Tiền đạo Mục tiêu", photo: "img/Quang.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    "Vũ Đệ": { num: "47", role: "Hậu vệ Thòng", photo: "img/vu.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    "Quốc DeGea": { num: "08", role: "Thủ môn", photo: "img/Quoc.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 },
    "MMO": { num: "00", role: "Đội Trưởng", photo: "img/mèo.jpg", baseGoals: 0, baseAttended: 0, baseAbsent: 0 }
};

var DEFAULT_TROPHIES = [];

var DEFAULT_MOMENTS = [];

// HÀM CHUẨN HÓA LINK GOOGLE DRIVE THÀNH LINK ẢNH HIỂN THỊ TRỰC TIẾP TẢI NHANH
function formatDriveImageUrl(url) {
    if (!url || typeof url !== "string") return url || "";
    let clean = url.trim();
    const fileIdMatch = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w1000`;
    }
    return clean;
}

// ========================================
// ĐỒNG BỘ CẦU THỦ THÊM MỚI TỪ ADMIN (LOCALSTORAGE & CLOUD)
// ========================================

const MMO_BASE_DEFAULT_PHOTOS = {
    "Nguyen sida": "img/Nguyen.jpg",
    "Thôi Nghé": "img/Thoi.jpg",
    "Thịnh Bánh Mỳ": "img/lethinh.jpg",
    "Lê Huy": "img/Huy.jpg",
    "Ngô Hiếu": "img/hiu.jpg",
    "Bin cunha": "img/thinh.jpg",
    "Khải futsal": "img/Khải.jpg",
    "Sỹ sancho": "img/Sysancho.jpg",
    "Quang bamboo": "img/Quang.jpg",
    "Vũ Đệ": "img/vu.jpg",
    "Quốc DeGea": "img/Quoc.jpg",
    "MMO": "img/mèo.jpg"
};

const DEFAULT_CORE_PLAYERS = [
    { baseName: "Nguyen sida", name: "Nguyen sida", num: "C", role: "Coach / HLV Trưởng", photoClass: "photo-one", defaultPhoto: "img/Nguyen.jpg", featured: true },
    { baseName: "Thôi Nghé", name: "Thôi Nghé", num: "27", role: "Tiền vệ Trung tâm", photoClass: "photo-two", defaultPhoto: "img/Thoi.jpg", featured: false },
    { baseName: "Thịnh Bánh Mỳ", name: "Thịnh Bánh Mỳ", num: "07", role: "Tiền vệ Cánh", photoClass: "photo-three", defaultPhoto: "img/lethinh.jpg", featured: false },
    { baseName: "Lê Huy", name: "Lê Huy", num: "25", role: "Trung vệ Thép", photoClass: "photo-four", defaultPhoto: "img/Huy.jpg", featured: false },
    { baseName: "Ngô Hiếu", name: "Ngô Hiếu", num: "99", role: "Hậu vệ Biên", photoClass: "photo-five", defaultPhoto: "img/hiu.jpg", featured: true },
    { baseName: "Bin cunha", name: "Bin cunha", num: "17", role: "Tiền vệ Tấn công", photoClass: "photo-six", defaultPhoto: "img/thinh.jpg", featured: false },
    { baseName: "Khải futsal", name: "Khải futsal", num: "13", role: "Tiền vệ Điều tiết", photoClass: "photo-seven", defaultPhoto: "img/Khải.jpg", featured: false },
    { baseName: "Sỹ sancho", name: "Sỹ sancho", num: "12", role: "Tiền đạo Cánh", photoClass: "photo-eight", defaultPhoto: "img/Sysancho.jpg", featured: false },
    { baseName: "Quang bamboo", name: "Quang bamboo", num: "10", role: "Tiền đạo Mục tiêu", photoClass: "photo-nine", defaultPhoto: "img/Quang.jpg", featured: true },
    { baseName: "Vũ Đệ", name: "Vũ Đệ", num: "47", role: "Hậu vệ Thòng", photoClass: "photo-ten", defaultPhoto: "img/vu.jpg", featured: false },
    { baseName: "Quốc DeGea", name: "Quốc DeGea", num: "08", role: "Thủ môn", photoClass: "photo-eleven", defaultPhoto: "img/Quoc.jpg", featured: false },
    { baseName: "MMO", name: "MMO", num: "00", role: "Đội Trưởng", photoClass: "photo-twelve", defaultPhoto: "img/mèo.jpg", featured: false }
];

function getEnglishRole(posOrRole) {
    const low = String(posOrRole || "").toLowerCase();
    if (low.includes("hlv") || low.includes("coach") || low.includes("huấn luyện")) return "COACH";
    if (low.includes("thủ môn") || low.includes("gk") || low.includes("goal")) return "GOALKEEPER";
    if (low.includes("hậu vệ") || low.includes("trung vệ") || low.includes("thòng") || low.includes("biên") || low.includes("defen")) return "DEFENDER";
    if (low.includes("tiền vệ") || low.includes("trung tâm") || low.includes("cánh") || low.includes("midfield")) return "MIDFIELDER";
    if (low.includes("tiền đạo") || low.includes("mục tiêu") || low.includes("cắm") || low.includes("striker") || low.includes("forward")) return "FORWARD";
    if (low.includes("đội trưởng") || low.includes("captain")) return "CAPTAIN";
    return "PLAYER";
}

function normalizePlayerName(name) {
    return String(name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

function getUnifiedSquadList() {
    let photoOverrides = {};
    try { photoOverrides = JSON.parse(localStorage.getItem("mmo_player_photos")) || {}; } catch (e) {}

    let infoOverrides = {};
    try { infoOverrides = JSON.parse(localStorage.getItem("mmo_player_info_overrides")) || {}; } catch (e) {}

    let hiddenPlayers = new Set();
    try {
        const rawHidden = JSON.parse(localStorage.getItem("mmo_hidden_players")) || [];
        hiddenPlayers = new Set(rawHidden.map(n => normalizePlayerName(n)));
    } catch (e) {}

    let customList = [];
    try { customList = JSON.parse(localStorage.getItem("mmo_custom_players")) || []; } catch (e) {}

    const squad = [];
    const addedNames = new Set();

    // 1. Quét 12 cầu thủ cốt lõi của MMO FC
    DEFAULT_CORE_PLAYERS.forEach(bp => {
        const baseNorm = normalizePlayerName(bp.baseName);
        if (hiddenPlayers.has(baseNorm)) return;

        // Tìm thông tin tùy chỉnh (override số áo, vị trí, tên mới) từ Admin hoặc Google Sheet
        const pInfo = infoOverrides[bp.baseName] 
            || Object.entries(infoOverrides).find(([k]) => normalizePlayerName(k) === baseNorm)?.[1];

        const currentName = (pInfo && pInfo.name) ? String(pInfo.name).trim() : bp.name;
        if (hiddenPlayers.has(normalizePlayerName(currentName))) return;

        const currentNum = (pInfo && pInfo.num !== undefined && String(pInfo.num).trim() !== "") ? String(pInfo.num).trim() : bp.num;
        const currentRole = (pInfo && (pInfo.pos || pInfo.role)) ? (pInfo.pos || pInfo.role) : bp.role;
        const baseGoals = (pInfo && pInfo.baseGoals !== undefined) ? Number(pInfo.baseGoals) : 0;
        const baseAttended = (pInfo && pInfo.baseAttended !== undefined) ? Number(pInfo.baseAttended) : 0;

        // Tìm ảnh tùy chỉnh từ Admin hoặc Drive
        const customPhoto = photoOverrides[currentName] || photoOverrides[bp.baseName] || (pInfo && pInfo.photo) || "";
        const photoUrl = customPhoto ? formatDriveImageUrl(customPhoto) : bp.defaultPhoto;

        const isFeatured = bp.featured || currentNum === "C" || currentNum === "99" || currentNum === "10" || String(currentRole).toLowerCase().includes("hlv") || String(currentRole).toLowerCase().includes("đội trưởng");

        squad.push({
            baseName: bp.baseName,
            name: currentName,
            num: currentNum,
            role: currentRole,
            pos: currentRole,
            photo: photoUrl,
            customPhoto: !!customPhoto,
            photoClass: customPhoto ? "" : bp.photoClass,
            featured: isFeatured,
            baseGoals: baseGoals,
            baseAttended: baseAttended,
            isCustom: false
        });
        addedNames.add(baseNorm);
        addedNames.add(normalizePlayerName(currentName));
    });

    // 2. Quét các cầu thủ thêm mới (Custom Players từ Admin / Google Sheets)
    customList.forEach(cp => {
        if (!cp || !cp.name) return;
        const norm = normalizePlayerName(cp.name);
        if (hiddenPlayers.has(norm) || addedNames.has(norm)) return;

        const customPhoto = cp.photo || photoOverrides[cp.name] || "";
        const photoUrl = customPhoto ? formatDriveImageUrl(customPhoto) : "";
        const currentNum = cp.num !== undefined ? String(cp.num).trim() : "#";
        const currentRole = cp.pos || cp.role || "Cầu thủ MMO FC";
        const isFeatured = currentNum === "C" || String(currentRole).toLowerCase().includes("hlv") || String(currentRole).toLowerCase().includes("đội trưởng");

        squad.push({
            baseName: cp.name,
            name: cp.name,
            num: currentNum || "#",
            role: currentRole,
            pos: currentRole,
            photo: photoUrl,
            customPhoto: !!photoUrl,
            photoClass: "",
            featured: isFeatured,
            baseGoals: Number(cp.baseGoals) || 0,
            baseAttended: Number(cp.baseAttended) || 0,
            isCustom: true
        });
        addedNames.add(norm);
    });

    return squad;
}

function syncCustomPlayers(cloudPlayers) {
    let customList = [];
    try {
        customList = JSON.parse(localStorage.getItem("mmo_custom_players")) || [];
    } catch (e) {}

    let photoOverrides = {};
    try {
        photoOverrides = JSON.parse(localStorage.getItem("mmo_player_photos")) || {};
    } catch (e) {}

    let infoOverrides = {};
    try {
        infoOverrides = JSON.parse(localStorage.getItem("mmo_player_info_overrides")) || {};
    } catch (e) {}

    // Hợp nhất dữ liệu cầu thủ từ Google Sheets nếu có
    if (Array.isArray(cloudPlayers) && cloudPlayers.length > 0) {
        // Lọc trùng lặp từ Google Sheet (chỉ giữ bản ghi mới nhất của mỗi cầu thủ)
        const uniqueCloudPlayers = [];
        const seenNames = new Set();
        for (let i = cloudPlayers.length - 1; i >= 0; i--) {
            const cp = cloudPlayers[i];
            if (!cp || !cp.name) continue;
            const norm = normalizePlayerName(cp.name);
            if (!seenNames.has(norm)) {
                seenNames.add(norm);
                uniqueCloudPlayers.unshift(cp);
            }
        }

        uniqueCloudPlayers.forEach(cp => {
            if (!cp || !cp.name) return;
            const cpNorm = normalizePlayerName(cp.name);

            // Kiểm tra xem cầu thủ này có phải là cầu thủ cốt lõi của đội không
            const coreMatch = DEFAULT_CORE_PLAYERS.find(bp => {
                const bNorm = normalizePlayerName(bp.baseName);
                const nNorm = normalizePlayerName(bp.name);
                return bNorm === cpNorm || nNorm === cpNorm;
            });

            if (coreMatch) {
                // Cập nhật thông tin đè trực tiếp vào cầu thủ cốt lõi, KHÔNG tạo thêm cầu thủ mới
                infoOverrides[coreMatch.baseName] = {
                    name: cp.name,
                    num: cp.num !== undefined ? String(cp.num).trim() : coreMatch.num,
                    pos: cp.pos || cp.role || coreMatch.role,
                    role: cp.role || cp.pos || coreMatch.role,
                    baseGoals: Number(cp.baseGoals) || 0,
                    baseAttended: Number(cp.baseAttended) || 0,
                    photo: cp.photo || ""
                };
                if (cp.photo) {
                    photoOverrides[coreMatch.baseName] = formatDriveImageUrl(cp.photo);
                    photoOverrides[cp.name] = formatDriveImageUrl(cp.photo);
                }
            } else {
                // Là cầu thủ tự thêm mới (Custom Player)
                if (cp.photo) {
                    photoOverrides[cp.name] = formatDriveImageUrl(cp.photo);
                }
                const idx = customList.findIndex(item => normalizePlayerName(item.name) === cpNorm);
                if (idx === -1) {
                    customList.push(cp);
                } else {
                    customList[idx] = { ...customList[idx], ...cp };
                }
            }
        });

        try {
            localStorage.setItem("mmo_custom_players", JSON.stringify(customList));
            localStorage.setItem("mmo_player_photos", JSON.stringify(photoOverrides));
            localStorage.setItem("mmo_player_info_overrides", JSON.stringify(infoOverrides));
        } catch (e) {}
    }

    // Nạp toàn bộ danh sách hợp nhất vào MMO_ROSTER_INFO toàn cục
    const unified = getUnifiedSquadList();
    for (const k of Object.keys(MMO_ROSTER_INFO)) {
        delete MMO_ROSTER_INFO[k];
    }
    unified.forEach(p => {
        MMO_ROSTER_INFO[p.name] = {
            num: p.num,
            role: p.role,
            pos: p.pos,
            photo: p.photo,
            baseGoals: p.baseGoals || 0,
            baseAttended: p.baseAttended || 0,
            baseAbsent: 0,
            isCustom: p.isCustom
        };
    });

    // Cập nhật ngay lập tức giao diện MEET THE SQUAD, danh sách điểm danh và bảng vua phá lưới
    renderDynamicSquadCards();
    initAttendancePlayerSelect();
    updateTopScorers(matchData);
}

function renderDynamicSquadCards() {
    const grid = document.getElementById("squadGrid");
    if (!grid) return;

    const squad = getUnifiedSquadList();

    grid.innerHTML = squad.map(p => {
        const enRole = getEnglishRole(p.role);
        const featClass = p.featured ? "featured" : "";
        const safeName = String(p.name).replace(/'/g, "\\'");

        let photoStyle = "";
        if (p.photo && (p.customPhoto || !p.photoClass)) {
            photoStyle = `background-image: linear-gradient(0deg, #111, transparent 70%), url('${p.photo}');`;
        } else if (!p.photoClass && !p.photo) {
            photoStyle = `background: #1a1c26; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #64748b;`;
        }

        return `
            <article class="player-card ${featClass}" data-player="${p.name}" onclick="openPlayerDetailModal('${safeName}')" title="Bấm xem thành tích & số trận của ${p.name}">
                <div class="player-photo ${p.photoClass}" style="${photoStyle}"></div>
                <div class="player-number">${p.num}</div>
                <div class="player-info">
                    <small>${enRole}</small>
                    <h3>${p.name}</h3>
                    <span>${p.role}</span>
                </div>
            </article>
        `;
    }).join("");
}

function getPlayerMeta(name) {
    if (!name) return { num: "#", role: "Cầu thủ MMO FC", photo: "" };

    const squad = getUnifiedSquadList();
    const low = name.toLowerCase().trim();
    const norm = normalizePlayerName(name);

    // 1. Khớp theo tên chuẩn hóa (không dấu)
    let found = squad.find(p => {
        const pNorm = normalizePlayerName(p.name);
        const bNorm = normalizePlayerName(p.baseName);
        return pNorm === norm || bNorm === norm;
    });
    if (found) return found;

    // 2. Khớp chính xác tên hiển thị hoặc tên gốc
    found = squad.find(p => p.name.toLowerCase().trim() === low || (p.baseName && p.baseName.toLowerCase().trim() === low));
    if (found) return found;

    // 3. Khớp bao hàm
    if (norm.length >= 3) {
        found = squad.find(p => {
            const pNorm = normalizePlayerName(p.name);
            return pNorm.includes(norm) || norm.includes(pNorm);
        });
        if (found) return found;
    }

    // 4. Tra trong MMO_ROSTER_INFO
    if (MMO_ROSTER_INFO[name]) return MMO_ROSTER_INFO[name];

    return { num: "#", role: "Cầu thủ MMO FC", photo: "" };
}

function renderPlayerTile(item, statusType) {
    const meta = getPlayerMeta(item.name);
    return `
        <div class="player-roster-tile ${statusType}">
            <div class="prt-jersey">#${meta.num}</div>
            <div class="prt-body">
                <span class="prt-name">${item.name}</span>
                <span class="prt-role">${meta.role}</span>
            </div>
            <div class="prt-time">${item.time || ""}</div>
        </div>
    `;
}

let upcomingMatchesList = [];
let selectedMatchIndex = 0;
let currentMatchKey = "";

// Định dạng văn bản hiển thị trong Dropdown: "Thứ mấy, ngày mấy (Giờ) — vs [Đối thủ]"
function formatMatchPickerOptionText(m) {
    const away = m.Away || "Đang tìm đối thủ";
    const dateStr = String(m.Date || "").trim();
    const timeStr = String(m.Time || "").trim();

    const formattedDate = formatDisplayDate(dateStr, timeStr);
    const formattedTime = formatDisplayTime(timeStr);

    let text = formattedDate !== "Chưa có lịch" ? formattedDate : "Trận thi đấu sắp tới";

    if (formattedTime && formattedTime !== "Sẽ cập nhật" && formattedTime !== "--:--") {
        text += ` (${formattedTime})`;
    }

    text += ` — vs ${away}`;
    return text;
}

// ========================================
// RENDER DROPDOWN CHỌN TRẬN ĐẤU ĐIỂM DANH
// ========================================

function renderMatchPickerDropdown(matches) {
    const selectEl = document.getElementById("pickerMatchSelect");
    const pickerWrap = document.getElementById("attMatchPicker");
    if (!pickerWrap) return;

    if (!matches || matches.length === 0) {
        pickerWrap.style.display = "none";
        return;
    }

    pickerWrap.style.display = "block";

    if (selectEl) {
        selectEl.innerHTML = matches.map((m, idx) => {
            const isSelected = idx === selectedMatchIndex ? "selected" : "";
            const optionText = formatMatchPickerOptionText(m);
            return `<option value="${idx}" ${isSelected}>${optionText}</option>`;
        }).join("");
        selectEl.value = selectedMatchIndex;
    }
}

// Giữ alias tương thích
function renderMatchPickerTabs(matches) {
    renderMatchPickerDropdown(matches);
}

function switchAttendanceMatch(index) {
    if (!upcomingMatchesList || !upcomingMatchesList[index]) return;
    selectedMatchIndex = index;

    // Đồng bộ giá trị chọn trên dropdown
    const selectEl = document.getElementById("pickerMatchSelect");
    if (selectEl && parseInt(selectEl.value, 10) !== index) {
        selectEl.value = index;
    }

    const match = upcomingMatchesList[index];

    // Nạp dữ liệu điểm danh riêng cho trận này
    loadAttendance(match);

    // Đồng thời cập nhật đồng hồ đếm ngược giờ bóng lăn cho trận này
    startMatchCountdown(match.Date, match.Time);
}

// ========================================
// CHUẨN HÓA MÃ TRẬN ĐẤU (CANONICAL MATCH KEY) & DỌN DẸP DỮ LIỆU CŨ
// ========================================

function getMatchCanonicalKey(matchOrDate, opponent) {
    if (!matchOrDate) return "mmo_match_fixture";
    let dateStr = "";
    let oppStr = "";

    if (typeof matchOrDate === "object") {
        dateStr = String(matchOrDate.Date || matchOrDate.matchDate || "");
        oppStr = String(matchOrDate.Away || matchOrDate.matchOpponent || matchOrDate.opponent || "");
    } else {
        dateStr = String(matchOrDate || "");
        oppStr = String(opponent || "");
    }

    dateStr = dateStr.replace(/^mmo_attendance_/, "").replace(/^mmo_match_/, "");

    let cleanDate = "";
    const dm = dateStr.match(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
    if (dm) {
        cleanDate = `${String(dm[1]).padStart(2, "0")}_${String(dm[2]).padStart(2, "0")}_${dm[3]}`;
    } else if (dateStr.includes("GMT") || dateStr.includes("T") || (dateStr.length > 8 && !isNaN(Date.parse(dateStr)))) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            const dd = String(d.getDate()).padStart(2, "0");
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const yyyy = d.getFullYear();
            if (yyyy >= 2020) cleanDate = `${dd}_${mm}_${yyyy}`;
        }
    }

    if (!cleanDate) {
        cleanDate = dateStr.trim().toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20) || "fixture";
    }

    return `mmo_match_${cleanDate}`;
}

// Tự động dọn dẹp và hợp nhất các key rác cũ trong localStorage về key chuẩn duy nhất
function cleanupLegacyAttendanceKeys() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("mmo_attendance_")) {
            if (!k.startsWith("mmo_attendance_mmo_match_")) {
                try {
                    const oldRecs = JSON.parse(localStorage.getItem(k)) || [];
                    const canon = getMatchCanonicalKey(k);
                    const targetKey = "mmo_attendance_" + canon;
                    let targetRecs = [];
                    try { targetRecs = JSON.parse(localStorage.getItem(targetKey)) || []; } catch (e) {}

                    oldRecs.forEach(o => {
                        const idx = targetRecs.findIndex(t => String(t.name || "").toLowerCase() === String(o.name || "").toLowerCase());
                        if (idx === -1) {
                            targetRecs.push(o);
                        } else if (o.status) {
                            targetRecs[idx].status = o.status;
                        }
                    });
                    localStorage.setItem(targetKey, JSON.stringify(targetRecs));
                } catch (e) {}
                keysToRemove.push(k);
            }
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
}

// ========================================
// ĐỒNG BỘ ĐIỂM DANH TỪ GOOGLE SHEET VỀ LOCALSTORAGE
// ========================================

function syncAttendanceFromCloud(cloudRecords) {
    if (!Array.isArray(cloudRecords) || cloudRecords.length === 0) return;

    // Lưu bản sao dữ liệu đám mây để tính toán đối chiếu
    try {
        localStorage.setItem("mmo_cloud_attendance", JSON.stringify(cloudRecords));
    } catch (e) {}

    const grouped = {};
    cloudRecords.forEach(row => {
        const canonKey = getMatchCanonicalKey(row.matchDate || row.matchKey, row.matchOpponent || "");
        if (!grouped[canonKey]) grouped[canonKey] = [];
        const rName = String(row.playerName || "").trim();
        if (!grouped[canonKey].some(r => r.name.toLowerCase() === rName.toLowerCase())) {
            grouped[canonKey].push({
                name: rName,
                status: row.status || "yes",
                time: row.time || ""
            });
        }
    });

    for (const [k, recs] of Object.entries(grouped)) {
        const storageKey = "mmo_attendance_" + k;
        localStorage.setItem(storageKey, JSON.stringify(recs));
    }

    // Tự động dọn dẹp key cũ không bị trùng lặp
    cleanupLegacyAttendanceKeys();

    if (currentMatchKey) {
        const curKey = "mmo_attendance_" + currentMatchKey;
        try {
            const currentRecs = JSON.parse(localStorage.getItem(curKey));
            if (currentRecs) renderAttendance(currentRecs);
        } catch (e) {}
    }
}

function loadAttendance(match) {
    if (!match) return;

    const home = match.Home || "MMO FC";
    const away = match.Away || "Đang tìm đối thủ";
    const date = match.Date || "Chưa có lịch";
    const time = match.Time || "--:--";
    const location = match.Location || "Sẽ cập nhật sân";
    const tourn = match.Tournament || "Giao hữu";

    // Sử dụng canonical key chuẩn hóa
    currentMatchKey = getMatchCanonicalKey(match);

    // Cập nhật thông tin chi tiết trận đấu cần điểm danh
    const titleEl = document.getElementById("attMatchTitle");
    const dateEl = document.getElementById("attDateTag");
    const timeEl = document.getElementById("attTimeTag");
    const locEl = document.getElementById("attLocationTag");
    const tournEl = document.getElementById("attTournTag");

    if (titleEl) {
        titleEl.innerHTML = `
            <span class="att-team-home">${home}</span>
            <span class="att-team-sep">VS</span>
            <span class="att-team-away">${away}</span>
        `;
    }
    if (dateEl) dateEl.textContent = formatDisplayDate(date, time);
    if (timeEl) timeEl.textContent = formatDisplayTime(time);
    if (locEl) locEl.textContent = location;
    if (tournEl) tournEl.textContent = tourn;

    const storageKey = "mmo_attendance_" + currentMatchKey;
    let records = [];
    try {
        records = JSON.parse(localStorage.getItem(storageKey)) || [];
    } catch (e) {
        records = [];
    }
    renderAttendance(records);
}

function selectAttStatus(status) {
    const valInput = document.getElementById("attendanceStatusVal");
    if (valInput) valInput.value = status;
    document.querySelectorAll(".btn-att-pill").forEach(b => b.classList.remove("active"));
    const activeBtn = document.querySelector(`.btn-att-pill.att-${status}`);
    if (activeBtn) activeBtn.classList.add("active");
}

function handleAttendanceSubmit(event) {
    event.preventDefault();
    const playerSelect = document.getElementById("attendancePlayer");
    const playerName = playerSelect.value;
    const status = document.getElementById("attendanceStatusVal").value || "yes";

    if (!playerName) {
        alert("Vui lòng chọn tên của bạn trong danh sách đội!");
        return;
    }

    const activeMatch = upcomingMatchesList[selectedMatchIndex] || null;
    const matchCanon = currentMatchKey || (activeMatch ? getMatchCanonicalKey(activeMatch) : "mmo_match_upcoming");
    const storageKey = "mmo_attendance_" + matchCanon;
    let records = [];
    try {
        records = JSON.parse(localStorage.getItem(storageKey)) || [];
    } catch (e) {
        records = [];
    }

    // Cho phép đổi ý: xóa lựa chọn cũ nếu cùng tên
    records = records.filter(r => r.name !== playerName);
    records.push({
        name: playerName,
        status: status,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    });

    localStorage.setItem(storageKey, JSON.stringify(records));
    renderAttendance(records);

    // Gửi ngầm lên Apps Script (Google Sheets)
    try {
        fetch(API_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "submit_attendance",
                playerName: playerName,
                status: status,
                matchKey: matchCanon,
                matchDate: activeMatch ? activeMatch.Date : matchCanon,
                matchOpponent: activeMatch ? activeMatch.Away : ""
            })
        });
    } catch (e) {}

    const matchName = activeMatch ? `Trận ${activeMatch.Date} (vs ${activeMatch.Away})` : "trận đấu";
    const statusText = status === "yes" ? "SẴN SÀNG RA SÂN" : (status === "maybe" ? "50/50 CHỜ XẾP LỊCH" : "BÁO BẬN NGHỈ ĐÁ");
    alert(`✓ ĐÃ GHI NHẬN ĐIỂM DANH: ${playerName}\n${matchName}\nTrạng thái: ${statusText}`);
}

function renderAttendance(records) {
    const yesList = document.getElementById("listAttYes");
    const maybeList = document.getElementById("listAttMaybe");
    const noList = document.getElementById("listAttNo");
    const totalEl = document.getElementById("attTotalPlayers");
    const statusBadge = document.getElementById("attSquadStatus");
    const progressBar = document.getElementById("attSquadBar");
    const progressText = document.getElementById("attSquadProgressText");

    if (!yesList) return;

    const yesItems = records.filter(r => r.status === "yes");
    const maybeItems = records.filter(r => r.status === "maybe");
    const noItems = records.filter(r => r.status === "no");

    const totalYes = yesItems.length;

    // Cập nhật số đếm
    const countYesEl = document.getElementById("countAttYes");
    const countMaybeEl = document.getElementById("countAttMaybe");
    const countNoEl = document.getElementById("countAttNo");

    if (countYesEl) countYesEl.textContent = totalYes;
    if (countMaybeEl) countMaybeEl.textContent = maybeItems.length;
    if (countNoEl) countNoEl.textContent = noItems.length;
    if (totalEl) totalEl.textContent = totalYes;

    // Thanh đo tiến độ đội hình (chuẩn 14 cầu thủ full đội: 7 chính + 7 dự bị)
    const pct = Math.min(100, Math.round((totalYes / 14) * 100));
    if (progressBar) progressBar.style.width = pct + "%";

    // Cập nhật tình trạng quân số & chỉ số sẵn sàng
    if (statusBadge) {
        if (totalYes === 0) {
            statusBadge.textContent = "CHƯA CÓ AI BÁO CẦU";
            statusBadge.className = "squad-readiness-badge status-warning";
            if (progressText) progressText.textContent = "0 / 7 cầu đá chính (Cần thêm 7 cầu để đủ đội)";
        } else if (totalYes < 5) {
            statusBadge.textContent = `THIẾU QUÂN (MỚI CÓ ${totalYes} CẦU)`;
            statusBadge.className = "squad-readiness-badge status-danger";
            if (progressText) progressText.textContent = `${totalYes} / 7 cầu đá chính (Còn thiếu ${7 - totalYes} cầu để đủ sân 7)`;
        } else if (totalYes < 7) {
            statusBadge.textContent = `SẴN SÀNG SÂN 5 (THIẾU ${7 - totalYes} CẦU SÂN 7)`;
            statusBadge.className = "squad-readiness-badge status-warning";
            if (progressText) progressText.textContent = `${totalYes} / 7 cầu (Đủ đá sân 5, thiếu ${7 - totalYes} cầu để đủ sân 7)`;
        } else if (totalYes <= 9) {
            statusBadge.textContent = `ĐỦ ĐỘI HÌNH SÂN 7 (${totalYes} CẦU SẴN SÀNG)`;
            statusBadge.className = "squad-readiness-badge status-ready";
            if (progressText) progressText.textContent = `Đã đủ 7/7 cầu chính${totalYes > 7 ? ` + ${totalYes - 7} cầu dự bị` : ""}`;
        } else {
            statusBadge.textContent = `ĐÔNG ĐỦ QUÂN SỐ (${totalYes} CẦU - FULL DỰ BỊ)`;
            statusBadge.className = "squad-readiness-badge status-fire";
            if (progressText) progressText.textContent = `Đội hình lý tưởng: 7 cầu đá chính + ${totalYes - 7} cầu dự bị sẵn sàng xoay tua!`;
        }
    }

    // Hiển thị danh sách thẻ cầu thủ chuyên nghiệp
    yesList.innerHTML = yesItems.length > 0
        ? yesItems.map(i => renderPlayerTile(i, "tile-ready")).join("")
        : '<div class="att-empty-slot">Chưa có ai điểm danh</div>';

    maybeList.innerHTML = maybeItems.length > 0
        ? maybeItems.map(i => renderPlayerTile(i, "tile-standby")).join("")
        : '<div class="att-empty-slot">Chưa có ai</div>';

    noList.innerHTML = noItems.length > 0
        ? noItems.map(i => renderPlayerTile(i, "tile-absent")).join("")
        : '<div class="att-empty-slot">Chưa có ai</div>';
}

// ========================================
// BẢNG VÀNG VUA PHÁ LƯỚI (TOP SCORERS)
// ========================================

function updateTopScorers(matches) {
    const listEl = document.getElementById("topScorersList");
    if (!listEl) return;

    const resetTime = Number(localStorage.getItem("mmo_reset_timestamp")) || 0;
    let preResetMatches = [];
    try {
        preResetMatches = JSON.parse(localStorage.getItem("mmo_pre_reset_matches")) || [];
    } catch (e) {}

    let hiddenPlayers = [];
    try {
        hiddenPlayers = JSON.parse(localStorage.getItem("mmo_hidden_players")) || [];
    } catch (e) {}
    const hiddenSet = new Set(hiddenPlayers.map(h => String(h).trim().toLowerCase()));

    // Khởi tạo bảng thành tích từ baseGoals của các cầu thủ trong đội hình
    const scorerCounts = {};
    for (const [name, meta] of Object.entries(MMO_ROSTER_INFO)) {
        if (!name || hiddenSet.has(name.toLowerCase().trim())) continue;
        const base = resetTime > 0 ? 0 : (Number(meta && meta.baseGoals) || 0);
        scorerCounts[name] = base;
    }

    // Nạp thêm cầu thủ tùy chỉnh nếu có
    try {
        const customList = JSON.parse(localStorage.getItem("mmo_custom_players")) || [];
        customList.forEach(cp => {
            if (cp && cp.name && !hiddenSet.has(cp.name.toLowerCase().trim())) {
                if (scorerCounts[cp.name] === undefined) {
                    scorerCounts[cp.name] = resetTime > 0 ? 0 : (Number(cp.baseGoals) || 0);
                }
            }
        });
    } catch (e) {}

    // Tập hợp danh sách trận đấu: ưu tiên tham số matches, sau đó tới matchData, window.matchData, cache
    let pool = (Array.isArray(matches) && matches.length > 0)
        ? matches
        : ((Array.isArray(matchData) && matchData.length > 0)
            ? matchData
            : ((Array.isArray(window.matchData) && window.matchData.length > 0)
                ? window.matchData
                : []));

    if (pool.length === 0) {
        try {
            const cached = JSON.parse(localStorage.getItem("mmo_matches_cache"));
            if (Array.isArray(cached)) pool = cached;
        } catch (e) {}
    }

    if (typeof applyScoresOverride === "function") {
        pool = applyScoresOverride(pool);
    }

    const scannedMatchKeys = new Set();

    function accumulateScorersString(scorersStr) {
        if (!scorersStr) return;
        const parts = String(scorersStr).split(/[,;\n]+/);
        parts.forEach(p => {
            const matchRegex = p.match(/(.*?)[(:]([0-9]+)[)]?/);
            let name = "";
            let goals = 1;
            if (matchRegex) {
                name = matchRegex[1].trim();
                goals = parseInt(matchRegex[2], 10) || 1;
            } else if (p.trim()) {
                name = p.trim();
                goals = 1;
            }
            if (!name) return;
            const norm = name.toLowerCase().trim();
            let matchedKey = null;
            for (const k of Object.keys(scorerCounts)) {
                const kNorm = k.toLowerCase().trim();
                if (kNorm === norm || (norm.length >= 3 && (kNorm.includes(norm) || norm.includes(kNorm)))) {
                    matchedKey = k;
                    break;
                }
            }
            if (matchedKey) {
                scorerCounts[matchedKey] += goals;
            } else if (!hiddenSet.has(norm)) {
                scorerCounts[name] = (scorerCounts[name] || 0) + goals;
            }
        });
    }

    // Quét cộng dồn bàn thắng mới từ các trận FINISHED trong pool
    (pool || []).forEach(m => {
        if (!m) return;
        const status = String(m.Status || "").trim().toUpperCase();
        if (status === "FINISHED" && m.Scorers) {
            const mKey = (typeof getMatchCanonicalKey === "function")
                ? getMatchCanonicalKey(m)
                : (String(m.Date || "") + "_" + String(m.Opponent || ""));
            if (resetTime > 0 && preResetMatches.includes(mKey)) return;
            scannedMatchKeys.add(mKey);
            accumulateScorersString(m.Scorers);
        }
    });

    // Quét trực tiếp thêm từ mmo_scores_sync để cập nhật ngay khi Admin vừa bấm lưu tỉ số trận đấu
    try {
        const scoresSync = JSON.parse(localStorage.getItem("mmo_scores_sync")) || {};
        for (const [sKey, sVal] of Object.entries(scoresSync)) {
            if (!sVal || !sVal.Scorers) continue;
            const canonKey = (typeof getMatchCanonicalKey === "function") ? getMatchCanonicalKey(sVal) : sKey;
            if (resetTime > 0 && preResetMatches.includes(canonKey)) continue;
            if (!scannedMatchKeys.has(canonKey)) {
                scannedMatchKeys.add(canonKey);
                accumulateScorersString(sVal.Scorers);
            }
        }
    } catch (e) {}

    const sortedScorers = Object.entries(scorerCounts)
        .filter(([_, goals]) => goals > 0)
        .map(([name, goals]) => ({ name, goals }))
        .sort((a, b) => b.goals - a.goals);

    if (sortedScorers.length === 0) {
        listEl.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 32px 20px; color: #94a3b8; font-size: 14px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
                <span style="font-size: 26px; display: block; margin-bottom: 8px;">⚽</span>
                Chưa có bàn thắng nào được ghi trong mùa giải mới.
            </div>`;
        return;
    }

    listEl.innerHTML = sortedScorers.slice(0, 6).map((s, idx) => {
        const rank = idx + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : "";
        const meta = MMO_ROSTER_INFO[s.name] || (typeof getPlayerMeta === "function" ? getPlayerMeta(s.name) : {});
        const role = (meta && (meta.role || meta.pos)) || "Cầu thủ MMO FC";
        const num = (meta && meta.num) ? `#${meta.num}` : "#";
        const photoUrl = (meta && meta.photo) || (MMO_BASE_DEFAULT_PHOTOS[s.name] || "");
        const safeName = String(s.name).replace(/'/g, "\\'");
        const photoStyle = photoUrl ? `background-image: url('${photoUrl}');` : "";

        return `
            <div class="scorer-card ${rankClass}" onclick="openPlayerDetailModal('${safeName}')" style="cursor: pointer;" title="Bấm để xem hồ sơ và thành tích chi tiết của ${s.name}">
                <div class="scorer-rank">${rank}</div>
                <div class="scorer-avatar" style="${photoStyle}">
                    ${!photoUrl ? `<span class="scorer-num">${num}</span>` : ''}
                </div>
                <div class="scorer-info">
                    <strong>${s.name}</strong>
                    <span>${role}</span>
                </div>
                <div class="scorer-goals">
                    ${s.goals}
                    <small>BÀN THẮNG</small>
                </div>
            </div>
        `;
    }).join("");
}

// ========================================
// XEM LỊCH SỬ ĐỘI BÓNG
// ========================================

function showTeamHistory(teamName) {
    const modal = document.getElementById("historyModal");
    const title = document.getElementById("historyTeamName");
    const list = document.getElementById("historyList");

    title.textContent = teamName;
    list.innerHTML = "";

    // LẤY CÁC TRẬN ĐÃ KẾT THÚC
    const teamMatches = matchData
        .filter(match =>
            String(match.Status || "").trim().toUpperCase() === "FINISHED" &&
            (
                String(match.Home || "").trim() === teamName.trim() ||
                String(match.Away || "").trim() === teamName.trim()
            )
        )
        .sort((a, b) =>
            parseMatchDate(b.Date) - parseMatchDate(a.Date)
        );

    if (teamMatches.length === 0) {
        list.textContent = "Đội bóng chưa có lịch sử thi đấu.";
    }

    teamMatches.forEach(match => {
        const isHome = match.Home.trim() === teamName.trim();

        const teamScore = Number(
            isHome ? match.HomeScore : match.AwayScore
        );

        const opponentScore = Number(
            isHome ? match.AwayScore : match.HomeScore
        );

        let result = "HÒA";
        let resultClass = "draw";

        if (teamScore > opponentScore) {
            result = "THẮNG";
            resultClass = "win";
        } else if (teamScore < opponentScore) {
            result = "THUA";
            resultClass = "loss";
        }

        // TẠO PHẦN TỬ LỊCH SỬ
        const item = document.createElement("div");
        item.className = "history-item";

        const info = document.createElement("div");

        const teams = document.createElement("strong");
        teams.textContent = match.Home + " vs " + match.Away;

        const date = document.createElement("small");
        date.textContent =
            match.Date + (isHome ? " · Sân nhà" : " · Sân khách");

        const resultLabel = document.createElement("div");
        resultLabel.className = "history-result " + resultClass;
        resultLabel.textContent = result;

        const score = document.createElement("div");
        score.className = "history-score";
        score.textContent =
            match.HomeScore + " : " + match.AwayScore;

        info.appendChild(teams);
        info.appendChild(date);
        info.appendChild(resultLabel);

        item.appendChild(info);
        item.appendChild(score);

        list.appendChild(item);
    });

    modal.classList.add("active");
}

// ========================================
// ĐÓNG MODAL
// ========================================

function closeTeamHistory() {
    document.getElementById("historyModal")
        .classList.remove("active");
}

// ========================================
// TỰ ĐỘNG ĐỒNG BỘ DANH SÁCH CẦU THỦ VÀO MENU ĐIỂM DANH
// ========================================

function initAttendancePlayerSelect() {
    const sel = document.getElementById("attendancePlayer");
    if (!sel) return;

    const squad = getUnifiedSquadList();
    let html = '<option value="">-- Bấm để chọn danh tính cầu thủ MMO FC --</option>';
    squad.forEach(p => {
        html += `<option value="${p.name}">#${p.num} - ${p.name} (${p.role})</option>`;
    });
    sel.innerHTML = html;
}

// ========================================
// KHỞI CHẠY KHI TRANG ĐÃ SẴN SÀNG
// ========================================

document.addEventListener("DOMContentLoaded", function () {
    cleanupLegacyAttendanceKeys();
    syncCustomPlayers([]);
    loadMatches();
    initAttendancePlayerSelect();
    loadHighlightsCovers();
    renderTrophyYearFilters();
    renderTrophiesSlider();

    // Bắt sự kiện click trên tất cả thẻ và ảnh cầu thủ ở Section 02
    document.querySelectorAll(".player-card").forEach(card => {
        card.addEventListener("click", function (e) {
            const h3 = this.querySelector("h3");
            const pName = this.getAttribute("data-player") || (h3 ? h3.textContent.trim() : "");
            if (pName) {
                openPlayerDetailModal(pName);
            }
        });
    });

    // KHÔI PHỤC VỊ TRÍ ĐỨNG KHI RELOAD TRANG (F5)
    try {
        const hash = window.location.hash;
        const lastSec = hash ? hash.replace("#", "") : sessionStorage.getItem("mmo_current_section");
        if (lastSec && lastSec !== "home") {
            const targetEl = document.getElementById(lastSec);
            if (targetEl) {
                setTimeout(() => {
                    targetEl.scrollIntoView({ behavior: "smooth" });
                }, 150);
            }
        }
    } catch (e) {}
});

// Lưu vị trí cuộn trang hiện tại vào sessionStorage để giữ nguyên khi reload
window.addEventListener("scroll", () => {
    let current = "home";
    sections.forEach(section => {
        if (window.scrollY >= section.offsetTop - 150) current = section.id;
    });
    try {
        sessionStorage.setItem("mmo_current_section", current);
    } catch (e) {}
});

// ========================================
// HÀM XỬ LÝ NHẬN KÈO THI ĐẤU
// ========================================

async function handleBookMatch(event) {
    event.preventDefault();

    const submitBtn = document.getElementById("btnSubmitMatch");
    const statusText = document.getElementById("bookingStatus");

    // Lấy thông tin từ form
    const opponentName = document.getElementById("opponentName").value.trim();
    const opponentPhone = document.getElementById("opponentPhone").value.trim();
    const opponentFbEl = document.getElementById("opponentFb");
    const opponentFb = opponentFbEl ? opponentFbEl.value.trim() : "";
    const matchDate = document.getElementById("matchBookDate").value;
    const matchTime = document.getElementById("matchBookTime") ? document.getElementById("matchBookTime").value : "19:00";
    const flexibleTime = document.getElementById("matchBookFlexibleTime") ? document.getElementById("matchBookFlexibleTime").value.trim() : "";
    const pitch = document.getElementById("matchBookPitch").value;
    const note = document.getElementById("matchBookNote").value.trim();

    if (!opponentName) {
        statusText.style.color = "#ff8888";
        statusText.textContent = "❌ Vui lòng nhập tên đội bóng của bạn!";
        document.getElementById("opponentName").focus();
        return;
    }

    // 1. KIỂM TRA SỐ ĐIỆN THOẠI ĐÚNG ĐỊNH DẠNG (10 SỐ VIỆT NAM BẮT ĐẦU BẰNG 03, 05, 07, 08, 09)
    const cleanPhone = opponentPhone.replace(/[\s\.-]/g, "");
    const phoneRegex = /^(\+?84|0)[35789][0-9]{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
        statusText.style.color = "#ff8888";
        statusText.textContent = "❌ Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số di động Việt Nam (bắt đầu bằng 03, 05, 07, 08, 09).";
        document.getElementById("opponentPhone").focus();
        return;
    }

    // 2. BẮT BUỘC LINK FACEBOOK
    if (!opponentFb) {
        statusText.style.color = "#ff8888";
        statusText.textContent = "❌ Vui lòng nhập link Facebook đội bóng hoặc người đại diện!";
        if (opponentFbEl) opponentFbEl.focus();
        return;
    }

    if (!opponentFb.toLowerCase().includes("facebook.com") && !opponentFb.toLowerCase().includes("fb.com") && !opponentFb.startsWith("http")) {
        statusText.style.color = "#ff8888";
        statusText.textContent = "❌ Link Facebook không đúng định dạng (Ví dụ: https://www.facebook.com/tenban)!";
        if (opponentFbEl) opponentFbEl.focus();
        return;
    }

    // Hiển thị trạng thái đang gửi
    submitBtn.disabled = true;
    submitBtn.textContent = "ĐANG GỬI THÔNG TIN...";
    statusText.textContent = "";

    try {
        let combinedNote = note;
        if (flexibleTime) {
            combinedNote = combinedNote ? `${combinedNote} | (Khung giờ chuyển dự phòng: ${flexibleTime})` : `Khung giờ chuyển dự phòng: ${flexibleTime}`;
        }

        const payload = {
            action: "book_match",
            opponentName: opponentName,
            opponentPhone: cleanPhone,
            opponentFb: opponentFb,
            matchDate: matchDate,
            matchTime: matchTime,
            flexibleTime: flexibleTime,
            pitch: pitch,
            note: combinedNote,
            createdAt: new Date().toLocaleString("vi-VN")
        };

        // 1. Lưu bản sao vào localStorage để Admin nhận ngay lập tức
        let localReqs = [];
        try {
            localReqs = JSON.parse(localStorage.getItem("mmo_booking_requests")) || [];
        } catch (e) {}
        localReqs.unshift({
            id: Date.now(),
            opponentName: opponentName,
            opponentPhone: cleanPhone,
            opponentFb: opponentFb,
            matchDate: matchDate,
            matchTime: matchTime,
            flexibleTime: flexibleTime,
            pitch: pitch,
            note: combinedNote,
            status: "PENDING",
            createdAt: new Date().toLocaleString("vi-VN")
        });
        localStorage.setItem("mmo_booking_requests", JSON.stringify(localReqs));

        // 2. Gửi dữ liệu qua Google Apps Script (POST)
        await fetch(API_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });

        // Phản hồi thành công
        statusText.style.color = "#a6ffb2";
        statusText.textContent = "✓ Đã gửi thông tin thành công! MMO FC sẽ liên hệ lại với bạn sớm nhất.";
        document.getElementById("matchBookingForm").reset();

    } catch (err) {
        console.error("Lỗi gửi kèo:", err);
        statusText.style.color = "#ffcccc";
        statusText.textContent = "Có lỗi kết nối. Bạn có thể nhắn tin trực tiếp qua Zalo!";
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "GỬI KÈO THI ĐẤU <b>↗</b>";
    }
}

// ========================================
// ĐIỀU KHIỂN MODAL QR ZALO
// ========================================

function openZaloModal() {
    const modal = document.getElementById("zaloModal");
    if (modal) {
        modal.classList.add("active");
    }
}

function closeZaloModal(event) {
    if (!event || event.target.id === "zaloModal" || event.target.classList.contains("zalo-modal-close")) {
        const modal = document.getElementById("zaloModal");
        if (modal) {
            modal.classList.remove("active");
        }
    }
}

// ========================================
// TÍNH TOÁN & HIỂN THỊ CHI TIẾT CẦU THỦ (PLAYER STATS MODAL)
// ========================================

function getPlayerDetailedStats(playerName) {
    try {
        const meta = getPlayerMeta(playerName);
        const resetTime = Number(localStorage.getItem("mmo_reset_timestamp")) || 0;
        let preResetMatches = [];
        try {
            preResetMatches = JSON.parse(localStorage.getItem("mmo_pre_reset_matches")) || [];
        } catch (e) {}
        let preResetAttSet = new Set();
        try {
            preResetAttSet = new Set(JSON.parse(localStorage.getItem("mmo_pre_reset_attendance")) || []);
        } catch (e) {}

        let goals = resetTime > 0 ? 0 : (Number(meta.baseGoals) || 0);
        let baseAttended = resetTime > 0 ? 0 : (Number(meta.baseAttended) || 0);
        let baseAbsent = resetTime > 0 ? 0 : (Number(meta.baseAbsent) || 0);

        const norm = String(playerName || "").trim().toLowerCase();

        // 1. Quét cộng dồn bàn thắng từ các trận FINISHED mới (Google Sheets / Cache / Memory)
        const scanned = new Set();
        const matchesPool = (Array.isArray(matchData) && matchData.length > 0) 
            ? matchData 
            : (Array.isArray(window.matchData) && window.matchData.length > 0 ? window.matchData : []);

        if (matchesPool.length === 0) {
            try {
                const cached = JSON.parse(localStorage.getItem("mmo_matches_cache"));
                if (Array.isArray(cached)) matchesPool.push(...cached);
            } catch (e) {}
        }

        if (Array.isArray(matchesPool)) {
            matchesPool.forEach(m => {
                if (m && String(m.Status || "").trim().toUpperCase() === "FINISHED" && m.Scorers) {
                    const mKey = getMatchCanonicalKey(m);
                    if (resetTime > 0 && preResetMatches.includes(mKey)) return;
                    scanned.add(mKey);
                    const parts = String(m.Scorers).split(/[,;\n]+/);
                    parts.forEach(p => {
                        const matchRegex = p.match(/(.*?)[(:]([0-9]+)[)]?/);
                        if (matchRegex) {
                            const name = matchRegex[1].trim().toLowerCase();
                            if (name === norm || (norm.length > 2 && (name.includes(norm) || norm.includes(name)))) {
                                goals += parseInt(matchRegex[2], 10) || 1;
                            }
                        } else if (p.trim()) {
                            const name = p.trim().toLowerCase();
                            if (name === norm || (norm.length > 2 && (name.includes(norm) || norm.includes(name)))) {
                                goals += 1;
                            }
                        }
                    });
                }
            });
        }

        // 2. Quét cộng dồn từ mmo_scores_sync (nếu có trận mới lưu từ Admin)
        try {
            const scoresSync = JSON.parse(localStorage.getItem("mmo_scores_sync")) || {};
            for (const [k, sVal] of Object.entries(scoresSync)) {
                if (!sVal) continue;
                const sKey = getMatchCanonicalKey(sVal);
                if (resetTime > 0 && preResetMatches.includes(sKey)) continue;
                if (!scanned.has(sKey) && sVal.Scorers) {
                    const parts = String(sVal.Scorers).split(/[,;\n]+/);
                    parts.forEach(p => {
                        const matchRegex = p.match(/(.*?)[(:]([0-9]+)[)]?/);
                        if (matchRegex) {
                            const name = matchRegex[1].trim().toLowerCase();
                            if (name === norm || (norm.length > 2 && (name.includes(norm) || norm.includes(name)))) {
                                goals += parseInt(matchRegex[2], 10) || 1;
                            }
                        } else if (p.trim()) {
                            const name = p.trim().toLowerCase();
                            if (name === norm || (norm.length > 2 && (name.includes(norm) || norm.includes(name)))) {
                                goals += 1;
                            }
                        }
                    });
                }
            }
        } catch (e) {}

        // 3. Quét số trận ra sân và vắng từ lịch sử điểm danh
        const attendedMatches = new Set();
        const absentMatches = new Set();

        // A. Quét từ dữ liệu đám mây (mmo_cloud_attendance)
        let cloudAtt = [];
        try {
            const raw = JSON.parse(localStorage.getItem("mmo_cloud_attendance"));
            if (Array.isArray(raw)) cloudAtt = raw;
        } catch (e) {}

        cloudAtt.forEach(row => {
            if (!row) return;
            const rName = String(row.playerName || "").trim().toLowerCase();
            if (rName === norm || (norm.length > 2 && (rName.includes(norm) || norm.includes(rName)))) {
                const canonId = getMatchCanonicalKey(row.matchDate || row.matchKey, row.matchOpponent || "");
                if (resetTime > 0) {
                    const sig = (String(row.matchDate || row.matchKey || "") + "_" + String(row.matchOpponent || "") + "_" + rName).toLowerCase().replace(/\s+/g, "");
                    if (preResetAttSet.has(sig)) return;
                    if (preResetMatches.includes(canonId)) return;
                    if (row.timestamp && Number(row.timestamp) < resetTime) return;
                }

                if (row.status === "yes") {
                    attendedMatches.add(canonId);
                    absentMatches.delete(canonId);
                } else if (row.status === "no") {
                    absentMatches.add(canonId);
                    attendedMatches.delete(canonId);
                }
            }
        });

        // B. Quét từ các bản ghi điểm danh trong localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("mmo_attendance_")) {
                try {
                    const recs = JSON.parse(localStorage.getItem(key)) || [];
                    const canonId = getMatchCanonicalKey(key);
                    if (resetTime > 0 && preResetMatches.includes(canonId)) continue;

                    if (Array.isArray(recs)) {
                        recs.forEach(r => {
                            if (!r) return;
                            const rName = String(r.name || "").trim().toLowerCase();
                            if (rName === norm || (norm.length > 2 && (rName.includes(norm) || norm.includes(rName)))) {
                                if (resetTime > 0) {
                                    const sig = (canonId + "_" + rName).toLowerCase().replace(/\s+/g, "");
                                    if (preResetAttSet.has(sig)) return;
                                }

                                if (r.status === "yes") {
                                    attendedMatches.add(canonId);
                                    absentMatches.delete(canonId);
                                } else if (r.status === "no") {
                                    absentMatches.add(canonId);
                                    attendedMatches.delete(canonId);
                                }
                            }
                        });
                    }
                } catch (e) {}
            }
        }

        const attended = baseAttended + attendedMatches.size;
        const absent = baseAbsent + absentMatches.size;
        const totalTracked = attended + absent;
        const rate = totalTracked > 0 ? Math.round((attended / totalTracked) * 100) : (attended > 0 ? 100 : 0);

        return { goals, attended, absent, rate };
    } catch (err) {
        console.warn("Lỗi tính getPlayerDetailedStats:", err);
        return { goals: 0, attended: 0, absent: 0, rate: 0 };
    }
}

function openPlayerDetailModal(playerName) {
    try {
        const modal = document.getElementById("playerModal");
        if (!modal) return;

        const meta = getPlayerMeta(playerName);
        const stats = getPlayerDetailedStats(playerName);

        // Xác định nguồn ảnh với 3 lớp bảo vệ:
        // 1. meta.photo (từ photoOverrides hoặc MMO_ROSTER_INFO)
        // 2. MMO_BASE_DEFAULT_PHOTOS (ảnh gốc trong mã nguồn)
        // 3. Ảnh từ DOM card Section 02 nếu có
        let photoSrc = meta.photo || MMO_BASE_DEFAULT_PHOTOS[playerName] || "";
        if (!photoSrc) {
            const norm = playerName.toLowerCase().trim();
            for (const [k, v] of Object.entries(MMO_BASE_DEFAULT_PHOTOS)) {
                if (k.toLowerCase().trim() === norm || norm.includes(k.toLowerCase()) || k.toLowerCase().includes(norm)) {
                    photoSrc = v;
                    break;
                }
            }
        }

        // Nếu vẫn rỗng, thử trích xuất từ thẻ DOM của Section 02
        if (!photoSrc) {
            const card = document.querySelector(`article[data-player="${playerName}"] .player-photo`);
            if (card) {
                const comp = window.getComputedStyle(card).backgroundImage;
                const m = comp.match(/url\(['"]?(.*?)['"]?\)/);
                if (m && m[1] && !m[1].includes("none")) {
                    photoSrc = m[1];
                }
            }
        }

        // Cập nhật ảnh đại diện chuẩn của cầu thủ
        const avatarEl = document.getElementById("pmAvatar");
        const btnViewPhoto = document.getElementById("pmBtnViewPhoto");

        if (avatarEl) {
            if (photoSrc) {
                avatarEl.style.backgroundImage = `linear-gradient(0deg, rgba(0,0,0,0.35) 0%, transparent 60%), url('${photoSrc}')`;
                avatarEl.style.backgroundSize = "cover";
                avatarEl.style.backgroundPosition = "center";
                avatarEl.innerHTML = `<span class="pm-avatar-badge">#${meta.num}</span>`;
                avatarEl.style.cursor = "pointer";
                avatarEl.title = "Bấm để phóng to xem ảnh";
                avatarEl.onclick = () => openImageLightbox(photoSrc, `${playerName} (#${meta.num}) · ${meta.role}`);
            } else {
                avatarEl.style.backgroundImage = "none";
                avatarEl.textContent = "#" + meta.num;
                avatarEl.style.cursor = "default";
                avatarEl.onclick = null;
            }
        }

        if (btnViewPhoto) {
            if (photoSrc) {
                btnViewPhoto.style.display = "inline-flex";
                btnViewPhoto.onclick = () => openImageLightbox(photoSrc, `${playerName} (#${meta.num}) · ${meta.role}`);
            } else {
                btnViewPhoto.style.display = "none";
            }
        }

        const elRole = document.getElementById("pmRole");
        if (elRole) elRole.textContent = meta.role;
        const elName = document.getElementById("pmName");
        if (elName) elName.textContent = playerName;
        const elJersey = document.getElementById("pmJersey");
        if (elJersey) elJersey.textContent = `SỐ ÁO: #${meta.num}`;

        const elGoals = document.getElementById("pmGoals");
        if (elGoals) elGoals.textContent = stats.goals;
        const elMatches = document.getElementById("pmMatches");
        if (elMatches) elMatches.textContent = stats.attended;
        const elAbsent = document.getElementById("pmAbsent");
        if (elAbsent) elAbsent.textContent = stats.absent;
        const elRate = document.getElementById("pmRate");
        if (elRate) elRate.textContent = stats.rate + "%";

        // Danh hiệu nổi bật tương ứng với thành tích
        const badgeWrap = document.getElementById("pmBadgeWrap");
        if (badgeWrap) {
            let badgesHtml = "";
            if (stats.goals >= 6) {
                badgesHtml = `<div class="pm-badge-honor" style="background: rgba(245, 158, 11, 0.16); border-color: rgba(245, 158, 11, 0.45); color: #fbbf24;">👑 <span>VUA PHÁ LƯỚI MMO FC (${stats.goals} BÀN THẮNG)</span></div>`;
            } else if (stats.goals >= 3) {
                badgesHtml = `<div class="pm-badge-honor" style="background: rgba(245, 158, 11, 0.16); border-color: rgba(245, 158, 11, 0.45); color: #fbbf24;">⚡ <span>CHÂN SÚT XUẤT SẮC (${stats.goals} BÀN THẮNG)</span></div>`;
            } else if (stats.rate === 100 && stats.attended >= 10) {
                badgesHtml = `<div class="pm-badge-honor" style="color: #4ade80; border-color: rgba(74,222,128,0.4); background: rgba(74,222,128,0.15);">⭐ <span>CHIẾN BINH 100% CHUYÊN CẦN (${stats.attended}/${stats.attended} TRẬN)</span></div>`;
            } else if (stats.rate >= 80) {
                badgesHtml = `<div class="pm-badge-honor" style="color: #38bdf8; border-color: rgba(56,189,248,0.4); background: rgba(56,189,248,0.15);">🔥 <span>CẦU THỦ SIÊU CHUYÊN CẦN (${stats.rate}% THAM GIA)</span></div>`;
            } else {
                badgesHtml = `<div class="pm-badge-honor" style="color: #cbd5e1; border-color: rgba(255,255,255,0.18); background: rgba(255,255,255,0.06);">⚽ <span>THÀNH VIÊN CHÍNH THỨC MMO FC</span></div>`;
            }
            badgeWrap.innerHTML = badgesHtml;
        }

        modal.classList.add("active");
    } catch (err) {
        console.error("Lỗi openPlayerDetailModal:", err);
        const modal = document.getElementById("playerModal");
        if (modal) modal.classList.add("active");
    }
}

function closePlayerModal(event) {
    if (!event || event.target.id === "playerModal" || event.target.classList.contains("player-modal-close")) {
        const modal = document.getElementById("playerModal");
        if (modal) modal.classList.remove("active");
    }
}

function openImageLightbox(src, caption) {
    if (!src) return;
    const lb = document.getElementById("playerLightbox");
    const img = document.getElementById("lightboxImg");
    const cap = document.getElementById("lightboxCaption");
    if (!lb || !img) return;

    img.src = src;
    if (cap) cap.textContent = caption || "MMO FC";
    lb.classList.add("active");
}

function closePlayerLightbox(event) {
    if (!event || event.target.id === "playerLightbox" || event.target.classList.contains("lightbox-close")) {
        const lb = document.getElementById("playerLightbox");
        if (lb) lb.classList.remove("active");
    }
}

// ========================================
// PHÒNG TRUYỀN THỐNG CÚP & DANH HIỆU (TROPHY CAROUSEL)
// ========================================

let currentTrophyIndex = 0;
let currentTrophyYearFilter = "all";

function escapeStr(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

function getTrophiesList() {
    try {
        const raw = localStorage.getItem("mmo_trophies_list");
        if (raw !== null) {
            const stored = JSON.parse(raw);
            if (Array.isArray(stored)) {
                // Lọc sạch các cúp mẫu giả định do bot tạo nếu có
                const clean = stored.filter(t => !["cup_1", "cup_2", "cup_3"].includes(t.id));
                if (clean.length !== stored.length) {
                    localStorage.setItem("mmo_trophies_list", JSON.stringify(clean));
                }
                return clean;
            }
        }
    } catch (e) {}
    return [];
}

function getFilteredTrophies() {
    const list = getTrophiesList();
    if (currentTrophyYearFilter === "all") return list;
    return list.filter(t => String(t.year || "").trim() === currentTrophyYearFilter);
}

function renderTrophyYearFilters() {
    const wrap = document.getElementById("trophyYearFilterWrap");
    if (!wrap) return;
    const list = getTrophiesList();
    if (list.length === 0) {
        wrap.innerHTML = `<button type="button" class="filter-chip active">🏆 TẤT CẢ (0)</button>`;
        return;
    }
    const years = Array.from(new Set(list.map(t => String(t.year || "2026").trim()))).sort((a, b) => b.localeCompare(a));

    let html = `<button type="button" class="filter-chip ${currentTrophyYearFilter === 'all' ? 'active' : ''}" onclick="setTrophyYearFilter('all')">🏆 TẤT CẢ (${list.length})</button>`;
    years.forEach(y => {
        const count = list.filter(t => String(t.year || "").trim() === y).length;
        html += `<button type="button" class="filter-chip ${currentTrophyYearFilter === y ? 'active' : ''}" onclick="setTrophyYearFilter('${escapeStr(y)}')">${y} (${count})</button>`;
    });
    wrap.innerHTML = html;
}

function setTrophyYearFilter(year) {
    currentTrophyYearFilter = year;
    currentTrophyIndex = 0;
    renderTrophyYearFilters();
    renderTrophiesSlider();
}

function renderTrophiesSlider() {
    const track = document.getElementById("trophySliderTrack");
    const dotsWrap = document.getElementById("trophyDotsWrap");
    if (!track) return;

    const list = getFilteredTrophies();
    if (list.length === 0) {
        track.innerHTML = `
            <div style="flex:0 0 100%; text-align:center; padding:40px 20px; color:#94a3b8;">
                <p style="font-size:36px; margin-bottom:8px;">🏆</p>
                <p style="font-size:15px; font-weight:700; color:#fff;">Phòng truyền thống đang được cập nhật</p>
                <p style="font-size:12.5px; color:#94a3b8; margin-top:4px;">Chưa có danh hiệu hoặc chiếc cúp nào được lưu.</p>
            </div>
        `;
        if (dotsWrap) dotsWrap.innerHTML = "";
        return;
    }

    if (currentTrophyIndex >= list.length) currentTrophyIndex = 0;
    if (currentTrophyIndex < 0) currentTrophyIndex = list.length - 1;

    track.innerHTML = list.map((t, idx) => {
        const typeClass = t.type === "silver" ? "type-silver" : (t.type === "bronze" ? "type-bronze" : "type-gold");
        const photoSrc = t.photo || "img/anh chinh.jpg";
        return `
            <div class="trophy-card-slide" data-index="${idx}">
                <div class="trophy-img-wrap">
                    <img src="${photoSrc}" alt="${escapeStr(t.title)}" onerror="this.onerror=null; this.src='img/anh chinh.jpg';">
                </div>
                <div class="trophy-card-body">
                    <span class="trophy-type-badge ${typeClass}">${t.typeLabel || "🏆 DANH HIỆU"}</span>
                    <h4 class="trophy-title">${t.title}</h4>
                    <span class="trophy-year">MÙA GIẢI: ${t.year || "2026"}</span>
                    <p class="trophy-desc">${t.desc || ""}</p>
                    <div class="trophy-stats-strip">
                        <span class="trophy-stat-pill"><b>Thành tích:</b> ${t.matches || "Bất bại"}</span>
                        <span class="trophy-stat-pill"><b>Ghi bàn:</b> ${t.goals || "Xuất sắc"}</span>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    track.style.transform = `translateX(-${currentTrophyIndex * 100}%)`;

    if (dotsWrap) {
        dotsWrap.innerHTML = list.map((_, idx) => `
            <div class="trophy-dot ${idx === currentTrophyIndex ? "active" : ""}" onclick="goToTrophySlide(${idx})"></div>
        `).join("");
    }
}

function slideTrophies(direction) {
    const list = getFilteredTrophies();
    if (list.length === 0) return;
    currentTrophyIndex = (currentTrophyIndex + direction + list.length) % list.length;
    renderTrophiesSlider();
}

function goToTrophySlide(index) {
    currentTrophyIndex = index;
    renderTrophiesSlider();
}

function openTrophiesModal() {
    renderTrophyYearFilters();
    renderTrophiesSlider();
    const modal = document.getElementById("trophiesModal");
    if (modal) {
        modal.style.display = "flex";
        modal.classList.add("active");
    }
}

function closeTrophiesModal(event) {
    if (!event || event.target.id === "trophiesModal" || event.target.classList.contains("trophy-modal-close") || (event.target && event.target.closest && event.target.closest(".trophy-modal-close"))) {
        const modal = document.getElementById("trophiesModal");
        if (modal) {
            modal.classList.remove("active");
            modal.style.display = "none";
        }
    }
}

// ========================================
// MÔ PHỎNG SA BÀN CHIẾN THUẬT SÂN 7 (TACTICAL SIMULATOR)
// ========================================

// ========================================
// HỆ THỐNG SA BÀN CHIẾN THUẬT ĐA NĂNG (SÂN 5 · SÂN 7 · SÂN 11)
// ========================================

var currentPitchType = "7";
var currentFormationScheme = "2-3-1";
var currentTacticalPlayers = [];
var currentTacticalBench = [];
var selectedTacticalPlayerIndex = 0;
window.currentPitchType = currentPitchType;

const ALL_TACTICAL_FORMATIONS = {
    // ------------------------------------
    // 1. SA BÀN SÂN 5 (FUTSAL / 5 NGƯỜI)
    // ------------------------------------
    "5": {
        title: "SA BÀN CHIẾN THUẬT SÂN 5 (FUTSAL)",
        defaultScheme: "1-2-1",
        schemes: {
            "1-2-1": {
                name: "SƠ ĐỒ 1-2-1 (KIM CƯƠNG FUTSAL)",
                shortName: "1-2-1 (KIM CƯƠNG)",
                desc: "Sơ đồ kinh điển sân 5: 1 Fixo trụ thòng quét sau cùng, 2 Ala cơ động 2 biên và 1 Pivot làm tường dứt điểm chớp nhoáng.",
                players: [
                    { num: "08", name: "Quốc DeGea", role: "Thủ Môn", posKey: "GK", top: 88, left: 50, note: "Phản xạ xuất thần, làm chủ khung thành nhỏ và phát bóng phản công." },
                    { num: "25", name: "Lê Huy", role: "Hậu Vệ Thòng (Fixo)", posKey: "FIXO", top: 68, left: 50, note: "Thủ lĩnh hàng thủ, đọc tình huống cắt bóng và phát động phản công." },
                    { num: "07", name: "Thịnh Bánh Mỳ", role: "Tiền Vệ Cánh Trái (Ala)", posKey: "ALA", top: 44, left: 20, note: "Khéo léo, leo biên tạt bóng và kéo giãn hàng thủ đối phương." },
                    { num: "17", name: "Bin cunha", role: "Tiền Vệ Cánh Phải (Ala)", posKey: "ALA", top: 44, left: 80, note: "Tốc độ bứt phá, bó vào trong dứt điểm chéo góc uy lực." },
                    { num: "10", name: "Quang bamboo", role: "Tiền Đạo Mục Tiêu (Pivot)", posKey: "PIVOT", top: 20, left: 50, note: "Tì đè giữ bóng xoay người, cài đè trung vệ và dứt điểm nhanh." }
                ],
                bench: [
                    { num: "27", name: "Thôi Nghé", role: "Tiền Vệ Điều Tiết", posKey: "ALA", note: "Thoát pressing cực tốt, chia bài giữa sân." },
                    { num: "99", name: "Ngô Hiếu", role: "Hậu Vệ Biên", posKey: "FIXO", note: "Đeo bám quyết liệt, áp sát dập tắt phản công." },
                    { num: "13", name: "Khải futsal", role: "Chuyên Gia Futsal", posKey: "ALA", note: "Kỹ thuật nhỏ phạm vi hẹp điêu luyện, giữ bóng tốt." },
                    { num: "12", name: "Sỹ sancho", role: "Tiền Đạo Đột Biến", posKey: "PIVOT", note: "Đi bóng lắt léo quấy rối vòng cấm." },
                    { num: "47", name: "Vũ Đệ", role: "Hậu Vệ Quét", posKey: "FIXO", note: "Đánh chặn từ xa dũng mãnh." },
                    { num: "01", name: "MMO", role: "Đội Trưởng", posKey: "CAP", note: "Thủ lĩnh tinh thần, chỉ huy toàn đội." },
                    { num: "00", name: "Nguyen sida", role: "HLV Trưởng", posKey: "COACH", note: "Thuyền trưởng đọc trận đấu và xoay tua liên tục." }
                ]
            },
            "2-2": {
                name: "SƠ ĐỒ 2-2 (TỨ GIÁC ĐỒNG ĐỀU SÂN 5)",
                shortName: "2-2 (TỨ GIÁC)",
                desc: "Chiến thuật cân bằng công thủ: 2 hậu vệ thòng dâng cao nhịp nhàng cùng 2 mũi nhọn tiền đạo hoán đổi vị trí liên tục.",
                players: [
                    { num: "08", name: "Quốc DeGea", role: "Thủ Môn", posKey: "GK", top: 88, left: 50, note: "Bảo vệ vững chắc khung thành." },
                    { num: "25", name: "Lê Huy", role: "Hậu Vệ Lệch Trái", posKey: "FIXO", top: 66, left: 30, note: "Bọc lót cánh trái và cắt bóng sớm." },
                    { num: "99", name: "Ngô Hiếu", role: "Hậu Vệ Lệch Phải", posKey: "FIXO", top: 66, left: 70, note: "Đeo bám cánh phải và dâng cao hỗ trợ." },
                    { num: "07", name: "Thịnh Bánh Mỳ", role: "Tiền Đạo Cánh Trái", posKey: "ALA", top: 24, left: 30, note: "Đột phá nách trung lộ và dứt điểm nhanh." },
                    { num: "10", name: "Quang bamboo", role: "Tiền Đạo Cắm Lệch Phải", posKey: "PIVOT", top: 24, left: 70, note: "Đón bóng hai cột xa và tì đè dứt điểm." }
                ],
                bench: [
                    { num: "27", name: "Thôi Nghé", role: "Tiền Vệ Điều Tiết", posKey: "ALA", note: "Thoát pressing cực tốt, chia bài giữa sân." },
                    { num: "17", name: "Bin cunha", role: "Tiền Vệ Cánh", posKey: "ALA", note: "Tốc độ bứt phá, dứt điểm chéo góc." },
                    { num: "13", name: "Khải futsal", role: "Chuyên Gia Futsal", posKey: "ALA", note: "Xử lý bóng kỹ thuật nhỏ phạm vi hẹp." },
                    { num: "12", name: "Sỹ sancho", role: "Tiền Đạo Đột Biến", posKey: "PIVOT", note: "Đi bóng lắt léo quấy rối vòng cấm." },
                    { num: "47", name: "Vũ Đệ", role: "Hậu Vệ Quét", posKey: "FIXO", note: "Đánh chặn từ xa dũng mãnh." },
                    { num: "01", name: "MMO", role: "Đội Trưởng", posKey: "CAP", note: "Thủ lĩnh tinh thần, chỉ huy toàn đội." },
                    { num: "00", name: "Nguyen sida", role: "HLV Trưởng", posKey: "COACH", note: "Thuyền trưởng đọc trận đấu và xoay tua liên tục." }
                ]
            },
            "1-1-2": {
                name: "SƠ ĐỒ 1-1-2 (TẤN CÔNG ÁP ĐẢO SÂN 5)",
                shortName: "1-1-2 (TẤN CÔNG)",
                desc: "Đội hình dâng cao ép sân nghẹt thở: 1 Fixo thấp nhất, 1 tiền vệ trung tâm phân phối và 2 tiền đạo áp sát vòng cấm.",
                players: [
                    { num: "08", name: "Quốc DeGea", role: "Thủ Môn", posKey: "GK", top: 88, left: 50, note: "Thủ môn dâng cao như Sweeper Keeper bọc lót bóng dài." },
                    { num: "47", name: "Vũ Đệ", role: "Hậu Vệ Đánh Chặn (Fixo)", posKey: "FIXO", top: 70, left: 50, note: "Chốt chặn thép trước khung thành, không ngại va chạm." },
                    { num: "27", name: "Thôi Nghé", role: "Tiền Vệ Điều Tiết", posKey: "ALA", top: 46, left: 50, note: "Giữ nhịp và tỉa bóng sắc sảo sang 2 biên." },
                    { num: "07", name: "Thịnh Bánh Mỳ", role: "Tiền Đạo Trái", posKey: "PIVOT", top: 22, left: 28, note: "Cắt chéo dứt điểm hoặc căng ngang dọn cỗ." },
                    { num: "10", name: "Quang bamboo", role: "Tiền Đạo Phải", posKey: "PIVOT", top: 22, left: 72, note: "Gây sức ép trực tiếp lên thủ môn đối phương." }
                ],
                bench: [
                    { num: "25", name: "Lê Huy", role: "Hậu Vệ Thòng", posKey: "FIXO", note: "Thủ lĩnh phòng ngự bọc lót." },
                    { num: "99", name: "Ngô Hiếu", role: "Hậu Vệ Biên", posKey: "FIXO", note: "Đeo bám cánh phải quyết liệt." },
                    { num: "17", name: "Bin cunha", role: "Tiền Vệ Tốc Độ", posKey: "ALA", note: "Bứt tốc phản công biên chớp nhoáng." },
                    { num: "13", name: "Khải futsal", role: "Tiền Vệ Kỹ Thuật", posKey: "ALA", note: "Giữ bóng thoát pressing điêu luyện." },
                    { num: "12", name: "Sỹ sancho", role: "Tiền Đạo Đột Biến", posKey: "PIVOT", note: "Kỹ thuật quấy rối vòng cấm." },
                    { num: "01", name: "MMO", role: "Đội Trưởng", posKey: "CAP", note: "Thủ lĩnh tinh thần toàn đội." },
                    { num: "00", name: "Nguyen sida", role: "HLV Trưởng", posKey: "COACH", note: "Điều chỉnh sơ đồ và xoay tua đội hình." }
                ]
            }
        }
    },

    // ------------------------------------
    // 2. SA BÀN SÂN 7 (TIÊU CHUẨN MINI SÂN 7)
    // ------------------------------------
    "7": {
        title: "SA BÀN CHIẾN THUẬT SÂN 7",
        defaultScheme: "2-3-1",
        schemes: {
            "2-3-1": {
                name: "SƠ ĐỒ 2-3-1 (CÂN BẰNG TIÊU CHUẨN SÂN 7)",
                shortName: "2-3-1 (CÂN BẰNG)",
                desc: "Sơ đồ thịnh hành nhất bóng đá 7 người: 2 hậu vệ chắc chắn, 1 tiền vệ trụ kết nối, 2 tiền vệ cánh dâng cao và 1 tiền đạo mục tiêu chớp thời cơ.",
                players: [
                    { num: "08", name: "Quốc DeGea", role: "Thủ Môn", posKey: "GK", top: 88, left: 50, note: "Thủ môn phản xạ xuất thần, chỉ huy hàng thủ và phát bóng phản công chuẩn xác." },
                    { num: "25", name: "Lê Huy", role: "Trung Vệ Trái", posKey: "CB", top: 72, left: 30, note: "Đá thấp bọc lót, tranh chấp dũng mãnh, không chiến làm chủ vòng cấm." },
                    { num: "99", name: "Ngô Hiếu", role: "Hậu Vệ Phải", posKey: "RB", top: 72, left: 70, note: "Tốc độ biên cực tốt, tranh chấp quyết liệt và sẵn sàng leo biên hỗ trợ cánh." },
                    { num: "27", name: "Thôi Nghé", role: "Tiền Vệ Trụ", posKey: "DMF", top: 52, left: 50, note: "Trái tim tuyến giữa, mỏ neo thu hồi bóng và phân phối bóng linh hoạt 2 cánh." },
                    { num: "07", name: "Thịnh Bánh Mỳ", role: "Tiền Vệ Cánh Trái", posKey: "LMF", top: 40, left: 22, note: "Kỹ thuật khéo léo, leo biên tạt bóng và bó trong dứt điểm hiểm hóc." },
                    { num: "17", name: "Bin cunha", role: "Tiền Vệ Cánh Phải", posKey: "RMF", top: 40, left: 78, note: "Tốc độ bứt phá, quấy phá hàng lang cánh đối phương và tạt bóng cột 2." },
                    { num: "10", name: "Quang bamboo", role: "Tiền Đạo Cắm", posKey: "ST", top: 20, left: 50, note: "Chân sút chủ lực, tì đè giữ bóng, xoay sở dứt điểm sắc bén." }
                ],
                bench: [
                    { num: "00", name: "Nguyen sida", role: "HLV Trưởng", posKey: "COACH", note: "Thuyền trưởng chỉ đạo chiến thuật và đọc trận đấu sắc bén." },
                    { num: "01", name: "MMO", role: "Đội Trưởng", posKey: "CAP", note: "Thủ lĩnh tinh thần, giữ nhịp và điều phối cự ly toàn đội." },
                    { num: "47", name: "Vũ Đệ", role: "Hậu Vệ Thép", posKey: "CB", note: "Tranh chấp mạnh mẽ, đánh chặn từ xa quyết liệt." },
                    { num: "13", name: "Khải futsal", role: "Tiền Vệ Kỹ Thuật", posKey: "CMF", note: "Xử lý bóng phạm vi hẹp, kéo bóng thoát pressing điêu luyện." },
                    { num: "12", name: "Sỹ sancho", role: "Tiền Vệ Tấn Công", posKey: "AMF", note: "Đi bóng lắt léo xé toang hàng thủ đối phương." }
                ]
            },
            "3-2-1": {
                name: "SƠ ĐỒ 3-2-1 (KHẮC TINH PHÒNG NGỰ PHẢN CÔNG)",
                shortName: "3-2-1 (PHÒNG NGỰ)",
                desc: "Chiến thuật bức tường thép: 3 hậu vệ tạo lớp chắn kiên cố trước khung thành, 2 tiền vệ trung tâm cơ động thu hồi bóng và tỉa bóng phản công nhanh cho mũi nhọn.",
                players: [
                    { num: "08", name: "Quốc DeGea", role: "Thủ Môn", posKey: "GK", top: 88, left: 50, note: "Chốt chặn cuối cùng tin cậy, làm chủ khu vực 13m." },
                    { num: "47", name: "Vũ Đệ", role: "Hậu Vệ Thòng Trái", posKey: "LB", top: 74, left: 22, note: "Bọc lót cánh trái, áp sát đối phương nhanh và phất bóng phản công." },
                    { num: "25", name: "Lê Huy", role: "Trung Vệ Thép", posKey: "CB", top: 76, left: 50, note: "Khóa chặt tiền đạo mục tiêu đối phương, chỉ huy hàng thủ." },
                    { num: "99", name: "Ngô Hiếu", role: "Hậu Vệ Biên Phải", posKey: "RB", top: 74, left: 78, note: "Đeo bám quyết liệt, bịt kín hành lang biên phải." },
                    { num: "27", name: "Thôi Nghé", role: "Tiền Vệ Trung Tâm", posKey: "CMF", top: 48, left: 34, note: "Đánh chặn từ xa, luân chuyển bóng nhanh khi chuyển đổi trạng thái." },
                    { num: "13", name: "Khải futsal", role: "Tiền Vệ Điều Tiết", posKey: "CMF", top: 48, left: 66, note: "Kỹ thuật nhỏ xử lý phạm vi hẹp, thoát pressing cực tốt." },
                    { num: "10", name: "Quang bamboo", role: "Tiền Đạo Mục Tiêu", posKey: "ST", top: 20, left: 50, note: "Độc lập tác chiến, pressing trung vệ bạn và chớp thời cơ phản công." }
                ],
                bench: [
                    { num: "07", name: "Thịnh Bánh Mỳ", role: "Hộ Công", posKey: "AMF", note: "Xâm nhập nách trung lộ, sút xa hiểm hóc." },
                    { num: "17", name: "Bin cunha", role: "Tiền Đạo Cánh", posKey: "RMF", note: "Tốc độ xé gió phản công hành lang cánh." },
                    { num: "12", name: "Sỹ sancho", role: "Tiền Vệ Đột Biến", posKey: "AMF", note: "Quấy đảo hàng thủ khi đối phương xuống sức." },
                    { num: "00", name: "Nguyen sida", role: "HLV Trưởng", posKey: "COACH", note: "Điều chỉnh sơ đồ linh hoạt theo diễn biến trận đấu." },
                    { num: "01", name: "MMO", role: "Đội Trưởng", posKey: "CAP", note: "Chỉ huy toàn đội giữ vững cự ly chiến thuật." }
                ]
            },
            "2-1-2-1": {
                name: "SƠ ĐỒ 2-1-2-1 (ÉP SÂN TỔNG LỰC TẤN CÔNG)",
                shortName: "2-1-2-1 (TẤN CÔNG)",
                desc: "Đội hình dâng cao áp đảo: 2 hậu vệ chủ động dâng cao, 1 tiền vệ trụ giữ nhịp, 2 hộ công áp sát vòng cấm hỗ trợ tiền đạo mũi nhọn bắn phá cầu môn.",
                players: [
                    { num: "08", name: "Quốc DeGea", role: "Thủ Môn", posKey: "GK", top: 88, left: 50, note: "Dâng cao đóng vai trò Sweeper Keeper bọc lót bóng dài." },
                    { num: "25", name: "Lê Huy", role: "Hậu Vệ Quét", posKey: "CB", top: 72, left: 32, note: "Cắt bóng sớm từ giữa sân, hỗ trợ phân phối bóng lên trên." },
                    { num: "47", name: "Vũ Đệ", role: "Hậu Vệ Đánh Chặn", posKey: "CB", top: 72, left: 68, note: "Tranh chấp bóng 2, phong tỏa đường phản công của bạn." },
                    { num: "27", name: "Thôi Nghé", role: "Tiền Vệ Trụ Quán Xuyến", posKey: "DMF", top: 56, left: 50, note: "Trụ cột phân phối bóng, giữ cự ly đội hình chuẩn xác." },
                    { num: "07", name: "Thịnh Bánh Mỳ", role: "Hộ Công Trái", posKey: "LAM", top: 36, left: 24, note: "Xâm nhập nách trung lộ, dứt điểm từ xa hoặc kiến tạo dọn cỗ." },
                    { num: "12", name: "Sỹ sancho", role: "Hộ Công Phải", posKey: "RAM", top: 36, left: 76, note: "Kỹ thuật lắt léo, quấy rối và tạo khoảng trống cho tiền đạo." },
                    { num: "10", name: "Quang bamboo", role: "Tiền Đạo Mũi Nhọn", posKey: "ST", top: 16, left: 50, note: "Gây sức ép trực tiếp lên thủ môn và trung vệ bạn, dứt điểm 1 chạm." }
                ],
                bench: [
                    { num: "99", name: "Ngô Hiếu", role: "Hậu Vệ Biên", posKey: "RB", note: "Tăng cường phòng ngự cánh khi cần bảo toàn tỉ số." },
                    { num: "17", name: "Bin cunha", role: "Tiền Vệ Tốc Độ", posKey: "RMF", note: "Bứt tốc phản công biên chớp nhoáng." },
                    { num: "13", name: "Khải futsal", role: "Tiền Vệ Giữ Nhịp", posKey: "CMF", note: "Cầm bóng điều tiết làm giảm hưng phấn đối thủ." },
                    { num: "00", name: "Nguyen sida", role: "HLV Trưởng", posKey: "COACH", note: "Thúc giục toàn đội pressing tầm cao gây áp lực nghẹt thở." },
                    { num: "01", name: "MMO", role: "Đội Trưởng", posKey: "CAP", note: "Cầu nối các tuyến, động viên tinh thần chiến đấu." }
                ]
            }
        }
    },

    // ------------------------------------
    // 3. SA BÀN SÂN 11 (BÓNG ĐÁ 11 NGƯỜI FIFA)
    // ------------------------------------
    "11": {
        title: "SA BÀN CHIẾN THUẬT SÂN 11 (FIFA)",
        defaultScheme: "4-3-3",
        schemes: {
            "4-3-3": {
                name: "SƠ ĐỒ 4-3-3 (TẤN CÔNG HIỆN ĐẠI SÂN 11)",
                shortName: "4-3-3 (TẤN CÔNG)",
                desc: "Sơ đồ đỉnh cao bóng đá 11 người: 4 hậu vệ tạo lớp lá chắn, 3 tiền vệ kiểm soát trung tuyến và bộ 3 tiền đạo tam tấu xé toang hàng phòng ngự đối phương.",
                players: [
                    { num: "08", name: "Quốc DeGea", role: "Thủ Môn", posKey: "GK", top: 90, left: 50, note: "Làm chủ khu vực 16m50, phản xạ xuất thần cản phá cú sút." },
                    { num: "47", name: "Vũ Đệ", role: "Hậu Vệ Cánh Trái", posKey: "LB", top: 76, left: 16, note: "Bịt kín hành lang cánh trái, leo biên hỗ trợ tấn công." },
                    { num: "25", name: "Lê Huy", role: "Trung Vệ Lệch Trái", posKey: "CB", top: 78, left: 38, note: "Thủ lĩnh hàng thủ, không chiến dũng mãnh chỉ huy bọc lót." },
                    { num: "01", name: "MMO", role: "Trung Vệ Thép", posKey: "CB", top: 78, left: 62, note: "Bọc lót thông minh, đánh chặn từ xa chuẩn xác." },
                    { num: "99", name: "Ngô Hiếu", role: "Hậu Vệ Cánh Phải", posKey: "RB", top: 76, left: 84, note: "Tốc độ dâng cao leo biên, hỗ trợ tiền đạo cánh phải." },
                    { num: "27", name: "Thôi Nghé", role: "Tiền Vệ Trụ Mỏ Neo", posKey: "CDM", top: 60, left: 50, note: "Trái tim tuyến giữa, máy quét thu hồi bóng và phân phối bóng." },
                    { num: "13", name: "Khải futsal", role: "Tiền Vệ Trung Tâm Trái", posKey: "CM", top: 48, left: 32, note: "Khéo léo thoát pressing, chuyền bóng sắc sảo sang cánh trái." },
                    { num: "17", name: "Bin cunha", role: "Tiền Vệ Con Thoi Phải", posKey: "CM", top: 48, left: 68, note: "Năng nổ tranh chấp, dâng cao tham gia dứt điểm tuyến hai." },
                    { num: "07", name: "Thịnh Bánh Mỳ", role: "Tiền Đạo Cánh Trái", posKey: "LW", top: 24, left: 18, note: "Đột phá nách trung lộ, tạt bóng dọn cỗ và sút bóng xoáy." },
                    { num: "10", name: "Quang bamboo", role: "Tiền Đạo Cắm Chủ Lực", posKey: "ST", top: 16, left: 50, note: "Chân sút số 1, tì đè giữ bóng và dứt điểm lạnh lùng." },
                    { num: "12", name: "Sỹ sancho", role: "Tiền Đạo Cánh Phải", posKey: "RW", top: 24, left: 82, note: "Đi bóng lắt léo xé toang biên phải đối phương." }
                ],
                bench: [
                    { num: "00", name: "Nguyen sida", role: "HLV Trưởng", posKey: "COACH", note: "Chỉ đạo chiến thuật toàn diện trên sa bàn sân 11." }
                ]
            },
            "4-2-3-1": {
                name: "SƠ ĐỒ 4-2-3-1 (KIỂM SOÁT TRUNG TUYẾN SÂN 11)",
                shortName: "4-2-3-1 (KIỂM SOÁT)",
                desc: "Sơ đồ thịnh hành bóng đá chuyên nghiệp: 2 tiền vệ trụ đánh chặn (Double Pivot), bộ ba hộ công sáng tạo hỗ trợ 1 trung phong cắm.",
                players: [
                    { num: "08", name: "Quốc DeGea", role: "Thủ Môn", posKey: "GK", top: 90, left: 50, note: "Làm chủ khu vực 16m50, phản xạ xuất thần cản phá cú sút." },
                    { num: "47", name: "Vũ Đệ", role: "Hậu Vệ Cánh Trái", posKey: "LB", top: 76, left: 16, note: "Bịt kín hành lang cánh trái, leo biên hỗ trợ tấn công." },
                    { num: "25", name: "Lê Huy", role: "Trung Vệ Lệch Trái", posKey: "CB", top: 78, left: 38, note: "Thủ lĩnh hàng thủ, không chiến dũng mãnh chỉ huy bọc lót." },
                    { num: "01", name: "MMO", role: "Trung Vệ Thép", posKey: "CB", top: 78, left: 62, note: "Bọc lót thông minh, đánh chặn từ xa chuẩn xác." },
                    { num: "99", name: "Ngô Hiếu", role: "Hậu Vệ Cánh Phải", posKey: "RB", top: 76, left: 84, note: "Tốc độ dâng cao leo biên, hỗ trợ tiền đạo cánh phải." },
                    { num: "27", name: "Thôi Nghé", role: "Tiền Vệ Trụ Trái", posKey: "CDM", top: 62, left: 36, note: "Đánh chặn từ xa và phân phối bóng nhịp nhàng." },
                    { num: "13", name: "Khải futsal", role: "Tiền Vệ Trụ Phải", posKey: "CDM", top: 62, left: 64, note: "Thoát pressing khu vực hẹp và giữ nhịp trận đấu." },
                    { num: "07", name: "Thịnh Bánh Mỳ", role: "Hộ Công Lệch Trái", posKey: "LAM", top: 36, left: 22, note: "Đột phá nách trung lộ, dứt điểm từ xa hoặc kiến tạo." },
                    { num: "17", name: "Bin cunha", role: "Tiền Vệ Hộ Công (Số 10)", posKey: "CAM", top: 34, left: 50, note: "Bộ não kiến thiết, chọc khe quyết định cho tiền đạo cắm." },
                    { num: "12", name: "Sỹ sancho", role: "Hộ Công Lệch Phải", posKey: "RAM", top: 36, left: 78, note: "Đi bóng lắt léo quấy phá hành lang biên phải." },
                    { num: "10", name: "Quang bamboo", role: "Tiền Đạo Cắm Mục Tiêu", posKey: "ST", top: 16, left: 50, note: "Chân sút số 1, tì đè giữ bóng và dứt điểm lạnh lùng." }
                ],
                bench: [
                    { num: "00", name: "Nguyen sida", role: "HLV Trưởng", posKey: "COACH", note: "Chỉ đạo chiến thuật toàn diện trên sa bàn sân 11." }
                ]
            },
            "3-5-2": {
                name: "SƠ ĐỒ 3-5-2 (ÁP ĐẢO TRUNG TUYẾN & SONG SÁT)",
                shortName: "3-5-2 (TRUNG TUYẾN)",
                desc: "Chiến thuật bức tường 3 trung vệ, 2 hậu vệ cánh con thoi (Wingback) dâng cao như tiền vệ và cặp tiền đạo song sát công phá vòng cấm.",
                players: [
                    { num: "08", name: "Quốc DeGea", role: "Thủ Môn", posKey: "GK", top: 90, left: 50, note: "Làm chủ khu vực 16m50, chỉ huy bọc lót hàng thủ 3 người." },
                    { num: "47", name: "Vũ Đệ", role: "Trung Vệ Lệch Trái", posKey: "CB", top: 78, left: 26, note: "Bọc lót cánh trái, áp sát nhanh dập tắt phản công." },
                    { num: "25", name: "Lê Huy", role: "Trung Vệ Quét Giữa", posKey: "CB", top: 80, left: 50, note: "Chốt chặn trung tâm, không chiến chỉ huy toàn tuyến dưới." },
                    { num: "01", name: "MMO", role: "Trung Vệ Lệch Phải", posKey: "CB", top: 78, left: 74, note: "Cắt bóng thông minh, bọc lót cánh phải an toàn." },
                    { num: "07", name: "Thịnh Bánh Mỳ", role: "Tiền Vệ Cánh Con Thoi Trái", posKey: "LWB", top: 52, left: 14, note: "Lên công về thủ không biết mệt mỏi hành lang trái." },
                    { num: "27", name: "Thôi Nghé", role: "Tiền Vệ Trung Tâm Trái", posKey: "CM", top: 54, left: 36, note: "Phân phối bóng, chuyển trạng thái từ thủ sang công." },
                    { num: "13", name: "Khải futsal", role: "Tiền Vệ Hộ Công", posKey: "CAM", top: 38, left: 50, note: "Tỉa bóng sắc sảo tạo khoảng trống cho 2 tiền đạo." },
                    { num: "17", name: "Bin cunha", role: "Tiền Vệ Trung Tâm Phải", posKey: "CM", top: 54, left: 64, note: "Tranh chấp cơ động, tham gia sút xa tuyến hai." },
                    { num: "99", name: "Ngô Hiếu", role: "Tiền Vệ Cánh Con Thoi Phải", posKey: "RWB", top: 52, left: 86, note: "Tốc độ dâng cao leo biên, hỗ trợ tiền đạo cánh phải." },
                    { num: "12", name: "Sỹ sancho", role: "Tiền Đạo Lùi (Song Sát)", posKey: "ST", top: 20, left: 36, note: "Đi bóng lắt léo quấy rối tạo cơ hội cho trung phong." },
                    { num: "10", name: "Quang bamboo", role: "Tiền Đạo Mũi Nhọn (Song Sát)", posKey: "ST", top: 18, left: 64, note: "Tì đè làm tường và chớp thời cơ săn bàn trong vòng cấm." }
                ],
                bench: [
                    { num: "00", name: "Nguyen sida", role: "HLV Trưởng", posKey: "COACH", note: "Chỉ đạo chiến thuật toàn diện trên sa bàn sân 11." }
                ]
            }
        }
    }
};

// ========================================
// HÀM TÍNH TOÁN VỊ TRÍ THI ĐẤU DỰA TRÊN QUY MÔ SÂN (SÂN 5 · 7 · 11)
// ========================================
function calculateTacticalPosition(left, top, pitchType) {
    pitchType = String(pitchType || currentPitchType || window.currentPitchType || "7");
    // ------------------------------------
    // SÂN 5 (FUTSAL)
    // ------------------------------------
    if (pitchType === "5") {
        if (top >= 78) {
            return {
                posKey: "GK",
                role: "Thủ Môn",
                zone: "Khung thành sân 5",
                desc: "Phản xạ xuất thần, làm chủ khung thành nhỏ và phát động phản công nhanh."
            };
        }
        if (top >= 52) {
            if (left < 36) {
                return {
                    posKey: "FIXO",
                    role: "Hậu Vệ Lệch Trái (Fixo)",
                    zone: "Phòng ngự cánh trái sân 5",
                    desc: "Cắt bóng biên trái, bọc lót trung lộ và luân chuyển bóng."
                };
            }
            if (left > 64) {
                return {
                    posKey: "FIXO",
                    role: "Hậu Vệ Lệch Phải (Fixo)",
                    zone: "Phòng ngự cánh phải sân 5",
                    desc: "Đeo bám quyết liệt biên phải, dập tắt các pha xâm nhập."
                };
            }
            return {
                posKey: "FIXO",
                role: "Hậu Vệ Thòng (Fixo)",
                zone: "Chốt chặn sau cùng sân 5",
                desc: "Thủ lĩnh hàng thủ Futsal, cắt bóng thông minh và chỉ đạo cự ly đội hình."
            };
        }
        if (top >= 32) {
            if (left < 36) {
                return {
                    posKey: "ALA",
                    role: "Tiền Vệ Cánh Trái (Ala Trái)",
                    zone: "Hành lang cánh trái Futsal",
                    desc: "Tốc độ leo biên, kéo giãn phòng ngự đối phương và dứt điểm nhanh."
                };
            }
            if (left > 64) {
                return {
                    posKey: "ALA",
                    role: "Tiền Vệ Cánh Phải (Ala Phải)",
                    zone: "Hành lang cánh phải Futsal",
                    desc: "Đột phá tốc độ, sút chéo góc hoặc căng ngang cho Pivot băng cắt."
                };
            }
            return {
                posKey: "ALA",
                role: "Tiền Vệ Điều Tiết (Ala Trung Tâm)",
                zone: "Khu vực trung tuyến Futsal",
                desc: "Giữ nhịp trận đấu, phân phối bóng nhanh và chia bài sang hai biên."
            };
        }
        if (left < 36) {
            return {
                posKey: "PIVOT",
                role: "Tiền Đạo Lệch Trái (Pivot)",
                zone: "Nách trái vòng cấm sân 5",
                desc: "Áp sát cầu môn, đón bóng bật ra và dứt điểm cận thành."
            };
        }
        if (left > 64) {
            return {
                posKey: "PIVOT",
                role: "Tiền Đạo Lệch Phải (Pivot)",
                zone: "Nách phải vòng cấm sân 5",
                desc: "Chớp cơ hội góc xa, đá bồi và sút bóng một chạm hiểm hóc."
            };
        }
        return {
            posKey: "PIVOT",
            role: "Tiền Đạo Mục Tiêu (Pivot)",
            zone: "Trực diện khung thành sân 5",
            desc: "Tì đè cài người làm tường, xoay sở dứt điểm chớp nhoáng trước cầu môn."
        };
    }

    // ------------------------------------
    // SÂN 11 (BÓNG ĐÁ TIÊU CHUẨN FIFA)
    // ------------------------------------
    if (pitchType === "11") {
        if (top >= 84) {
            return {
                posKey: "GK",
                role: "Thủ Môn",
                zone: "Khu vực 16m50 sân 11",
                desc: "Làm chủ vòng cấm 16m50, cản phá phản xạ và phát động tấn công bóng dài."
            };
        }
        if (top >= 66) {
            if (left < 28) {
                return {
                    posKey: "LB",
                    role: "Hậu Vệ Cánh Trái (LB)",
                    zone: "Hành lang cánh trái sân 11",
                    desc: "Phong tỏa tiền đạo cánh đối phương, dâng cao leo biên tạt bóng."
                };
            }
            if (left > 72) {
                return {
                    posKey: "RB",
                    role: "Hậu Vệ Cánh Phải (RB)",
                    zone: "Hành lang cánh phải sân 11",
                    desc: "Bịt kín hành lang biên phải, tranh chấp bóng và bọc lót trung lộ."
                };
            }
            if (left < 50) {
                return {
                    posKey: "CB",
                    role: "Trung Vệ Lệch Trái (LCB)",
                    zone: "Trung tâm hàng thủ lệch trái",
                    desc: "Không chiến mạnh mẽ, chỉ huy bọc lót và cắt các đường bóng chọc khe."
                };
            }
            return {
                posKey: "CB",
                role: "Trung Vệ Lệch Phải (RCB)",
                zone: "Trung tâm hàng thủ lệch phải",
                desc: "Tranh chấp tay đôi dũng mãnh, phong tỏa tiền đạo cắm đối phương."
            };
        }
        if (top >= 48) {
            if (left < 28) {
                return {
                    posKey: "LM",
                    role: "Tiền Vệ Cánh Trái (LM)",
                    zone: "Biên trái khu vực trung tuyến",
                    desc: "Chạy cánh cơ động, tạt bóng bổng và hỗ trợ phòng ngự từ xa."
                };
            }
            if (left > 72) {
                return {
                    posKey: "RM",
                    role: "Tiền Vệ Cánh Phải (RM)",
                    zone: "Biên phải khu vực trung tuyến",
                    desc: "Tốc độ khoét biên, căng ngang cắt mặt hoặc xâm nhập dứt điểm."
                };
            }
            if (top >= 58) {
                return {
                    posKey: "CDM",
                    role: "Tiền Vệ Trụ Quét Sân (CDM)",
                    zone: "Mỏ neo trước vòng cấm 16m50",
                    desc: "Máy quét tuyến giữa, thu hồi bóng và bẻ gãy các đợt phản công từ xa."
                };
            }
            return {
                posKey: "CM",
                role: "Tiền Vệ Trung Tâm (CM)",
                zone: "Vòng tròn trung tâm sân 11",
                desc: "Điều tiết nhịp độ trận đấu, thoát pressing và kết nối các tuyến."
            };
        }
        if (top >= 30) {
            if (left < 28) {
                return {
                    posKey: "LAM",
                    role: "Tiền Đạo Cánh Trái Dâng Cao (LAM)",
                    zone: "Nách trung lộ cánh trái",
                    desc: "Khoét sâu nách trung lộ, căng ngang dọn cỗ hoặc cứa lòng góc xa."
                };
            }
            if (left > 72) {
                return {
                    posKey: "RAM",
                    role: "Tiền Đạo Cánh Phải Dâng Cao (RAM)",
                    zone: "Nách trung lộ cánh phải",
                    desc: "Bứt tốc khoét biên phải, tạt bóng cắt mặt hoặc dứt điểm chéo góc."
                };
            }
            return {
                posKey: "CAM",
                role: "Tiền Vệ Hộ Công (CAM - Số 10)",
                zone: "Khu vực trực diện 16m50",
                desc: "Bộ não kiến thiết, chọc khe quyết định và sút xa giải tỏa thế bế tắc."
            };
        }
        if (left < 30) {
            return {
                posKey: "LW",
                role: "Tiền Đạo Cánh Trái (LW)",
                zone: "Hàng lang biên trái áp sát khung thành",
                desc: "Đột phá tốc độ, dứt điểm chéo góc hoặc căng ngang cho trung phong."
            };
        }
        if (left > 70) {
            return {
                posKey: "RW",
                role: "Tiền Đạo Cánh Phải (RW)",
                zone: "Hành lang biên phải áp sát khung thành",
                desc: "Đột phá dũng mãnh, săn bàn cột 2 hoặc chuyền ngược tuyến hai."
            };
        }
        return {
            posKey: "ST",
            role: "Tiền Đạo Cắm Mục Tiêu (ST)",
            zone: "Trực diện khung thành sân 11",
            desc: "Chân sút chủ lực, tì đè làm tường, không chiến và chớp thời cơ săn bàn."
        };
    }

    // ------------------------------------
    // SÂN 7 (TIÊU CHUẨN MẶC ĐỊNH)
    // ------------------------------------
    if (top >= 80) {
        return {
            posKey: "GK",
            role: "Thủ Môn",
            zone: "Khu vực khung thành sân nhà",
            desc: "Làm chủ khu vực 13m, bảo vệ khung thành và phát động phản công nhanh."
        };
    }
    if (top >= 60) {
        if (left < 36) {
            return {
                posKey: "LB",
                role: "Hậu Vệ Biên Trái (Thòng Trái)",
                zone: "Hành lang phòng ngự cánh trái",
                desc: "Đeo bám quyết liệt biên trái, bọc lót trung lộ và phất bóng phản công."
            };
        }
        if (left > 64) {
            return {
                posKey: "RB",
                role: "Hậu Vệ Biên Phải (Thòng Phải)",
                zone: "Hành lang phòng ngự cánh phải",
                desc: "Bịt kín hành lang biên phải, tranh chấp bóng và sẵn sàng dâng cao hỗ trợ cánh."
            };
        }
        return {
            posKey: "CB",
            role: "Trung Vệ Thép (Thòng Giữa)",
            zone: "Trung tâm hàng phòng ngự",
            desc: "Chỉ huy toàn bộ hàng thủ, không chiến làm chủ vòng cấm và dập tắt các đợt hãm thành."
        };
    }
    if (top >= 44) {
        if (left < 36) {
            return {
                posKey: "LMF",
                role: "Tiền Vệ Cánh Trái",
                zone: "Hành lang biên trái tuyến giữa",
                desc: "Leo biên dâng cao tạt bóng, hỗ trợ phòng ngự từ xa và bó trong dứt điểm."
            };
        }
        if (left > 64) {
            return {
                posKey: "RMF",
                role: "Tiền Vệ Cánh Phải",
                zone: "Hành lang biên phải tuyến giữa",
                desc: "Tốc độ bứt phá quấy rối hành lang cánh, tạt cột 2 hoặc sút xa uy lực."
            };
        }
        if (top >= 52) {
            return {
                posKey: "DMF",
                role: "Tiền Vệ Trụ Mỏ Neo",
                zone: "Đáy tuyến giữa (Mỏ neo)",
                desc: "Thu hồi bóng, đánh chặn từ xa trước vòng cấm và phân phối bóng linh hoạt 2 cánh."
            };
        }
        return {
            posKey: "CMF",
            role: "Tiền Vệ Trung Tâm (Nhạc Trưởng)",
            zone: "Vòng tròn trung tâm giữa sân",
            desc: "Cầm trịch trận đấu, điều tiết nhịp độ, thoát pressing và kết nối các tuyến."
        };
    }
    if (top >= 26) {
        if (left < 36) {
            return {
                posKey: "LW",
                role: "Tiền Đạo Cánh Trái",
                zone: "Cánh trái dâng cao áp sát vòng cấm",
                desc: "Khoét sâu nách trung lộ đối phương, căng ngang dọn cỗ hoặc cứa lòng góc xa."
            };
        }
        if (left > 64) {
            return {
                posKey: "RW",
                role: "Tiền Đạo Cánh Phải",
                zone: "Cánh phải dâng cao áp sát vòng cấm",
                desc: "Bứt tốc khoét biên phải, căng ngang cắt mặt hoặc dứt điểm chéo góc hiểm hóc."
            };
        }
        return {
            posKey: "CAM",
            role: "Tiền Vệ Hộ Công (Số 10)",
            zone: "Trung lộ trực diện trước vòng cấm",
            desc: "Cung cấp những đường chuyền chọc khe quyết định và sẵn sàng tung cú sút xa giải tỏa."
        };
    }
    if (left < 36) {
        return {
            posKey: "LF",
            role: "Tiền Đạo Lệch Trái",
            zone: "Khu vực 13m lệch trái cầu môn",
            desc: "Áp sát cầu môn từ mạn trái, chớp cơ hội đá bồi và dứt điểm góc hẹp."
        };
    }
    if (left > 64) {
        return {
            posKey: "RF",
            role: "Tiền Đạo Lệch Phải",
            zone: "Khu vực 13m lệch phải cầu môn",
            desc: "Đón bóng hai cột xa, đệm bóng cận thành và dứt điểm chéo góc uy lực."
        };
    }
    return {
        posKey: "ST",
        role: "Tiền Đạo Cắm (Mũi Nhọn)",
        zone: "Trực diện khung thành đối phương",
        desc: "Tì đè làm tường, độc lập tác chiến, săn bàn chớp nhoáng trong khu vực 13m."
    };
}

function selectPitchType(type) {
    type = String(type || currentPitchType || window.currentPitchType || "7");
    currentPitchType = type;
    window.currentPitchType = type;
    const config = ALL_TACTICAL_FORMATIONS[currentPitchType] || ALL_TACTICAL_FORMATIONS["7"];

    // Cập nhật trạng thái nút quy mô sân
    document.querySelectorAll(".btn-pitch-type").forEach(btn => {
        btn.classList.toggle("active", btn.id === `btnPitch${currentPitchType}`);
    });

    // Cập nhật tiêu đề sa bàn
    const titleEl = document.getElementById("tacticsModalMainTitle");
    if (titleEl) titleEl.textContent = config.title;

    // Cập nhật đường kẻ sân trên soccer-pitch
    const pitchEl = document.getElementById("soccerPitch");
    if (pitchEl) {
        pitchEl.classList.remove("pitch-size-5", "pitch-size-7", "pitch-size-11");
        pitchEl.classList.add(`pitch-size-${currentPitchType}`);
    }

    // Tải sơ đồ mặc định của loại sân
    renderTacticsField(config.defaultScheme);
}
window.selectPitchType = selectPitchType;

function initTacticsPitchButtons() {
    const b5 = document.getElementById("btnPitch5");
    const b7 = document.getElementById("btnPitch7");
    const b11 = document.getElementById("btnPitch11");
    if (b5) {
        b5.onclick = function(e) { if (e && e.preventDefault) e.preventDefault(); selectPitchType("5"); };
    }
    if (b7) {
        b7.onclick = function(e) { if (e && e.preventDefault) e.preventDefault(); selectPitchType("7"); };
    }
    if (b11) {
        b11.onclick = function(e) { if (e && e.preventDefault) e.preventDefault(); selectPitchType("11"); };
    }
}
window.initTacticsPitchButtons = initTacticsPitchButtons;

function renderTacticsSchemeButtons() {
    const selector = document.getElementById("tacticsSchemeSelector");
    if (!selector) return;

    const config = ALL_TACTICAL_FORMATIONS[currentPitchType] || ALL_TACTICAL_FORMATIONS["7"];
    const schemeKeys = Object.keys(config.schemes);

    let html = schemeKeys.map((key) => {
        const item = config.schemes[key];
        const isActive = key === currentFormationScheme;
        return `<button type="button" class="btn-scheme ${isActive ? "active" : ""}" onclick="switchFormation('${key}')">${item.shortName || item.name}</button>`;
    }).join("");

    html += `<button type="button" class="btn-scheme btn-reset-pitch" onclick="resetTacticalFormation()" title="Khôi phục lại vị trí chuẩn ban đầu">🔄 ĐẶT LẠI VỊ TRÍ</button>`;

    selector.innerHTML = html;
}

// ========================================
// QUẢN LÝ CẦU THỦ MƯỢN NGOÀI (VIỆN BINH ĐÁ SÂN 11 / GIAO LƯU)
// ========================================
function getGuestBorrowedPlayers() {
    let list = [];
    try {
        list = JSON.parse(localStorage.getItem("mmo_guest_players")) || [];
    } catch (e) {}
    return list;
}

function saveGuestBorrowedPlayers(list) {
    localStorage.setItem("mmo_guest_players", JSON.stringify(list));
    // Đồng bộ sang mmo_custom_players với cờ isGuest: true
    let customList = [];
    try { customList = JSON.parse(localStorage.getItem("mmo_custom_players")) || []; } catch(e) {}
    customList = customList.filter(p => !p.isGuest);
    list.forEach(g => {
        customList.push({
            name: g.name,
            num: g.num || "M",
            pos: g.pos || g.role || "Cầu thủ mượn ngoài",
            isCustom: true,
            isGuest: true,
            note: g.note || "Chi viện đá sân 11"
        });
    });
    localStorage.setItem("mmo_custom_players", JSON.stringify(customList));
    localStorage.setItem("mmo_scores_sync", String(Date.now()));
}

function handleTacticsBorrowGuest() {
    const guestList = getGuestBorrowedPlayers();
    const nextIdx = guestList.length + 1;
    const name = prompt("🤝 NHẬP TÊN CẦU THỦ MƯỢN NGOÀI (ĐÁ SÂN 11):\n\nNhập tên bạn bè/viện binh mượn ngoài (hoặc bấm OK để lấy tên tự động):", `Cầu mượn #${nextIdx}`);
    if (!name || !name.trim()) return;

    const rawNum = prompt("Nhập số áo cho cầu thủ mượn:", `${80 + nextIdx}`) || `${80 + nextIdx}`;
    const num = rawNum.replace("#", "").trim() || `${80 + nextIdx}`;

    const newGuest = {
        name: name.trim(),
        num: num,
        pos: "Cầu thủ mượn ngoài",
        role: "Viện binh",
        isGuest: true,
        note: `Cầu thủ mượn ngoài #${num} ${name.trim()} chi viện đá sân 11`
    };

    guestList.push(newGuest);
    saveGuestBorrowedPlayers(guestList);

    // Bổ sung vào bench sa bàn ngay lập tức
    currentTacticalBench.push({
        num: num,
        name: name.trim(),
        role: "Cầu thủ mượn ngoài",
        posKey: "MƯỢN",
        isGuest: true,
        note: newGuest.note
    });

    updateTacticsView();
    alert(`🤝 Đã thêm cầu thủ mượn ngoài "${name.trim()}" (#${num}) vào hàng ghế dự bị!\nBấm vào chip của cầu thủ để thay vào sân.`);
}

function handleTacticsClearGuest() {
    const guestList = getGuestBorrowedPlayers();
    if (!guestList.length) {
        alert("Hiện không có cầu thủ mượn ngoài nào.");
        return;
    }
    if (!confirm(`Bạn có chắc muốn trả/xóa toàn bộ ${guestList.length} cầu thủ mượn ngoài khỏi đội hình?`)) return;
    localStorage.removeItem("mmo_guest_players");

    let customList = [];
    try { customList = JSON.parse(localStorage.getItem("mmo_custom_players")) || []; } catch(e) {}
    customList = customList.filter(p => !p.isGuest);
    localStorage.setItem("mmo_custom_players", JSON.stringify(customList));
    localStorage.setItem("mmo_scores_sync", String(Date.now()));

    renderTacticsField(currentFormationScheme);
    alert("✅ Đã trả toàn bộ cầu thủ mượn ngoài!");
}

window.getGuestBorrowedPlayers = getGuestBorrowedPlayers;
window.saveGuestBorrowedPlayers = saveGuestBorrowedPlayers;
window.handleTacticsBorrowGuest = handleTacticsBorrowGuest;
window.handleTacticsClearGuest = handleTacticsClearGuest;

function renderTacticsField(scheme) {
    const config = ALL_TACTICAL_FORMATIONS[currentPitchType] || ALL_TACTICAL_FORMATIONS["7"];
    currentFormationScheme = scheme || config.defaultScheme;
    const preset = config.schemes[currentFormationScheme] || config.schemes[config.defaultScheme];

    currentTacticalPlayers = JSON.parse(JSON.stringify(preset.players));
    currentTacticalBench = JSON.parse(JSON.stringify(preset.bench));

    // Nạp thêm danh sách cầu thủ mượn ngoài (nếu Admin đã chủ động bấm mượn)
    const guestList = getGuestBorrowedPlayers();
    if (guestList && guestList.length > 0) {
        guestList.forEach(g => {
            currentTacticalBench.push({
                num: g.num || "M",
                name: g.name,
                role: g.pos || g.role || "Cầu thủ mượn ngoài",
                posKey: "MƯỢN",
                isGuest: true,
                note: g.note || "Cầu thủ mượn ngoài chi viện đá sân 11."
            });
        });
    }

    selectedTacticalPlayerIndex = 0;

    renderTacticsSchemeButtons();
    updateTacticsView();
}

function resetTacticalFormation() {
    renderTacticsField(currentFormationScheme);
    const panelRole = document.getElementById("tipRoleBadge");
    const panelName = document.getElementById("tipPlayerName");
    const panelNote = document.getElementById("tipTacticalNote");
    const config = ALL_TACTICAL_FORMATIONS[currentPitchType] || ALL_TACTICAL_FORMATIONS["7"];
    if (panelRole) panelRole.textContent = "🔄 ĐÃ ĐẶT LẠI VỊ TRÍ";
    if (panelName) panelName.textContent = `${config.title} · Sơ đồ ${currentFormationScheme}`;
    if (panelNote) panelNote.textContent = "Toàn bộ vị trí cầu thủ trên sa bàn và danh sách dự bị đã được khôi phục về trạng thái chuẩn ban huấn luyện.";
}

function updateTacticsView() {
    const nodesContainer = document.getElementById("tacticsFieldNodes");
    const benchContainer = document.getElementById("tacticsBenchChips");
    const panelRole = document.getElementById("tipRoleBadge");
    const panelName = document.getElementById("tipPlayerName");
    const panelNote = document.getElementById("tipTacticalNote");

    if (!nodesContainer) return;

    // Render các nốt cầu thủ trên sân
    nodesContainer.innerHTML = currentTacticalPlayers.map((p, idx) => {
        const isGK = p.posKey === "GK";
        const isGuest = !!p.isGuest;
        const isActive = idx === selectedTacticalPlayerIndex;
        return `
            <div class="tactical-node ${isGK ? "node-gk" : ""} ${isGuest ? "node-guest" : ""} ${isActive ? "active-node" : ""}" 
                 data-index="${idx}"
                 style="top: ${p.top}%; left: ${p.left}%;">
                <div class="node-badge">${isGuest ? "🤝" : "#" + p.num}</div>
                <div class="node-name-pill">
                    <span>${p.name}</span>
                    <small class="node-role-tag">${isGuest ? "MƯỢN" : p.posKey}</small>
                </div>
            </div>
        `;
    }).join("");

    // Cập nhật thông tin cầu thủ đang chọn
    if (currentTacticalPlayers.length > 0) {
        const cur = currentTacticalPlayers[selectedTacticalPlayerIndex] || currentTacticalPlayers[0];
        const posInfo = calculateTacticalPosition(cur.left, cur.top, currentPitchType);
        if (panelRole) panelRole.textContent = `VỊ TRÍ: ${cur.role || posInfo.role} (${cur.posKey || posInfo.posKey}) · ${posInfo.zone.toUpperCase()}`;
        if (panelName) panelName.textContent = `${cur.name} (#${cur.num})`;
        if (panelNote) panelNote.textContent = cur.note || posInfo.desc;
    }

    // Render hàng ghế dự bị
    if (benchContainer && Array.isArray(currentTacticalBench)) {
        const guestList = getGuestBorrowedPlayers();
        const btnClear = document.getElementById("btnClearGuestTactics");
        if (btnClear) btnClear.style.display = guestList.length > 0 ? "inline-block" : "none";

        benchContainer.innerHTML = currentTacticalBench.map((b, bIdx) => {
            const isGuest = !!b.isGuest;
            return `
                <span class="bench-chip ${isGuest ? "bench-chip-guest" : ""}" 
                      onclick="handleSwapBenchPlayer(${bIdx})" 
                      title="Bấm để thay cầu thủ ${isGuest ? '[MƯỢN]' : ''} #${b.num} ${b.name} vào sân">
                    🔄 ${isGuest ? "🤝 " : ""}#${b.num} ${b.name} <small style="opacity:0.8; font-size:9.5px;">(${isGuest ? "CẦU MƯỢN" : b.role})</small>
                </span>
            `;
        }).join("");
    }

    // Gắn engine kéo thả cho các node cầu thủ
    attachTacticalDragEvents();
}

function attachTacticalDragEvents() {
    const pitch = document.getElementById("soccerPitch");
    const nodeEls = document.querySelectorAll(".tactical-node");
    if (!pitch || !nodeEls.length) return;

    nodeEls.forEach(nodeEl => {
        const onPointerDown = function(downEvent) {
            const isTouch = !!downEvent.touches;
            const startX = isTouch ? downEvent.touches[0].clientX : downEvent.clientX;
            const startY = isTouch ? downEvent.touches[0].clientY : downEvent.clientY;
            const idx = parseInt(nodeEl.getAttribute("data-index"), 10);
            if (isNaN(idx) || !currentTacticalPlayers[idx]) return;

            let isMoved = false;
            const pitchRect = pitch.getBoundingClientRect();

            const onPointerMove = function(moveEvent) {
                const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
                const dist = Math.hypot(clientX - startX, clientY - startY);

                if (dist > 5) {
                    if (!isMoved) {
                        isMoved = true;
                        nodeEl.classList.add("is-dragging");
                    }
                    if (moveEvent.cancelable) {
                        moveEvent.preventDefault();
                    }

                    let xPct = ((clientX - pitchRect.left) / pitchRect.width) * 100;
                    let yPct = ((clientY - pitchRect.top) / pitchRect.height) * 100;

                    // Giới hạn trong sân cỏ
                    xPct = Math.max(6, Math.min(94, xPct));
                    yPct = Math.max(7, Math.min(93, yPct));

                    nodeEl.style.left = xPct.toFixed(1) + "%";
                    nodeEl.style.top = yPct.toFixed(1) + "%";

                    currentTacticalPlayers[idx].left = parseFloat(xPct.toFixed(1));
                    currentTacticalPlayers[idx].top = parseFloat(yPct.toFixed(1));

                    // Tính toán vị trí đá thực tế theo quy mô sân
                    const posInfo = calculateTacticalPosition(xPct, yPct, currentPitchType);

                    // Cập nhật tag vị trí trên nút cầu thủ tức thì
                    const roleTagEl = nodeEl.querySelector(".node-role-tag");
                    if (roleTagEl) roleTagEl.textContent = posInfo.posKey;
                    nodeEl.classList.toggle("node-gk", posInfo.posKey === "GK");

                    // Cập nhật bảng thông tin: Hiện rõ vị trí thi đấu
                    const panelRole = document.getElementById("tipRoleBadge");
                    const panelName = document.getElementById("tipPlayerName");
                    const panelNote = document.getElementById("tipTacticalNote");
                    const p = currentTacticalPlayers[idx];

                    if (panelRole) panelRole.textContent = `VỊ TRÍ THI ĐẤU: ${posInfo.role} (${posInfo.posKey}) · ${posInfo.zone.toUpperCase()}`;
                    if (panelName) panelName.textContent = `${p.name} (#${p.num}) · [ĐANG RÊ VÀO VỊ TRÍ NÀY]`;
                    if (panelNote) panelNote.textContent = posInfo.desc;
                }
            };

            const onPointerUp = function() {
                window.removeEventListener("mousemove", onPointerMove);
                window.removeEventListener("mouseup", onPointerUp);
                window.removeEventListener("touchmove", onPointerMove);
                window.removeEventListener("touchend", onPointerUp);
                window.removeEventListener("touchcancel", onPointerUp);

                nodeEl.classList.remove("is-dragging");

                // Đặt cầu thủ này là đang được chọn
                selectedTacticalPlayerIndex = idx;
                document.querySelectorAll(".tactical-node").forEach(n => n.classList.remove("active-node"));
                nodeEl.classList.add("active-node");

                const posInfo = calculateTacticalPosition(currentTacticalPlayers[idx].left, currentTacticalPlayers[idx].top, currentPitchType);

                // Cập nhật vị trí thi đấu mới cho cầu thủ
                currentTacticalPlayers[idx].role = posInfo.role;
                currentTacticalPlayers[idx].posKey = posInfo.posKey;
                currentTacticalPlayers[idx].note = posInfo.desc;

                const roleTagEl = nodeEl.querySelector(".node-role-tag");
                if (roleTagEl) roleTagEl.textContent = posInfo.posKey;
                nodeEl.classList.toggle("node-gk", posInfo.posKey === "GK");

                const p = currentTacticalPlayers[idx];
                const panelRole = document.getElementById("tipRoleBadge");
                const panelName = document.getElementById("tipPlayerName");
                const panelNote = document.getElementById("tipTacticalNote");

                if (panelRole) panelRole.textContent = `VỊ TRÍ: ${posInfo.role} (${posInfo.posKey}) · ${posInfo.zone.toUpperCase()}`;
                if (panelName) panelName.textContent = `${p.name} (#${p.num})`;
                if (panelNote) panelNote.textContent = p.note;
            };

            window.addEventListener("mousemove", onPointerMove);
            window.addEventListener("mouseup", onPointerUp);
            window.addEventListener("touchmove", onPointerMove, { passive: false });
            window.addEventListener("touchend", onPointerUp);
            window.addEventListener("touchcancel", onPointerUp);
        };

        nodeEl.addEventListener("mousedown", onPointerDown);
        nodeEl.addEventListener("touchstart", onPointerDown, { passive: true });
    });
}

function handleSwapBenchPlayer(benchIdx) {
    if (!currentTacticalBench || !currentTacticalBench[benchIdx]) return;
    if (!currentTacticalPlayers || currentTacticalPlayers.length === 0) return;

    const sub = currentTacticalBench[benchIdx];
    const targetIdx = (selectedTacticalPlayerIndex >= 0 && selectedTacticalPlayerIndex < currentTacticalPlayers.length) 
        ? selectedTacticalPlayerIndex 
        : 0;
    const outPlayer = currentTacticalPlayers[targetIdx];

    // Xác định vị trí thi đấu tại tọa độ cầu thủ đang đứng
    const posInfo = calculateTacticalPosition(outPlayer.left, outPlayer.top, currentPitchType);

    // Tạo cầu thủ mới nhận vị trí của cầu thủ vừa rời sân
    const newPlayerOnPitch = {
        num: sub.num,
        name: sub.name,
        role: posInfo.role,
        posKey: posInfo.posKey,
        top: outPlayer.top,
        left: outPlayer.left,
        note: posInfo.desc
    };

    // Đưa cầu thủ rời sân xuống hàng dự bị
    const newBenchPlayer = {
        num: outPlayer.num,
        name: outPlayer.name,
        role: outPlayer.role,
        posKey: outPlayer.posKey,
        note: outPlayer.note
    };

    currentTacticalPlayers[targetIdx] = newPlayerOnPitch;
    currentTacticalBench[benchIdx] = newBenchPlayer;

    updateTacticsView();

    const panelRole = document.getElementById("tipRoleBadge");
    const panelName = document.getElementById("tipPlayerName");
    const panelNote = document.getElementById("tipTacticalNote");
    if (panelRole) panelRole.textContent = `🔄 THAY NGƯỜI: #${newPlayerOnPitch.num} ${newPlayerOnPitch.name} VÀO SÂN (${newPlayerOnPitch.role})`;
    if (panelName) panelName.textContent = `Thay cho ${outPlayer.name} (#${outPlayer.num}) · ${posInfo.zone.toUpperCase()}`;
    if (panelNote) panelNote.textContent = newPlayerOnPitch.note;
}

function selectTacticalPlayer(name, num, role, note, nodeEl) {
    if (nodeEl) {
        const idx = parseInt(nodeEl.getAttribute("data-index"), 10);
        if (!isNaN(idx)) selectedTacticalPlayerIndex = idx;
    }
    document.querySelectorAll(".tactical-node").forEach(n => n.classList.remove("active-node"));
    if (nodeEl) nodeEl.classList.add("active-node");

    const p = currentTacticalPlayers[selectedTacticalPlayerIndex] || { left: 50, top: 50, posKey: "MF" };
    const posInfo = calculateTacticalPosition(p.left, p.top, currentPitchType);

    const panelRole = document.getElementById("tipRoleBadge");
    const panelName = document.getElementById("tipPlayerName");
    const panelNote = document.getElementById("tipTacticalNote");

    if (panelRole) panelRole.textContent = `VỊ TRÍ: ${p.role || posInfo.role} (${p.posKey || posInfo.posKey}) · ${posInfo.zone.toUpperCase()}`;
    if (panelName) panelName.textContent = `${name} (#${num})`;
    if (panelNote) panelNote.textContent = note || posInfo.desc;
}

function switchFormation(scheme) {
    renderTacticsField(scheme);
}

function openTacticsModal() {
    initTacticsPitchButtons();
    selectPitchType(currentPitchType || "7");
    const modal = document.getElementById("tacticsModal");
    if (modal) {
        modal.style.display = "flex";
        modal.classList.add("active");
    }
}

function closeTacticsModal(event) {
    if (!event || event.target.id === "tacticsModal" || event.target.classList.contains("tactics-modal-close") || (event.target && event.target.closest && event.target.closest(".tactics-modal-close"))) {
        const modal = document.getElementById("tacticsModal");
        if (modal) {
            modal.classList.remove("active");
            modal.style.display = "none";
        }
    }
}

// ========================================
// KHOẢNH KHẮC & TẬP THỂ GẮN KẾT (MOMENTS & BROTHERHOOD GALLERY)
// ========================================

let currentMomentIndex = 0;
let currentMomentYearFilter = "all";
let currentMomentCategoryFilter = "all";
let currentMomentsViewMode = "slider";

function getMomentsList() {
    let list = [];
    try {
        const raw = localStorage.getItem("mmo_moments_list");
        if (raw !== null) {
            const stored = JSON.parse(raw);
            if (Array.isArray(stored)) list = stored;
        }
    } catch (e) {}

    // Lọc bỏ các khoảnh khắc mẫu do bot tạo nếu có
    list = list.filter(m => !["NÂNG CÚP TỨ HÙNG VÀ BỮA TIỆC ĂN MỪNG CHIẾN THẮNG", "SÁT CÁNH CHIẾN ĐẤU - TINH THẦN ĐỒNG ĐỘI", "ANH EM MỘT NHÀ - TẬP THỂ GẮN KẾT BẤT DIỆT"].includes(m.title));

    // Chuẩn hóa đảm bảo luôn có mảng photos đầy đủ
    return list.map(m => {
        let photos = [];
        if (Array.isArray(m.photos) && m.photos.length > 0) {
            photos = m.photos.map(p => formatDriveImageUrl(p)).filter(Boolean);
        } else if (m.photo) {
            photos = [formatDriveImageUrl(m.photo)];
        } else {
            photos = ["img/chinh5.jpg"];
        }
        return {
            ...m,
            photo: photos[0],
            photos: photos
        };
    });
}

function getFilteredMoments() {
    let list = getMomentsList();
    if (currentMomentYearFilter !== "all") {
        list = list.filter(m => String(m.date || "").includes(currentMomentYearFilter));
    }
    if (currentMomentCategoryFilter !== "all") {
        list = list.filter(m => m.category === currentMomentCategoryFilter);
    }
    return list;
}

function renderMomentFilters() {
    const yearWrap = document.getElementById("momentsYearFilterWrap");
    const catWrap = document.getElementById("momentsCategoryFilterWrap");
    const allMoments = getMomentsList();

    if (yearWrap) {
        const yearsSet = new Set();
        allMoments.forEach(m => {
            const dateStr = String(m.date || "2026").trim();
            const yearMatch = dateStr.match(/\b(20[2-9][0-9])\b/);
            if (yearMatch) yearsSet.add(yearMatch[1]);
            else yearsSet.add("2026");
        });
        const sortedYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));

        let yHtml = `<button type="button" class="filter-chip ${currentMomentYearFilter === 'all' ? 'active' : ''}" onclick="setMomentYearFilter('all')">⚡ TẤT CẢ NĂM (${allMoments.length})</button>`;
        sortedYears.forEach(y => {
            const count = allMoments.filter(m => String(m.date || "").includes(y)).length;
            yHtml += `<button type="button" class="filter-chip ${currentMomentYearFilter === y ? 'active' : ''}" onclick="setMomentYearFilter('${escapeStr(y)}')">${y} (${count})</button>`;
        });
        yearWrap.innerHTML = yHtml;
    }

    if (catWrap) {
        const categories = [
            { key: "all", label: "Tất cả bài viết" },
            { key: "celebration", label: "🎉 Ăn mừng" },
            { key: "matchday", label: "⚽ Thi đấu" },
            { key: "gathering", label: "🤝 Gắn kết" },
            { key: "training", label: "🔥 Tập luyện" }
        ];

        let cHtml = "";
        categories.forEach(c => {
            const count = c.key === "all" ? allMoments.length : allMoments.filter(m => m.category === c.key).length;
            cHtml += `<button type="button" class="filter-chip ${currentMomentCategoryFilter === c.key ? 'active' : ''}" onclick="setMomentCategoryFilter('${c.key}')">${c.label} (${count})</button>`;
        });
        catWrap.innerHTML = cHtml;
    }
}

function setMomentYearFilter(year) {
    currentMomentYearFilter = year;
    currentMomentIndex = 0;
    renderMomentFilters();
    if (currentMomentsViewMode === "grid") {
        renderMomentsGrid();
    } else {
        renderMomentsSlider();
    }
}

function setMomentCategoryFilter(cat) {
    currentMomentCategoryFilter = cat;
    currentMomentIndex = 0;
    renderMomentFilters();
    if (currentMomentsViewMode === "grid") {
        renderMomentsGrid();
    } else {
        renderMomentsSlider();
    }
}

function setMomentsViewMode(mode) {
    currentMomentsViewMode = mode;
    const sliderBox = document.getElementById("momentsSliderContainer");
    const dotsWrap = document.getElementById("momentsDotsWrap");
    const gridBox = document.getElementById("momentsGridContainer");
    const btnSlider = document.getElementById("btnMomentsViewSlider");
    const btnGrid = document.getElementById("btnMomentsViewGrid");

    if (mode === "grid") {
        if (sliderBox) sliderBox.style.display = "none";
        if (dotsWrap) dotsWrap.style.display = "none";
        if (gridBox) gridBox.style.display = "grid";
        if (btnGrid) btnGrid.classList.add("active");
        if (btnSlider) btnSlider.classList.remove("active");
        renderMomentsGrid();
    } else {
        if (sliderBox) sliderBox.style.display = "flex";
        if (dotsWrap) dotsWrap.style.display = "flex";
        if (gridBox) gridBox.style.display = "none";
        if (btnSlider) btnSlider.classList.add("active");
        if (btnGrid) btnGrid.classList.remove("active");
        renderMomentsSlider();
    }
}

function renderMomentsGrid() {
    const gridBox = document.getElementById("momentsGridContainer");
    if (!gridBox) return;

    const list = getFilteredMoments();
    if (list.length === 0) {
        gridBox.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: #94a3b8;">
                <p style="font-size: 28px; margin-bottom: 8px;">📷</p>
                <p style="font-size: 15px; font-weight: 700; color: #fff;">Không tìm thấy bài viết khoảnh khắc nào phù hợp</p>
                <p style="font-size: 13px;">Hãy chọn năm hoặc chuyên mục khác để xem ảnh.</p>
            </div>
        `;
        return;
    }

    gridBox.innerHTML = list.map(m => {
        const catClass = m.category === "matchday" ? "cat-matchday" : 
                         (m.category === "gathering" ? "cat-gathering" : 
                         (m.category === "training" ? "cat-training" : "cat-celebration"));
        const photos = (Array.isArray(m.photos) && m.photos.length > 0) ? m.photos : [m.photo || "img/chinh5.jpg"];
        const photoSrc = photos[0];
        const hasMultiple = photos.length > 1;
        const yearMatch = String(m.date || "2026").match(/\b(20[2-9][0-9])\b/);
        const year = yearMatch ? yearMatch[1] : "2026";

        return `
            <div class="moment-news-card" onclick="openMomentArticleModal('${m.id}')">
                <div class="moment-news-thumb">
                    <img src="${photoSrc}" alt="${escapeStr(m.title)}" onerror="this.onerror=null; this.src='img/chinh5.jpg';">
                    <span class="moment-news-badge-year">${year}</span>
                    <span class="moment-news-badge-cat ${catClass}">${m.categoryLabel || "📸 Khoảnh khắc"}</span>
                    ${hasMultiple ? `<span class="moment-album-badge">📸 Album (${photos.length} ảnh)</span>` : ''}
                </div>
                <div class="moment-news-body">
                    <div class="moment-news-meta">
                        <span>📅 ${m.date || "2026"}</span>
                        <span>📍 ${m.location || "Sân cỏ"}</span>
                    </div>
                    <h4 class="moment-news-title">${m.title}</h4>
                    <p class="moment-news-desc">${m.desc || ""}</p>
                    <div class="moment-news-footer">
                        <span>${hasMultiple ? `📸 Album ${photos.length} ảnh` : 'MMO FC MEDIA'}</span>
                        <div class="btn-news-read">Xem bài & Album ➔</div>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

function renderMomentsSlider() {
    const track = document.getElementById("momentsSliderTrack");
    const dotsWrap = document.getElementById("momentsDotsWrap");
    if (!track) return;

    const list = getFilteredMoments();
    if (list.length === 0) {
        track.innerHTML = `
            <div style="flex:0 0 100%; text-align:center; padding:40px 20px; color:#94a3b8;">
                <p style="font-size:32px; margin-bottom:8px;">📷</p>
                <p style="font-size:15px; font-weight:700; color:#fff;">Không tìm thấy bài viết khoảnh khắc nào phù hợp</p>
                <button type="button" class="filter-chip" onclick="setMomentYearFilter('all'); setMomentCategoryFilter('all');" style="margin-top:10px;">Xem tất cả bài viết</button>
            </div>
        `;
        if (dotsWrap) dotsWrap.innerHTML = "";
        return;
    }

    if (currentMomentIndex >= list.length) currentMomentIndex = 0;
    if (currentMomentIndex < 0) currentMomentIndex = list.length - 1;

    track.innerHTML = list.map((m, idx) => {
        const catClass = m.category === "matchday" ? "cat-matchday" : 
                         (m.category === "gathering" ? "cat-gathering" : 
                         (m.category === "training" ? "cat-training" : "cat-celebration"));
        const photos = (Array.isArray(m.photos) && m.photos.length > 0) ? m.photos : [m.photo || "img/chinh5.jpg"];
        const photoSrc = photos[0];
        const hasMultiple = photos.length > 1;

        return `
            <div class="moments-card-slide" data-index="${idx}">
                <div style="display:flex; flex-direction:column; flex-shrink:0;">
                    <div class="moments-img-wrap" onclick="openMomentArticleModal('${m.id}')">
                        <img src="${photoSrc}" alt="${escapeStr(m.title)}" onerror="this.onerror=null; this.src='img/chinh5.jpg';">
                        ${hasMultiple ? `<span class="moment-album-badge">📸 Album (${photos.length} ảnh)</span>` : ''}
                        <div class="moments-zoom-hint">📖 Xem chi tiết & album</div>
                    </div>
                    ${hasMultiple ? `
                        <div class="moments-mini-thumbs">
                            ${photos.slice(0, 5).map((p, pIdx) => `
                                <div class="moment-mini-thumb ${pIdx === 0 ? 'active' : ''}" onclick="event.stopPropagation(); openMomentArticleModal('${m.id}')" title="Bấm xem album ${photos.length} ảnh">
                                    <img src="${p}" alt="Ảnh ${pIdx + 1}" onerror="this.onerror=null; this.src='img/chinh5.jpg';">
                                </div>
                            `).join('')}
                            ${photos.length > 5 ? `<span style="font-size:10px; color:#38bdf8; align-self:center; font-weight:800; padding:2px;">+${photos.length - 5}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="moments-card-body">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="moments-cat-badge ${catClass}">${m.categoryLabel || "📸 KHOẢNH KHẮC"}</span>
                        <small style="color:#64748b; font-weight:800; font-size:11px;">BÀI ${idx + 1} / ${list.length}</small>
                    </div>
                    <h4 class="moments-title">${m.title}</h4>
                    <div class="moments-meta">
                        <span>📅 ${m.date || "2026"}</span>
                        <span>📍 ${m.location || "Sân cỏ"}</span>
                        ${hasMultiple ? `<span style="color:#38bdf8;">📸 ${photos.length} bức ảnh</span>` : ''}
                    </div>
                    <p class="moments-desc">${m.desc || ""}</p>
                    <div class="moments-actions-row">
                        <button type="button" class="btn-moment-read" onclick="openMomentArticleModal('${m.id}')">
                            📖 Đọc bài viết & xem Album (${photos.length} ảnh) ➔
                        </button>
                        <button type="button" class="btn-moment-zoom" onclick="openImageLightbox('${photoSrc}', '${escapeStr(m.title)}')">
                            🔍 Phóng to ảnh HD
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    track.style.transform = `translateX(-${currentMomentIndex * 100}%)`;

    if (dotsWrap) {
        dotsWrap.innerHTML = list.map((_, idx) => `
            <div class="moments-dot ${idx === currentMomentIndex ? "active" : ""}" onclick="goToMomentSlide(${idx})"></div>
        `).join("");
    }
}

function slideMoments(direction) {
    const list = getFilteredMoments();
    if (list.length === 0) return;
    currentMomentIndex = (currentMomentIndex + direction + list.length) % list.length;
    renderMomentsSlider();
}

function goToMomentSlide(index) {
    currentMomentIndex = index;
    renderMomentsSlider();
}

// ========================================
// TRANG XEM CHI TIẾT BÀI BÁO ẢNH & ALBUM (ARTICLE MODAL)
// ========================================
let currentArticleMoment = null;
let currentArticlePhotoIndex = 0;

function openMomentArticleModal(momentId) {
    const list = getMomentsList();
    const moment = list.find(m => m.id === momentId) || list[0];
    if (!moment) return;

    currentArticleMoment = moment;
    currentArticlePhotoIndex = 0;
    renderMomentArticleView();

    const modal = document.getElementById("momentArticleModal");
    if (modal) {
        modal.style.display = "flex";
        modal.classList.add("active");
        modal.scrollTop = 0;
    }
}

function closeMomentArticleModal(event) {
    if (!event || event.target.id === "momentArticleModal" || 
        event.target.classList.contains("moment-article-close") || 
        event.target.classList.contains("btn-article-back") || 
        (event.target.closest && (event.target.closest(".moment-article-close") || event.target.closest(".btn-article-back")))) {
        const modal = document.getElementById("momentArticleModal");
        if (modal) {
            modal.style.display = "none";
            modal.classList.remove("active");
        }
    }
}

function switchArticlePhoto(index) {
    if (!currentArticleMoment) return;
    const photos = (Array.isArray(currentArticleMoment.photos) && currentArticleMoment.photos.length > 0) 
        ? currentArticleMoment.photos 
        : [currentArticleMoment.photo || "img/chinh5.jpg"];
    const total = photos.length;
    currentArticlePhotoIndex = (index + total) % total;
    updateArticlePhotoDisplay();
}

function renderMomentArticleView() {
    const container = document.getElementById("momentArticleContent");
    if (!container || !currentArticleMoment) return;

    const m = currentArticleMoment;
    const photos = (Array.isArray(m.photos) && m.photos.length > 0) ? m.photos : [m.photo || "img/chinh5.jpg"];
    const catClass = m.category === "matchday" ? "cat-matchday" : 
                     (m.category === "gathering" ? "cat-gathering" : 
                     (m.category === "training" ? "cat-training" : "cat-celebration"));

    const allMoments = getMomentsList();
    const curIdx = allMoments.findIndex(item => item.id === m.id);
    const prevMoment = curIdx > 0 ? allMoments[curIdx - 1] : null;
    const nextMoment = curIdx < allMoments.length - 1 ? allMoments[curIdx + 1] : null;

    container.innerHTML = `
        <div class="article-header">
            <div class="article-meta-row">
                <span class="moments-cat-badge ${catClass}">${m.categoryLabel || "📸 BÁO ẢNH"}</span>
                <span class="article-meta-item">📅 ${m.date || "2026"}</span>
                <span class="article-meta-item">📍 ${m.location || "Sân bóng MMO FC"}</span>
                <span class="article-meta-badge">📸 Album ${photos.length} ảnh HD</span>
            </div>
            <h2 class="article-title">${m.title}</h2>
        </div>

        <!-- ALBUM SLIDER INTERACTIVE VIEWER -->
        <div class="article-album-viewer">
            <div class="article-main-photo-wrap">
                <img id="articleActiveImg" src="${photos[0]}" alt="${escapeStr(m.title)}" onclick="openImageLightbox(this.src, '${escapeStr(m.title)}')">
                <div class="article-photo-counter" id="articlePhotoCounter">
                    Ảnh 1 / ${photos.length}
                </div>
                ${photos.length > 1 ? `
                    <button type="button" class="article-photo-nav article-photo-prev" onclick="switchArticlePhoto(currentArticlePhotoIndex - 1)" aria-label="Ảnh trước">❮</button>
                    <button type="button" class="article-photo-nav article-photo-next" onclick="switchArticlePhoto(currentArticlePhotoIndex + 1)" aria-label="Ảnh sau">❯</button>
                ` : ''}
                <button type="button" class="btn-article-zoom" onclick="openImageLightbox(document.getElementById('articleActiveImg').src, '${escapeStr(m.title)}')">
                    🔍 Phóng to toàn màn hình HD
                </button>
            </div>

            <!-- DẢI THUMBNAILS CỦA TẤT CẢ ẢNH TRONG BÀI VIẾT -->
            ${photos.length > 1 ? `
                <div class="article-thumbnails-strip" id="articleThumbnailsStrip">
                    ${photos.map((p, idx) => `
                        <div class="article-thumb-item ${idx === 0 ? 'active' : ''}" onclick="switchArticlePhoto(${idx})">
                            <img src="${p}" alt="Ảnh ${idx + 1}" onerror="this.onerror=null; this.src='img/chinh5.jpg';">
                            <span class="thumb-num">#${idx + 1}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>

        <!-- NỘI DUNG BÀI VIẾT CHI TIẾT - PHONG CÁCH BẢNG TIN BÁO CHÍ -->
        <div class="article-body-text bulletin-card">
            <div class="bulletin-header-strip">
                <span class="bulletin-badge">📰 BẢN TIN KHOẢNH KHẮC MMO FC</span>
                <span class="bulletin-date">${m.date || "2026"} · ${m.location || "Sân bóng MMO FC"}</span>
            </div>
            <h3 class="article-section-heading">📝 NỘI DUNG & Ý NGHĨA KHOẢNH KHẮC</h3>
            <div class="article-full-desc">${m.desc ? m.desc.replace(/\n/g, '<br>') : "Khoảnh khắc đáng nhớ của đại gia đình MMO FC."}</div>
        </div>

        <!-- TOÀN BỘ ẢNH TRONG ALBUM (COLLAGE GRID) - BẢNG TIN HÌNH ẢNH -->
        ${photos.length > 1 ? `
            <div class="article-gallery-grid-section bulletin-card gallery-bulletin">
                <div class="bulletin-header-strip">
                    <span class="bulletin-badge blue">📸 PHÒNG TRƯNG BÀY ALBUM</span>
                    <span class="bulletin-date">Tổng cộng ${photos.length} ảnh chất lượng cao HD</span>
                </div>
                <h3 class="article-section-heading gallery-heading">
                    🖼️ BỘ SƯU TẬP TẤT CẢ ẢNH <span class="highlight-count">(${photos.length} ẢNH)</span>
                </h3>
                <p class="article-gallery-subtitle">
                    <span class="guide-icon">👆</span> Bấm vào từng ảnh dưới đây để phóng to toàn màn hình sắc nét HD
                </p>
                <div class="article-gallery-grid">
                    ${photos.map((p, idx) => `
                        <div class="gallery-grid-item" onclick="openImageLightbox('${p}', '${escapeStr(m.title)} - Ảnh ${idx + 1}')">
                            <img src="${p}" alt="${escapeStr(m.title)}" onerror="this.onerror=null; this.src='img/chinh5.jpg';">
                            <div class="grid-zoom-overlay">
                                <span>🔍 Phóng to #${idx + 1}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        <!-- ĐIỀU HƯỚNG BÀI VIẾT TRƯỚC / TIẾP THEO -->
        <div class="article-nav-footer">
            ${prevMoment ? `
                <button type="button" class="btn-article-nav-other" onclick="openMomentArticleModal('${prevMoment.id}')">
                    ❮ Bài trước: <b>${prevMoment.title}</b>
                </button>
            ` : '<div></div>'}
            ${nextMoment ? `
                <button type="button" class="btn-article-nav-other next" onclick="openMomentArticleModal('${nextMoment.id}')">
                    Bài tiếp: <b>${nextMoment.title}</b> ❯
                </button>
            ` : '<div></div>'}
        </div>
    `;
}

function updateArticlePhotoDisplay() {
    if (!currentArticleMoment) return;
    const photos = (Array.isArray(currentArticleMoment.photos) && currentArticleMoment.photos.length > 0) 
        ? currentArticleMoment.photos 
        : [currentArticleMoment.photo || "img/chinh5.jpg"];
    const activePhoto = photos[currentArticlePhotoIndex];

    const imgEl = document.getElementById("articleActiveImg");
    if (imgEl) {
        imgEl.style.opacity = "0.3";
        setTimeout(() => {
            imgEl.src = activePhoto;
            imgEl.style.opacity = "1";
        }, 120);
    }

    const counter = document.getElementById("articlePhotoCounter");
    if (counter) {
        counter.textContent = `Ảnh ${currentArticlePhotoIndex + 1} / ${photos.length}`;
    }

    const thumbs = document.querySelectorAll(".article-thumb-item");
    thumbs.forEach((t, idx) => {
        t.classList.toggle("active", idx === currentArticlePhotoIndex);
    });
}

function openMatchdayGalleryModal() {
    renderMomentFilters();
    if (currentMomentsViewMode === "grid") {
        renderMomentsGrid();
    } else {
        renderMomentsSlider();
    }
    const modal = document.getElementById("momentsModal");
    if (modal) {
        modal.style.display = "flex";
        modal.classList.add("active");
    }
}

function closeMomentsModal(event) {
    if (!event || event.target.id === "momentsModal" || event.target.classList.contains("moments-modal-close") || (event.target && event.target.closest && event.target.closest(".moments-modal-close"))) {
        const modal = document.getElementById("momentsModal");
        if (modal) {
            modal.classList.remove("active");
            modal.style.display = "none";
        }
    }
}

function loadHighlightsCovers() {
    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem("mmo_highlights_config")) || {}; } catch(e) {}
    
    const imgTrophies = document.getElementById("hlImgTrophies");
    const imgTactics = document.getElementById("hlImgTactics");
    const imgMatchday = document.getElementById("hlImgMatchday");

    if (imgTrophies && cfg.trophiesCover) {
        imgTrophies.style.backgroundImage = `url('${cfg.trophiesCover}')`;
    }
    if (imgTactics && cfg.tacticsCover) {
        imgTactics.style.backgroundImage = `url('${cfg.tacticsCover}')`;
    }
    if (imgMatchday && cfg.matchdayCover) {
        imgMatchday.style.backgroundImage = `url('${cfg.matchdayCover}')`;
    }
}

// Bắt phím Escape để đóng nhanh tất cả các modal và lightbox
window.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        closePlayerLightbox();
        closePlayerModal();
        closeZaloModal();
        closeTrophiesModal();
        closeTacticsModal();
        closeMomentsModal();
    }
    if (e.key === "ArrowLeft") {
        const trophyModal = document.getElementById("trophiesModal");
        if (trophyModal && trophyModal.classList.contains("active")) slideTrophies(-1);
        const momentsModal = document.getElementById("momentsModal");
        if (momentsModal && momentsModal.classList.contains("active")) slideMoments(-1);
    }
    if (e.key === "ArrowRight") {
        const trophyModal = document.getElementById("trophiesModal");
        if (trophyModal && trophyModal.classList.contains("active")) slideTrophies(1);
        const momentsModal = document.getElementById("momentsModal");
        if (momentsModal && momentsModal.classList.contains("active")) slideMoments(1);
    }
});

// ========================================
// LẮNG NGHE ĐỒNG BỘ TỨC THÌ TỪ TRANG ADMIN (KHI MỞ 2 TAB)
// ========================================
window.addEventListener("storage", function (e) {
    if (e.key === "mmo_scores_sync" || e.key === "mmo_matches_cache" || e.key === "mmo_deleted_matches" || e.key === "mmo_matches_updated_ts") {
        console.log("MMO FC: Phát hiện cập nhật dữ liệu trận đấu từ Admin, đang đồng bộ...");
        loadMatches();
        updateTopScorers();
    }
    if (e.key === "mmo_custom_players" || e.key === "mmo_player_photos" || e.key === "mmo_hidden_players" || e.key === "mmo_player_info_overrides" || e.key === "mmo_player_sync") {
        console.log("MMO FC: Phát hiện thay đổi thông tin cầu thủ từ Admin, đang cập nhật MEET THE SQUAD...");
        syncCustomPlayers([]);
        renderDynamicSquadCards();
        initAttendancePlayerSelect();
        updateTopScorers(matchData);
    }
    if (e.key === "mmo_reset_timestamp") {
        console.log("MMO FC: Phát hiện lệnh Reset về 0 từ Admin, đang làm mới hệ thống...");
        matchData = [];
        updateClubStats([]);
        syncCustomPlayers([]);
        renderDynamicSquadCards();
        initAttendancePlayerSelect();
        updateTopScorers([]);
        loadMatches();
    }
    if (e.key === "mmo_highlights_config") {
        loadHighlightsCovers();
    }
    if (e.key === "mmo_trophies_list") {
        renderTrophyYearFilters();
        renderTrophiesSlider();
    }
    if (e.key === "mmo_moments_list") {
        renderMomentFilters();
        if (currentMomentsViewMode === "grid") {
            renderMomentsGrid();
        } else {
            renderMomentsSlider();
        }
    }
});

// Gắn các hàm mở modal vào window scope toàn cục để tương thích 100% với onclick trong HTML
window.openTrophiesModal = openTrophiesModal;
window.closeTrophiesModal = closeTrophiesModal;
window.slideTrophies = slideTrophies;
window.goToTrophySlide = goToTrophySlide;
window.setTrophyYearFilter = setTrophyYearFilter;
window.openTacticsModal = openTacticsModal;
window.closeTacticsModal = closeTacticsModal;
window.selectPitchType = selectPitchType;
window.switchFormation = switchFormation;
window.selectTacticalPlayer = selectTacticalPlayer;
window.resetTacticalFormation = resetTacticalFormation;
window.handleSwapBenchPlayer = handleSwapBenchPlayer;
window.calculateTacticalPosition = calculateTacticalPosition;
window.openMatchdayGalleryModal = openMatchdayGalleryModal;
window.closeMomentsModal = closeMomentsModal;
window.slideMoments = slideMoments;
window.goToMomentSlide = goToMomentSlide;
window.setMomentYearFilter = setMomentYearFilter;
window.updateTopScorers = updateTopScorers;
window.setMomentCategoryFilter = setMomentCategoryFilter;
window.setMomentsViewMode = setMomentsViewMode;
window.renderMomentsGrid = renderMomentsGrid;
window.openPlayerDetailModal = openPlayerDetailModal;
window.closePlayerModal = closePlayerModal;
window.openImageLightbox = openImageLightbox;
window.closePlayerLightbox = closePlayerLightbox;
window.openMomentArticleModal = openMomentArticleModal;
window.closeMomentArticleModal = closeMomentArticleModal;
window.switchArticlePhoto = switchArticlePhoto;

// Lắng nghe sự kiện click trực tiếp trên các thẻ Highlight Mục 04 khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", function () {
    const cardTrophies = document.getElementById("hlCardTrophies");
    if (cardTrophies) {
        cardTrophies.addEventListener("click", function(e) {
            e.preventDefault();
            openTrophiesModal();
        });
    }

    const cardTactics = document.getElementById("hlCardTactics");
    if (cardTactics) {
        cardTactics.addEventListener("click", function(e) {
            e.preventDefault();
            openTacticsModal();
        });
    }

    const cardMatchday = document.getElementById("hlCardMatchday");
    if (cardMatchday) {
        cardMatchday.addEventListener("click", function(e) {
            e.preventDefault();
            openMatchdayGalleryModal();
        });
    }

    loadHighlightsCovers();
    initTacticsPitchButtons();
});

// Hàm hỗ trợ xóa toàn bộ dữ liệu lưu đệm trên trình duyệt để nhập lại từ đầu
window.mmoResetAllData = function() {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ bộ nhớ đệm (điểm danh, tỉ số cũ) trên trình duyệt để bắt đầu từ 0?")) return;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("mmo_attendance_") || k === "mmo_scores_sync" || k === "mmo_matches_cache" || k === "mmo_player_info_overrides" || k === "mmo_cloud_attendance")) {
            keysToRemove.push(k);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.setItem("mmo_reset_timestamp", String(Date.now()));
    window.location.reload();
};
