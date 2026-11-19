import {
  auditToritekiContract,
  generateToritekiComplianceMarkdown,
} from './core/torihiki-engine.mjs';

const BAD_CONTRACT_SAMPLE = `・資本金1000万以下対象外とみなして口頭発注を行い、支払は90日払いの約束手形払い（振込手数料差し引き）とする。
・コスト変動にかかわらず価格据置とし、量産終了後も金型無償保管・書類未作成とする。`;

const GOOD_CONTRACT_SAMPLE = `・新規発注ごとに直ちに4条書面（電磁的記録を含む委託内容・支払期日明記）を交付する。
・資本金・従業員数確認（300人/100人基準）を実施し特定運送委託も含め中小受託事業者へ受領後60日以内に全額現金振込する。
・約束手形廃止（手形不使用）とし振込手数料委託者負担にて割引料転嫁なしとする。
・労務費・原材料費高騰の申出に対して価格転嫁協議（協議義務）を誠実に行い、金型保管料有償・型返却を定め5条書類を2年保存する。`;

const els = {
  org: document.getElementById('in-org'),
  supplier: document.getElementById('in-supplier'),
  cat: document.getElementById('in-cat'),
  bcap: document.getElementById('in-bcap'),
  scap: document.getElementById('in-scap'),
  bemp: document.getElementById('in-bemp'),
  semp: document.getElementById('in-semp'),
  cycle: document.getElementById('in-cycle'),
  method: document.getElementById('in-method'),
  mold: document.getElementById('in-mold'),
  freeze: document.getElementById('in-freeze'),
  contract: document.getElementById('in-contract'),
  badge: document.getElementById('status-badge'),
  mScore: document.getElementById('m-score'),
  mScope: document.getElementById('m-scope'),
  mPay: document.getElementById('m-pay'),
  findingsList: document.getElementById('findings-list'),
  mdOutput: document.getElementById('md-output'),
  btnBad: document.getElementById('btn-sample-bad'),
  btnGood: document.getElementById('btn-sample-good'),
  btnAudit: document.getElementById('btn-audit'),
  btnCopyMd: document.getElementById('btn-copy-md'),
  btnDownloadMd: document.getElementById('btn-download-md'),
};

let latestMarkdown = '';

function renderAudit() {
  const result = auditToritekiContract(els.contract.value, {
    transactionCategory: els.cat.value,
    buyerCapitalJpy: Number(els.bcap.value || 0),
    supplierCapitalJpy: Number(els.scap.value || 0),
    buyerEmployees: Number(els.bemp.value || 0),
    supplierEmployees: Number(els.semp.value || 0),
    paymentCycleDays: Number(els.cycle.value || 0),
    paymentMethod: els.method.value,
    hasUnilateralPriceFreeze: els.freeze.checked,
    unpaidMoldStorageMonths: Number(els.mold.value || 0),
  });

  const t = result.thresholds;
  els.mScore.textContent = `${result.score} / 100点`;
  els.mScope.textContent = t.toritekiApplicable
    ? t.employeeRuleCovered && !t.capitalCovered
      ? `適用 (従業員${t.employeeThreshold}人基準)`
      : '取適法 適用対象'
    : '適用対象外';
  els.mPay.textContent =
    t.paymentCycleOver60d || t.prohibitedBillOrFeeDeduction || t.priceFreezeViolation || t.unpaidMoldStorageViolation
      ? `違反 (${t.paymentCycleDays}日 / ${t.paymentMethod})`
      : `適法 (${t.paymentCycleDays}日 現金)`;

  els.badge.className = 'score-pill';
  if (result.status === 'pass') {
    els.badge.textContent = '2026年取適法 適合 (PASS)';
    els.badge.classList.add('status-ready');
  } else if (result.status === 'warn') {
    els.badge.textContent = '一部補完推奨 (WARN)';
    els.badge.classList.add('status-review');
  } else {
    els.badge.textContent = '要改善・公取委勧告リスク (FAIL)';
    els.badge.classList.add('status-high');
  }

  els.findingsList.innerHTML = '';
  if (result.findings.length === 0) {
    const ok = document.createElement('div');
    ok.setAttribute('data-ui', 'finding-card');
    ok.className = 'sev-ok';
    ok.textContent = '全8要件（4条書面・60日現金払・手形廃止/手数料負担・価格転嫁協議・300/100人基準・特定運送委託・金型有償管理・2年保存）と定量禁止基準を充足しています。';
    els.findingsList.appendChild(ok);
  } else {
    for (const f of result.findings) {
      const card = document.createElement('div');
      card.setAttribute('data-ui', 'finding-card');
      card.className = f.severity === 'HIGH' ? 'sev-high' : 'sev-medium';
      const head = document.createElement('div');
      head.style.fontWeight = '700';
      head.textContent = `[${f.id}] ${f.title} (${f.criterion})`;
      const desc = document.createElement('div');
      desc.textContent = `${f.detail} ／ 是正案: ${f.remediation}`;
      card.append(head, desc);
      els.findingsList.appendChild(card);
    }
  }

  latestMarkdown = generateToritekiComplianceMarkdown(result, {
    organizationName: els.org.value,
    supplierName: els.supplier.value,
  });
  els.mdOutput.textContent = latestMarkdown;
}

els.btnBad.addEventListener('click', () => {
  els.cat.value = 'manufacturing_or_logistics';
  els.bcap.value = '10000000';
  els.scap.value = '10000000';
  els.bemp.value = '420';
  els.semp.value = '85';
  els.cycle.value = '90';
  els.method.value = 'promissory_note';
  els.mold.value = '12';
  els.freeze.checked = true;
  els.contract.value = BAD_CONTRACT_SAMPLE;
  renderAudit();
});

els.btnGood.addEventListener('click', () => {
  els.cat.value = 'manufacturing_or_logistics';
  els.bcap.value = '10000000';
  els.scap.value = '10000000';
  els.bemp.value = '420';
  els.semp.value = '85';
  els.cycle.value = '45';
  els.method.value = 'bank_transfer';
  els.mold.value = '0';
  els.freeze.checked = false;
  els.contract.value = GOOD_CONTRACT_SAMPLE;
  renderAudit();
});

els.btnAudit.addEventListener('click', renderAudit);
els.btnCopyMd.addEventListener('click', async () => {
  await navigator.clipboard.writeText(latestMarkdown);
  els.btnCopyMd.textContent = 'コピー完了';
  setTimeout(() => {
    els.btnCopyMd.textContent = 'Markdownをコピー';
  }, 1500);
});
els.btnDownloadMd.addEventListener('click', () => {
  const blob = new Blob([latestMarkdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'torihikigate-compliance-certificate.md';
  a.click();
  URL.revokeObjectURL(url);
});

els.contract.value = BAD_CONTRACT_SAMPLE;
renderAudit();
