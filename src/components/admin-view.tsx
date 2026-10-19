"use client";

import { useState } from "react";
import { api } from "@/api";
import type { Person } from "@/domain/types";
import { useEditor } from "@/components/shell";
import { AsyncView, Button, Field, Panel, Skeleton, controlClass } from "@/components/ui";
import { toast } from "@/lib/toast";
import { useLiveQuery } from "@/lib/use-live-query";

export function PeopleDirectory() {
  const state = useLiveQuery("people", () => api.people());
  const editor = useEditor();
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-80" />}>
      {(data) => <PeopleBody people={data.items} editor={editor} />}
    </AsyncView>
  );
}

function PeopleBody({ people, editor }: { people: Person[]; editor: boolean }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <h2 className="mb-1 font-semibold">人員</h2>
      <p className="mb-3 text-xs text-muted">目錄只有姓名與部門。負責人、廠務 PM 與副責都從這裡挑選。外部目錄同步的人員不能在這裡改。</p>
      {editor ? (
        <Panel className="mb-4 p-4">
          <h2 className="mb-3 font-semibold">新增人員</h2>
          <form
            className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void api.createPerson({
                name: String(form.get("name") ?? ""),
                department: String(form.get("department") ?? ""),
              }).then(() => {
                toast("已新增人員");
                event.currentTarget.reset();
              }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "新增失敗"));
            }}
          >
            <Field label="姓名"><input name="name" className={controlClass} required /></Field>
            <Field label="部門"><input name="department" className={controlClass} required /></Field>
            <div className="self-end"><Button type="submit">新增</Button></div>
          </form>
        </Panel>
      ) : (
        <p className="mb-4 text-sm text-muted">使用者只能閱讀人員目錄。</p>
      )}
      <Panel className="p-4">
        <ul className="divide-y divide-line">
          {people.map((person) => (
            <PersonRow key={person.id} person={person} editor={editor} onError={setError} />
          ))}
        </ul>
      </Panel>
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

function PersonRow({ person, editor, onError }: { person: Person; editor: boolean; onError: (message: string) => void }) {
  const [name, setName] = useState(person.name);
  const [department, setDepartment] = useState(person.department);
  const [active, setActive] = useState(person.active);
  const external = person.source !== "manual";
  const locked = !editor || external;
  return (
    <li className="grid gap-2 py-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <Field label="姓名">
        <input className={controlClass} value={name} disabled={locked} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="部門">
        <input className={controlClass} value={department} disabled={locked} onChange={(event) => setDepartment(event.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 pb-1 text-xs">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{external ? "外部目錄" : "手動"}</span>
        {!person.active ? <span className="text-rose-700">已停用</span> : null}
        {editor && !external ? (
          <>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              在職
            </label>
            <button
              type="button"
              className="text-accent"
              onClick={() => {
                void api.updatePerson(person.id, { name, department, active }).then(() => toast("人員已更新")).catch((caught: unknown) => {
                  onError(caught instanceof Error ? caught.message : "更新失敗");
                });
              }}
            >
              儲存
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}
