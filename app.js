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
  var updateProgressBar = null;

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

    updateProgressBar = update;
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ------------------------------------------------------------------
   * 紙芝居モード（slides.html）
   * 開くと01だけ表示。タップ/クリックまたは→キーで1枚ずつ進み、
   * 13の次で資料モード（全部縦並び・スクロール）に切り替わる。
   * 毎回01から始まる（記憶しない）。JSが動かない環境では既定CSSの
   * まま資料モードで表示される。
   * ---------------------------------------------------------------- */
  function initSlideDeck() {
    var deck = document.querySelector(".slide-deck");
    if (!deck) return;

    var slides = Array.prototype.slice.call(deck.querySelectorAll(".slide"));
    if (!slides.length) return;

    var skipBtn = document.getElementById("deckSkip");
    var root = document.documentElement;
    var total = slides.length;
    var index = 0;
    var mode = "deck"; // "deck"（紙芝居） | "doc"（資料）
    var INTERACTIVE_SELECTOR = "a[href], button, input, textarea, select, [role='button']";

    function reduceMotion() {
      return !!(window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    function updateDeckProgress() {
      var fill = document.querySelector(".progress-bar-fill");
      if (!fill) return;
      fill.style.width = (((index + 1) / total) * 100) + "%";
    }

    function showSlide(newIndex) {
      var prev = slides[index];
      var next = slides[newIndex];
      if (!next || next === prev) return;

      prev.classList.remove("is-current");
      if (reduceMotion()) {
        prev.classList.remove("is-leaving");
      } else {
        prev.classList.add("is-leaving");
        setTimeout(function () {
          prev.classList.remove("is-leaving");
        }, 260);
      }

      next.classList.add("is-current");
      next.scrollTop = 0;

      index = newIndex;
      updateDeckProgress();
    }

    function switchToDocMode() {
      if (mode !== "deck") return;
      mode = "doc";

      function finish() {
        root.classList.remove("js-deck");
        slides.forEach(function (s) {
          s.classList.remove("is-current", "is-leaving");
        });
        window.scrollTo(0, 0);
        if (updateProgressBar) updateProgressBar();
        deck.classList.remove("deck-fading");
      }

      if (reduceMotion()) {
        finish();
        return;
      }
      deck.classList.add("deck-fading");
      setTimeout(finish, 200);
    }

    function advance() {
      if (mode !== "deck") return;
      if (index >= total - 1) {
        switchToDocMode();
        return;
      }
      showSlide(index + 1);
    }

    function goBack() {
      if (mode !== "deck") return;
      if (index <= 0) return;
      showSlide(index - 1);
    }

    root.classList.add("js-deck");
    slides[0].classList.add("is-current");
    updateDeckProgress();

    document.addEventListener("click", function (e) {
      var interactive = e.target.closest && e.target.closest(INTERACTIVE_SELECTOR);
      if (interactive) return; // リンク・ボタンは本来の動作にまかせる
      advance();
    });

    if (skipBtn) {
      skipBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        switchToDocMode();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (mode !== "deck") return;
      var active = document.activeElement;
      if (active && active.closest && active.closest(INTERACTIVE_SELECTOR)) return;
      if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        advance();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
    });
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

  /* ------------------------------------------------------------------
   * analytics.html：グラフのドリルダウン（バー／ブロックをタップ→社員一覧）
   * サンプルデータのみ。社員データはここ1箇所で定義し、
   * 提出率パネル・調子パネルの両方から同じ配列を参照することで
   * 2つのパネル間で状態が食い違わないようにする。
   * ---------------------------------------------------------------- */
  var ANALYTICS_WEEKS = ["6/29", "7/6", "7/13", "7/20", "7/27", "8/3"];

  var ANALYTICS_STAFF = [
    { name: "山田 太郎", dept: "IT広告", weeks: [
      { status: "happy", out: 2 }, { status: "happy", out: 1 }, { status: "happy", out: 2 },
      { status: "happy", out: 2 }, { status: "happy", out: 1 }, { status: "happy", out: 2 }
    ]},
    { name: "佐藤 花子", dept: "飲食", weeks: [
      { status: "happy", out: 1 }, { status: "happy", out: 1 }, { status: "meh", out: 1 },
      { status: "meh", out: 1 }, { status: "meh", out: 1 }, { status: "happy", out: 2 }
    ]},
    { name: "鈴木 一郎", dept: "IT広告", weeks: [
      { status: "happy", out: 1 }, { status: "happy", out: 2 }, { status: "happy", out: 1 },
      { status: "happy", out: 0 }, { status: "happy", out: 1 }, { status: "happy", out: 2 }
    ]},
    { name: "高橋 健", dept: "飲食", weeks: [
      { status: "happy", out: 0 }, { status: "happy", out: 0 }, { status: "happy", out: 0 },
      { status: "unsub" }, { status: "meh", out: 1 }, { status: "happy", out: 1 }
    ]},
    { name: "田中 美咲", dept: "IT広告", weeks: [
      { status: "meh", out: 1 }, { status: "meh", out: 1 }, { status: "happy", out: 1 },
      { status: "happy", out: 2 }, { status: "meh", out: 1 }, { status: "happy", out: 1 }
    ]},
    { name: "伊藤 大輔", dept: "IT広告", weeks: [
      { status: "happy", out: 1 }, { status: "sos", out: 1, note: "first" }, { status: "sos", out: 1, note: "done" },
      { status: "happy", out: 1 }, { status: "happy", out: 2 }, { status: "happy", out: 1 }
    ]},
    { name: "渡辺 さくら", dept: "飲食", weeks: [
      { status: "meh", out: 1 }, { status: "meh", out: 1 }, { status: "happy", out: 1 },
      { status: "meh", out: 1 }, { status: "happy", out: 2 }, { status: "happy", out: 1 }
    ]},
    { name: "中村 拓也", dept: "飲食", weeks: [
      { status: "happy", out: 1 }, { status: "happy", out: 1 }, { status: "happy", out: 1 },
      { status: "sos", out: 2, note: "first" }, { status: "sos", out: 2, note: "ongoing" }, { status: "happy", out: 1 }
    ]},
    { name: "小林 由紀", dept: "IT広告", weeks: [
      { status: "sos", out: 1, note: "first" }, { status: "happy", out: 1 }, { status: "unsub" },
      { status: "happy", out: 2 }, { status: "happy", out: 1 }, { status: "meh", out: 1 }
    ]},
    { name: "加藤 翔", dept: "IT広告", weeks: [
      { status: "unsub" }, { status: "happy", out: 1 }, { status: "meh", out: 1 },
      { status: "happy", out: 2 }, { status: "happy", out: 1 }, { status: "happy", out: 2 }
    ]},
    { name: "吉田 彩", dept: "飲食", weeks: [
      { status: "happy", out: 1 }, { status: "unsub" }, { status: "happy", out: 1 },
      { status: "meh", out: 1 }, { status: "happy", out: 2 }, { status: "sos", out: 1, note: "first" }
    ]},
    { name: "山口 直樹", dept: "飲食", weeks: [
      { status: "happy", out: 2 }, { status: "unsub" }, { status: "sos", out: 1, note: "first" },
      { status: "happy", out: 1 }, { status: "happy", out: 2 }, { status: "meh", out: 1 }
    ]},
    { name: "松本 恵", dept: "IT広告", weeks: [
      { status: "meh", out: 1 }, { status: "meh", out: 1 }, { status: "meh", out: 1 },
      { status: "happy", out: 2 }, { status: "happy", out: 1 }, { status: "happy", out: 1 }
    ]},
    { name: "井上 隆", dept: "IT広告", weeks: [
      { status: "sos", out: 1, note: "first" }, { status: "happy", out: 2 }, { status: "happy", out: 1 },
      { status: "happy", out: 1 }, { status: "unsub" }, { status: "happy", out: 2 }
    ]},
    { name: "木村 美穂", dept: "飲食", weeks: [
      { status: "meh", out: 1 }, { status: "happy", out: 1 }, { status: "unsub" },
      { status: "happy", out: 1 }, { status: "happy", out: 2 }, { status: "happy", out: 1 }
    ]},
    { name: "林 慎一", dept: "飲食", weeks: [
      { status: "happy", out: 1 }, { status: "sos", out: 1, note: "first" }, { status: "happy", out: 1 },
      { status: "happy", out: 2 }, { status: "happy", out: 1 }, { status: "meh", out: 1 }
    ]},
    { name: "清水 亜衣", dept: "IT広告", weeks: [
      { status: "happy", out: 2 }, { status: "meh", out: 1 }, { status: "happy", out: 1 },
      { status: "sos", out: 1, note: "first" }, { status: "happy", out: 2 }, { status: "happy", out: 1 }
    ]},
    { name: "森田 光", dept: "飲食", weeks: [
      { status: "unsub" }, { status: "happy", out: 1 }, { status: "meh", out: 1 },
      { status: "happy", out: 1 }, { status: "happy", out: 1 }, { status: "happy", out: 2 }
    ]},
    { name: "岡田 涼", dept: "IT広告", weeks: [
      { status: "happy", out: 1 }, { status: "unsub" }, { status: "happy", out: 2 },
      { status: "meh", out: 1 }, { status: "sos", out: 1, note: "first" }, { status: "happy", out: 1 }
    ]}
  ];

  var ANALYTICS_SQ_CLASS = { happy: "sq-happy", meh: "sq-meh", sos: "sq-sos", unsub: "sq-none" };
  var ANALYTICS_MOOD_LABEL = { happy: "順調", meh: "遅れ気味", sos: "要フォロー" };

  function analyticsOutText(out) {
    return out === 0 ? "成果物なし" : "成果物" + out + "件";
  }

  function analyticsMehStreak(person, weekIndex) {
    var streak = 0;
    for (var i = weekIndex; i >= 0; i--) {
      if (person.weeks[i].status === "meh") { streak++; } else { break; }
    }
    return streak;
  }

  function analyticsSubmitStatusText(week) {
    if (week.status === "unsub") return "未提出";
    return ANALYTICS_MOOD_LABEL[week.status] + "・" + analyticsOutText(week.out);
  }

  function analyticsMoodStatusText(person, weekIndex) {
    var week = person.weeks[weekIndex];
    if (week.status === "happy") return analyticsOutText(week.out);
    if (week.status === "meh") {
      var streak = analyticsMehStreak(person, weekIndex);
      return streak >= 2 ? (streak + "週連続で遅れ気味") : analyticsOutText(week.out);
    }
    if (week.status === "sos") {
      if (week.note === "ongoing") return "SOS 対応中";
      if (week.note === "done") return "SOS 完了";
      return "今週が初めて";
    }
    return "";
  }

  function analyticsRowHtml(person, statusText, isUnsub, sqClass) {
    return '<div class="drilldown-row' + (isUnsub ? " is-unsub" : "") + '">' +
      '<span class="sq ' + sqClass + '"></span>' +
      '<span class="drilldown-name">' + person.name + '</span>' +
      '<span class="drilldown-dept">' + person.dept + '</span>' +
      '<span class="drilldown-status">' + statusText + '</span>' +
      '</div>';
  }

  function renderAnalyticsSubmitPanel(panel, weekIndex) {
    var unsubRows = [];
    var restRows = [];
    var submittedCount = 0;

    ANALYTICS_STAFF.forEach(function (person) {
      var week = person.weeks[weekIndex];
      var rowHtml = analyticsRowHtml(
        person,
        analyticsSubmitStatusText(week),
        week.status === "unsub",
        ANALYTICS_SQ_CLASS[week.status]
      );
      if (week.status === "unsub") {
        unsubRows.push(rowHtml);
      } else {
        restRows.push(rowHtml);
        submittedCount++;
      }
    });

    var head = ANALYTICS_WEEKS[weekIndex] + "週の提出状況（" + submittedCount + "/" + ANALYTICS_STAFF.length + "名）";

    panel.innerHTML =
      '<div class="drilldown-head">' + head + '</div>' +
      '<div class="drilldown-rows">' + unsubRows.join("") + restRows.join("") + '</div>';
    panel.hidden = false;
  }

  function renderAnalyticsMoodPanel(panel, weekIndex, mood) {
    var rows = [];

    ANALYTICS_STAFF.forEach(function (person) {
      var week = person.weeks[weekIndex];
      if (week.status !== mood) return;
      rows.push(analyticsRowHtml(
        person,
        analyticsMoodStatusText(person, weekIndex),
        false,
        ANALYTICS_SQ_CLASS[mood]
      ));
    });

    var head = ANALYTICS_WEEKS[weekIndex] + "週・" + ANALYTICS_MOOD_LABEL[mood] + "（" + rows.length + "名）";
    var noteHtml = mood === "sos" ?
      '<div class="drilldown-sos-note">この一覧は社長のみ表示されます。困っている内容の中身は、さらに社長だけが見られます。</div>' : "";

    panel.innerHTML =
      '<div class="drilldown-head">' + head + '</div>' +
      '<div class="drilldown-rows">' + rows.join("") + '</div>' +
      noteHtml;
    panel.hidden = false;
  }

  function initAnalyticsDrilldown() {
    var barTracks = document.querySelectorAll(".chart-bar-track");
    var stackItems = document.querySelectorAll(".chart-stack-item");
    var submitPanel = document.getElementById("submitDrilldown");
    var moodPanel = document.getElementById("moodDrilldown");
    if (!barTracks.length && !stackItems.length) return;

    var openSubmitIndex = null;
    var openMoodKey = null;

    barTracks.forEach(function (track, weekIndex) {
      track.setAttribute("role", "button");
      track.setAttribute("tabindex", "0");
      track.setAttribute("aria-label", ANALYTICS_WEEKS[weekIndex] + "週の提出状況を見る");

      function toggleSubmit() {
        if (!submitPanel) return;
        if (openSubmitIndex === weekIndex) {
          submitPanel.hidden = true;
          submitPanel.innerHTML = "";
          track.classList.remove("is-selected");
          openSubmitIndex = null;
          return;
        }
        barTracks.forEach(function (t) { t.classList.remove("is-selected"); });
        track.classList.add("is-selected");
        openSubmitIndex = weekIndex;
        renderAnalyticsSubmitPanel(submitPanel, weekIndex);
      }

      track.addEventListener("click", toggleSubmit);
      track.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          toggleSubmit();
        }
      });
    });

    stackItems.forEach(function (item, weekIndex) {
      var segs = item.querySelectorAll(".chart-stack-seg");
      segs.forEach(function (seg) {
        var mood = seg.classList.contains("seg-happy") ? "happy" :
          seg.classList.contains("seg-meh") ? "meh" :
          seg.classList.contains("seg-sos") ? "sos" : null;
        if (!mood) return;
        var key = weekIndex + "-" + mood;

        seg.setAttribute("role", "button");
        seg.setAttribute("tabindex", "0");
        seg.setAttribute("aria-label", ANALYTICS_WEEKS[weekIndex] + "週・" + ANALYTICS_MOOD_LABEL[mood] + "の内訳を見る");

        function toggleMood() {
          if (!moodPanel) return;
          if (openMoodKey === key) {
            moodPanel.hidden = true;
            moodPanel.innerHTML = "";
            seg.classList.remove("is-selected");
            openMoodKey = null;
            return;
          }
          document.querySelectorAll(".chart-stack-seg.is-selected").forEach(function (s) {
            s.classList.remove("is-selected");
          });
          seg.classList.add("is-selected");
          openMoodKey = key;
          renderAnalyticsMoodPanel(moodPanel, weekIndex, mood);
        }

        seg.addEventListener("click", toggleMood);
        seg.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            toggleMood();
          }
        });
      });
    });
  }

  /* ------------------------------------------------------------------
   * analytics.html：SOSカード（今月のSOS／対応中／完了）のドリルダウン。
   * 数字はハードコードせず、ANALYTICS_STAFF から算出する。
   * 集計ルール：
   *  - 対象期間＝直近4週（ANALYTICS_WEEKS の後ろ4つ）
   *  - 同じ人の連続した status:"sos" は1案件としてまとめる
   *  - 案件の開始週が対象期間内のものだけを数える
   *  - 最新週まで sos が続いていれば「対応中」、それ以外は「完了」
   * ---------------------------------------------------------------- */
  function computeAnalyticsSosCases() {
    var periodStart = ANALYTICS_WEEKS.length - 4;
    var latestIndex = ANALYTICS_WEEKS.length - 1;
    var cases = [];

    ANALYTICS_STAFF.forEach(function (person) {
      var i = 0;
      while (i < person.weeks.length) {
        if (person.weeks[i].status === "sos") {
          var start = i;
          var end = i;
          while (end + 1 < person.weeks.length && person.weeks[end + 1].status === "sos") {
            end++;
          }
          if (start >= periodStart) {
            cases.push({ person: person, startIdx: start, endIdx: end, ongoing: end === latestIndex });
          }
          i = end + 1;
        } else {
          i++;
        }
      }
    });

    return cases;
  }

  function analyticsSosCaseStatusText(kase) {
    var statusLabel = kase.ongoing ? "対応中" : "完了";
    if (kase.startIdx === kase.endIdx) {
      return ANALYTICS_WEEKS[kase.startIdx] + "週に発生・" + statusLabel;
    }
    return ANALYTICS_WEEKS[kase.startIdx] + "週〜" + ANALYTICS_WEEKS[kase.endIdx] + "週・" + statusLabel;
  }

  function renderAnalyticsSosCards(cases) {
    var totalEl = document.getElementById("sosCardTotal");
    var ongoingEl = document.getElementById("sosCardOngoing");
    var doneEl = document.getElementById("sosCardDone");
    var ongoingCount = cases.filter(function (c) { return c.ongoing; }).length;
    var doneCount = cases.length - ongoingCount;
    if (totalEl) totalEl.textContent = cases.length;
    if (ongoingEl) ongoingEl.textContent = ongoingCount;
    if (doneEl) doneEl.textContent = doneCount;
  }

  function renderAnalyticsSosPanel(panel, cases, filter) {
    var filtered = cases.filter(function (c) {
      if (filter === "ongoing") return c.ongoing;
      if (filter === "done") return !c.ongoing;
      return true;
    });
    var rows = filtered.map(function (c) {
      return analyticsRowHtml(c.person, analyticsSosCaseStatusText(c), false, "sq-sos");
    });
    var headLabel = filter === "ongoing" ? "対応中のSOS" :
      filter === "done" ? "対応が完了したSOS" : "直近1か月のSOS";
    var head = headLabel + "（" + filtered.length + "件）";
    var noteHtml = '<div class="drilldown-sos-note">この一覧は社長のみ表示されます。困っている内容の中身は、さらに社長だけが見られます。</div>';

    panel.innerHTML =
      '<div class="drilldown-head">' + head + '</div>' +
      '<div class="drilldown-rows">' + rows.join("") + '</div>' +
      noteHtml;
    panel.hidden = false;
  }

  function initAnalyticsSosDrilldown() {
    var cards = document.querySelectorAll(".stat-cards .stat-card");
    var panel = document.getElementById("sosDrilldown");
    if (!cards.length || !panel) return;

    var cases = computeAnalyticsSosCases();
    renderAnalyticsSosCards(cases);

    var filters = [null, "ongoing", "done"];
    var labels = ["直近1か月のSOSの内訳を見る", "対応中のSOSの内訳を見る", "完了したSOSの内訳を見る"];
    var openIndex = null;

    cards.forEach(function (card, idx) {
      var filter = filters[idx];
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", labels[idx]);

      function toggle() {
        if (openIndex === idx) {
          panel.hidden = true;
          panel.innerHTML = "";
          card.classList.remove("is-selected");
          openIndex = null;
          return;
        }
        cards.forEach(function (c) { c.classList.remove("is-selected"); });
        card.classList.add("is-selected");
        openIndex = idx;
        renderAnalyticsSosPanel(panel, cases, filter);
      }

      card.addEventListener("click", toggle);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    initSplash();
    initProgressBar();
    initSlideDeck();
    initTabs();
    initFilters();
    initCopyButtons();
    initSlackMocks();
    initWeekToggle();
    initAnalyticsDrilldown();
    initAnalyticsSosDrilldown();
  });
})();
