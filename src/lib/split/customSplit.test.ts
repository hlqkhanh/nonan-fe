import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateCustomSplit } from "./customSplit.js";

const participants = [
  { id: "a", name: "Khanh" },
  { id: "b", name: "Kien" },
  { id: "c", name: "Thong" },
  { id: "d", name: "Nam" }
];

describe("calculateCustomSplit", () => {
  it("splits remaining amount with deterministic remainder", () => {
    assert.deepEqual(calculateCustomSplit({ totalAmount: 80000, participants, customAmounts: { a: 10000 } }), [
      { memberId: "a", amount: 10000, isCustom: true },
      { memberId: "b", amount: 23334, isCustom: false },
      { memberId: "c", amount: 23333, isCustom: false },
      { memberId: "d", amount: 23333, isCustom: false }
    ]);
  });

  it("supports multiple custom participants", () => {
    const shares = calculateCustomSplit({
      totalAmount: 100001,
      participants,
      customAmounts: { a: 20000, c: 30000 }
    });

    assert.deepEqual(shares, [
      { memberId: "a", amount: 20000, isCustom: true },
      { memberId: "b", amount: 25001, isCustom: false },
      { memberId: "c", amount: 30000, isCustom: true },
      { memberId: "d", amount: 25000, isCustom: false }
    ]);
  });

  it("allows all custom amounts when they equal total", () => {
    const shares = calculateCustomSplit({
      totalAmount: 10,
      participants: participants.slice(0, 2),
      customAmounts: { a: 4, b: 6 }
    });

    assert.equal(shares.reduce((sum, share) => sum + share.amount, 0), 10);
  });

  it("rejects custom amounts greater than total", () => {
    assert.throws(() =>
      calculateCustomSplit({ totalAmount: 100, participants: participants.slice(0, 2), customAmounts: { a: 101 } })
      , /exceed/);
  });

  it("rejects empty participants", () => {
    assert.throws(() => calculateCustomSplit({ totalAmount: 100, participants: [], customAmounts: {} }), /participant/);
  });

  it("rejects negative custom amounts", () => {
    assert.throws(() =>
      calculateCustomSplit({ totalAmount: 100, participants: participants.slice(0, 2), customAmounts: { a: -1 } })
      , /negative/);
  });

  it("always returns the exact total", () => {
    const shares = calculateCustomSplit({ totalAmount: 7, participants: participants.slice(0, 3), customAmounts: {} });
    assert.equal(shares.reduce((sum, share) => sum + share.amount, 0), 7);
  });
});
