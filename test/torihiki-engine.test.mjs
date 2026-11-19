import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateToritekiThresholds,
  auditToritekiContract,
  generateToritekiComplianceMarkdown,
} from '../docs/core/torihiki-engine.mjs';

test('evaluateToritekiThresholds catches 300/100 employee-only coverage when capitals match plus statutory violations', () => {
  const mfgEmployeeOnly = evaluateToritekiThresholds({
    transactionCategory: 'manufacturing_or_logistics',
    buyerCapitalJpy: 10_000_000,
    supplierCapitalJpy: 10_000_000,
    buyerEmployees: 420,
    supplierEmployees: 85,
    paymentCycleDays: 90,
    paymentMethod: 'promissory_note',
    hasUnilateralPriceFreeze: true,
    unpaidMoldStorageMonths: 12,
  });
  assert.equal(mfgEmployeeOnly.capitalCovered, false);
  assert.equal(mfgEmployeeOnly.employeeRuleCovered, true);
  assert.equal(mfgEmployeeOnly.toritekiApplicable, true);
  assert.equal(mfgEmployeeOnly.paymentCycleOver60d, true);
  assert.equal(mfgEmployeeOnly.prohibitedBillOrFeeDeduction, true);
  assert.equal(mfgEmployeeOnly.priceFreezeViolation, true);
  assert.equal(mfgEmployeeOnly.unpaidMoldStorageViolation, true);

  const svcEmployeeOnly = evaluateToritekiThresholds({
    transactionCategory: 'service_or_content',
    buyerCapitalJpy: 10_000_000,
    supplierCapitalJpy: 10_000_000,
    buyerEmployees: 150,
    supplierEmployees: 30,
  });
  assert.equal(svcEmployeeOnly.employeeThreshold, 100);
  assert.equal(svcEmployeeOnly.capitalCovered, false);
  assert.equal(svcEmployeeOnly.employeeRuleCovered, true);
  assert.equal(svcEmployeeOnly.toritekiApplicable, true);
});

test('auditToritekiContract flags violations and passes 100/100 on compliant Toriteki policy', () => {
  const bad = auditToritekiContract(
    '資本金1000万以下対象外とみなして口頭発注し、約束手形払いで価格据置・金型無償保管とする。',
    {
      buyerCapitalJpy: 10_000_000,
      supplierCapitalJpy: 10_000_000,
      buyerEmployees: 420,
      supplierEmployees: 85,
      paymentCycleDays: 90,
      paymentMethod: 'promissory_note',
      hasUnilateralPriceFreeze: true,
      unpaidMoldStorageMonths: 12,
    }
  );
  assert.equal(bad.status, 'fail');
  const badIds = new Set(bad.findings.map((f) => f.id));
  assert.ok(badIds.has('cycle_over_60d'));
  assert.ok(badIds.has('prohibited_bill_or_fee'));
  assert.ok(badIds.has('price_freeze'));
  assert.ok(badIds.has('unpaid_mold_custody'));

  const compliantText = [
    '直ちに4条書面（電磁的記録・委託内容明記・支払期日明記）を交付する。',
    '物品受領日から60日以内に全額現金振込（銀行振込）で決済する。',
    '約束手形廃止を徹底し振込手数料委託者負担（割引料転嫁なし）とする。',
    '労務費・原材料費高騰に伴う価格転嫁協議の申出に誠実に応じる。',
    '従業員数基準（300人/100人）で取適法対象取引を確認し特定運送委託も登録する。',
    '量産終了後の金型は保管料有償または型返却とし、5条書類を2年保存する。',
  ].join('\n');

  const good = auditToritekiContract(compliantText, {
    transactionCategory: 'manufacturing_or_logistics',
    buyerCapitalJpy: 10_000_000,
    supplierCapitalJpy: 10_000_000,
    buyerEmployees: 420,
    supplierEmployees: 85,
    paymentCycleDays: 45,
    paymentMethod: 'bank_transfer',
    hasUnilateralPriceFreeze: false,
    unpaidMoldStorageMonths: 0,
  });
  assert.equal(good.score, 100);
  assert.equal(good.status, 'pass');
  assert.equal(good.findings.length, 0);

  const md = generateToritekiComplianceMarkdown(good, {
    organizationName: 'テスト発注株式会社',
    supplierName: 'テスト受託有限会社',
  });
  assert.match(md, /ネットワーク通信: `0`回/);
  assert.match(md, /420人 -> 85人/);
});
