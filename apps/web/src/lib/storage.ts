import type { LocalGroup } from '@/types';

const AUTH_TOKEN_KEY = 'fi_auth_token_v1';
const GROUPS_KEY = 'fi_local_groups_v1';

const readGroupsRecord = () => {
  const raw = localStorage.getItem(GROUPS_KEY);
  if (!raw) return {} as Record<string, LocalGroup[]>;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, LocalGroup[]>)
      : {};
  } catch {
    return {} as Record<string, LocalGroup[]>;
  }
};

export const storage = {
  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  },
  getGroups(userId: string) {
    const record = readGroupsRecord();
    return Array.isArray(record[userId]) ? record[userId] : [];
  },
  setGroups(userId: string, groups: LocalGroup[]) {
    const record = readGroupsRecord();
    record[userId] = groups;
    localStorage.setItem(GROUPS_KEY, JSON.stringify(record));
  },
};
