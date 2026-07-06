import type { Expense, Group } from "../types/sharebill";

export const seedGroups: Group[] = [
  {
    id: "group-1",
    name: "Hoi Ban Tron",
    members: [
      { id: "khanh", name: "Khanh" },
      { id: "kien", name: "Kien" },
      { id: "thong", name: "Thong" },
      { id: "nam", name: "Nam" }
    ]
  }
];

export const seedExpenses: Expense[] = [
  {
    id: "expense-1",
    groupId: "group-1",
    title: "Lau toi thu sau",
    totalAmount: 320000,
    paidDate: "2026-07-03",
    imageUrl:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80",
    payers: [{ memberId: "khanh", amount: 320000 }],
    participants: [
      { memberId: "khanh", amount: 80000, isCustom: false },
      { memberId: "kien", amount: 80000, isCustom: false },
      { memberId: "thong", amount: 80000, isCustom: false },
      { memberId: "nam", amount: 80000, isCustom: false }
    ],
    splitMode: "equal"
  },
  {
    id: "expense-2",
    groupId: "group-1",
    title: "Cafe sau phim",
    totalAmount: 185000,
    paidDate: "2026-07-04",
    payers: [
      { memberId: "kien", amount: 100000 },
      { memberId: "thong", amount: 85000 }
    ],
    participants: [
      { memberId: "khanh", amount: 61667, isCustom: false },
      { memberId: "kien", amount: 61667, isCustom: false },
      { memberId: "thong", amount: 61666, isCustom: false }
    ],
    splitMode: "equal"
  }
];
