import type { Group } from "../../types/sharebill";

type GroupPickerProps = {
  groups: Group[];
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
};

export function GroupPicker({ groups, selectedGroupId, onSelectGroup }: GroupPickerProps) {
  return (
    <label className="flex items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.06] px-3 py-2">
      <span className="text-xs text-white/48">Nhóm</span>
      <select
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-mist outline-none"
        value={selectedGroupId}
        onChange={(event) => onSelectGroup(event.target.value)}
      >
        {groups.map((group) => (
          <option className="bg-ink text-mist" key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </label>
  );
}
