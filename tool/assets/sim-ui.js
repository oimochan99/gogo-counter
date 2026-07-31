/* =========================================================================
 * GOGOカウンター Web版 設定判別ツール — 画面まわり
 *
 * 使い方：ページ内に以下のマウント先を置くだけでフォームと結果表示が生成される。
 *   <div id="gogo-sim"></div>                        … 機種を選ばせる（ハブ用）
 *   <div id="gogo-sim" data-machine="ゴーゴージャグラー3"></div>  … 機種固定（機種別ページ用）
 *
 * 入力の考え方（ここがアプリとの整合の要）：
 *   アプリは「合算ボーナスの分母＝台の累計G」「ぶどう・単独REGの分母＝自分が回したG」と
 *   明確に分けている。Web版でこれを1欄にまとめると、途中参加（後ヅモ）のときに
 *   ぶどうの分母だけが数倍に膨らみ、アプリと正反対の結果が出てしまう。
 *   そのため入力は必ず「自分が回した分」を基準にし、座る前の分は別欄で受け取る。
 * ========================================================================= */

(function () {
  'use strict';

  var STORE_PLAY = 'https://play.google.com/store/apps/details?id=com.oimochan99.gogocounter&referrer=utm_source%3Dsetting-tool%26utm_medium%3Dweb%26utm_campaign%3Dlp-simulator';
  var STORE_APPLE = 'https://apps.apple.com/jp/app/id6788582005?ct=setting-tool';

  var SETTING_COLORS = ['#3b82f6', '#22d3ee', '#a3e635', '#facc15', '#fb923c', '#ef4444'];

  var APPLE_SVG = '<svg class="w-5 h-5 fill-current" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 分母表示（1/123.4 形式）。null は「—」 */
  function denomText(v) {
    if (v == null || !isFinite(v)) return '—';
    return '1/' + v.toFixed(v < 100 ? 2 : 1);
  }

  /** 数値入力欄（±ステッパー付き）のHTML */
  function numField(id, label, opts) {
    opts = opts || {};
    var step = opts.step || 1;
    var hint = opts.hint ? '<p class="text-[11px] text-on-surface-variant/60 mt-xs leading-snug">' + opts.hint + '</p>' : '';
    return '' +
      '<div class="flex flex-col gap-xs">' +
      '  <label for="' + id + '" class="text-sm font-bold text-on-surface-variant">' + label + '</label>' +
      '  <div class="flex items-stretch gap-xs">' +
      '    <button type="button" data-step="-' + step + '" data-target="' + id + '" aria-label="' + esc(label) + 'を減らす"' +
      '      class="sim-step w-11 shrink-0 rounded-xl bg-surface-container-high border border-white/10 text-on-surface text-xl font-bold hover:bg-surface-container-highest active:scale-95 transition">−</button>' +
      '    <input id="' + id + '" type="number" inputmode="numeric" min="0" step="1" placeholder="0"' +
      '      class="sim-input flex-1 min-w-0 h-12 rounded-xl bg-surface-container-lowest border border-white/15 px-sm text-center text-xl font-mono-num text-white focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container"/>' +
      '    <button type="button" data-step="' + step + '" data-target="' + id + '" aria-label="' + esc(label) + 'を増やす"' +
      '      class="sim-step w-11 shrink-0 rounded-xl bg-surface-container-high border border-white/10 text-on-surface text-xl font-bold hover:bg-surface-container-highest active:scale-95 transition">＋</button>' +
      '  </div>' + hint +
      '</div>';
  }

  /** 折りたたみブロック */
  function foldBlock(summary, sub, inner) {
    return '' +
      '<details class="bg-surface-container-low border border-white/10 rounded-xl overflow-hidden group">' +
      '  <summary class="cursor-pointer list-none px-sm py-sm flex justify-between items-center gap-sm">' +
      '    <span><span class="font-bold text-primary text-sm">' + summary + '</span>' +
      '      <span class="block text-[11px] text-on-surface-variant/70 mt-[2px]">' + sub + '</span></span>' +
      '    <span class="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform">expand_more</span>' +
      '  </summary>' +
      '  <div class="px-sm pb-sm pt-xs border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-sm">' + inner + '</div>' +
      '</details>';
  }

  function buildForm(mount, fixedMachine) {
    var machines = Object.keys(window.SIM_PROB_TABLES || {});
    var options = machines.map(function (m) {
      return '<option value="' + esc(m) + '"' + (m === fixedMachine ? ' selected' : '') + '>' + esc(m) + '</option>';
    }).join('');

    var machineField = fixedMachine
      ? '<input type="hidden" id="sim-machine" value="' + esc(fixedMachine) + '"/>'
      : '<div class="flex flex-col gap-xs">' +
        '  <label for="sim-machine" class="text-sm font-bold text-on-surface-variant">機種</label>' +
        '  <select id="sim-machine" class="h-12 rounded-xl bg-surface-container-lowest border border-white/15 px-sm text-white text-base focus:border-primary-container focus:outline-none">' +
        options + '</select>' +
        '</div>';

    mount.innerHTML = '' +
      '<div class="bg-surface-container border border-white/10 rounded-2xl p-md flex flex-col gap-md">' +
      machineField +
      '  <div class="grid grid-cols-1 sm:grid-cols-3 gap-sm">' +
      numField('sim-spins', '回したゲーム数', { step: 100, hint: '自分が回した分だけ' }) +
      numField('sim-big', 'BIG回数', { hint: '自分が引いた分' }) +
      numField('sim-reg', 'REG回数', { hint: '自分が引いた分' }) +
      '  </div>' +

      foldBlock('もっと正確に判定する', 'ぶどう・REGの内訳を入れると精度が上がります',
        numField('sim-budou', 'ぶどう回数', { step: 10 }) +
        numField('sim-regsolo', '単独REG回数', { hint: 'チェリーを引かずに当たったREG' }) +
        numField('sim-regcherry', 'チェリー重複REG回数', { hint: 'チェリーと同時に当たったREG' }) +
        '<div class="sm:col-span-2 text-[11px] text-on-surface-variant/70 leading-relaxed" id="sim-unknown-note"></div>'
      ) +

      foldBlock('途中から打ち始めた場合', '前の人が回した分（データカウンターの数字）を入れてください',
        numField('sim-prev-spins', '座る前のゲーム数', { step: 100 }) +
        numField('sim-prev-big', '座る前のBIG回数') +
        numField('sim-prev-reg', '座る前のREG回数') +
        '<div class="sm:col-span-2 text-[11px] text-on-surface-variant/70 leading-relaxed">' +
        'ぶどうと単独REGは自分で数えた分しか分からないため、この欄を入れても<strong class="text-on-surface">自分が回した分だけ</strong>を分母にして計算します。アプリ本体と同じ扱いです。</div>'
      ) +

      '  <div id="sim-warn" class="hidden text-sm rounded-xl border border-g5/40 bg-g5/10 text-g5 px-sm py-sm"></div>' +
      '  <button type="button" id="sim-reset" class="self-start text-xs text-on-surface-variant/60 hover:text-white underline transition">入力をクリア</button>' +
      '</div>' +

      '<div id="sim-result" class="mt-md"></div>';
  }

  function val(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var n = parseInt(el.value, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }

  function renderResult(container, r, machineName) {
    // 何も入力されていないときは案内だけ出す
    if (r.derived.currentGames === 0 && r.derived.bonuses === 0 && r.input.budou === 0) {
      container.innerHTML =
        '<div class="bg-surface-container-low border border-dashed border-white/15 rounded-2xl p-md text-center text-on-surface-variant">' +
        '<span class="material-symbols-outlined text-3xl text-on-surface-variant/40">calculate</span>' +
        '<p class="mt-xs text-sm">ゲーム数とBIG・REG回数を入れると、設定1〜6の可能性がその場で表示されます。</p></div>';
      return;
    }

    var insufficient = r.statusLevel === 0;
    var heroColor = insufficient ? '#4a4d55' : SETTING_COLORS[r.mostLikelySetting - 1];

    // ---- ヒーロー（アプリの設定分析画面と同じ表示規則）----
    var hero = '' +
      '<div class="rounded-2xl p-md border" style="border-color:' + heroColor + '4d; background:linear-gradient(135deg,' + heroColor + '26,' + heroColor + '0d)">' +
      '  <p class="text-xs font-bold text-on-surface-variant">' + (insufficient ? '最有力設定（参考値なし）' : '最有力設定') + '</p>' +
      '  <div class="flex items-end gap-sm mt-xs flex-wrap">' +
      '    <span class="font-head text-[34px] leading-none" style="color:' + heroColor + '">' +
      (insufficient ? '——' : '設定' + r.mostLikelySetting) + '</span>' +
      (insufficient ? '' : '<span class="font-mono-num text-lg text-on-surface-variant pb-[2px]">' + r.topProbability.toFixed(1) + '%</span>') +
      '  </div>' +
      '  <div class="flex flex-wrap gap-x-md gap-y-xs mt-sm text-sm text-on-surface-variant">' +
      '    <span>期待設定 <strong class="text-white font-mono-num">' + (r.hasData ? r.expectedSetting.toFixed(1) : '—') + '</strong></span>' +
      '    <span>期待機械割 <strong class="text-white font-mono-num">' + (r.expectedPayout != null ? r.expectedPayout.toFixed(1) + '%' : '—') + '</strong></span>' +
      '    <span>総ゲーム数 <strong class="text-white font-mono-num">' + r.derived.currentGames.toLocaleString() + 'G</strong></span>' +
      '  </div>' +
      '</div>';

    // ---- 信頼度の正直な表示 ----
    // 500G未満（データ不足）と、25%ゲートに届いていない場合とで文言を分ける。
    // 両方を同時に出すと重複して読みにくいため、データ不足のほうを優先する。
    var gate = '';
    if (r.hasData && insufficient) {
      gate = '<div class="mt-sm rounded-xl border border-g5/40 bg-g5/10 px-sm py-sm text-sm text-on-surface-variant">' +
        '<strong class="text-g5">まだ判定できる量ではありません。</strong>' +
        'この下に出ている実測確率やゲージは「いまの見た目」であって、設定の根拠にはなりません。' +
        '500ゲームに満たない段階の数字は偶然で大きく振れるため、最有力設定は表示していません。</div>';
    } else if (r.hasData && r.badgeSetting === null) {
      gate = '<div class="mt-sm rounded-xl border border-white/15 bg-surface-container-low px-sm py-sm text-sm text-on-surface-variant">' +
        '<strong class="text-white">まだ設定を絞り込める段階ではありません。</strong>' +
        '最有力設定の確率が25%（6等分の16.7%に対して意味のある偏り）に届いていないため、アプリでは「設定不明」と表示される状態です。</div>';
    }

    // ---- 推奨アクション（アプリの文言と同一）----
    var recMsg, recSub, recNote = '', recColor;
    if (r.statusLevel === 0) {
      recMsg = 'データ不足';
      recSub = 'あと ' + (500 - r.derived.currentGames) + ' G 以上の観測を推奨します';
      recColor = '#f87171';
    } else if (r.statusLevel === 1) {
      recMsg = '観測継続を推奨';
      recSub = 'あと ' + (3000 - r.derived.currentGames) + ' G 程度の観測で精度が上がります';
      recNote = '※ 単独REGは出現自体が少ないため、G数が増えるほど分析が安定します';
      recColor = '#facc15';
    } else {
      recMsg = '判断の目安になるデータ量です';
      recSub = '単独REG・ぶどうを数え続けるほど精度が上がります';
      recNote = '※ 設定判別は確率的な推測です。断定はできません';
      recColor = '#4ade80';
    }
    var rec = '' +
      '<div class="mt-sm rounded-xl bg-surface-container-low border border-white/10 px-sm py-sm">' +
      '  <p class="text-[11px] font-bold text-on-surface-variant/70 mb-xs">推奨アクション</p>' +
      '  <p class="font-bold" style="color:' + recColor + '">' + recMsg + '</p>' +
      '  <p class="text-sm text-on-surface-variant mt-[2px]">' + recSub + '</p>' +
      (recNote ? '<p class="text-[11px] text-on-surface-variant/60 mt-xs">' + recNote + '</p>' : '') +
      '</div>';

    // ---- 設定1〜6のバー（アプリと同じく最大値との比で描画）----
    var maxProb = Math.max.apply(null, r.probs);
    var bars = r.probs.map(function (p, i) {
      var ratio = maxProb > 0 ? p / maxProb : 0;
      ratio = Math.max(0.02, Math.min(1, ratio));
      return '' +
        '<div class="flex items-center gap-sm">' +
        '  <span class="w-12 shrink-0 text-xs font-bold" style="color:' + SETTING_COLORS[i] + '">設定' + (i + 1) + '</span>' +
        '  <div class="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">' +
        '    <div class="h-full rounded-full" style="width:' + (ratio * 100) + '%;background:' + SETTING_COLORS[i] + '"></div>' +
        '  </div>' +
        '  <span class="w-14 shrink-0 text-right text-xs font-mono-num text-on-surface-variant">' + p.toFixed(1) + '%</span>' +
        '</div>';
    }).join('');

    // ---- 実測確率とゲージ ----
    // 狭い画面でも収まるよう「見出し行」と「ゲージ行」の2段構成にする
    // （1行に詰めると390px幅で右端のラベルがはみ出す）
    function gaugeRow(label, denom, pos, closest, missing) {
      var head = '<span class="font-bold text-on-surface-variant">' + label + '</span>';
      if (missing) {
        return '<div class="flex items-center justify-between gap-sm text-sm">' + head +
          '<span class="text-on-surface-variant/50 text-xs">調査中（解析値の公開待ち）</span></div>';
      }
      if (denom == null) {
        return '<div class="flex items-center justify-between gap-sm text-sm">' + head +
          '<span class="text-on-surface-variant/50 text-xs">未入力</span></div>';
      }
      return '' +
        '<div class="flex flex-col gap-xs">' +
        '  <div class="flex items-baseline justify-between gap-sm text-sm">' + head +
        '    <span class="flex items-baseline gap-sm">' +
        '      <span class="font-mono-num text-white">' + denomText(denom) + '</span>' +
        (closest ? '<span class="text-[11px] text-on-surface-variant/70 whitespace-nowrap">設定' + closest + '近</span>' : '') +
        '    </span>' +
        '  </div>' +
        '  <div class="relative h-[10px] w-full">' +
        '    <div class="gauge-track absolute inset-0"></div>' +
        '    <div class="absolute top-[-3px] w-[3px] h-[16px] bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.9)]" style="left:' + (pos * 100).toFixed(1) + '%"></div>' +
        '  </div>' +
        '</div>';
    }

    var hasRegSoloTable = !!window.GogoSim.denomTable('regSolo', machineName);
    var hasBudouTable = !!window.GogoSim.denomTable('budou', machineName);

    var indicators = '' +
      '<div class="mt-sm rounded-xl bg-surface-container-low border border-white/10 px-sm py-sm flex flex-col gap-sm">' +
      '  <p class="text-[11px] font-bold text-on-surface-variant/70">判別指標（実測値）</p>' +
      gaugeRow('合算', r.probGou, r.posGou, r.closestGou, false) +
      gaugeRow('BIG', r.probBig, r.posBig, null, false) +
      gaugeRow('REG', r.probReg, r.posReg, null, false) +
      gaugeRow('単独REG', r.probRegSolo, r.posRegSolo, r.closestRegSolo, !hasRegSoloTable) +
      gaugeRow('ぶどう', r.probBudou, r.posBudou, null, !hasBudouTable) +
      '</div>';

    // ---- 結果直後のCTA ----
    var ctaLead;
    if (r.input.budou === 0) {
      ctaLead = 'いまは合算ボーナスだけで計算しています。<strong class="text-white">ぶどうを数えると、判別の精度は大きく上がります。</strong>';
    } else if (r.statusLevel < 2) {
      ctaLead = 'この判定は、まだ回すほど変わります。<strong class="text-white">数え続けるほど、答えははっきりします。</strong>';
    } else {
      ctaLead = 'この数字は次のゲームで動きます。<strong class="text-white">動くたびに、ここへ入力し直しますか？</strong>';
    }
    var cta = '' +
      '<div class="mt-md rounded-2xl border border-neon-pink/40 bg-surface-container p-md text-center shadow-[0_0_30px_rgba(255,29,206,0.15)]">' +
      '  <p class="text-on-surface-variant text-sm mb-sm">' + ctaLead + '</p>' +
      '  <p class="font-head text-lg text-white mb-md">アプリなら、親指1本で押すだけ。<br class="sm:hidden">この画面が自動で更新され続けます。</p>' +
      '  <div class="flex flex-col sm:flex-row gap-sm items-center justify-center">' +
      '    <a href="' + STORE_PLAY + '" target="_blank" rel="noopener" class="bg-primary-container text-background font-bold px-md py-sm rounded-full neon-bloom-primary hover:bg-primary-fixed transition-all flex items-center justify-center gap-xs w-full sm:w-auto whitespace-nowrap">' +
      '      <span class="material-symbols-outlined">android</span>GOGOカウンターを無料DL</a>' +
      '    <a href="' + STORE_APPLE + '" target="_blank" rel="noopener" class="bg-cyan text-background font-bold px-md py-sm rounded-full neon-bloom-cyan hover:bg-[#5cf0ff] transition-all flex items-center justify-center gap-xs w-full sm:w-auto whitespace-nowrap">' +
      APPLE_SVG + 'App Storeで無料DL</a>' +
      '  </div>' +
      '  <p class="text-[11px] text-on-surface-variant/50 mt-sm">※18歳以上対象・広告なし・カウントと設定判別は無料</p>' +
      '</div>';

    var disclaimer = '' +
      '<p class="mt-sm text-[11px] text-on-surface-variant/60 leading-relaxed">' +
      '本ツールは公表スペックと解析値をもとにした統計的な推定です。設定や利益を保証するものではありません。' +
      '確率データ更新日：' + esc(window.SIM_DATA_VERSION || '—') + '（アプリ本体と同一の数値表・同一の計算式を使用）</p>';

    container.innerHTML =
      '<div class="bg-surface-container border-2 border-white/10 rounded-2xl p-md">' +
      hero + gate + rec +
      '<div class="mt-sm rounded-xl bg-surface-container-low border border-white/10 px-sm py-sm flex flex-col gap-xs">' +
      '<p class="text-[11px] font-bold text-on-surface-variant/70 mb-xs">設定別の可能性</p>' + bars + '</div>' +
      indicators + disclaimer +
      '</div>' + cta;
  }

  function recalc(mount) {
    var machineName = document.getElementById('sim-machine').value;
    var spins = val('sim-spins');
    var bigMine = val('sim-big');
    var regMine = val('sim-reg');
    var budou = val('sim-budou');
    var regSolo = val('sim-regsolo');
    var regCherry = val('sim-regcherry');
    var prevSpins = val('sim-prev-spins');
    var prevBig = val('sim-prev-big');
    var prevReg = val('sim-prev-reg');

    // 入力の不整合を先に伝える（アプリはこの場合その指標をスキップする）
    var warns = [];
    if (budou > spins && spins > 0) {
      warns.push('ぶどう回数が回したゲーム数を超えています。このままだとぶどうは判定に使われません。');
    }
    if (regSolo + regCherry > regMine) {
      warns.push('REGの内訳（単独＋チェリー重複）が、自分が引いたREG回数を超えています。');
    }
    if (spins === 0 && (budou > 0 || regSolo > 0)) {
      warns.push('回したゲーム数が未入力です。ぶどう・単独REGは判定に使われません。');
    }
    var warnEl = document.getElementById('sim-warn');
    if (warns.length) {
      warnEl.innerHTML = warns.map(function (w) { return '<div>' + w + '</div>'; }).join('');
      warnEl.classList.remove('hidden');
    } else {
      warnEl.classList.add('hidden');
    }

    var r = window.GogoSim.analyze({
      machineName: machineName,
      startGames: prevSpins,
      spins: spins,
      bigTotal: bigMine + prevBig,
      regTotal: regMine + prevReg,
      budou: budou,
      regSolo: regSolo,
      regCherry: regCherry
    });

    // 「不明REG」の内訳説明（なぜ内訳を数える価値があるかの説明にもなる）
    var note = document.getElementById('sim-unknown-note');
    if (note) {
      if (r.derived.regUnknown > 0 && (regSolo > 0 || regCherry > 0)) {
        note.innerHTML = '内訳を入れていない <strong class="text-on-surface">' + r.derived.regUnknown +
          '回</strong> のREGは「不明」として扱い、単独REGの判定への影響をその分だけ弱めます（アプリ本体と同じ計算です）。';
      } else if (regSolo === 0 && regCherry === 0) {
        note.innerHTML = 'REGの内訳（単独かチェリー重複か）を数えると、判別の精度が上がります。';
      } else {
        note.innerHTML = 'REGの内訳がすべて判明しています。単独REGの判定が最大限に効いた状態です。';
      }
    }

    renderResult(document.getElementById('sim-result'), r, machineName);
  }

  /**
   * 機種カード（ハブの一覧）に、アプリの機種選択ボタンと同じ色を当てる。
   * 色は sim-tables.js（アプリからの自動生成物）が持っているので、
   * HTML側に色を書かない＝アプリの色を変えても再生成だけで追従できる。
   */
  function paintMachineCards() {
    var colors = window.SIM_MACHINE_COLORS || {};
    var cards = document.querySelectorAll('[data-machine-card]');
    Array.prototype.forEach.call(cards, function (el) {
      var c = colors[el.getAttribute('data-machine-card')];
      if (!c) return;
      var g = c.gradient;
      el.style.background = 'linear-gradient(135deg,' + g[0] + ' 0%,' + g[1] + ' 60%,' + g[2] + ' 100%)';
      el.style.borderColor = c.border;
      el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.14)';
      // ホバー時だけ機種色で発光させる（常時光らせると一覧がうるさくなる）
      el.addEventListener('mouseenter', function () {
        el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.14), 0 0 18px ' + c.border;
      });
      el.addEventListener('mouseleave', function () {
        el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.14)';
      });
    });
  }

  function init() {
    paintMachineCards();

    var mount = document.getElementById('gogo-sim');
    if (!mount) return;
    if (!window.GogoSim || !window.SIM_PROB_TABLES) {
      mount.innerHTML = '<p class="text-g6">計算用データの読み込みに失敗しました。ページを再読み込みしてください。</p>';
      return;
    }

    var fixed = mount.getAttribute('data-machine') || null;
    if (fixed && !window.SIM_PROB_TABLES[fixed]) fixed = null;
    buildForm(mount, fixed);

    var run = function () { recalc(mount); };

    mount.addEventListener('input', function (e) {
      if (e.target.matches('.sim-input, #sim-machine')) run();
    });
    mount.addEventListener('change', function (e) {
      if (e.target.matches('#sim-machine')) run();
    });
    mount.addEventListener('click', function (e) {
      var btn = e.target.closest('.sim-step');
      if (btn) {
        var input = document.getElementById(btn.getAttribute('data-target'));
        var cur = parseInt(input.value, 10);
        if (isNaN(cur)) cur = 0;
        var next = cur + parseInt(btn.getAttribute('data-step'), 10);
        input.value = next < 0 ? 0 : next;
        run();
        return;
      }
      if (e.target.id === 'sim-reset') {
        Array.prototype.forEach.call(mount.querySelectorAll('.sim-input'), function (el) { el.value = ''; });
        run();
      }
    });

    run();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
