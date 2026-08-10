/* ==========================================================================
   レター 触れる企画書 ─ 共通スクリプト
   外部ライブラリは使用しない。オフラインで完結する。
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * 送信後のお礼メッセージ（順調／遅れ気味 の場合・ランダム10種）
   * ---------------------------------------------------------------- */
  var THANKS = [
    "今週もおつかれさまでした。ゆっくり休んでください",
    "がんばってるの、ちゃんと見てます。よい週末を",
    "ありがとうございます。今週の分、しっかり切り替えてくださいね",
    "おつかれさまでした。週末はどうか無理せず。また来週！",
    "ありがとう。あなたが動いてくれたぶん、会社は前に進んでいます",
    "今週もありがとうございました。ゆっくりしてください",
    "おつかれさまです。ちゃんと届きました。よい週末を",
    "ありがとうございます。少し肩の力を抜いてくださいね",
    "今週もおつかれさまでした。よく持ちこたえました",
    "受け取りました。あとは週末に任せましょう"
  ];

  var THANKS_STORAGE_KEY = "letterThanksLastIndex";

  function pickThanksIndex() {
    var last = sessionStorage.getItem(THANKS_STORAGE_KEY);
    var lastIndex = last === null ? -1 : parseInt(last, 10);
    var next = lastIndex;
    if (THANKS.length > 1) {
      while (next === lastIndex) {
        next = Math.floor(Math.random() * THANKS.length);
      }
    } else {
      next = 0;
    }
    sessionStorage.setItem(THANKS_STORAGE_KEY, String(next));
    return next;
  }

  /* ------------------------------------------------------------------
   * オープニング演出（index.html）
   * ---------------------------------------------------------------- */
  function initSplash() {
    var overlay = document.getElementById("splash");
    if (!overlay) return;

    var SPLASH_KEY = "letterSplashDone";
    var FADE_IN_MS = 800;
    var HOLD_MS = 1000;
    var FADE_OUT_MS = 500;

    function removeOverlay() {
      if (!overlay || !overlay.parentNode) return;
      overlay.parentNode.removeChild(overlay);
    }

    var reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (sessionStorage.getItem(SPLASH_KEY) || reduceMotion) {
      sessionStorage.setItem(SPLASH_KEY, "1");
      removeOverlay();
      return;
    }

    sessionStorage.setItem(SPLASH_KEY, "1");

    var img = overlay.querySelector(".splash-img");
    var holdTimer;
    var fadedOut = false;

    function fadeOut() {
      if (fadedOut) return;
      fadedOut = true;
      clearTimeout(holdTimer);
      overlay.classList.add("splash-hide");
      overlay.addEventListener("transitionend", removeOverlay, { once: true });
      setTimeout(removeOverlay, FADE_OUT_MS + 150);
    }

    overlay.addEventListener("click", fadeOut);

    setTimeout(function () {
      if (img) img.classList.add("splash-show");
    }, 20);

    holdTimer = setTimeout(fadeOut, FADE_IN_MS + HOLD_MS);
  }

  /* ------------------------------------------------------------------
   * 読み進みバー（slides.html）
   * ---------------------------------------------------------------- */
  function initProgressBar() {
    var fill = document.querySelector(".progress-bar-fill");
    if (!fill) return;

    function update() {
      var doc = document.documentElement;
      var scrollTop = window.pageYOffset || doc.scrollTop;
      var height = doc.scrollHeight - doc.clientHeight;
      var pct = height > 0 ? (scrollTop / height) * 100 : 0;
      fill.style.width = pct + "%";
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ------------------------------------------------------------------
   * タブ切り替え（mock.html）
   * ---------------------------------------------------------------- */
  function initTabs() {
    var tabBtns = document.querySelectorAll("[data-tab-target]");
    if (!tabBtns.length) return;

    tabBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-tab-target");

        tabBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");

        document.querySelectorAll(".tab-panel").forEach(function (panel) {
          panel.classList.toggle("active", panel.id === targetId);
        });
      });
    });
  }

  /* ------------------------------------------------------------------
   * 社長の画面：絞り込みボタン
   * ---------------------------------------------------------------- */
  function initFilters() {
    var filterBtns = document.querySelectorAll("[data-filter]");
    if (!filterBtns.length) return;

    filterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var filter = btn.getAttribute("data-filter");
        var table = btn.closest(".table-block") || document;
        var group = btn.closest(".filter-row");

        if (group) {
          group.querySelectorAll(".filter-btn").forEach(function (b) {
            b.classList.remove("active");
          });
        }
        btn.classList.add("active");

        var rows = table.querySelectorAll(".notion-table tbody tr");
        rows.forEach(function (row) {
          var status = row.getAttribute("data-status");
          var nofile = row.getAttribute("data-nofile") === "true";
          var show = true;
          if (filter === "happy") show = status === "happy";
          else if (filter === "meh") show = status === "meh";
          else if (filter === "sos") show = status === "sos";
          else if (filter === "nofile") show = nofile;
          row.classList.toggle("hidden-row", !show);
        });
      });
    });
  }

  /* ------------------------------------------------------------------
   * mock.html：週の切り替えチップ（ふつうの週／会議があった週）
   * ---------------------------------------------------------------- */
  function initWeekToggle() {
    var toggle = document.querySelector(".week-toggle");
    if (!toggle) return;

    var buttons = toggle.querySelectorAll(".week-toggle-btn");
    var mockContainer = document.querySelector("[data-slack-mock]");
    if (!mockContainer) return;

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");

        var isMeeting = btn.getAttribute("data-week") === "meeting";
        var frame = mockContainer.querySelector(".slack-frame");
        if (frame) frame.classList.toggle("meeting-week", isMeeting);
      });
    });
  }

  /* ------------------------------------------------------------------
   * build.html：コピー ボタン
   * ---------------------------------------------------------------- */
  function initCopyButtons() {
    var copyBtns = document.querySelectorAll(".copy-btn");
    if (!copyBtns.length) return;

    copyBtns.forEach(function (btn) {
      var targetId = btn.getAttribute("data-target");
      var target = document.getElementById(targetId);
      if (!target) return;

      var originalLabel = btn.textContent;
      var timer = null;

      btn.addEventListener("click", function () {
        var text = target.textContent;

        function showCopied() {
          clearTimeout(timer);
          btn.textContent = "✓ コピーしました";
          btn.classList.add("copied");
          timer = setTimeout(function () {
            btn.textContent = originalLabel;
            btn.classList.remove("copied");
          }, 2000);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(showCopied, function () {
            fallbackCopy(text);
            showCopied();
          });
        } else {
          fallbackCopy(text);
          showCopied();
        }
      });
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
  }

  /* ------------------------------------------------------------------
   * Slack風フォーム（mock.html の「社員の画面」/ staff.html 共用）
   * data-slack-mock 属性を持つ要素の中に、5画面ぶんの DOM を生成する。
   * ---------------------------------------------------------------- */
  var slackMockSeq = 0;

  function renderSlackMock(container) {
    slackMockSeq += 1;
    var uid = "sm" + slackMockSeq;
    var todoFeature = container.getAttribute("data-todo-feature") === "true";

    var meetingTodoBlockHtml = todoFeature ?
      '<div class="meeting-todo-block">' +
        '<div class="meeting-todo-text">先週の企画会議で、あなたのToDoが3件あります。</div>' +
        '<button type="button" class="btn btn-outline btn-block" data-go="t">ToDoを確認する</button>' +
      '</div>' : '';

    var screenTHtml = todoFeature ?
      '<div class="slack-screen screen-t">' +
        '<div class="canvas-frame">' +
          '<div class="canvas-title">あなたのToDo（8/7 企画会議）</div>' +
          '<div class="canvas-desc">チェックすると、金曜21時の集計に自動で反映されます。ここはあなた専用のページで、いつでも開けます。</div>' +
          '<label class="todo-item"><input type="checkbox" class="todo-check"><span class="todo-box"></span><span class="todo-label">新規案件Aの見積もりを作る（8/14まで）</span></label>' +
          '<label class="todo-item"><input type="checkbox" class="todo-check"><span class="todo-box"></span><span class="todo-label">LP修正の依頼文をデザイナーに送る（8/12まで）</span></label>' +
          '<label class="todo-item"><input type="checkbox" class="todo-check"><span class="todo-box"></span><span class="todo-label">B社への請求書を経理に回す（8/15まで）</span></label>' +
          '<div class="canvas-note">未完了のToDoは、翌週のレターにも自動で載ります</div>' +
          '<button type="button" class="btn btn-block" data-go="a" data-no-reset="true">レターに戻る</button>' +
        '</div>' +
      '</div>' : '';

    container.innerHTML =
      '<div class="slack-frame">' +
        '<div class="slack-topbar"># レター</div>' +
        '<div class="slack-body">' +

          /* 画面A */
          '<div class="slack-screen screen-a active">' +
            '<div class="slack-msg-title">レターの時間です</div>' +
            '<div class="slack-msg-body">' +
              'おつかれさまです。今週もありがとうございました。\n30秒で終わります。\n\n' +
              'うまくいかなかった週も、そのまま出してOKです。\nきれいにまとめる必要はありません。' +
            '</div>' +
            meetingTodoBlockHtml +
            '<button type="button" class="btn btn-block" data-go="b">レターを書く</button>' +
          '</div>' +

          /* 画面B（フォーム） */
          '<div class="slack-screen screen-b">' +
            '<div class="form-title">レター（8/14週）</div>' +

            '<div class="q-block">' +
              '<div class="q-label">Q1. 今週の調子はどうでしたか？</div>' +
              '<label class="radio-option"><input type="radio" name="' + uid + '-q1" value="happy"><span class="sq sq-happy"></span>順調でした</label>' +
              '<label class="radio-option"><input type="radio" name="' + uid + '-q1" value="meh"><span class="sq sq-meh"></span>ちょっと遅れ気味</label>' +
              '<label class="radio-option"><input type="radio" name="' + uid + '-q1" value="sos"><span class="sq sq-sos"></span>困ってる・相談したい</label>' +
            '</div>' +

            '<div class="q-block">' +
              '<div class="q-label">Q2. 今週やったこと・出したもの</div>' +
              '<div class="q-sub">スクショ、資料、URLなど何でも。無い週は空欄でOK。</div>' +
              '<div class="dropzone" tabindex="0">ここにファイルをドラッグ＆ドロップ／クリックして選択</div>' +
              '<input type="file" class="file-input-hidden" multiple style="display:none">' +
              '<div class="file-chips"></div>' +
              '<div class="url-input-wrap">' +
                '<input type="url" placeholder="リンクで渡す場合はこちら（任意）">' +
              '</div>' +
            '</div>' +

            '<div class="q-block">' +
              '<div class="q-label">Q3. ひとこと</div>' +
              '<textarea rows="3" placeholder="例）来週◯◯に着手します／××が想定より重かった"></textarea>' +
            '</div>' +

            '<div class="reveal-block">' +
              '<div class="reveal-inner">' +
                '<div class="q-block">' +
                  '<div class="q-label">Q4. どんなことで困っていますか？</div>' +
                  '<div class="note-box">' +
                    '<div class="note-box-head">' +
                      '<span class="note-box-title">ご記入前に（大事なことを書いています）</span>' +
                      '<button type="button" class="note-box-toggle" aria-expanded="true" aria-label="注意書きの開閉">−</button>' +
                    '</div>' +
                    '<div class="note-box-body">ここは社長だけが見ます。リーダーには表示されません。\nまとまっていなくて大丈夫です。愚痴でも構いません。\nすぐに解決できるとは限りません。それでも、知っているだけで\n打てる手があります。気楽に書いてください。</div>' +
                  '</div>' +
                  '<textarea rows="4" class="q4-textarea"></textarea>' +
                '</div>' +
                '<div class="q-block">' +
                  '<div class="q-label">Q5. どうしてほしいですか？</div>' +
                  '<label class="radio-option"><input type="radio" name="' + uid + '-q5" value="listen">話を聞いてほしい</label>' +
                  '<label class="radio-option"><input type="radio" name="' + uid + '-q5" value="decide">判断・指示がほしい</label>' +
                  '<label class="radio-option"><input type="radio" name="' + uid + '-q5" value="resource">人・お金・時間がほしい</label>' +
                  '<label class="radio-option"><input type="radio" name="' + uid + '-q5" value="handover">自分では手に負えないので引き取ってほしい</label>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<button type="button" class="btn btn-block" data-submit>送信する</button>' +
          '</div>' +

          /* 画面C（通常・ランダム） */
          '<div class="slack-screen screen-c">' +
            '<div class="corner-note">← <span class="sq sq-sos"></span>「困ってる・相談したい」を選ぶと、この文面に変わります</div>' +
            '<div class="slack-complete">' +
              '<div class="complete-main">受け取りました。</div>' +
              '<div class="complete-sub complete-random"></div>' +
              '<div class="complete-actions">' +
                '<button type="button" class="btn-outline btn" data-again>もう一度見る</button>' +
                '<div class="random-note">毎回ちがう言葉が出ます</div>' +
                '<button type="button" class="btn-secondary btn" data-go="a">もう一度最初から試す</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

          /* 画面D（困ってる・相談したい・固定） */
          '<div class="slack-screen screen-d">' +
            '<div class="corner-note">← <span class="sq sq-sos"></span>「困ってる・相談したい」を選ぶと、この文面に変わります</div>' +
            '<div class="slack-complete">' +
              '<div class="complete-main">受け取りました。\n社長がちゃんと読みます。すぐに声をかけられないこともありますが、必ず読みます。安心してください。</div>' +
              '<div class="complete-sub">ひとりで抱えないでくれて、ありがとう。</div>' +
              '<div class="complete-actions">' +
                '<button type="button" class="btn-secondary btn" data-go="a">もう一度最初から試す</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

          screenTHtml +

        '</div>' +
      '</div>';

    var screens = {
      a: container.querySelector(".screen-a"),
      b: container.querySelector(".screen-b"),
      c: container.querySelector(".screen-c"),
      d: container.querySelector(".screen-d")
    };
    if (todoFeature) {
      screens.t = container.querySelector(".screen-t");
    }

    function show(key) {
      Object.keys(screens).forEach(function (k) {
        if (screens[k]) screens[k].classList.toggle("active", k === key);
      });
    }

    container.querySelectorAll("[data-go]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-go");
        if (target === "a" && btn.getAttribute("data-no-reset") !== "true") resetForm();
        show(target);
      });
    });

    /* ---- Q1 の分岐（困ってる・相談したい で Q4/Q5 が出現） ---- */
    var revealBlock = screens.b.querySelector(".reveal-block");
    var q1Radios = screens.b.querySelectorAll('input[name="' + uid + '-q1"]');
    q1Radios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        revealBlock.classList.toggle("show", radio.value === "sos" && radio.checked);
      });
    });

    /* ---- Q4 上の注意書き：＋／−で畳める ---- */
    var NOTE_TITLE_TEXT = "ご記入前に（大事なことを書いています）";
    var noteToggle = screens.b.querySelector(".note-box-toggle");
    var noteTitle = screens.b.querySelector(".note-box-title");
    var noteBody = screens.b.querySelector(".note-box-body");
    if (noteToggle && noteTitle && noteBody) {
      noteToggle.addEventListener("click", function () {
        var expanded = noteToggle.getAttribute("aria-expanded") === "true";
        var nextExpanded = !expanded;
        noteToggle.setAttribute("aria-expanded", String(nextExpanded));
        noteToggle.textContent = nextExpanded ? "−" : "＋";
        noteBody.classList.toggle("collapsed", !nextExpanded);
        noteTitle.textContent = nextExpanded ? NOTE_TITLE_TEXT : "＋ " + NOTE_TITLE_TEXT;
      });
    }

    /* ---- Q2：ドラッグ＆ドロップ／クリック選択 ---- */
    var dropzone = screens.b.querySelector(".dropzone");
    var fileInput = screens.b.querySelector(".file-input-hidden");
    var fileChips = screens.b.querySelector(".file-chips");

    function addFileChip(name) {
      var chip = document.createElement("span");
      chip.className = "file-chip";
      var label = document.createElement("span");
      label.textContent = name;
      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", function () {
        chip.remove();
      });
      chip.appendChild(label);
      chip.appendChild(removeBtn);
      fileChips.appendChild(chip);
    }

    dropzone.addEventListener("click", function () {
      fileInput.click();
    });
    dropzone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });
    dropzone.addEventListener("dragover", function (e) {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", function () {
      dropzone.classList.remove("dragover");
    });
    dropzone.addEventListener("drop", function (e) {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      var files = e.dataTransfer ? e.dataTransfer.files : [];
      Array.prototype.forEach.call(files, function (f) { addFileChip(f.name); });
    });
    fileInput.addEventListener("change", function () {
      Array.prototype.forEach.call(fileInput.files, function (f) { addFileChip(f.name); });
      fileInput.value = "";
    });

    /* ---- 送信 ---- */
    var submitBtn = screens.b.querySelector("[data-submit]");
    var q4Textarea = screens.b.querySelector(".q4-textarea");
    var q5Radios = screens.b.querySelectorAll('input[name="' + uid + '-q5"]');
    var completeRandom = screens.c.querySelector(".complete-random");

    function clearErrors() {
      screens.b.querySelectorAll(".field-error").forEach(function (el) {
        el.classList.remove("field-error");
      });
    }

    submitBtn.addEventListener("click", function () {
      clearErrors();

      var checkedQ1 = screens.b.querySelector('input[name="' + uid + '-q1"]:checked');
      if (!checkedQ1) {
        window.alert("Q1：今週の調子を選んでください。");
        return;
      }

      var isSos = checkedQ1.value === "sos";

      if (isSos) {
        if (!q4Textarea.value.trim()) {
          q4Textarea.classList.add("field-error");
          q4Textarea.focus();
          return;
        }
        var checkedQ5 = screens.b.querySelector('input[name="' + uid + '-q5"]:checked');
        if (!checkedQ5) {
          window.alert("Q5：どうしてほしいか選んでください。");
          return;
        }
        show("d");
      } else {
        completeRandom.textContent = THANKS[pickThanksIndex()];
        show("c");
      }
    });

    var againBtn = screens.c.querySelector("[data-again]");
    againBtn.addEventListener("click", function () {
      completeRandom.textContent = THANKS[pickThanksIndex()];
    });

    function resetForm() {
      clearErrors();
      screens.b.querySelectorAll('input[type="radio"]').forEach(function (r) { r.checked = false; });
      screens.b.querySelectorAll("textarea").forEach(function (t) { t.value = ""; });
      screens.b.querySelectorAll('input[type="url"]').forEach(function (u) { u.value = ""; });
      fileChips.innerHTML = "";
      revealBlock.classList.remove("show");
      container.querySelectorAll(".todo-check").forEach(function (cb) { cb.checked = false; });
      if (noteToggle && noteTitle && noteBody) {
        noteToggle.setAttribute("aria-expanded", "true");
        noteToggle.textContent = "−";
        noteBody.classList.remove("collapsed");
        noteTitle.textContent = NOTE_TITLE_TEXT;
      }
    }

    show("a");
  }

  function initSlackMocks() {
    document.querySelectorAll("[data-slack-mock]").forEach(function (el) {
      renderSlackMock(el);
    });
  }

  /* ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    initSplash();
    initProgressBar();
    initTabs();
    initFilters();
    initCopyButtons();
    initSlackMocks();
    initWeekToggle();
  });
})();
