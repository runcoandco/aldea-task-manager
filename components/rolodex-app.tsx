"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  internalPrimaryContact: "",
  categories: []
};

export default function RolodexApp({ user, contacts, primaryContacts, loadError = "" }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({ lives: "", country: "", work: "", category: "", internalPrimaryContact: "" });
  const [selectedContactId, setSelectedContactId] = useState(contacts[0]?.contactId || "");
  const [editingContactId, setEditingContactId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [draft, setDraft] = useState<RolodexDraft>(emptyDraft);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [currentView, setCurrentView] = useState<"list" | "detail">("list");
  const listScrollY = useRef(0);
  const editorNavigation = useRef({ active: false, dirty: false, hash: "" });
  const skipNavigationPrompt = useRef(false);
  const detailRef = useRef<HTMLElement>(null);
  const [isPending, startTransition] = useTransition();

  const filteredContacts = useMemo(() => {
    const query = normalize(searchTerm);
    return contacts.filter((contact) => {
      const matchesFilters = (Object.keys(filters) as (keyof typeof filters)[])
        .every((field) => !filters[field] || (field === "category"
          ? contact.categories.some((category) => normalize(category) === normalize(filters.category))
          : field === "internalPrimaryContact" && filters.internalPrimaryContact === "__unassigned__"
            ? !contact.internalPrimaryContact.trim()
            : normalize(contact[field]) === normalize(filters[field])));
      return matchesFilters && (!query || [
        contact.fullName,
        contact.company,
        contact.work,
        contact.country,
        contact.lives,
        contact.relation,
        contact.internalPrimaryContact,
        contact.email,
        contact.phoneNumber,
        ...contact.categories
      ].some((value) => normalize(value).includes(query)));
    });
  }, [contacts, filters, searchTerm]);

  const filterOptions = useMemo(() => ({
    lives: uniqueValues(contacts.map((contact) => contact.lives)),
    country: uniqueValues(contacts.map((contact) => contact.country)),
    work: uniqueValues(contacts.map((contact) => contact.work)),
    category: uniqueValues(contacts.flatMap((contact) => contact.categories)),
    internalPrimaryContact: uniqueValues(contacts.map((contact) => contact.internalPrimaryContact))
  }), [contacts]);

  const similarContacts = useMemo(() => {
    if (!isCreating) return [];
    const name = normalizeContactName(draft.fullName);
    const email = normalize(draft.email);
    const phone = phoneDigits(draft.phoneNumber);
    return contacts.flatMap((contact) => {
      const contactName = normalizeContactName(contact.fullName);
      let reason = "";
      let score = 0;
      if (email.includes("@") && email === normalize(contact.email)) {
        reason = "Same email";
        score = 3;
      } else if (phone.length >= 6 && phone === phoneDigits(contact.phoneNumber)) {
        reason = "Same phone";
        score = 3;
      } else if (name.length >= 4 && contactName) {
        if (name === contactName) {
          reason = "Same name";
          score = 2;
        } else if (contactName.includes(name) || (name.length >= 6 && name.includes(contactName))) {
          reason = "Similar name";
          score = 1;
        }
      }
      return score ? [{ contact, reason, score }] : [];
    }).sort((left, right) => right.score - left.score || left.contact.fullName.localeCompare(right.contact.fullName)).slice(0, 4);
  }, [contacts, draft.email, draft.fullName, draft.phoneNumber, isCreating]);

  useEffect(() => {
    if (currentView === "detail") return;
    if (!filteredContacts.length) {
      setSelectedContactId("");
      return;
    }

    const exists = filteredContacts.some((contact) => contact.contactId === selectedContactId);
    if (!exists) {
      setSelectedContactId(filteredContacts[0].contactId);
    }
  }, [filteredContacts, selectedContactId, currentView]);

  useEffect(() => {
    const syncFromUrl = (event?: Event) => {
      const hash = window.location.hash;
      const bypassPrompt = skipNavigationPrompt.current;
      if (event) skipNavigationPrompt.current = false;
      if (event && !bypassPrompt && editorNavigation.current.active && editorNavigation.current.dirty && hash !== editorNavigation.current.hash) {
        if (!window.confirm("Discard unsaved changes?")) {
          window.history.forward();
          return;
        }
      }
      if (hash === "#new") {
        setIsCreating(true);
        setCurrentView("detail");
      } else if (hash.startsWith("#edit=")) {
        const contactId = decodeURIComponent(hash.slice(6));
        const contact = contacts.find((item) => item.contactId === contactId);
        if (contact) {
          setSelectedContactId(contactId);
          setIsCreating(false);
          setEditingContactId(contactId);
          if (!(editorNavigation.current.active && editorNavigation.current.hash === hash)) {
            setDraft(contactDraft(contact));
            setCategoryInput("");
          }
          setCurrentView("detail");
        } else {
          setCurrentView("list");
        }
      } else if (hash.startsWith("#contact=")) {
        const contactId = decodeURIComponent(hash.slice(9));
        if (contacts.some((contact) => contact.contactId === contactId)) {
          setSelectedContactId(contactId);
          setIsCreating(false);
          setEditingContactId("");
          setDraft(emptyDraft);
          setCategoryInput("");
          setError("");
          setCurrentView("detail");
        } else {
          setCurrentView("list");
        }
      } else {
        setIsCreating(false);
        setEditingContactId("");
        setDraft(emptyDraft);
        setCategoryInput("");
        setError("");
        setCurrentView("list");
        window.requestAnimationFrame(() => window.scrollTo(0, listScrollY.current));
      }
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, [contacts]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (currentView === "detail") detailRef.current?.focus();
  }, [currentView]);

  useEffect(() => {
    try {
      const message = window.sessionStorage.getItem("rolodexSaveMessage");
      const contactId = window.sessionStorage.getItem("rolodexSavedContactId");
      window.sessionStorage.removeItem("rolodexSaveMessage");
      window.sessionStorage.removeItem("rolodexSavedContactId");
      if (message) setToast(message);
      if (contactId && contacts.some((contact) => contact.contactId === contactId)) {
        setSelectedContactId(contactId);
      }
    } catch {
      // Session storage can be blocked in some mobile browser modes.
    }
  }, [contacts]);

  const selectedContact = contacts.find((contact) => contact.contactId === selectedContactId) || null;
  const isEditing = isCreating || (!!selectedContact && editingContactId === selectedContact.contactId);

  useEffect(() => {
    editorNavigation.current = {
      active: isEditing,
      dirty: isEditing && hasUnsavedChanges(),
      hash: isCreating ? "#new" : editingContactId ? `#edit=${encodeURIComponent(selectedContactId)}` : `#contact=${encodeURIComponent(selectedContactId)}`
    };
  });

  function openContactView(hash: string) {
    if (currentView === "list") listScrollY.current = window.scrollY;
    window.history.pushState({ ...window.history.state, rolodexView: true }, "", hash);
    setCurrentView("detail");
    window.scrollTo(0, 0);
  }

  function returnToList() {
    if (window.history.state?.rolodexView || window.history.state?.rolodexMobile) {
      window.history.back();
    } else {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      skipNavigationPrompt.current = false;
      setCurrentView("list");
      window.requestAnimationFrame(() => window.scrollTo(0, listScrollY.current));
    }
  }

  function returnToContact() {
    if ((window.history.state?.rolodexView || window.history.state?.rolodexMobile) && window.location.hash.startsWith("#edit=")) {
      window.history.back();
    } else {
      window.history.replaceState(window.history.state, "", `#contact=${encodeURIComponent(selectedContactId)}`);
      skipNavigationPrompt.current = false;
      setCurrentView("detail");
    }
  }

  function hasUnsavedChanges() {
    if (categoryInput.trim()) return true;
    if (isCreating) return Object.entries(draft).some(([, value]) => Array.isArray(value) ? value.length > 0 : !!value.trim());
    if (!selectedContact || !editingContactId) return false;
    return (Object.keys(emptyDraft) as (keyof RolodexDraft)[]).some((field) =>
      field === "categories"
        ? JSON.stringify(draft.categories) !== JSON.stringify(selectedContact.categories)
        : draft[field] !== selectedContact[field]);
  }

  function goBack() {
    if (isEditing && hasUnsavedChanges() && !window.confirm("Discard unsaved changes?")) return;
    const wasEditing = !!editingContactId && !isCreating;
    skipNavigationPrompt.current = true;
    setIsCreating(false);
    setEditingContactId("");
    setDraft(emptyDraft);
    setCategoryInput("");
    setError("");
    if (wasEditing) returnToContact();
    else returnToList();
  }

  function beginCreate() {
    setDraft({ ...emptyDraft });
    setCategoryInput("");
    setEditingContactId("");
    setIsCreating(true);
    setError("");
    openContactView("#new");
  }

  function beginEdit() {
    if (!selectedContact) return;
    setDraft(contactDraft(selectedContact));
    setCategoryInput("");
    setEditingContactId(selectedContact.contactId);
    setError("");
    openContactView(`#edit=${encodeURIComponent(selectedContact.contactId)}`);
  }

  function viewSuggestedContact(contactId: string) {
    if (hasUnsavedChanges() && !window.confirm("Discard this new contact and view the saved contact?")) return;
    setIsCreating(false);
    setDraft(emptyDraft);
    setCategoryInput("");
    setError("");
    setSelectedContactId(contactId);
    window.history.replaceState({ ...window.history.state, rolodexView: true }, "", `#contact=${encodeURIComponent(contactId)}`);
    setCurrentView("detail");
    window.scrollTo(0, 0);
  }

  function cancelEdit() {
    const wasCreating = isCreating;
    const wasEditing = !!editingContactId && !isCreating;
    if (wasCreating || wasEditing) skipNavigationPrompt.current = true;
    setIsCreating(false);
    setEditingContactId("");
    setDraft(emptyDraft);
    setCategoryInput("");
    setError("");
    if (wasCreating) returnToList();
    else if (wasEditing) returnToContact();
  }

  function reportError(message: string) {
    setError(message);
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function addCategory(value: string) {
    const category = value.trim();
    if (!category) return;
    if (draft.categories.some((item) => normalize(item) === normalize(category))) {
      setCategoryInput("");
      return;
    }
    if (category.length > 60) {
      reportError("Category names must be 60 characters or shorter.");
      return;
    }
    if (draft.categories.length >= 20) {
      reportError("A contact can have up to 20 Categories.");
      return;
    }
    setDraft((current) => ({
      ...current,
      categories: [...current.categories, category]
    }));
    setCategoryInput("");
    setError("");
  }

  async function saveContact() {
    if (!isCreating && !selectedContact) return;

    const pendingCategory = categoryInput.trim();
    if (pendingCategory.length > 60) {
      reportError("Category names must be 60 characters or shorter.");
      return;
    }
    const categories = pendingCategory && !draft.categories.some((item) => normalize(item) === normalize(pendingCategory))
      ? [...draft.categories, pendingCategory]
      : draft.categories;
    if (categories.length > 20) {
      reportError("A contact can have up to 20 Categories.");
      return;
    }

    if (!draft.fullName.trim()) {
      reportError("Full Name is required.");
      return;
    }

    if (isCreating && !draft.phoneNumber.trim() && !draft.email.trim()) {
      reportError("Add a Phone Number or Email to create a contact.");
      return;
    }

    setError("");

    setIsSaving(true);
    try {
      const response = await fetch(isCreating ? "/api/rolodex" : `/api/rolodex/${encodeURIComponent(selectedContact!.contactId)}`, {
        method: isCreating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isCreating
          ? { ...draft, categories }
          : { ...draft, categories })
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        reportError(result?.error || "Contact save failed. Please try again.");
        return;
      }

      const result = await response.json().catch(() => null) as { contactId?: string } | null;
      try {
        window.sessionStorage.setItem("rolodexSaveMessage", isCreating ? "Contact created." : "Contact saved.");
        window.sessionStorage.setItem("rolodexSavedContactId", result?.contactId || selectedContact?.contactId || "");
      } catch {
        // The save succeeded even if this browser blocks session storage.
      }
      const savedFromEdit = !isCreating && window.location.hash.startsWith("#edit=") && !!(window.history.state?.rolodexView || window.history.state?.rolodexMobile);
      if (!savedFromEdit && (result?.contactId || selectedContact?.contactId)) {
        window.history.replaceState({ ...window.history.state, rolodexView: true }, "", `#contact=${encodeURIComponent(result?.contactId || selectedContact!.contactId)}`);
      }
      setIsCreating(false);
      setEditingContactId("");
      if (savedFromEdit) {
        skipNavigationPrompt.current = true;
        window.addEventListener("popstate", () => window.location.reload(), { once: true });
        window.history.back();
      } else {
        startTransition(() => window.location.reload());
      }
    } catch {
      reportError("Contact save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteContact() {
    if (!selectedContact || isCreating || editingContactId !== selectedContact.contactId || isDeleting) return;
    if (!window.confirm(`Delete ${selectedContact.fullName}? This removes the contact from the shared Rolodex.`)) return;

    setError("");
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/rolodex/${encodeURIComponent(selectedContact.contactId)}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        reportError(result?.error || "Contact could not be deleted.");
        return;
      }
      try {
        window.sessionStorage.setItem("rolodexSaveMessage", "Contact deleted.");
        window.sessionStorage.removeItem("rolodexSavedContactId");
      } catch {
        // The deletion succeeded even if this browser blocks session storage.
      }
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      startTransition(() => window.location.reload());
    } catch {
      reportError("Contact could not be deleted.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className={`app-shell rolodex-shell ${currentView === "detail" ? "rolodex-contact-view" : ""}`}>
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

      <section className="rolodex-directory-tools" aria-label="Find contacts">
        <label className="field rolodex-search-field">
          <span>Search Contacts</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, company, or contact details"
          />
        </label>
        <div className="rolodex-filter-group">
          {(["lives", "country", "work", "category", "internalPrimaryContact"] as const).map((field) => (
            <label className="field rolodex-filter" key={field}>
              <span>{field === "internalPrimaryContact" ? "Owner" : field}</span>
              <select value={filters[field]} onChange={(event) => setFilters({ ...filters, [field]: event.target.value })}>
                <option value="">All {field === "country" ? "countries" : field === "lives" ? "locations" : field === "category" ? "categories" : field === "internalPrimaryContact" ? "owners" : "work"}</option>
                {filterOptions[field].map((value) => <option key={value} value={value}>{value}</option>)}
                {field === "internalPrimaryContact" && contacts.some((contact) => !contact.internalPrimaryContact.trim()) && <option value="__unassigned__">Unassigned</option>}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="rolodex-layout">
        <aside className="rolodex-list-card">
          <div className="rolodex-list-header">
            <div>
              <h2>Contacts</h2>
              <p>{filteredContacts.length} of {contacts.length}</p>
            </div>
            <div className="rolodex-list-tools">
              <button className="ghost-button rolodex-create-button" type="button" onClick={beginCreate}>
                <span aria-hidden="true">＋</span> Create Contact
              </button>
            </div>
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
                    setIsCreating(false);
                    setSelectedContactId(contact.contactId);
                    if (editingContactId && editingContactId !== contact.contactId) {
                      cancelEdit();
                    }
                    openContactView(`#contact=${encodeURIComponent(contact.contactId)}`);
                  }}
                >
                  <strong>{contact.fullName || "Unnamed Contact"}</strong>
                  <span>{contact.company || contact.relation || contact.country || "No company yet"}</span>
                  <span className="rolodex-list-disclosure" aria-hidden="true">›</span>
                </button>
              );
            }) : (
              <div className="rolodex-empty">No contacts match this search.</div>
            )}
          </div>
        </aside>

        <section className="rolodex-detail-card" ref={detailRef} tabIndex={-1}>
          <nav className="rolodex-back-nav" aria-label="Contact navigation">
            <button type="button" onClick={goBack} disabled={isDeleting} aria-label={editingContactId && !isCreating ? `Back to ${selectedContact?.fullName || "Contact"}` : "Back to Contacts"}>
              <span aria-hidden="true">‹</span> {editingContactId && !isCreating ? selectedContact?.fullName || "Contact" : "Contacts"}
            </button>
          </nav>
          {selectedContact || isCreating ? (
            <>
              <div className="rolodex-detail-head">
                <div>
                  <p className="rolodex-detail-kicker">{isCreating ? "New Contact" : "Contact"}</p>
                  <h2>{isCreating ? "Create Contact" : isEditing ? draft.fullName || "Edit Contact" : selectedContact?.fullName}</h2>
                </div>
                <div className="rolodex-detail-actions">
                  {!isEditing ? (
                    <button className="ghost-button rolodex-edit-button" type="button" onClick={beginEdit}>
                      Edit Details
                    </button>
                  ) : (
                    <>
                      <button className="ghost-button rolodex-cancel-button" type="button" onClick={cancelEdit} disabled={isDeleting || isSaving}>
                        Cancel
                      </button>
                      <button className="ghost-button rolodex-save-button" type="button" onClick={saveContact} disabled={isPending || isSaving || isDeleting}>
                        {isCreating ? "Create Contact" : "Save"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {error ? <p className="create-task-error rolodex-error" role="alert">{error}</p> : null}

              {!isCreating && selectedContact ? <div className="rolodex-detail-pills">
                {selectedContact.company ? <span>{selectedContact.company}</span> : null}
                {selectedContact.work ? <span>{selectedContact.work}</span> : null}
                {selectedContact.country ? <span>{selectedContact.country}</span> : null}
              </div> : null}

              <div className="rolodex-detail-grid">
                <div className="rolodex-name-field">
                  <DetailField
                    label="Full Name"
                    editing={isEditing}
                    value={isEditing ? draft.fullName : selectedContact?.fullName || ""}
                    onChange={(value) => setDraft({ ...draft, fullName: value })}
                  />
                </div>
                <DetailField
                  label="Phone Number"
                  editing={isEditing}
                  value={isEditing ? draft.phoneNumber : selectedContact?.phoneNumber || ""}
                  href={!isEditing && selectedContact?.phoneNumber ? `tel:${selectedContact.phoneNumber}` : undefined}
                  onChange={(value) => setDraft({ ...draft, phoneNumber: value })}
                  type="tel"
                />
                <DetailField
                  label="Email"
                  editing={isEditing}
                  value={isEditing ? draft.email : selectedContact?.email || ""}
                  href={!isEditing && selectedContact?.email ? `mailto:${selectedContact.email}` : undefined}
                  onChange={(value) => setDraft({ ...draft, email: value })}
                  type="email"
                />
                {isCreating && similarContacts.length ? (
                  <div className="rolodex-similar" aria-live="polite">
                    <strong>Possible existing contacts</strong>
                    <div className="rolodex-similar-list">
                      {similarContacts.map(({ contact, reason }) => (
                        <button type="button" key={contact.contactId} onClick={() => viewSuggestedContact(contact.contactId)}>
                          <span><b>{contact.fullName}</b><small>{contact.company || contact.relation || "Saved contact"}</small></span>
                          <span className="rolodex-similar-reason">{reason} · View</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <DetailField
                  label="Country"
                  editing={isEditing}
                  value={isEditing ? draft.country : selectedContact?.country || ""}
                  onChange={(value) => setDraft({ ...draft, country: value })}
                />
                <DetailField
                  label="Lives"
                  editing={isEditing}
                  value={isEditing ? draft.lives : selectedContact?.lives || ""}
                  onChange={(value) => setDraft({ ...draft, lives: value })}
                />
                <DetailField
                  label="Company"
                  editing={isEditing}
                  value={isEditing ? draft.company : selectedContact?.company || ""}
                  onChange={(value) => setDraft({ ...draft, company: value })}
                />
                <DetailField
                  label="Work"
                  editing={isEditing}
                  value={isEditing ? draft.work : selectedContact?.work || ""}
                  onChange={(value) => setDraft({ ...draft, work: value })}
                />
                <DetailField
                  label="Relation"
                  editing={isEditing}
                  value={isEditing ? draft.relation : selectedContact?.relation || ""}
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
                    <div className="rolodex-value">{selectedContact?.internalPrimaryContact || ""}</div>
                  )}
                </label>

                <div className="rolodex-field rolodex-field-full">
                  <span>Categories</span>
                  <div className="rolodex-category-list">
                    {(isEditing ? draft.categories : selectedContact?.categories || []).map((category) => (
                      isEditing ? (
                        <button
                          className="rolodex-category-chip"
                          type="button"
                          key={category}
                          aria-label={`Remove ${category} category`}
                          onClick={() => setDraft((current) => ({
                            ...current,
                            categories: current.categories.filter((item) => item !== category)
                          }))}
                        >
                          {category} <span aria-hidden="true">×</span>
                        </button>
                      ) : <span className="rolodex-category-chip" key={category}>{category}</span>
                    ))}
                  </div>
                  {isEditing ? (
                    <div className="rolodex-category-controls">
                      <select
                        aria-label="Add existing category"
                        value=""
                        onChange={(event) => addCategory(event.target.value)}
                      >
                        <option value="">Choose existing Category</option>
                        {filterOptions.category
                          .filter((category) => !draft.categories.some((item) => normalize(item) === normalize(category)))
                          .map((category) => <option value={category} key={category}>{category}</option>)}
                      </select>
                      <input
                        aria-label="New Category"
                        value={categoryInput}
                        onChange={(event) => setCategoryInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addCategory(categoryInput);
                          }
                        }}
                        placeholder="New Category"
                      />
                      <button className="ghost-button" type="button" onClick={() => addCategory(categoryInput)}>
                        Add
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {isEditing ? (
                <div className="rolodex-mobile-actions">
                  <button className="ghost-button rolodex-cancel-button" type="button" onClick={cancelEdit} disabled={isDeleting || isSaving}>Cancel</button>
                  <button className="ghost-button rolodex-save-button" type="button" onClick={saveContact} disabled={isPending || isSaving || isDeleting}>
                    {isCreating ? "Create Contact" : "Save"}
                  </button>
                </div>
              ) : null}
              {isEditing && !isCreating && selectedContact ? (
                <div className="rolodex-delete-action">
                  <button className="ghost-button rolodex-delete-button" type="button" onClick={deleteContact} disabled={isPending || isSaving || isDeleting}>
                    {isDeleting ? "Deleting…" : "Delete Contact"}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rolodex-empty rolodex-empty-detail">Select a contact to view details.</div>
          )}
        </section>
      </section>
    </main>
  );
}

function contactDraft(contact: RolodexContact): RolodexDraft {
  return {
    fullName: contact.fullName,
    phoneNumber: contact.phoneNumber,
    email: contact.email,
    country: contact.country,
    lives: contact.lives,
    company: contact.company,
    work: contact.work,
    relation: contact.relation,
    internalPrimaryContact: contact.internalPrimaryContact,
    categories: [...contact.categories]
  };
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
        <div className="rolodex-value">{value}</div>
      )}
    </label>
  );
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function normalizeContactName(value: string) {
  return normalize(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function uniqueValues(values: string[]) {
  const unique = new Map<string, string>();
  values.forEach((value) => {
    const trimmed = value.trim();
    if (trimmed && !unique.has(normalize(trimmed))) unique.set(normalize(trimmed), trimmed);
  });
  return [...unique.values()].sort((left, right) => left.localeCompare(right));
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

