"use client";

import { useTransition } from "react";

import { updateUserRole } from "./actions";
import type { RoleRecord } from "./repository";

type UserRoleSelectProps = {
  userId: string;
  currentRoleKey: string | null;
  roles: RoleRecord[];
};

export function UserRoleSelect({ userId, currentRoleKey, roles }: UserRoleSelectProps) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentRoleKey ?? ""}
      disabled={pending}
      onChange={(event) => {
        const roleKey = event.target.value;
        startTransition(() => {
          void updateUserRole(userId, roleKey);
        });
      }}
    >
      <option value="" disabled>Sin rol</option>
      {roles.map((role) => (
        <option key={role.id} value={role.key}>{role.name}</option>
      ))}
    </select>
  );
}
