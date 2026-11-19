/**
 * TORIHIKIGATE（取適門）Core Engine
 * 2026年 中小受託取引適正化法（取適法 / 改正下請法）
 *  - 資本金基準に加え 従業員数基準（製造/特定運送 300人超→300人以下・役務/情報 100人超→100人以下）
 *  - 約束手形払い禁止 ＆ 電子記録債権割引料・ファクタリング手数料等の受注者負担禁止
 *  - 60日以内全額現金決済 / 労務費・エネルギー・原材料高騰への価格転嫁協議義務 / 金型無償保管禁止
 * ブラウザローカル監査エンジン（外部通信ゼロ）
 */

const PROHIBITED_METHODS = new Set([
  'promissory_note',
  'tegata',
  'discounted_emc',
  'factoring_supplier_fee',
]);

const PILLARS = [
  {
    id: 'immediate_digital_or_written_order',
    title: '直ちに行う4条書面／電磁的記録交付（委託内容・対価・支払期日明記）',
    criterion: '取適法第4条（旧下請法第3条書面・電磁的記録交付義務）',
    weight: 14,
    severity: 'HIGH',
    pattern: /(?:3条書面|4条書面|発注書交付|電磁的記録|支払期日明記|委託内容明記|書面交付)/i,
    antiPattern: /(?:口頭発注|書面交付省略|発注後事後確定)/i,
    detail: '発注直後に給付内容・代金額・支払期日・検査基準等を明示した書面又は電磁的記録を交付する運用条項が不足しています。',
    remediation: '業務委託・製造・運送委託の発注時、直ちに4条法定記載事項を含む発注書または電子契約データを交付してください。',
  },
  {
    id: 'sixty_day_cash_full_payment',
    title: '受領日等から起算した60日以内の期日設定・全額現金決済',
    criterion: '取適法（60日以内支払期日・全額現金決済原則）',
    weight: 14,
    severity: 'HIGH',
    pattern: /(?:60日以内|現金振込|口座振込|全額現金|支払期日厳守)/i,
    antiPattern: /(?:60日超|90日払い|120日サイト|翌々月末超)/i,
    detail: '物品等の受領日から起算して60日以内のできる限り短い期間内で現金全額を支払う規定が見当たりません。',
    remediation: '検収完了日基準ではなく「受領日から60日以内」で確実に入金される締日・銀行振込サイトへ改定してください。',
  },
  {
    id: 'promissory_note_abolition_no_fee',
    title: '約束手形廃止 ＆ 割引料・振込手数料等の中小受託事業者転嫁禁止',
    criterion: '2026年取適法（手形交付禁止・電子記録債権等手数料転嫁禁止）',
    weight: 14,
    severity: 'HIGH',
    pattern: /(?:約束手形廃止|手形不使用|振込手数料委託者負担|割引料転嫁なし|一括決済手数料負担)/i,
    antiPattern: /(?:約束手形(?!廃止|不使用|撤廃|禁止)|手形交付|割引料受注者負担|振込手数料差し引き)/i,
    detail: '約束手形による支払の禁止および一括決済方式・電債の割引料や銀行振込手数料を委託者側負担とする条項が欠けています。',
    remediation: '手形サイト払いを廃止して全額現金振込へ切り替え、振込手数料や一括決済手数料の控除を完全に撤廃してください。',
  },
  {
    id: 'mandatory_cost_pass_through_talk',
    title: '労務費・原材料・エネルギーコスト上昇時の誠実な価格転嫁協議義務',
    criterion: '取適法（一方的代金決定・価格交渉無視の禁止）',
    weight: 13,
    severity: 'HIGH',
    pattern: /(?:価格転嫁協議|協議義務|労務費|原材料費高騰|価格交渉申出|協議に応じる)/i,
    antiPattern: /(?:価格据置|交渉拒否|一方的値引|値上げ不可)/i,
    detail: '中小受託事業者からの価格転嫁協議申出に対して十分な協議を行わずに代金を据え置く行為を禁じる規定がありません。',
    remediation: '労務費・原材料費の変動を反映した定期的・申出ベースの価格改定協議条項と議事録保存を組み込んでください。',
  },
  {
    id: 'employee_300_100_scope_screening',
    title: '資本金＋従業員数（製造運送300人 / 役務情報100人）二重適用判定',
    criterion: '2026年取適法 従業員数基準（資本金1,000万円対策の是正）',
    weight: 12,
    severity: 'HIGH',
    pattern: /(?:従業員数基準|300人|100人|取適法|中小受託事業者|資本金・従業員確認)/i,
    antiPattern: /(?:資本金1000万以下対象外|従業員基準無視|減資で適用回避)/i,
    detail: '資本金1,000万円同士など資本金区分だけで対象外扱いせず、従業員数300人/100人基準で適用取引を網羅する管理手順が未整備です。',
    remediation: '新規取引開始・年次更新時に資本金と従業員数（300人超／100人超）の双方を取得し自動フラグ管理してください。',
  },
  {
    id: 'specific_logistics_consignment_scope',
    title: '発荷主が運送事業者へ直接委託する『特定運送委託』の対象組み込み',
    criterion: '2026年取適法 特定運送委託の追加適用',
    weight: 11,
    severity: 'MEDIUM',
    pattern: /(?:特定運送委託|荷主委託運送|発荷主|運送委託契約)/i,
    antiPattern: /(?:運送委託対象外扱い|自家運送扱い偽装)/i,
    detail: 'メーカー・卸・EC事業者が顧客先や倉庫等へ物品を届けるため運送事業者へ直接委託する特定運送委託の管理が抜けています。',
    remediation: '外注物流・チャーター輸送契約も取適法対象取引として発注書交付・60日現金払・価格協議の対象台帳へ登録してください。',
  },
  {
    id: 'mold_tooling_custody_compensation',
    title: '金型・木型・治具等の長期無償保管強要の禁止 ＆ 保管費用・返却負担',
    criterion: '取適法・公取委運用基準（型無償保管・経済的利益提供強制禁止）',
    weight: 11,
    severity: 'MEDIUM',
    pattern: /(?:金型|木型|治具|保管料有償|型返却|量産終了後有償保管)/i,
    antiPattern: /(?:金型無償保管|金型永久無料預かり|無償長期保管)/i,
    detail: '量産終了後も長期にわたって受託事業者へ金型や治具を無償保管させる商慣行を禁止する規定が確認できません。',
    remediation: '量産終了時の金型返却・廃棄合意または有償保管契約を明確化し、無償保管コストを押し付けないよう見直してください。',
  },
  {
    id: 'two_year_transaction_ledger_retention',
    title: '法定取引記録（旧5条書類・価格交渉経緯・支払明細）の2年間保存',
    criterion: '取適法第7条（旧下請法第5条 書類作成・2年保存義務）',
    weight: 11,
    severity: 'MEDIUM',
    pattern: /(?:2年保存|5条書類|取引記録保存|取引台帳|法定帳簿)/i,
    antiPattern: /(?:書類未作成|保存なし|記録破棄)/i,
    detail: '給付内容・受領日・支払金額・手形等不使用の証憑や協議記録をまとめた法定書類の2年保存運用が明記されていません。',
    remediation: '取引毎の受領日・支払日・支払方法・減額有無を記した取引記録台帳を電帳法対応ストレージで2年以上保管してください。',
  },
];

export function evaluateToritekiThresholds({
  transactionCategory = 'manufacturing_or_logistics',
  buyerCapitalJpy = 0,
  supplierCapitalJpy = 0,
  buyerEmployees = 0,
  supplierEmployees = 0,
  paymentCycleDays = 30,
  paymentMethod = 'bank_transfer',
  hasUnilateralPriceFreeze = false,
  unpaidMoldStorageMonths = 0,
} = {}) {
  const rawCat = String(transactionCategory || 'manufacturing_or_logistics').trim().toLowerCase();
  const category = ['service_or_content', 'service', 'information_and_service', 'it_software'].includes(rawCat)
    ? 'service_or_content'
    : 'manufacturing_or_logistics';

  const bCap = Math.max(0, Number(buyerCapitalJpy) || 0);
  const sCap = Math.max(0, Number(supplierCapitalJpy) || 0);
  const bEmp = Math.max(0, Math.trunc(Number(buyerEmployees) || 0));
  const sEmp = Math.max(0, Math.trunc(Number(supplierEmployees) || 0));
  const cycle = Math.max(0, Math.trunc(Number(paymentCycleDays) || 0));
  const method = String(paymentMethod || 'bank_transfer').trim().toLowerCase();
  const moldM = Math.max(0, Math.trunc(Number(unpaidMoldStorageMonths) || 0));

  let capitalCovered = false;
  let employeeThreshold = 300;
  let employeeRuleCovered = false;

  if (category === 'service_or_content') {
    capitalCovered = Boolean(
      (bCap > 50_000_000 && sCap > 0 && sCap <= 50_000_000) ||
      (bCap > 10_000_000 && sCap > 0 && sCap <= 10_000_000)
    );
    employeeThreshold = 100;
    employeeRuleCovered = Boolean(bEmp > 100 && sEmp > 0 && sEmp <= 100);
  } else {
    capitalCovered = Boolean(
      (bCap > 300_000_000 && sCap > 0 && sCap <= 300_000_000) ||
      (bCap > 10_000_000 && sCap > 0 && sCap <= 10_000_000)
    );
    employeeThreshold = 300;
    employeeRuleCovered = Boolean(bEmp > 300 && sEmp > 0 && sEmp <= 300);
  }

  const toritekiApplicable = Boolean(capitalCovered || employeeRuleCovered);
  const paymentCycleOver60d = cycle > 60;
  const prohibitedBillOrFeeDeduction = PROHIBITED_METHODS.has(method);
  const priceFreezeViolation = Boolean(hasUnilateralPriceFreeze);
  const unpaidMoldStorageViolation = moldM >= 6;

  return {
    transactionCategory: category,
    buyerCapitalJpy: bCap,
    supplierCapitalJpy: sCap,
    buyerEmployees: bEmp,
    supplierEmployees: sEmp,
    employeeThreshold,
    capitalCovered,
    employeeRuleCovered,
    toritekiApplicable,
    paymentCycleDays: cycle,
    paymentMethod: method,
    paymentCycleOver60d,
    prohibitedBillOrFeeDeduction,
    priceFreezeViolation,
    unpaidMoldStorageMonths: moldM,
    unpaidMoldStorageViolation,
  };
}

export function auditToritekiContract(contractText = '', options = {}) {
  const normalized = String(contractText || '').replace(/\u3000/g, ' ').trim();
  const thresholds = evaluateToritekiThresholds(options);

  const findings = [];
  const passedPillars = [];
  let rawScore = 0;

  for (const pillar of PILLARS) {
    const matched = pillar.pattern.test(normalized);
    const negated = pillar.antiPattern.test(normalized);
    if (matched && !negated) {
      rawScore += pillar.weight;
      passedPillars.push({
        id: pillar.id,
        title: pillar.title,
        criterion: pillar.criterion,
        weight: pillar.weight,
      });
    } else {
      findings.push({
        id: pillar.id,
        title: pillar.title,
        criterion: pillar.criterion,
        severity: pillar.severity,
        detail: negated ? `NG商慣行パターン検出（${pillar.detail}）` : pillar.detail,
        remediation: pillar.remediation,
      });
    }
  }

  let penalty = 0;
  if (thresholds.paymentCycleOver60d) {
    penalty += 20;
    findings.push({
      id: 'cycle_over_60d',
      title: '支払期日が物品等受領日から60日を超過',
      criterion: `支払サイト ${thresholds.paymentCycleDays}日 > 60日上限`,
      severity: 'HIGH',
      detail: '物品等受領日から起算して60日以内に代金を支払う取適法の法定上限を超過しています。',
      remediation: '受領日から60日以内の支払サイトに契約条件を改定してください。',
    });
  }
  if (thresholds.prohibitedBillOrFeeDeduction) {
    penalty += 25;
    findings.push({
      id: 'prohibited_bill_or_fee',
      title: '約束手形払いまたは割引料・振込手数料の受注者負担は取適法違反',
      criterion: `禁止決済方式 (${thresholds.paymentMethod})`,
      severity: 'HIGH',
      detail: '2026年取適法により手形交付や割引料・手数料転嫁による代金目減りは厳禁となっています。',
      remediation: '期日現金振込または手数料委託者負担の銀行振込・電子記録債権へ切り替えてください。',
    });
  }
  if (thresholds.priceFreezeViolation) {
    penalty += 20;
    findings.push({
      id: 'price_freeze',
      title: 'コスト上昇時の価格交渉申出に対する一方的価格据置',
      criterion: '取適法 価格転嫁協議義務違反リスク',
      severity: 'HIGH',
      detail: '労務費や原材料高騰に伴う協議申出に対して実質的協議を行わず価格を据え置くことは違法とされます。',
      remediation: '協議プロセス・価格改定基準を設け、根拠資料をもとに誠実に交渉して合意記録を残してください。',
    });
  }
  if (thresholds.unpaidMoldStorageViolation) {
    penalty += 15;
    findings.push({
      id: 'unpaid_mold_custody',
      title: '量産終了後の金型・治具の6か月以上無償保管強制',
      criterion: `無償保管期間 ${thresholds.unpaidMoldStorageMonths}か月 >= 6か月`,
      severity: 'HIGH',
      detail: '長期間にわたり受託事業者へ無償保管を強いる行為は取適法上の不当な経済的利益の提供要請に該当します。',
      remediation: '速やかに金型を引き取るか有償保管契約を締結してください。',
    });
  }

  const score = Math.min(100, Math.max(0, rawScore - penalty));
  let readinessLabel = '公取委勧告・取適法違反リスクあり';
  let status = 'fail';
  if (score >= 88 && findings.every((f) => f.severity !== 'HIGH')) {
    readinessLabel = '2026年取適法（改正下請法）適合';
    status = 'pass';
  } else if (score >= 65) {
    readinessLabel = '一部補完推奨（書面・協議・型管理条項見直し）';
    status = 'warn';
  }

  return {
    score,
    status,
    readinessLabel,
    thresholds,
    passedPillars,
    findings,
    passedCount: passedPillars.length,
    totalPillars: PILLARS.length,
  };
}

export function generateToritekiComplianceMarkdown(auditResult, meta = {}) {
  const org = String(meta.organizationName || '貴社（未設定）').trim() || '貴社（未設定）';
  const counterparty = String(meta.supplierName || '委託先事業者（未設定）').trim() || '委託先事業者（未設定）';
  const today = new Date().toISOString().slice(0, 10);
  const t = auditResult.thresholds;

  const lines = [
    '# 2026年 取適法（改正下請法・従業員数300/100人基準・手形廃止）遵守監査証明書',
    '',
    `- **作成日**: ${today}`,
    `- **委託事業者名**: ${org}`,
    `- **中小受託事業者名**: ${counterparty}`,
    `- **法令適合スコア**: **${auditResult.readinessLabel}**（\`${auditResult.score}/100\` / 充足 \`${auditResult.passedCount}/${auditResult.totalPillars}\`）`,
    '',
    '## 1. 適用範囲・定量的禁止行為判定（資本金＋従業員数基準）',
    '',
    `- **取引区分**: \`${t.transactionCategory === 'service_or_content' ? '役務提供・情報成果物作成 (従業員100人基準)' : '製造委託・修理・特定運送委託 (従業員300人基準)'}\``,
    `- **取適法適用判定**: \`${t.toritekiApplicable ? '適用対象' : '対象外'}\`（資本金判定: \`${t.capitalCovered ? '該当' : '非該当'}\` / 従業員基準 (\`${t.buyerEmployees}人 -> ${t.supplierEmployees}人\`, 閾値\`${t.employeeThreshold}人\`): \`${t.employeeRuleCovered ? '該当' : '非該当'}\`）`,
    `- **支払期日（上限60日）**: \`${t.paymentCycleDays}日\` -> \`${t.paymentCycleOver60d ? '60日超過違反リスク' : '基準内'}\``,
    `- **支払方法（手形/手数料転嫁禁止）**: \`${t.paymentMethod}\` -> \`${t.prohibitedBillOrFeeDeduction ? '手形・控除禁止違反(NG)' : '現金・適法方式'}\``,
    `- **価格据置リスク**: \`${t.priceFreezeViolation ? '価格転嫁協議拒否・据置違反(NG)' : '問題なし'}\``,
    `- **金型無償保管（6か月以上注意）**: \`${t.unpaidMoldStorageMonths}か月\` -> \`${t.unpaidMoldStorageViolation ? '無償保管超過違反(NG)' : '基準内'}\``,
    '',
    '## 2. 2026年取適法 8大遵守チェック項目',
    '',
    '| 法的チェック項目 | 判定 | 根拠 / 是正事項 |',
    '|---|---|---|',
  ];

  for (const p of auditResult.passedPillars) {
    lines.push(`| ${p.title} | 充足 | ${p.criterion} |`);
  }
  for (const f of auditResult.findings) {
    lines.push(`| ${f.title} | 要是正 (${f.severity}) | ${f.detail} ／ 是正案: ${f.remediation} |`);
  }

  lines.push(
    '',
    '---',
    '*本証明書は TORIHIKIGATE（取適門）により取引先従業員数・支払サイト・契約条項を社外サーバーへ一切送信せずブラウザローカルで生成されました（ネットワーク通信: `0`回）。*'
  );

  return lines.join('\n');
}
