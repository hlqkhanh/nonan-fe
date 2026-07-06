import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Expense } from "../../types/sharebill.js";
import { calculateSettlements } from "./settlements.js";

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: "expense-1",
    groupId: "group-1",
    title: "Dinner",
    totalAmount: 90000,
    paidDate: "2026-07-03",
    payers: [{ memberId: "a", amount: 90000 }],
    participants: [
      { memberId: "a", amount: 30000, isCustom: false },
      { memberId: "b", amount: 30000, isCustom: false },
      { memberId: "c", amount: 30000, isCustom: false }
    ],
    splitMode: "equal",
    ...overrides
  };
}

describe("calculateSettlements", () => {
  it("creates settlements when one payer covers the bill", () => {
    assert.deepEqual(calculateSettlements([expense({})]), [
      { id: "b->a:30000", fromMemberId: "b", toMemberId: "a", amount: 30000, paid: false },
      { id: "c->a:30000", fromMemberId: "c", toMemberId: "a", amount: 30000, paid: false }
    ]);
  });

  it("supports multiple payers", () => {
    const settlements = calculateSettlements([
      expense({
        payers: [
          { memberId: "a", amount: 50000 },
          { memberId: "b", amount: 40000 }
        ]
      })
    ]);

    assert.deepEqual(settlements, [
      { id: "c->a:20000", fromMemberId: "c", toMemberId: "a", amount: 20000, paid: false },
      { id: "c->b:10000", fromMemberId: "c", toMemberId: "b", amount: 10000, paid: false }
    ]);
  });

  it("allows a payer outside participants", () => {
    const settlements = calculateSettlements([
      expense({
        payers: [{ memberId: "x", amount: 90000 }]
      })
    ]);

    assert.equal(settlements.length, 3);
    assert.equal(settlements.every((settlement) => settlement.toMemberId === "x"), true);
  });

  it("skips zero amount settlements", () => {
    assert.deepEqual(
      calculateSettlements([
        expense({
          totalAmount: 0,
          payers: [{ memberId: "a", amount: 0 }],
          participants: [{ memberId: "a", amount: 0, isCustom: false }]
        })
      ])
    , []);
  });

  it("marks paid settlements by id", () => {
    assert.equal(calculateSettlements([expense({})], new Set(["b->a:30000"]))[0].paid, true);
  });
});
