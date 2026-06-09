"use client";

import { useEffect, useState, useTransition } from "react";
import type { AldeaUser } from "@/lib/config";
import { SETUP, buildSections, formatDate, normalize, parseSheetDate, type Task, type TaskSection } from "@/lib/tasks";

type Props = {
  user: AldeaUser;
  sections: TaskSection[];
  owners: string[];
  allTasks: Task[];
  signalUrl: string;
};

type DraftTask = {
  task: string;
  owner: string;
  area: string;
  priority: string;
  status: string;
  dueDate: string;
  blocker: string;
  nextAction: string;
  link: string;
  notes: string;
};

const initialDraft: DraftTask = {
  task: "",
  owner: "",
  area: "",
  priority: "Medium",
  status: "To Do",
  dueDate: "",
  blocker: "",
  nextAction: "",
  link: "",
  notes: ""
};

const OWNER_FILTER_STORAGE_KEY = "aldea-owner-filter";

export default function TaskDashboard({ user, sections, owners, allTasks, signalUrl }: Props) {
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<DraftTask>>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => (
    Object.fromEntries(sections.map((section) => [section.id, section.tasks.length > 0]))
  ));
  const [adminListOpen, setAdminListOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [toast, setToast] = useState("");
  const [createError, setCreateError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DraftTask>({
    ...initialDraft,
    owner: user.owner
  });
  const displayedTasks = user.role === "admin" && ownerFilter !== "ALL"
    ? allTasks.filter((task) => task.owner === ownerFilter)
    : allTasks;
  const displayedSections = user.role === "admin" ? buildSections(displayedTasks) : sections;
  const totalOpen = displayedSections.reduce((sum, section) => sum + section.tasks.length, 0);
  const archiveCount = allTasks.filter((task) => normalize(task.status) === "done").length;

  useEffect(() => {
    const message = window.sessionStorage.getItem("aldea-toast");
    if (!message) return;

    window.sessionStorage.removeItem("aldea-toast");
    setToast(message);
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user.role !== "admin") return;

    const savedFilter = window.sessionStorage.getItem(OWNER_FILTER_STORAGE_KEY);
    if (!savedFilter) return;

    const isValidFilter = savedFilter === "ALL" || owners.includes(savedFilter);
    if (isValidFilter) {
      setOwnerFilter(savedFilter);
      return;
    }

    window.sessionStorage.removeItem(OWNER_FILTER_STORAGE_KEY);
  }, [owners, user.role]);

  useEffect(() => {
    if (user.role !== "admin") return;
    window.sessionStorage.setItem(OWNER_FILTER_STORAGE_KEY, ownerFilter);
  }, [ownerFilter, user.role]);

  function refresh(message?: string) {
    if (message) {
      window.sessionStorage.setItem("aldea-toast", message);
    }
    if (user.role === "admin") {
      window.sessionStorage.setItem(OWNER_FILTER_STORAGE_KEY, ownerFilter);
    }
    startTransition(() => {
      window.location.reload();
    });
  }

  async function patch(url: string, body?: unknown, message = "Task updated.") {
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      setPendingTaskId(null);
      throw new Error("Request failed");
    }
    refresh(message);
  }

  async function markDone(task: Task) {
    setPendingTaskId(task.taskId);
    await patch(`/api/tasks/${encodeURIComponent(task.taskId)}/done`, undefined, "Task marked done.");
  }

  async function updateStatus(task: Task, status: string) {
    setPendingTaskId(task.taskId);
    if (status === "Blocked") {
      setEditingTaskId(task.taskId);
      setEditDrafts((drafts) => ({
        ...drafts,
        [task.taskId]: { ...(drafts[task.taskId] || {}), status }
      }));
      setPendingTaskId(null);
      return;
    }
    await patch(`/api/tasks/${encodeURIComponent(task.taskId)}/status`, { status }, `Task moved to ${status}.`);
  }

  async function updateNotes(task: Task, notes: string) {
    setPendingTaskId(task.taskId);
    await patch(`/api/tasks/${encodeURIComponent(task.taskId)}/notes`, { notes }, "Notes saved.");
  }

  async function updateAdminTask(task: Task, body: Partial<DraftTask>, message = "Task updated.") {
    setPendingTaskId(task.taskId);
    const response = await fetch(`/api/admin/tasks/${encodeURIComponent(task.taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setPendingTaskId(null);
      return;
    }
    refresh(message);
  }

  function editValue(task: Task, field: keyof DraftTask) {
    const draftValue = editDrafts[task.taskId]?.[field];
    if (draftValue !== undefined) return draftValue;
    return String(task[field as keyof Task] || "");
  }

  function setEditValue(task: Task, field: keyof DraftTask, value: string) {
    setEditDrafts((drafts) => ({
      ...drafts,
      [task.taskId]: {
        ...(drafts[task.taskId] || {}),
        [field]: value
      }
    }));
  }

  async function saveTaskDetails(task: Task) {
    const taskDraft = editDrafts[task.taskId] || {};
    const blocker = String(taskDraft.blocker ?? task.blocker ?? "").trim();
    const nextAction = String(taskDraft.nextAction ?? task.nextAction ?? "").trim();
    const status = normalize(String(taskDraft.status ?? task.status ?? ""));

    if ((blocker || status === "blocked") && !nextAction) {
      alert("Please add a Next Action when a task has a Blocker.");
      return;
    }

    await updateAdminTask(task, taskDraft, "Task details saved.");
  }

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const response = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft
      })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setCreateError(body?.error || "Please add a task, owner, area, and due date.");
      return;
    }
    setDraft({
      ...initialDraft,
      owner: user.owner
    });
    refresh("Task created.");
  }

  async function deleteTask(task: Task) {
    const confirmed = window.confirm(
      `Delete "${task.task}"? This will permanently remove the task from the sheet.`
    );
    if (!confirmed) return;

    setPendingTaskId(task.taskId);
    const response = await fetch(`/api/admin/tasks/${encodeURIComponent(task.taskId)}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      setPendingTaskId(null);
      alert("Task delete failed.");
      return;
    }
    refresh("Task deleted.");
  }

  async function archiveDone() {
    if (!archiveCount) return;
    const response = await fetch("/api/admin/archive", { method: "POST" });
    if (!response.ok) {
      setPendingTaskId(null);
      alert("Archive Done could not complete. The tasks were not removed, so nothing was lost.");
      return;
    }
    refresh(`Archived ${archiveCount} done ${archiveCount === 1 ? "task" : "tasks"}.`);
  }

  function toggleEdit(task: Task) {
    if (editingTaskId === task.taskId) {
      setEditingTaskId(null);
      return;
    }

    setEditingTaskId(task.taskId);
    setEditDrafts((drafts) => ({
      ...drafts,
      [task.taskId]: {
        task: task.task,
        owner: task.owner,
        area: task.area,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        blocker: task.blocker,
        nextAction: task.nextAction,
        link: task.link,
        notes: task.notes
      }
    }));
  }

  function dateInputValue(value: string) {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const date = parseSheetDate(value);
    if (!date) return "";

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return (
    <main className="app-shell">
      {toast ? <div className="toast" role="status">{toast}</div> : null}

      <header className="topbar">
        <div>
          <img className="brand-logo" src="/aldea-logo.png" alt="ALDEA" />
          <h1>Task Manager | {user.owner}</h1>
          <p className="muted">
            {user.role === "admin" ? "Admin Access" : "Personal View"}
          </p>
        </div>
        <div className="topbar-actions">
          <a className="icon-link" href="/" aria-label="Workspace Home" title="Workspace Home">
            <AppGridIcon />
          </a>
          {user.apps.includes("signal") ? (
            <a className="icon-link" href={signalUrl} aria-label="Open Signal" title="Open Signal">
              <SignalIcon />
            </a>
          ) : null}
          <form action="/api/auth/logout" method="post">
            <button className="icon-link sign-out-button" type="submit" aria-label="Sign Out" title="Sign Out">
              <SignOutIcon />
            </button>
          </form>
        </div>
      </header>

      {user.role === "admin" ? (
        <section className="admin-filter-band" aria-label="Admin task filter">
          <label className="field owner-filter-field">
            <span>View Tasks For</span>
            <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              <option value="ALL">All</option>
              {owners.map((owner) => <option key={owner}>{owner}</option>)}
            </select>
          </label>
        </section>
      ) : null}

      <nav className="counter-bar" aria-label="Task sections">
        <div className="pending-box">
          <span>Total Tasks</span>
          <strong>{totalOpen}</strong>
        </div>
        {displayedSections.map((section) => (
          <a href={`#${section.id}`} key={section.id}>
            <span>{section.title}</span>
            <strong>{section.tasks.length}</strong>
          </a>
        ))}
      </nav>

      <section className="admin-band">
        {user.role === "admin" ? (
          <div className="admin-controls-header">
            <h2>Create New Task</h2>
            <button className="archive-button" type="button" onClick={archiveDone} disabled={!archiveCount || isPending}>
              <span>Archive Done</span>
              <strong>{archiveCount}</strong>
            </button>
          </div>
        ) : (
          <div className="admin-controls-header">
            <h2>Create New Task</h2>
          </div>
        )}
        <form className="create-task" onSubmit={createTask}>
          <label className="field field-task">
            <span>New Task</span>
            <input
              value={draft.task}
              onChange={(event) => setDraft({ ...draft, task: event.target.value })}
              placeholder="New Task"
              required
            />
          </label>
          <label className="field">
            <span>Owner</span>
            <select value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} required>
              <option value="">Owner</option>
              {owners.map((owner) => <option key={owner}>{owner}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Area</span>
            <select value={draft.area} onChange={(event) => setDraft({ ...draft, area: event.target.value })} required>
              <option value="">Area</option>
              {SETUP.areas.map((area) => <option key={area}>{area}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
              {SETUP.priorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Due Date</span>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
              required
            />
          </label>
          <label className="field field-next">
            <span>Next Action</span>
            <input
              value={draft.nextAction}
              onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })}
              placeholder="Next Action"
            />
          </label>
          <button className="primary-button" type="submit">Create</button>
          {createError ? <p className="create-task-error" role="alert">{createError}</p> : null}
        </form>
      </section>

      <section className="sections">
        {displayedSections.map((section) => (
          <section className="task-section" id={section.id} key={section.id}>
            <button
              className="section-heading toggle-heading"
              type="button"
              onClick={() => setOpenSections((open) => ({ ...open, [section.id]: !open[section.id] }))}
            >
              <span className={`toggle-caret ${openSections[section.id] ? "is-open" : ""}`} aria-hidden="true" />
              <span className="section-title-group">
                <h2>{titleCase(section.title)}</h2>
                <strong>{section.tasks.length}</strong>
              </span>
            </button>
            {openSections[section.id] && section.tasks.length ? (
              <div className="task-list">
                {section.tasks.map((task) => {
                  const canEdit =
                    user.role === "admin" ||
                    normalize(task.owner) === normalize(user.owner);
                  const isEditing = canEdit && editingTaskId === task.taskId;
                  const priorityValue = isEditing ? editValue(task, "priority") : task.priority;
                  const statusValue = isEditing ? editValue(task, "status") : task.status;
                  const blockerValue = isEditing ? editValue(task, "blocker") : task.blocker;

                  return (
                  <article className={`task-card ${isEditing ? "is-editing" : ""}`} key={task.taskId}>
                    <div className="task-main">
                      <div className="task-title-row">
                        <div className="date-priority">
                          {isEditing ? (
                            <label className="inline-field date-edit">
                              <span>Due Date</span>
                              <input
                                type="date"
                                value={dateInputValue(editValue(task, "dueDate"))}
                                onChange={(event) => setEditValue(task, "dueDate", event.target.value)}
                              />
                            </label>
                          ) : (
                            <p className="task-date">{formatDate(task.dueDate) || "No Due Date"}</p>
                          )}
                          {isEditing ? (
                            <label className="inline-field priority-edit">
                              <span>Priority</span>
                              <select value={priorityValue} onChange={(event) => setEditValue(task, "priority", event.target.value)}>
                                {SETUP.priorities.map((priority) => <option key={priority}>{priority}</option>)}
                              </select>
                            </label>
                          ) : (
                            <span className={`priority-pill priority-${normalize(priorityValue)}`}>{priorityValue || "No Priority"}</span>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <label className="inline-field task-name-edit">
                          <span>Task</span>
                          <textarea
                            value={editValue(task, "task")}
                            onChange={(event) => setEditValue(task, "task", event.target.value)}
                            rows={2}
                          />
                        </label>
                      ) : (
                        <h3>{task.task}</h3>
                      )}
                      <div className="task-meta">
                        {user.role === "admin" ? (
                          isEditing ? (
                            <label className="inline-field chip-edit">
                              <span>Owner</span>
                              <select value={editValue(task, "owner")} onChange={(event) => setEditValue(task, "owner", event.target.value)}>
                                {owners.map((owner) => <option key={owner}>{owner}</option>)}
                              </select>
                            </label>
                          ) : <span>{task.owner}</span>
                        ) : null}
                        {isEditing ? (
                          <label className="inline-field chip-edit">
                            <span>Area</span>
                            <select value={editValue(task, "area")} onChange={(event) => setEditValue(task, "area", event.target.value)}>
                              <option value="">Area</option>
                              {SETUP.areas.map((area) => <option key={area}>{area}</option>)}
                            </select>
                          </label>
                        ) : <span>{task.area || "No Area"}</span>}
                      </div>
                      {isEditing ? (
                        <div className="inline-edit-grid">
                          <label className="inline-field">
                            <span>Blocker</span>
                            <input value={blockerValue} onChange={(event) => setEditValue(task, "blocker", event.target.value)} />
                          </label>
                          <label className="inline-field">
                            <span>Link</span>
                            <input value={editValue(task, "link")} onChange={(event) => setEditValue(task, "link", event.target.value)} />
                          </label>
                        </div>
                      ) : blockerValue ? <p className="blocker">Blocked: {blockerValue}</p> : null}
                      {isEditing ? (
                        <label className="inline-field next-action-edit">
                          <span>Next Action</span>
                          <input value={editValue(task, "nextAction")} onChange={(event) => setEditValue(task, "nextAction", event.target.value)} />
                        </label>
                      ) : task.nextAction ? (
                        <div className="task-note-line">
                          <span>Next</span>
                          <p>{task.nextAction}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="task-actions">
                      {isEditing ? (
                        <button className="primary-button compact save-action" type="button" onClick={() => saveTaskDetails(task)}>
                          Save Details
                        </button>
                      ) : canEdit ? (
                        <button className="secondary-action" type="button" onClick={() => toggleEdit(task)}>
                          Edit Task
                        </button>
                      ) : null}
                      {isEditing ? (
                        <button className="secondary-action cancel-action" type="button" onClick={() => toggleEdit(task)}>
                          Cancel Edit
                        </button>
                      ) : null}
                      {isEditing ? (
                        <div className="status-picker">
                          <select
                            className="status-select"
                            value={statusValue}
                            onChange={(event) => setEditValue(task, "status", event.target.value)}
                            disabled={pendingTaskId === task.taskId || isPending}
                          >
                            {SETUP.statuses.filter((status) => status !== "Done").map((status) => <option key={status}>{status}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="status-picker">
                          <select
                            className="status-select"
                            defaultValue={task.status}
                            onChange={(event) => updateStatus(task, event.target.value)}
                            disabled={pendingTaskId === task.taskId || isPending}
                          >
                            {SETUP.statuses.filter((status) => status !== "Done").map((status) => <option key={status}>{status}</option>)}
                          </select>
                        </div>
                      )}
                      {task.link ? (
                        <a className="icon-link" href={task.link} target="_blank" rel="noreferrer">Open Link</a>
                      ) : null}
                      <button
                        className="primary-button compact"
                        type="button"
                        onClick={() => markDone(task)}
                        disabled={pendingTaskId === task.taskId || isPending}
                      >
                          Mark Done
                      </button>
                      {isEditing ? (
                        <button
                          className="secondary-action danger"
                          type="button"
                          onClick={() => deleteTask(task)}
                          disabled={pendingTaskId === task.taskId || isPending}
                        >
                          Delete Task
                        </button>
                      ) : null}
                    </div>
                    {!isEditing && task.notes ? (
                      <div className="note-preview">
                        <span>Notes</span>
                        <p>{task.notes}</p>
                      </div>
                    ) : null}
                    <label className={`notes-field ${user.role === "admin" && !isEditing ? "notes-field-hidden" : ""}`}>
                      <span>Notes</span>
                      <textarea
                        value={isEditing ? editValue(task, "notes") : undefined}
                        defaultValue={isEditing ? undefined : task.notes}
                        onChange={isEditing ? (event) => setEditValue(task, "notes", event.target.value) : undefined}
                        onBlur={!isEditing ? (event) => {
                          if (event.target.value !== task.notes) updateNotes(task, event.target.value);
                        } : undefined}
                        rows={2}
                      />
                    </label>
                  </article>
                );
                })}
              </div>
            ) : openSections[section.id] ? (
              <p className="empty">No tasks in this section.</p>
            ) : null}
          </section>
        ))}
      </section>

      {user.role === "admin" ? (
        <section className="all-tasks">
          <button className="toggle-heading section-heading" type="button" onClick={() => setAdminListOpen(!adminListOpen)}>
            <span className={`toggle-caret ${adminListOpen ? "is-open" : ""}`} aria-hidden="true" />
            <span className="section-title-group">
              <h2>Admin Task List</h2>
              <strong>{displayedTasks.length}</strong>
            </span>
          </button>
          {adminListOpen ? <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Task</th>
                  <th>Owner</th>
                  <th>Area</th>
                  <th>Status</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {displayedTasks.map((task) => (
                  <tr key={`${task.taskId}-${task.rowNumber}`}>
                    <td>{task.taskId}</td>
                    <td>{task.task}</td>
                    <td>{task.owner}</td>
                    <td>{task.area}</td>
                    <td>{task.status}</td>
                    <td>{formatDate(task.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div> : null}
        </section>
      ) : null}
    </main>
  );
}

function AppGridIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
}

function SignalIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 17.5 3.5 21l3.8-1.2A9 9 0 1 0 5 17.5Z" /><path d="M8 12h8M8 8.5h5M8 15.5h6" /></svg>;
}

function SignOutIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></svg>;
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
