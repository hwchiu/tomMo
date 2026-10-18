import type { Person } from "@/domain/types";

export interface PeopleQuery {
  includeInactive?: boolean;
}

/**
 * Read API for people. The manual implementation reads the app's people table.
 * A future LDAP, AD, or HR adapter can replace this without changing callers.
 * Writes (add, edit, deactivate) stay on the admin API and apply only to source=manual.
 */
export interface PeopleDirectory {
  listPeople(query?: PeopleQuery): Person[];
  searchPeople(text: string, query?: PeopleQuery): Person[];
  getPerson(id: string): Person | null;
}

export function manualDirectory(people: readonly Person[]): PeopleDirectory {
  const list = () => people;
  return {
    listPeople(query) {
      return list().filter((person) => query?.includeInactive || person.active);
    },
    searchPeople(text, query) {
      const needle = text.trim().toLowerCase();
      return this.listPeople(query).filter((person) => {
        if (!needle) return true;
        return person.name.toLowerCase().includes(needle) || person.department.toLowerCase().includes(needle);
      });
    },
    getPerson(id) {
      return list().find((person) => person.id === id) ?? null;
    },
  };
}
