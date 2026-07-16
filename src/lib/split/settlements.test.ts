import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Expense } from "../../types/sharebill.js";
import { calculateSettlements } from "./settlements.js";

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: "expense-1",
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

  it("does not offset debts through a third party", () => {
    const settlements = calculateSettlements([
      expense({
        id: "expense-1",
        totalAmount: 20000,
        payers: [{ memberId: "b", amount: 20000 }],
        participants: [
          { memberId: "a", amount: 10000, isCustom: false },
          { memberId: "b", amount: 10000, isCustom: false }
        ]
      }),
      expense({
        id: "expense-2",
        totalAmount: 20000,
        payers: [{ memberId: "c", amount: 20000 }],
        participants: [
          { memberId: "b", amount: 10000, isCustom: false },
          { memberId: "c", amount: 10000, isCustom: false }
        ]
      })
    ]);

    assert.deepEqual(settlements, [
      { id: "a->b:10000", fromMemberId: "a", toMemberId: "b", amount: 10000, paid: false },
      { id: "b->c:10000", fromMemberId: "b", toMemberId: "c", amount: 10000, paid: false }
    ]);
  });

  it("nets bidirectional debts within a pair", () => {
    const settlements = calculateSettlements([
      expense({
        id: "expense-1",
        totalAmount: 100000,
        payers: [{ memberId: "a", amount: 100000 }],
        participants: [
          { memberId: "a", amount: 50000, isCustom: false },
          { memberId: "b", amount: 50000, isCustom: false }
        ]
      }),
      expense({
        id: "expense-2",
        totalAmount: 60000,
        payers: [{ memberId: "b", amount: 60000 }],
        participants: [
          { memberId: "a", amount: 30000, isCustom: false },
          { memberId: "b", amount: 30000, isCustom: false }
        ]
      })
    ]);

    assert.deepEqual(settlements, [{ id: "b->a:20000", fromMemberId: "b", toMemberId: "a", amount: 20000, paid: false }]);
  });

  it("cancels a fully offsetting pair", () => {
    const settlements = calculateSettlements([
      expense({
        id: "expense-1",
        totalAmount: 100000,
        payers: [{ memberId: "a", amount: 100000 }],
        participants: [
          { memberId: "a", amount: 50000, isCustom: false },
          { memberId: "b", amount: 50000, isCustom: false }
        ]
      }),
      expense({
        id: "expense-2",
        totalAmount: 100000,
        payers: [{ memberId: "b", amount: 100000 }],
        participants: [
          { memberId: "a", amount: 50000, isCustom: false },
          { memberId: "b", amount: 50000, isCustom: false }
        ]
      })
    ]);

    assert.deepEqual(settlements, []);
  });

  it("allocates proportionally with multiple debtors and creditors", () => {
    const settlements = calculateSettlements([
      expense({
        id: "expense-1",
        totalAmount: 20000,
        payers: [
          { memberId: "a", amount: 12000 },
          { memberId: "b", amount: 8000 }
        ],
        participants: [
          { memberId: "a", amount: 5000, isCustom: false },
          { memberId: "b", amount: 5000, isCustom: false },
          { memberId: "c", amount: 5000, isCustom: false },
          { memberId: "d", amount: 5000, isCustom: false }
        ]
      })
    ]);

    assert.deepEqual(settlements, [
      { id: "c->a:3500", fromMemberId: "c", toMemberId: "a", amount: 3500, paid: false },
      { id: "c->b:1500", fromMemberId: "c", toMemberId: "b", amount: 1500, paid: false },
      { id: "d->a:3500", fromMemberId: "d", toMemberId: "a", amount: 3500, paid: false },
      { id: "d->b:1500", fromMemberId: "d", toMemberId: "b", amount: 1500, paid: false }
    ]);
  });

  it("assigns the rounding remainder to the largest creditor", () => {
    const settlements = calculateSettlements([
      expense({
        id: "expense-1",
        totalAmount: 10000,
        payers: [
          { memberId: "a", amount: 5000 },
          { memberId: "b", amount: 5000 }
        ],
        participants: [
          { memberId: "c", amount: 7001, isCustom: false },
          { memberId: "d", amount: 2999, isCustom: false }
        ]
      })
    ]);

    assert.deepEqual(settlements, [
      { id: "c->a:3501", fromMemberId: "c", toMemberId: "a", amount: 3501, paid: false },
      { id: "c->b:3500", fromMemberId: "c", toMemberId: "b", amount: 3500, paid: false },
      { id: "d->a:1500", fromMemberId: "d", toMemberId: "a", amount: 1500, paid: false },
      { id: "d->b:1499", fromMemberId: "d", toMemberId: "b", amount: 1499, paid: false }
    ]);
    assert.equal(
      settlements.reduce((sum, settlement) => sum + settlement.amount, 0),
      10000
    );
  });
});
