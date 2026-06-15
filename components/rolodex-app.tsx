"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { AldeaUser } from "@/lib/config";
import type { RolodexContact, RolodexDraft } from "@/lib/rolodex";

type Props = {
  user: AldeaUser;
  contacts: RolodexContact[];
  primaryContacts: string[];
  loadError?: string;
};

const emptyDraft: RolodexDraft = {
  fullName: "",
  phoneNumber: "",
  email: "",
  country: "",
  lives: "",
  company: "",
  work: "",
  relation: "",
  internalPrimaryContact: ""
};

export default function RolodexApp({ user, contacts, primaryContacts, loadError = "" }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContactId, setSelectedContactId] = useState(contacts[0]?.contactId || "");
  const [editingContactId, setEditingContactId] = useState("");
  const [draft, setDraft] = useState<RolodexDraft>(emptyDraft);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredContacts = useMemo(() => {
    const query = normalize(searchTerm);
    if (!query) return contacts;

    return contacts.filter((contact) => (
      [
        contact.fullName,
        contact.company,
        contact.work,
        contact.country,
        contact.lives,
        contact.relation,
        contact.internalPrimaryContact,
        contact.email,
        contact.phoneNumber
      ].some((value) => normalize(value).includes(query))
    ));
  }, [contacts, searchTerm]);

  useEffect(() => {
    if (!filteredContacts.length) {
      setSelectedContactId("");
      return;
    }

    const exists = filteredContacts.some((contact) => contact.contactId === selectedContactId);
    if (!exists) {
      setSelectedContactId(filteredContacts[0].contactId);
    }
  }, [filteredContacts, selectedContactId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedContact = filteredContacts.find((contact) => contact.contactId === selectedContactId)
    || contacts.find((contact) => contact.contactId === selectedContactId)
    || null;
  const isEditing = !!selectedContact && editingContactId === selectedContact.contactId;

  function beginEdit() {
    if (!selectedContact) return;
    setDraft({
      fullName: selectedContact.fullName,
      phoneNumber: selectedContact.phoneNumber,
      email: selectedContact.email,
      country: selectedContact.country,
      lives: selectedContact.lives,
      company: selectedContact.company,
      work: selectedContact.work,
      relation: selectedContact.relation,
      internalPrimaryContact: selectedContact.internalPrimaryContact
    });
    setEditingContactId(selectedContact.contactId);
    setError("");
  }

  function cancelEdit() {
    setEditingContactId("");
    setDraft(emptyDraft);
    setError("");
  }

  async function saveContact() {
    if (!selectedContact) return;

    if (!draft.fullName.trim()) {
      setError("Full Name is required.");
      return;
    }

    setError("");

    const response = await fetch(`/api/rolodex/${encodeURIComponent(selectedContact.contactId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rowNumber: selectedContact.rowNumber,
        ...draft
      })
    });

    if (!response.ok) {
      setError("Contact save failed.");
      return;
    }

    setToast("Contact saved.");
    cancelEdit();
    startTransition(() => {
      window.location.reload();
    });
  }

  return (
    <main className="app-shell rolodex-shell">
      {toast ? <div className="toast" role="status">{toast}</div> : null}

      <header className="topbar">
        <div>
          <img className="brand-logo" src="/aldea-logo.png" alt="ALDEA" />
          <h1>ALDEA Rolodex</h1>
          <p className="muted">Shared Contact View</p>
        </div>
        <div className="topbar-actions rolodex-actions">
          <a className="icon-link" href="/" aria-label="Workspace Home" title="Workspace Home">
            <AppGridIcon />
          </a>
          {user.apps.includes("signal") ? (
            <a className="icon-link" href="/api/signal/launch" aria-label="Open Signal" title="Open Signal">
              <SignalIcon />
            </a>
          ) : null}
          {user.apps.includes("task-manager") ? (
            <a className="icon-link" href="/task-manager" aria-label="Open Task Manager" title="Open Task Manager">
              <TaskListIcon />
            </a>
          ) : null}
          <form action="/api/auth/logout" method="post">
            <button className="icon-link sign-out-button" type="submit" aria-label="Sign Out" title="Sign Out">
              <SignOutIcon />
            </button>
          </form>
        </div>
      </header>

      {loadError ? (
        <div className="duplicate-warning" role="alert">
          {loadError}
        </div>
      ) : null}

      <section className="rolodex-search-band">
        <label className="field rolodex-search-field">
          <span>Search Contacts</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name, company, relation, or ALDEA contact"
          />
        </label>
      </section>

      <section className="rolodex-layout">
        <aside className="rolodex-list-card">
          <div className="rolodex-list-header">
            <h2>Contacts</h2>
            <strong>{filteredContacts.length}</strong>
          </div>
          <div className="rolodex-list">
            {filteredContacts.length ? filteredContacts.map((contact) => {
              const active = selectedContact?.contactId === contact.contactId;
              return (
                <button
                  key={contact.contactId || `${contact.fullName}-${contact.rowNumber}`}
                  className={`rolodex-list-item ${active ? "is-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setSelectedContactId(contact.contactId);
                    if (editingContactId && editingContactId !== contact.contactId) {
                      cancelEdit();
                    }
                  }}
                >
                  <strong>{contact.fullName || "Unnamed Contact"}</strong>
                  <span>{contact.company || contact.relation || contact.country || "No company yet"}</span>
                </button>
              );
            }) : (
              <div className="rolodex-empty">No contacts match this search.</div>
            )}
          </div>
        </aside>

        <section className="rolodex-detail-card">
          {selectedContact ? (
            <>
              <div className="rolodex-detail-head">
                <div>
                  <p className="rolodex-detail-kicker">Contact Detail</p>
                  <h2>{isEditing ? draft.fullName || "Edit Contact" : selectedContact.fullName}</h2>
                </div>
                <div className="rolodex-detail-actions">
                  {!isEditing ? (
                    <button className="ghost-button rolodex-edit-button" type="button" onClick={beginEdit}>
                      Edit Details
                    </button>
                  ) : (
                    <>
                      <button className="ghost-button rolodex-cancel-button" type="button" onClick={cancelEdit}>
                        Cancel
                      </button>
                      <button className="ghost-button rolodex-save-button" type="button" onClick={saveContact} disabled={isPending}>
                        Save
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="rolodex-detail-pills">
                {selectedContact.company ? <span>{selectedContact.company}</span> : null}
                {selectedContact.work ? <span>{selectedContact.work}</span> : null}
                {selectedContact.country ? <span>{selectedContact.country}</span> : null}
              </div>

              <div className="rolodex-detail-grid">
                <DetailField
                  label="Full Name"
                  editing={isEditing}
                  value={isEditing ? draft.fullName : selectedContact.fullName}
                  onChange={(value) => setDraft({ ...draft, fullName: value })}
                />
                <DetailField
                  label="Phone Number"
                  editing={isEditing}
                  value={isEditing ? draft.phoneNumber : selectedContact.phoneNumber}
                  href={!isEditing && selectedContact.phoneNumber ? `tel:${selectedContact.phoneNumber}` : undefined}
                  onChange={(value) => setDraft({ ...draft, phoneNumber: value })}
                  type="tel"
                />
                <DetailField
                  label="Email"
                  editing={isEditing}
                  value={isEditing ? draft.email : selectedContact.email}
                  href={!isEditing && selectedContact.email ? `mailto:${selectedContact.email}` : undefined}
                  onChange={(value) => setDraft({ ...draft, email: value })}
                  type="email"
                />
                <DetailField
                  label="Country"
                  editing={isEditing}
                  value={isEditing ? draft.country : selectedContact.country}
                  onChange={(value) => setDraft({ ...draft, country: value })}
                />
                <DetailField
                  label="Lives"
                  editing={isEditing}
                  value={isEditing ? draft.lives : selectedContact.lives}
                  onChange={(value) => setDraft({ ...draft, lives: value })}
                />
                <DetailField
                  label="Company"
                  editing={isEditing}
                  value={isEditing ? draft.company : selectedContact.company}
                  onChange={(value) => setDraft({ ...draft, company: value })}
                />
                <DetailField
                  label="Work"
                  editing={isEditing}
                  value={isEditing ? draft.work : selectedContact.work}
                  onChange={(value) => setDraft({ ...draft, work: value })}
                />
                <DetailField
                  label="Relation"
                  editing={isEditing}
                  value={isEditing ? draft.relation : selectedContact.relation}
                  onChange={(value) => setDraft({ ...draft, relation: value })}
                />

                <label className="rolodex-field rolodex-field-full">
                  <span>Internal Primary Contact</span>
                  {isEditing ? (
                    <select
                      value={draft.internalPrimaryContact}
                      onChange={(event) => setDraft({ ...draft, internalPrimaryContact: event.target.value })}
                    >
                      <option value="">Select ALDEA User</option>
                      {primaryContacts.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  ) : (
                    <div className="rolodex-value is-chip">{selectedContact.internalPrimaryContact || "Not set"}</div>
                  )}
                </label>
              </div>

              {error ? <p className="create-task-error rolodex-error" role="alert">{error}</p> : null}
            </>
          ) : (
            <div className="rolodex-empty rolodex-empty-detail">Select a contact to view details.</div>
          )}
        </section>
      </section>
    </main>
  );
}

function DetailField({
  label,
  editing,
  value,
  onChange,
  href,
  type = "text"
}: {
  label: string;
  editing: boolean;
  value: string;
  onChange: (value: string) => void;
  href?: string;
  type?: string;
}) {
  return (
    <label className="rolodex-field">
      <span>{label}</span>
      {editing ? (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : href && value ? (
        <a className="rolodex-value is-link" href={href}>{value}</a>
      ) : (
        <div className="rolodex-value">{value || "Not set"}</div>
      )}
    </label>
  );
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function AppGridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function TaskListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
    </svg>
  );
}

function SignalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 17.5 3.5 21l3.8-1.2A9 9 0 1 0 5 17.5Z" />
      <path d="M8 12h8M8 8.5h5M8 15.5h6" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 5H5v14h5" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </svg>
  );
}
