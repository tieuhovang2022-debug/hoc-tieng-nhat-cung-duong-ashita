
    "use strict";
    /* ================================================================
       KHO CÂU HỎI — một cấu trúc dữ liệu duy nhất:
       Cấp độ (N5..N2) → Kỹ năng → Số đề → { passage?, questions[] }
       Mỗi câu: { q, options[4], answer (0=A,1=B,2=C,3=D), explain }
       Thêm đề mới: chỉ cần thêm một mục vào tests của kỹ năng tương ứng.
       ================================================================ */
;

    /* ============ KẾT THÚC KHO CÂU HỎI ============ */

    const LEVELS = ["N5", "N4", "N3", "N2"];
    const SKILLS = [
      { "key": "tuvung",   "label": "Từ Vựng",  "icon": "あ", "cls": "ico-vocab" },
      { "key": "nguphap",  "label": "Ngữ Pháp", "icon": "文", "cls": "ico-grammar" },
      { "key": "dochieu",  "label": "Đọc Hiểu", "icon": "読", "cls": "ico-read" },
      { "key": "luyennoi", "label": "Luyện Nói", "icon": "話", "cls": "ico-speak" }
    ];
    const TOTAL_TESTS = 20;
    const TEST_SECONDS = 45 * 60;
    /* Từ Vựng: mỗi bài chia thành các phần con tối đa 20 câu, mỗi phần 15 phút.
       Đọc Hiểu và Luyện Nói giữ nguyên 45 phút như trước. */
    const VOCAB_PART_SIZE = 20;
    const VOCAB_SECONDS = 15 * 60;

    const state = {
      level: null, skill: null, testNo: null, partNo: null,
      quiz: null, quizSeconds: TEST_SECONDS,
      answers: {}, submitted: false,
      timerId: null, secondsLeft: TEST_SECONDS
    };

    function $(id){ return document.getElementById(id); }

    function showScreen(id){
      document.querySelectorAll(".screen").forEach(function(s){ s.classList.remove("active"); });
      $(id).classList.add("active");
      /* Nút quay lại cố định: chỉ hiện khi đang ở trang con (trang chủ không có trang trước) */
      const isHome = id === "screen-home";
      $("fixed-back").classList.toggle("is-hidden", isHome);
      document.body.classList.toggle("has-fixed-back", !isHome);
      window.scrollTo(0, 0);
    }

    function stopTimer(){
      if (state.timerId !== null){ clearInterval(state.timerId); state.timerId = null; }
    }

    function pad2(n){ return (n < 10 ? "0" : "") + n; }

    function renderTimer(){
      const chip = $("timer-chip");
      const m = Math.floor(state.secondsLeft / 60);
      const s = state.secondsLeft % 60;
      chip.textContent = "⏱ " + m + ":" + pad2(s);
      chip.classList.toggle("low", state.secondsLeft <= 60 && !state.submitted);
    }

    function startTimer(seconds){
      stopTimer();
      state.secondsLeft = seconds;
      renderTimer();
      state.timerId = setInterval(function(){
        state.secondsLeft--;
        renderTimer();
        if (state.secondsLeft <= 0){
          stopTimer();
          submitQuiz(true);
        }
      }, 1000);
    }

    function getTest(level, skill, no){
      const lv = QUIZ_DATABASE[level];
      if (!lv || !lv[skill]) return null;
      return lv[skill].tests[no] || null;
    }

    /* ---------- Từ Vựng: chia bài thành các phần con tối đa 20 câu ---------- */
    function vocabPartCount(t){
      return Math.max(1, Math.ceil(t.questions.length / VOCAB_PART_SIZE));
    }
    function lessonBaseLabel(title, no){
      const m = /^(Bài \d+|Unit \d+|Tổng hợp \d+)/.exec(title || "");
      return m ? m[1] : ("Bài " + no);
    }
    function vocabPartTitle(t, no, partNo){
      const title = (t && t.title) ? t.title : ("Bài " + no);
      const base = lessonBaseLabel(title, no);
      return title.replace(base, base + "." + partNo);
    }
    /* Khung làm bài hiện tại: với Từ Vựng + số phần, questions là lát cắt đúng
       thứ tự của bài (phần cuối có thể ít hơn 20 câu) và giờ là 15 phút;
       các kỹ năng khác dùng nguyên bài với 45 phút. */
    function getQuizView(level, skill, no, partNo){
      const t = getTest(level, skill, no);
      if (!t) return null;
      if (skill === "tuvung" && partNo){
        const start = (partNo - 1) * VOCAB_PART_SIZE;
        return {
          title: vocabPartTitle(t, no, partNo),
          passage: null,
          questions: t.questions.slice(start, start + VOCAB_PART_SIZE),
          seconds: VOCAB_SECONDS
        };
      }
      return { title: t.title, passage: t.passage || null, questions: t.questions, seconds: TEST_SECONDS };
    }

    function skillLabel(skillKey){
      const sk = SKILLS.find(function(s){ return s.key === skillKey; });
      return sk ? sk.label : skillKey;
    }

    function crumbHTML(parts){
      return parts.map(function(p, i){
        const sep = i > 0 ? '<span class="sep">›</span>' : "";
        return sep + (p.bold ? "<b>" + p.text + "</b>" : "<span>" + p.text + "</span>");
      }).join("");
    }

    /* ---------- Trang chủ: nút cấp độ ---------- */
    (function buildLevels(){
      const row = $("level-row");
      LEVELS.forEach(function(lv){
        const b = document.createElement("button");
        b.type = "button";
        b.className = "level-btn lv-" + lv;
        b.innerHTML = '<span class="lv-small">JLPT</span><span class="lv-big">' + lv + "</span>";
        b.addEventListener("click", function(){ openSkills(lv); });
        row.appendChild(b);
      });
      const dBtn = document.createElement("button");
      dBtn.type = "button";
      dBtn.className = "donate-btn";
      dBtn.innerHTML = '<span class="lv-small">ỦNG HỘ</span><span class="lv-big">❤ Donate cho tác giả</span>';
      dBtn.addEventListener("click", function(){ openDonate(); });
      row.appendChild(dBtn);
    })();

    /* ---------- Màn chọn kỹ năng ---------- */
    function openSkills(level){
      stopTimer();
      state.level = level;
      $("crumb-skills").innerHTML = crumbHTML([
        { text: "Trang chủ" }, { text: "JLPT " + level, bold: true }, { text: "Chọn kỹ năng" }
      ]);
      const list = $("skill-list");
      list.innerHTML = "";
      SKILLS.forEach(function(sk){
        const sec = QUIZ_DATABASE[level][sk.key];
        const isGrammar = sk.key === "nguphap";
        const readyCount = isGrammar ? Object.keys(GRAMMAR_LECTURES[level] || {}).length : Object.keys(sec.tests).length;
        const slots = sec.slots || TOTAL_TESTS;
        const unit = sec.unitLabel || "đề";
        const b = document.createElement("button");
        b.type = "button";
        b.className = "skill-btn";
        b.innerHTML =
          '<span class="skill-ico ' + sk.cls + ' jp">' + sk.icon + "</span>" +
          "<span>" + sk.label + "</span>" +
          '<span class="count">' + (isGrammar ? readyCount + " bài giảng có sẵn" : readyCount + " / " + slots + " " + unit + " có sẵn") + "</span>";
        b.addEventListener("click", function(){ openTests(level, sk.key); });
        list.appendChild(b);
      });
      showScreen("screen-skills");
    }

    /* ---------- Màn danh sách đề ---------- */
    function openTests(level, skill){
      stopTimer();
      state.level = level; state.skill = skill; state.partNo = null; state.quiz = null;
      const isGrammar = skill === "nguphap";
      const sec = QUIZ_DATABASE[level][skill];
      const slots = sec.slots || TOTAL_TESTS;
      const unit = sec.unitLabel || "đề";
      $("crumb-tests").innerHTML = crumbHTML([
        { text: "Trang chủ" }, { text: "JLPT " + level }, { text: skillLabel(skill), bold: true }, { text: isGrammar ? "Chọn bài giảng" : ("Chọn " + unit) }
      ]);
      const grid = $("test-grid");
      grid.innerHTML = "";
      for (let n = 1; n <= slots; n++){
        const lec = isGrammar ? getLecture(level, n) : null;
        const t = isGrammar ? null : getTest(level, skill, n);
        const has = isGrammar ? !!lec : !!t;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "test-btn " + (n <= 10 ? "tb-green" : "tb-blue") + (has ? "" : " is-empty");
        const badge = isGrammar
          ? (lec ? lec.points.length + " mẫu ngữ pháp" : "Đang cập nhật")
          : (t ? (skill === "tuvung"
              ? t.questions.length + " câu · " + vocabPartCount(t) + " phần"
              : t.questions.length + " câu") : "Đang cập nhật");
        const tName = isGrammar
          ? (lec ? lec.title : ("Bài giảng số " + pad2(n)))
          : ((t && t.title) ? t.title : ("Đề số " + pad2(n)));
        b.innerHTML = '<span class="t-name">' + tName + '</span><span class="t-badge">' + badge + "</span>";
        (function(no){
          b.addEventListener("click", function(){
            if (isGrammar) openLecture(level, no);
            else if (skill === "tuvung") openParts(level, no);
            else openQuiz(level, skill, no);
          });
        })(n);
        grid.appendChild(b);
      }
      showScreen("screen-tests");
    }

    /* ---------- Màn danh sách phần con (chỉ dùng cho Từ Vựng) ---------- */
    function openParts(level, no){
      stopTimer();
      state.level = level; state.skill = "tuvung"; state.testNo = no; state.partNo = null; state.quiz = null;
      const t = getTest(level, "tuvung", no);
      const tName = (t && t.title) ? t.title : ("Bài " + no);
      if (!t){
        $("crumb-empty").innerHTML = crumbHTML([
          { text: "Trang chủ" }, { text: "JLPT " + level }, { text: "Từ Vựng" },
          { text: tName, bold: true }
        ]);
        $("empty-title").textContent = level + " - Từ Vựng: " + tName;
        showScreen("screen-empty");
        return;
      }
      const parts = vocabPartCount(t);
      $("crumb-parts").innerHTML = crumbHTML([
        { text: "Trang chủ" }, { text: "JLPT " + level }, { text: "Từ Vựng" },
        { text: tName, bold: true }, { text: "Chọn phần" }
      ]);
      $("parts-title").textContent = level + " - Từ Vựng: " + tName;
      $("parts-sub").textContent = "Bài này có " + t.questions.length + " câu, được chia thành " + parts +
        " phần — mỗi phần tối đa " + VOCAB_PART_SIZE + " câu, thời gian làm bài " + (VOCAB_SECONDS / 60) +
        " phút. Chọn một phần để bắt đầu làm bài:";
      const grid = $("part-grid");
      grid.innerHTML = "";
      const base = lessonBaseLabel(t.title, no);
      for (let p = 1; p <= parts; p++){
        const start = (p - 1) * VOCAB_PART_SIZE;
        const count = Math.min(VOCAB_PART_SIZE, t.questions.length - start);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "test-btn " + (p % 2 === 1 ? "tb-green" : "tb-blue");
        b.innerHTML = '<span class="t-name">' + base + "." + p + '</span>' +
          '<span class="t-badge">' + count + " câu · " + (VOCAB_SECONDS / 60) + " phút</span>";
        (function(partNo){
          b.addEventListener("click", function(){ openQuiz(level, "tuvung", no, partNo); });
        })(p);
        grid.appendChild(b);
      }
      showScreen("screen-parts");
    }

    /* ---------- Màn bài giảng ngữ pháp ---------- */
    function getLecture(level, no){
      const lv = GRAMMAR_LECTURES[level];
      if (!lv) return null;
      return lv[no] || lv[String(no)] || null;
    }

    function escText(s){
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function openLecture(level, no){
      stopTimer();
      state.level = level; state.skill = "nguphap"; state.testNo = no;
      const lec = getLecture(level, no);
      if (!lec){
        $("crumb-empty").innerHTML = crumbHTML([
          { text: "Trang chủ" }, { text: "JLPT " + level }, { text: "Ngữ Pháp" },
          { text: "Bài giảng số " + pad2(no), bold: true }
        ]);
        $("empty-title").textContent = level + " - Ngữ Pháp: Bài giảng số " + pad2(no);
        showScreen("screen-empty");
        return;
      }
      $("crumb-lecture").innerHTML = crumbHTML([
        { text: "Trang chủ" }, { text: "JLPT " + level }, { text: "Ngữ Pháp" },
        { text: lec.title, bold: true }
      ]);
      const bookName = (level === "N5" || level === "N4") ? "Minna no Nihongo" : "Mimi kara Oboeru";
      let h = "";
      h += '<div class="card lecture-head">';
      h += '<div class="lec-meta"><span class="lec-chip">JLPT ' + level + '</span>' +
           '<span class="lec-chip alt">Bài giảng ngữ pháp</span>' +
           '<span class="lec-chip alt">' + lec.points.length + ' mẫu ngữ pháp</span>' +
           '<span class="lec-chip alt">' + bookName + '</span></div>';
      h += '<h2 class="lec-title">' + escText(lec.title) + "</h2>";
      h += '<p class="lec-intro">' + escText(lec.intro) + "</p>";
      h += '<div class="lec-toc">';
      lec.points.forEach(function(pt, i){
        h += '<button type="button" class="jp" data-target="lec-point-' + i + '">' + (i + 1) + ". " + escText(pt.pattern) + "</button>";
      });
      h += "</div></div>";

      lec.points.forEach(function(pt, i){
        h += '<article class="card point-card" id="lec-point-' + i + '">';
        h += '<div class="point-top"><span class="point-no">' + (i + 1) + '</span>' +
             '<h3 class="point-pattern jp">' + escText(pt.pattern) + "</h3></div>";
        h += '<p class="meaning-line">Dịch nghĩa: <b>' + escText(pt.meaning) + "</b></p>";
        if (pt.form){
          h += '<div class="form-box"><p class="sec-h">CẤU TRÚC</p><span class="jp">' + escText(pt.form) + "</span></div>";
        }
        h += '<p class="sec-h">GIẢI THÍCH CHI TIẾT</p>';
        h += '<p class="explain-text">' + escText(pt.explain) + "</p>";
        if (pt.examples && pt.examples.length){
          h += '<div class="ex-list"><p class="sec-h">VÍ DỤ MINH HỌA</p>';
          pt.examples.forEach(function(ex){
            h += '<div class="ex-item"><p class="ex-jp jp">' + escText(ex.jp) + '</p>' +
                 '<p class="ex-vi">' + escText(ex.vi) + "</p></div>";
          });
          h += "</div>";
        }
        if (pt.note){
          h += '<div class="note-box"><b>Lưu ý:</b> ' + escText(pt.note) + "</div>";
        }
        h += "</article>";
      });

      h += '<div class="card summary-card"><h3>Tổng kết bài học</h3><ul class="summary-list">';
      lec.points.forEach(function(pt){
        h += '<li><span class="s-pat jp">' + escText(pt.pattern) + '</span>' +
             '<span class="s-mean">' + escText(pt.meaning) + "</span></li>";
      });
      h += "</ul>";
      h += '<p class="summary-tip">Cách học hiệu quả: đọc kỹ giải thích của từng mẫu, tự đọc to các ví dụ tiếng Nhật 2–3 lần, sau đó tự đặt một câu của riêng bạn cho mỗi mẫu trước khi chuyển sang bài tiếp theo.</p>';
      h += '<button type="button" class="lecture-done-btn" id="lecture-done-btn">✓ Đã học xong — về danh sách bài giảng</button>';
      h += "</div>";

      const box = $("lecture-content");
      box.innerHTML = h;
      box.querySelectorAll(".lec-toc button").forEach(function(btn){
        btn.addEventListener("click", function(){
          const el = document.getElementById(btn.getAttribute("data-target"));
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
      $("lecture-done-btn").addEventListener("click", function(){ openTests(level, "nguphap"); });
      showScreen("screen-lecture");
    }

    /* ---------- Màn làm bài ---------- */
    function openQuiz(level, skill, no, partNo){
      stopTimer();
      state.level = level; state.skill = skill; state.testNo = no;
      state.partNo = (skill === "tuvung" && partNo) ? partNo : null;
      state.answers = {}; state.submitted = false;
      const t = getTest(level, skill, no);
      const view = t ? getQuizView(level, skill, no, state.partNo) : null;
      state.quiz = view;
      state.quizSeconds = view ? view.seconds : TEST_SECONDS;
      const tName = view ? view.title : ((t && t.title) ? t.title : ("Đề số " + pad2(no)));
      const crumb = (skill === "tuvung" && state.partNo && t)
        ? [ { text: "Trang chủ" }, { text: "JLPT " + level }, { text: skillLabel(skill) },
            { text: t.title || tName }, { text: tName, bold: true } ]
        : [ { text: "Trang chủ" }, { text: "JLPT " + level }, { text: skillLabel(skill) },
            { text: tName, bold: true } ];
      if (!t){
        $("crumb-empty").innerHTML = crumbHTML(crumb);
        $("empty-title").textContent = level + " - " + skillLabel(skill) + ": " + tName;
        showScreen("screen-empty");
        return;
      }
      $("crumb-quiz").innerHTML = crumbHTML(crumb);
      $("quiz-title").textContent = level + " - " + skillLabel(skill) + ": " + tName.toUpperCase();
      $("result-banner").className = "result-banner";
      $("result-banner").innerHTML = "";
      $("submit-btn").style.display = "block";
      $("retry-btn").classList.remove("show");
      $("retry-btn").textContent = t.title ? "↻ Làm lại bài này" : "↻ Làm lại đề này";

      const pBox = $("passage-box");
      if (view.passage){
        pBox.innerHTML = '<div class="passage jp"><span class="p-label">ĐOẠN VĂN — ĐỌC KỸ RỒI TRẢ LỜI CÁC CÂU HỎI BÊN DƯỚI</span>' + view.passage + "</div>";
      } else if (skill === "luyennoi"){
        pBox.innerHTML = '<div class="passage"><span class="p-label">HỘI THOẠI</span>Đọc câu nói của người đối thoại trong mỗi câu và chọn câu trả lời phù hợp nhất.</div>';
      } else {
        pBox.innerHTML = "";
      }

      const listEl = $("question-list");
      listEl.innerHTML = "";
      view.questions.forEach(function(q, qi){
        const block = document.createElement("div");
        block.className = "q-block";
        let html = '<p class="q-text jp"><span class="q-num">Câu ' + (qi + 1) + "</span>" + q.q + "</p>";
        html += '<div class="opts">';
        q.options.forEach(function(opt, oi){
          html += '<button type="button" class="opt-btn jp" data-q="' + qi + '" data-o="' + oi + '">' +
                  '<span class="opt-letter">' + "ABCD"[oi] + "</span><span>" + opt + "</span></button>";
        });
        html += "</div>";
        html += '<div class="explain" id="explain-' + qi + '"><b>Giải thích:</b> ' + q.explain + "</div>";
        block.innerHTML = html;
        listEl.appendChild(block);
      });
      listEl.querySelectorAll(".opt-btn").forEach(function(btn){
        btn.addEventListener("click", function(){
          if (state.submitted) return;
          const qi = parseInt(btn.getAttribute("data-q"), 10);
          const oi = parseInt(btn.getAttribute("data-o"), 10);
          state.answers[qi] = oi;
          listEl.querySelectorAll('.opt-btn[data-q="' + qi + '"]').forEach(function(x){ x.classList.remove("selected"); });
          btn.classList.add("selected");
          renderProgress();
        });
      });
      renderProgress();
      showScreen("screen-quiz");
      startTimer(view.seconds);
    }

    function renderProgress(){
      const t = state.quiz;
      if (!t) return;
      const done = Object.keys(state.answers).length;
      $("progress-text").textContent = state.submitted
        ? "Đã nộp bài — xem đáp án và giải thích bên dưới."
        : "Đã làm " + done + " / " + t.questions.length + " câu · Thời gian làm bài: " + (state.quizSeconds / 60) + " phút";
    }

    /* ---------- Nộp bài ---------- */
    function submitQuiz(auto){
      if (state.submitted) return;
      const t = state.quiz;
      if (!t) return;
      const total = t.questions.length;
      const unanswered = total - Object.keys(state.answers).length;
      if (!auto && unanswered > 0){
        $("confirm-text").textContent =
          "Bạn vẫn còn " + unanswered + " câu chưa chọn đáp án. Bạn có chắc muốn nộp bài không?";
        $("confirm-modal").classList.add("show");
        return;
      }
      doSubmit();
    }

    function doSubmit(){
      const t = state.quiz;
      if (!t || state.submitted) return;
      state.submitted = true;
      stopTimer();
      renderTimer();
      let score = 0;
      t.questions.forEach(function(q, qi){
        const chosen = state.answers[qi];
        if (chosen === q.answer) score++;
        document.querySelectorAll('.opt-btn[data-q="' + qi + '"]').forEach(function(btn){
          const oi = parseInt(btn.getAttribute("data-o"), 10);
          btn.disabled = true;
          btn.classList.remove("selected");
          if (oi === q.answer) btn.classList.add("correct");
          else if (oi === chosen) btn.classList.add("wrong");
        });
        const ex = $("explain-" + qi);
        if (ex) ex.classList.add("show");
      });
      const total = t.questions.length;
      const pct = Math.round(score / total * 100);
      const banner = $("result-banner");
      let cls, msg;
      if (pct >= 80){ cls = "good"; msg = "🎉 Xuất sắc! Bạn làm đúng " + score + " / " + total + " câu chính xác."; }
      else if (pct >= 50){ cls = "mid"; msg = "💪 Khá tốt! Bạn làm đúng " + score + " / " + total + " câu chính xác. Xem lại phần giải thích để tiến bộ hơn nhé."; }
      else { cls = "low"; msg = "📚 Bạn làm đúng " + score + " / " + total + " câu chính xác. Đừng nản — xem kỹ giải thích rồi làm lại đề này nhé!"; }
      banner.className = "result-banner show " + cls;
      banner.innerHTML = msg + '<span class="pct">Điểm của bạn: ' + pct + "%</span>";
      $("submit-btn").style.display = "none";
      $("retry-btn").classList.add("show");
      renderProgress();
      banner.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    /* ---------- Donate cho tác giả (VietQR — Agribank) ---------- */
    /* Chuỗi payload VietQR tính sẵn kèm CRC chuẩn EMV cho từng mệnh giá — không sửa bất kỳ ký tự nào.
       Payload có đủ trường 59 (tên chủ tài khoản NGUYEN DUONG ANH, trường bắt buộc theo chuẩn EMVCo)
       để app ngân hàng nào cũng đọc ra màn hình chuyển khoản. Mã VietQR không có hạn sử dụng. */
    const DONATE_PAYLOADS = {
      "10000": "00020101021238560010A0000007270126000697040501122709555568680208QRIBFTTA53037045405100005802VN5916NGUYEN DUONG ANH62170813Cam on sensei6304959A",
      "20000": "00020101021238560010A0000007270126000697040501122709555568680208QRIBFTTA53037045405200005802VN5916NGUYEN DUONG ANH62170813Cam on sensei630457D3",
      "50000": "00020101021238560010A0000007270126000697040501122709555568680208QRIBFTTA53037045405500005802VN5916NGUYEN DUONG ANH62170813Cam on sensei630482A7"
    };
    const DONATE_LABELS = { "10000": "10.000₫", "20000": "20.000₫", "50000": "50.000₫" };
    const DONATE_ACCOUNT = "270955556868";

    function openDonate(){
      stopTimer();
      showScreen("screen-donate");
    }

    function selectDonateAmount(amount){
      document.querySelectorAll(".amount-btn").forEach(function(btn){
        btn.classList.toggle("selected", btn.getAttribute("data-amount") === amount);
      });
      const qr = qrcode(0, "M");
      qr.addData(DONATE_PAYLOADS[amount], "Byte");
      qr.make();
      /* margin 32px với cellSize 8 = vùng trắng yên lặng đúng chuẩn 4 module quanh mã,
         để camera app ngân hàng bắt được mã ngay cả khi quét qua màn hình. */
      $("donate-qr").innerHTML = qr.createSvgTag({ cellSize: 8, margin: 32, scalable: true });
      $("donate-amount-text").textContent = DONATE_LABELS[amount];
      $("copy-ok").textContent = "";
      $("donate-result").classList.add("show");
    }

    function copyAccountNumber(){
      const ok = $("copy-ok");
      function done(){ ok.textContent = "✓ Đã sao chép số tài khoản " + DONATE_ACCOUNT; }
      function fallback(){
        const ta = document.createElement("textarea");
        ta.value = DONATE_ACCOUNT;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); }
        catch (e) { ok.textContent = "Hãy nhập tay số tài khoản: " + DONATE_ACCOUNT; }
        document.body.removeChild(ta);
      }
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(DONATE_ACCOUNT).then(done, fallback);
      } else {
        fallback();
      }
    }

    /* ---------- Sự kiện nút ---------- */
    /* Nút quay lại cố định: bấm đúng nút "quay lại" của màn hình hiện tại,
       để hành vi (dừng đồng hồ, nạp lại danh sách…) giống hệt nút trong trang. */
    $("fixed-back").addEventListener("click", function(){
      const active = document.querySelector(".screen.active");
      const map = {
        "screen-skills": "back-home",
        "screen-tests": "back-skills",
        "screen-parts": "back-parts",
        "screen-quiz": "back-tests",
        "screen-lecture": "back-lecture-tests",
        "screen-empty": "back-empty",
        "screen-donate": "back-donate-home"
      };
      const target = active ? map[active.id] : null;
      if (target) $(target).click();
    });
    $("back-home").addEventListener("click", function(){ stopTimer(); showScreen("screen-home"); });
    $("back-lecture-tests").addEventListener("click", function(){ stopTimer(); openTests(state.level, "nguphap"); });
    $("back-donate-home").addEventListener("click", function(){ stopTimer(); showScreen("screen-home"); });
    document.querySelectorAll(".amount-btn").forEach(function(btn){
      btn.addEventListener("click", function(){ selectDonateAmount(btn.getAttribute("data-amount")); });
    });
    $("copy-acc-btn").addEventListener("click", copyAccountNumber);
    $("back-skills").addEventListener("click", function(){ stopTimer(); openSkills(state.level); });
    $("back-parts").addEventListener("click", function(){ stopTimer(); openTests(state.level, "tuvung"); });
    $("back-tests").addEventListener("click", function(){
      stopTimer();
      if (state.skill === "tuvung" && state.partNo) openParts(state.level, state.testNo);
      else openTests(state.level, state.skill);
    });
    $("back-empty").addEventListener("click", function(){ openTests(state.level, state.skill); });
    $("submit-btn").addEventListener("click", function(){ submitQuiz(false); });
    $("retry-btn").addEventListener("click", function(){ openQuiz(state.level, state.skill, state.testNo, state.partNo || undefined); });
    $("confirm-cancel").addEventListener("click", function(){ $("confirm-modal").classList.remove("show"); });
    $("confirm-ok").addEventListener("click", function(){
      $("confirm-modal").classList.remove("show");
      doSubmit();
    });
    