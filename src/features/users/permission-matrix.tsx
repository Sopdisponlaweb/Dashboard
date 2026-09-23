"use client";

import { useState, useTransition } from "react";

import { updateRolePermission } from "./actions";
import type { PermissionRecord, RoleRecord } from "./repository";

const PROTECTED_ROLE_KEY = "administrator";

type PermissionMatrixProps = {
  roles: RoleRecord[];
  permissions: PermissionRecord[];
  initialGranted: string[];
};

export function PermissionMatrix({ roles, permissions, initialGranted }: PermissionMatrixProps) {
  const [granted, setGranted] = useState(() => new Set(initialGranted));
  const [, startTransition] = useTransition();

  function toggle(role: RoleRecord, permission: PermissionRecord) {
    if (role.key === PROTECTED_ROLE_KEY) return;
    const key = `${role.id}:${permission.id}`;
    const nextGranted = !granted.has(key);

    setGranted((previous) => {
      const next = new Set(previous);
      if (nextGranted) next.add(key);
      else next.delete(key);
      return next;
    });

    startTransition(() => {
      void updateRolePermission(role.id, role.key, permission.id, nextGranted);
    });
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table compact-table permission-matrix">
        <thead>
          <tr>
            <th>Permiso</th>
            {roles.map((role) => <th key={role.id}>{role.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {permissions.map((permission) => (
            <tr key={permission.id}>
              <td><strong>{permission.name}</strong><small>{permission.description}</small></td>
              {roles.map((role) => {
                const key = `${role.id}:${permission.id}`;
                const isProtected = role.key === PROTECTED_ROLE_KEY;
                return (
                  <td key={role.id} className="permission-cell">
                    <input
                      type="checkbox"
                      checked={isProtected ? true : granted.has(key)}
                      disabled={isProtected}
                      onChange={() => toggle(role, permission)}
                      aria-label={`${permission.name} · ${role.name}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
