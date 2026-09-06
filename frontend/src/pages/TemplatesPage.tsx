import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type MessageTemplate } from "../api";
import { renderWhatsAppMarkdown } from "../whatsappMarkdown";
import { ConfirmDialog } from "../components/ConfirmDialog";

const emptyDraft = { id: "", name: "", body: "", tags: [] as string[] };

export function TemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState("");
  const [draft, setDraft] = useState<typeof emptyDraft | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [pendingDelete, setPendingDelete] = useState<MessageTemplate | null>(null);

  async function load() {
    setTemplates(await api.listTemplates());
    setAllTags(await api.listTemplateTags());
  }

  useEffect(() => {
    void load();
  }, []);

  function startNew() {
    setDraft({ ...emptyDraft });
    setTagInput("");
  }

  function startEdit(tpl: MessageTemplate) {
    setDraft({ id: tpl.id, name: tpl.name, body: tpl.body, tags: [...tpl.tags] });
    setTagInput("");
  }

  function addTag() {
    if (!draft || !tagInput.trim()) return;
    if (!draft.tags.includes(tagInput.trim())) {
      setDraft({ ...draft, tags: [...draft.tags, tagInput.trim()] });
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    if (!draft) return;
    setDraft({ ...draft, tags: draft.tags.filter((tg) => tg !== tag) });
  }

  async function save() {
    if (!draft || !draft.name.trim() || !draft.body.trim()) return;
    if (draft.id) {
      await api.updateTemplate(draft.id, { name: draft.name, body: draft.body, tags: draft.tags });
    } else {
      await api.createTemplate({ name: draft.name, body: draft.body, tags: draft.tags });
    }
    setDraft(null);
    void load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await api.deleteTemplate(pendingDelete.id);
    setPendingDelete(null);
    void load();
  }

  const visibleTemplates = filterTag ? templates.filter((tpl) => tpl.tags.includes(filterTag)) : templates;

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t("templates.title")}</h1>
        <div>
          <Link to="/">{t("nav.backToDashboard")}</Link>
        </div>
      </header>

      <div className="inline-form">
        <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
          <option value="">{t("templates.filterByTag")}</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <button onClick={startNew}>{t("templates.new")}</button>
      </div>

      {visibleTemplates.length === 0 && !draft && <p className="muted">{t("templates.empty")}</p>}

      <div className="grid">
        {visibleTemplates.map((tpl) => (
          <div className="card template-card" key={tpl.id} onClick={() => startEdit(tpl)}>
            <h3>{tpl.name}</h3>
            <p className="muted template-snippet">{tpl.body.slice(0, 120)}</p>
            <div className="tag-list">
              {tpl.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                </span>
              ))}
            </div>
            <button
              className="link danger"
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(tpl);
              }}
            >
              {t("templates.delete")}
            </button>
          </div>
        ))}
      </div>

      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <div className="modal template-editor" onClick={(e) => e.stopPropagation()}>
            <input
              placeholder={t("templates.namePlaceholder")}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />

            <div className="template-editor-body">
              <textarea
                placeholder={t("templates.bodyPlaceholder")}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={10}
              />
              <div className="template-preview">
                <p className="muted">{t("templates.preview")}</p>
                <div
                  className="wa-preview"
                  dangerouslySetInnerHTML={{ __html: renderWhatsAppMarkdown(draft.body) }}
                />
              </div>
            </div>

            <div className="tag-list">
              {draft.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              placeholder={t("templates.addTagPlaceholder")}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
            />

            <div className="modal-actions">
              <button type="button" className="link" onClick={() => setDraft(null)}>
                {t("dashboard.cancel")}
              </button>
              <button type="button" onClick={() => void save()}>
                {t("templates.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={t("templates.deleteConfirm")}
          body=""
          confirmLabel={t("templates.delete")}
          cancelLabel={t("dashboard.cancel")}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
