import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";
import { createAccessControl } from "better-auth/plugins/access";

const pages = {
  ...defaultStatements,
  Dashboard: ["view"],
  Brands: ["create", "read", "update", "delete"],
  AIQueries: ["create", "read", "update", "delete", "run"],
  Reddit: ["create", "read", "update", "delete"],
  Analytics: ["view", "export"],
  Billing: ["view", "create", "update", "cancel"],
  ApiKeys: ["create", "read", "delete"],
  Users: ["create", "read", "update", "delete", "ban"],
  Settings: ["view", "update"],
  Support: ["create", "read", "update", "delete"],
  Announcements: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(pages);

// Super admin — platform owner, unrestricted access
export const superadmin = ac.newRole({
  Dashboard: ["view"],
  Brands: ["create", "read", "update", "delete"],
  AIQueries: ["create", "read", "update", "delete", "run"],
  Reddit: ["create", "read", "update", "delete"],
  Analytics: ["view", "export"],
  Billing: ["view", "create", "update", "cancel"],
  ApiKeys: ["create", "read", "delete"],
  Users: ["create", "read", "update", "delete", "ban"],
  Settings: ["view", "update"],
  Support: ["create", "read", "update", "delete"],
  Announcements: ["create", "read", "update", "delete"],
  ...adminAc.statements,
});

// Regular user — manages their own brands and queries
export const user = ac.newRole({
  Dashboard: ["view"],
  Brands: ["create", "read", "update", "delete"],
  AIQueries: ["create", "read", "update", "delete", "run"],
  Reddit: ["create", "read", "update", "delete"],
  Analytics: ["view", "export"],
  Billing: ["view", "create", "update", "cancel"],
  ApiKeys: ["create", "read", "delete"],
  Settings: ["view", "update"],
  Support: ["create", "read", "update", "delete"],
});

export const roles = {
  superadmin,
  user,
};
