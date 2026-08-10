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
                  '<div class="note-box">ここは社長だけが見ます。リーダーには表示されません。\nまとまっていなくて大丈夫です。愚痴でも構いません。\nすぐに解決できるとは限りません。それでも、知っているだけで\n打てる手があります。気楽に書いてください。</div>' +
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
              '<div class="complete-main">受け取りました。\n近いうちに社長から声をかけます。</div>' +
              '<div class="complete-sub">ひとりで抱えないでくれて、ありがとう。</div>' +
              '<div class="complete-actions">' +
                '<button type="button" class="btn-secondary btn" data-go="a">もう一度最初から試す</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

        '</div>' +
      '</div>';

    var screens = {
      a: container.querySelector(".screen-a"),
      b: container.querySelector(".screen-b"),
      c: container.querySelector(".screen-c"),
      d: container.querySelector(".screen-d")
    };

    function show(key) {
      Object.keys(screens).forEach(function (k) {
        screens[k].classList.toggle("active", k === key);
      });
    }

    container.querySelectorAll("[data-go]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-go");
        if (target === "a") resetForm();
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
    initProgressBar();
    initTabs();
    initFilters();
    initCopyButtons();
    initSlackMocks();
  });
})();
