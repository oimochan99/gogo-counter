/* =========================================================================
 * GOGOカウンター Web版 設定判別エンジン
 *
 * アプリ本体（Flutter/Dart）の lib/providers/machine_data.dart にある
 * calcSettingLikelihood() をそのまま移植したもの。
 * 数値がアプリと1桁でもズレると信用問題になるため、下記のルールを厳守すること。
 *
 *  1. 二項係数 C(n,k) は省略する（設定間で共通のため正規化で消える）
 *  2. 各指標は「カウント>0」かつ「分母>=分子」かつ「その機種に解析値が収録済み」の
 *     ときだけ加算する。条件を満たさない指標は完全にスキップする（0回をペナルティにしない）
 *  3. 単位変換：合算 p=1/gou[i]、単独REG p=10/regSolo10[i]、ぶどう p=100/budou10[i]
 *     （budou10 はキー名が "10" だが実際は分母×100 で格納されている）
 *  4. 単独REGの重み regSoloWeight は、その項の対数尤度全体に掛ける
 *  5. 正規化は必ず maxL を引いてから exp する。clamp の下限 -60 も再現する
 *  6. 最有力設定は狭義比較（>）なので、同率なら設定番号が小さい方が勝つ
 *
 * 整合の検証は tool/selftest.html で行う（アプリが書き出した sim-golden.json と突き合わせ）。
 * テーブル（sim-tables.js）は自動生成物なので手で編集しないこと。
 * ========================================================================= */

(function (global) {
  'use strict';

  /** 機種テーブルが無い場合のフォールバック用汎用テーブル（マイジャグラーⅤ基準） */
  var GENERIC_TABLE = {
    budou:   { 1: 5.90, 2: 5.85, 3: 5.80, 4: 5.78, 5: 5.76, 6: 5.66 },
    cherry:  { 1: 38.10, 2: 38.10, 3: 36.82, 4: 35.62, 5: 35.62, 6: 35.62 },
    big:     { 1: 273,   2: 271,   3: 266,   4: 254,   5: 240,   6: 229 },
    reg:     { 1: 410,   2: 386,   3: 336,   4: 290,   5: 269,   6: 229 },
    regSolo: { 1: 662.5, 2: 601.7, 3: 489.1, 4: 413.3, 5: 395.8, 6: 330.3 },
    gou:     { 1: 164,   2: 159,   3: 149,   4: 135,   5: 127,   6: 115 }
  };

  function tables() {
    return global.SIM_PROB_TABLES || {};
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /** 二項分布の対数尤度（二項係数は省略） */
  function binomialLogL(k, n, p) {
    return k * Math.log(p) + (n - k) * Math.log(1 - p);
  }

  /**
   * 設定1〜6の確率分布を求める（アプリの calcSettingLikelihood と同一）
   * @returns {{probs:number[], hasData:boolean}} probs は%表記・合計100
   */
  function calcSettingLikelihood(o) {
    var mp = tables()[o.machineName] || null;
    var logL = [0, 0, 0, 0, 0, 0];
    var hasData = false;

    // 単独REG指標の寄与重み：内訳が判明しているREG回数 ÷ 総REG回数。
    // 不明REGが多いと単独REGの実回数が過小評価され低設定側に誤誘導されるため、
    // 判明率が低いほど尤度への寄与を減衰させる。
    var regKnown = o.regSoloCount + o.regCherryCount;
    var regTotal = regKnown + o.regUnknownCount;
    var regSoloWeight = regTotal > 0 ? regKnown / regTotal : 1.0;

    for (var i = 0; i < 6; i++) {
      var s = i + 1;
      var ll = 0.0;

      // 合算ボーナス（分母＝台の累計G。途中参加の不明ボーナスも分子に含む）
      if (o.bonuses > 0 && o.currentGames >= o.bonuses) {
        var gou = (mp && mp.gou) ? mp.gou[i] : GENERIC_TABLE.gou[s];
        ll += binomialLogL(o.bonuses, o.currentGames, 1 / gou);
        hasData = true;
      }
      // 単独REG（分母＝セッションG。自分で確認できた分のみ）
      if (o.regSoloCount > 0 &&
          o.sessionSpins >= o.regSoloCount &&
          mp && mp.regSolo10) {
        ll += regSoloWeight *
          binomialLogL(o.regSoloCount, o.sessionSpins, 10.0 / mp.regSolo10[i]);
        hasData = true;
      }
      // ぶどう（分母＝セッションG）
      if (o.budouCount > 0 &&
          o.sessionSpins >= o.budouCount &&
          mp && mp.budou10) {
        ll += binomialLogL(o.budouCount, o.sessionSpins, 100.0 / mp.budou10[i]);
        hasData = true;
      }
      logL[i] = ll;
    }

    if (!hasData) {
      var u = 100 / 6;
      return { probs: [u, u, u, u, u, u], hasData: false };
    }

    // 対数尤度を相対確率へ（オーバーフロー防止のため最大値を引いてから指数化）
    var maxL = Math.max.apply(null, logL);
    var scores = logL.map(function (l) {
      return Math.exp(clamp(l - maxL, -60.0, 0.0));
    });
    var total = scores.reduce(function (a, b) { return a + b; }, 0);
    var probs = scores.map(function (v) { return v / total * 100; });
    return { probs: probs, hasData: true };
  }

  /** 最有力設定（分布のモード）。同率なら設定番号が小さい方 */
  function mostLikelySetting(probs) {
    var best = 1, bestP = 0;
    for (var i = 0; i < 6; i++) {
      if (probs[i] > bestP) { bestP = probs[i]; best = i + 1; }
    }
    return best;
  }

  /** 最有力設定のトップ確率（%） */
  function topProbability(probs) {
    var bestP = 0;
    for (var i = 0; i < 6; i++) {
      if (probs[i] > bestP) bestP = probs[i];
    }
    return bestP;
  }

  /** 期待設定（1.0〜6.0の加重平均） */
  function expectedSetting(probs) {
    var es = 0;
    for (var i = 0; i < 6; i++) es += (i + 1) * probs[i] / 100.0;
    return es;
  }

  /**
   * バッジ用：信頼度ゲート付きの最有力設定。
   * トップ確率が25%未満、またはデータ無しなら null（＝「設定不明」）
   */
  function badgeSetting(likelihood) {
    if (!likelihood.hasData) return null;
    if (topProbability(likelihood.probs) < 25.0) return null;
    return mostLikelySetting(likelihood.probs);
  }

  /** 表示ステータス： 0=データ不足(<500G) / 1=観測継続(<3000G) / 2=判断の目安 */
  function statusLevel(currentGames) {
    if (currentGames < 500) return 0;
    if (currentGames < 3000) return 1;
    return 2;
  }

  /** 期待機械割（収録が無い機種は null） */
  function expectedPayout(probs, machineName) {
    var rates = (global.SIM_PAY_RATES || {})[machineName];
    if (!rates) return null;
    var ep = 0;
    for (var i = 0; i < 6; i++) ep += rates[i] * (probs[i] / 100.0);
    return ep;
  }

  /** 指標ごとの理論値テーブル（分母表記）を取り出す。未収録なら null */
  function denomTable(kind, machineName) {
    var mp = tables()[machineName];
    if (!mp) return null;
    if (kind === 'budou' && mp.budou10) {
      return mp.budou10.map(function (v) { return v / 100.0; });
    }
    if (kind === 'cherry' && mp.cherry10) {
      return mp.cherry10.map(function (v) { return v / 10.0; });
    }
    if (kind === 'regSolo' && mp.regSolo10) {
      return mp.regSolo10.map(function (v) { return v / 10.0; });
    }
    if (mp[kind]) {
      return mp[kind].map(function (v) { return v * 1.0; });
    }
    return null;
  }

  /** 実測分母から設定ゲージ位置 [0..1] を求める（汎用テーブル用） */
  function probToSettingPos(kind, denom) {
    if (denom == null || denom === 0 || !isFinite(denom)) return 0.5;
    var p = GENERIC_TABLE[kind];
    var x = 1 / denom, a = 1 / p[1], b = 1 / p[6];
    return clamp((x - a) / (b - a), 0.0, 1.0);
  }

  /** 実測分母から設定ゲージ位置 [0..1] を求める（機種別） */
  function probToSettingPosByMachine(kind, denom, machineName) {
    if (denom == null || denom === 0 || !isFinite(denom)) return 0.5;
    var mp = tables()[machineName];
    if (mp) {
      var t = denomTable(kind, machineName);
      if (t) {
        var d1 = t[0], d6 = t[5];
        // 全設定共通（設定差なし）はゼロ除算を避けて中央表示
        if (d1 === d6) return 0.5;
        var x = 1 / denom, a = 1 / d1, b = 1 / d6;
        return clamp((x - a) / (b - a), 0.0, 1.0);
      }
      // 機種テーブルはあるが該当項目が未収録（調査中）の場合は、
      // 他機種の値で誤誘導しないよう中央（ニュートラル）を返す
      return 0.5;
    }
    return probToSettingPos(kind, denom);
  }

  /** 最も近い設定番号（汎用テーブル） */
  function closestSetting(kind, denom) {
    if (denom == null || denom === 0 || !isFinite(denom)) return null;
    var p = GENERIC_TABLE[kind];
    var best = 1, bestD = Infinity;
    for (var s = 1; s <= 6; s++) {
      var d = Math.abs((1 / denom) - (1 / p[s]));
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  /** 最も近い設定番号（機種別）。未収録項目は null＝バッジを出さない */
  function closestSettingByMachine(kind, denom, machineName) {
    if (denom == null || denom === 0 || !isFinite(denom)) return null;
    var mp = tables()[machineName];
    var t = mp ? denomTable(kind, machineName) : null;
    if (!t) {
      // 機種テーブル自体が無い場合のみ汎用へフォールバック
      return !mp ? closestSetting(kind, denom) : null;
    }
    var best = 1, bestD = Infinity;
    for (var i = 0; i < 6; i++) {
      var d = Math.abs((1 / denom) - (1 / t[i]));
      if (d < bestD) { bestD = d; best = i + 1; }
    }
    return best;
  }

  /**
   * 画面が使う総合エントリポイント。
   * 入力から実測確率・ゲージ位置まで含めた結果一式を返す。
   *
   * @param {object} inp
   *   machineName / startGames / spins / bigTotal / regTotal / budou / regSolo / regCherry
   */
  function analyze(inp) {
    var startGames = inp.startGames || 0;
    var spins = inp.spins || 0;
    var bigTotal = inp.bigTotal || 0;
    var regTotal = inp.regTotal || 0;
    var budou = inp.budou || 0;
    var regSolo = inp.regSolo || 0;
    var regCherry = inp.regCherry || 0;

    var currentGames = startGames + spins;
    var sessionSpins = spins;
    var bonuses = bigTotal + regTotal;
    // REG内訳の残りは「不明REG」扱い（アプリの regUnknown と同じ）
    var regUnknown = clamp(regTotal - regSolo - regCherry, 0, regTotal);

    var like = calcSettingLikelihood({
      bonuses: bonuses,
      currentGames: currentGames,
      sessionSpins: sessionSpins,
      budouCount: budou,
      regSoloCount: regSolo,
      regCherryCount: regCherry,
      regUnknownCount: regUnknown,
      machineName: inp.machineName
    });

    // 実測確率（分母定義はアプリの counter_provider.dart と同一）
    var totalGames = currentGames;
    var probGou = bonuses > 0 ? totalGames / bonuses : null;
    var probBig = bigTotal > 0 ? totalGames / bigTotal : null;
    var probReg = regTotal > 0 ? totalGames / regTotal : null;
    var probRegSolo = (regSolo > 0 && sessionSpins > 0) ? sessionSpins / regSolo : null;
    var probBudou = budou > 0 ? sessionSpins / budou : null;

    return {
      input: {
        machineName: inp.machineName,
        startGames: startGames,
        spins: spins,
        bigTotal: bigTotal,
        regTotal: regTotal,
        budou: budou,
        regSolo: regSolo,
        regCherry: regCherry
      },
      derived: {
        currentGames: currentGames,
        sessionSpins: sessionSpins,
        bonuses: bonuses,
        regUnknown: regUnknown
      },
      probs: like.probs,
      hasData: like.hasData,
      mostLikelySetting: mostLikelySetting(like.probs),
      topProbability: topProbability(like.probs),
      expectedSetting: expectedSetting(like.probs),
      badgeSetting: badgeSetting(like),
      statusLevel: statusLevel(currentGames),
      expectedPayout: expectedPayout(like.probs, inp.machineName),
      probGou: probGou,
      probBig: probBig,
      probReg: probReg,
      probRegSolo: probRegSolo,
      probBudou: probBudou,
      posGou: probToSettingPosByMachine('gou', probGou, inp.machineName),
      posBig: probToSettingPosByMachine('big', probBig, inp.machineName),
      posReg: probToSettingPosByMachine('reg', probReg, inp.machineName),
      posRegSolo: probToSettingPosByMachine('regSolo', probRegSolo, inp.machineName),
      posBudou: probToSettingPosByMachine('budou', probBudou, inp.machineName),
      closestGou: closestSettingByMachine('gou', probGou, inp.machineName),
      closestRegSolo: closestSettingByMachine('regSolo', probRegSolo, inp.machineName)
    };
  }

  global.GogoSim = {
    analyze: analyze,
    calcSettingLikelihood: calcSettingLikelihood,
    mostLikelySetting: mostLikelySetting,
    topProbability: topProbability,
    expectedSetting: expectedSetting,
    badgeSetting: badgeSetting,
    statusLevel: statusLevel,
    expectedPayout: expectedPayout,
    probToSettingPosByMachine: probToSettingPosByMachine,
    closestSettingByMachine: closestSettingByMachine,
    denomTable: denomTable
  };
})(typeof window !== 'undefined' ? window : globalThis);
