import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, mediaUrl, type MessageTemplate } from "../api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PaperclipIcon } from "../components/icons";
import { WhatsAppPreview } from "../components/WhatsAppPreview";

type Draft = {
  id: string;
  name: string;
  body: string;
  tags: string[];
  mediaPath: string | null;
  mediaType: "IMAGE" | "DOCUMENT" | null;
};

const emptyDraft: Draft = { id: "", name: "", body: "", tags: [], mediaPath: null, mediaType: null };

export function TemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
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
    setDraft({ id: tpl.id, name: tpl.name, body: tpl.body, tags: [...tpl.tags], mediaPath: tpl.mediaPath, mediaType: tpl.mediaType });
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

  async function attachImage(file: File) {
    if (!draft) return;
    setUploading(true);
    try {
      const uploaded = await api.uploadMedia(file);
      setDraft({ ...draft, mediaPath: uploaded.mediaPath, mediaType: uploaded.mediaType });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!draft || !draft.name.trim() || !draft.body.trim()) return;
    const payload = {
      name: draft.name,
      body: draft.body,
      tags: draft.tags,
      mediaPath: draft.mediaPath,
      mediaType: draft.mediaType,
    };
    if (draft.id) {
      await api.updateTemplate(draft.id, payload);
    } else {
      await api.createTemplate(payload);
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
    <>
      <header className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h1 className="text-xl font-medium tracking-tight m-0">{t("templates.title")}</h1>
      </header>

      <div className="flex gap-2 mb-6">
        <select className="field-input w-auto" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
          <option value="">{t("templates.filterByTag")}</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <button className="btn" onClick={startNew}>
          {t("templates.new")}
        </button>
      </div>

      {visibleTemplates.length === 0 && !draft && <p className="text-muted text-sm">{t("templates.empty")}</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {visibleTemplates.map((tpl) => (
          <div className="card cursor-pointer" key={tpl.id} onClick={() => startEdit(tpl)}>
            {tpl.mediaType === "IMAGE" && tpl.mediaPath && (
              <img src={mediaUrl(tpl.mediaPath)} alt="" className="w-full max-h-[120px] object-cover rounded-md" />
            )}
            <h3 className="m-0 text-base font-semibold">{tpl.name}</h3>
            <p className="text-muted text-sm m-0 line-clamp-3 whitespace-pre-wrap">{tpl.body.slice(0, 120)}</p>
            <div className="flex flex-wrap gap-1.5">
              {tpl.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                </span>
              ))}
            </div>
            <button
              className="btn-link-danger"
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
          <div className="modal-panel w-[min(760px,90vw)]" onClick={(e) => e.stopPropagation()}>
            <input
              className="field-input"
              placeholder={t("templates.namePlaceholder")}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <textarea
                className="field-input"
                placeholder={t("templates.bodyPlaceholder")}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={10}
              />
              <div>
                <p className="text-muted text-sm mb-1.5">{t("templates.preview")}</p>
                <WhatsAppPreview
                  botName={t("app.title")}
                  text={draft.body}
                  imageUrl={draft.mediaType === "IMAGE" && draft.mediaPath ? mediaUrl(draft.mediaPath) : null}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-text/70">{t("templates.image")}</span>
              {draft.mediaType === "IMAGE" && draft.mediaPath ? (
                <div className="flex items-center gap-3">
                  <img src={mediaUrl(draft.mediaPath)} alt="" className="w-[72px] h-[72px] object-cover rounded-md shrink-0" />
                  <button
                    type="button"
                    className="btn-link-danger"
                    onClick={() => setDraft({ ...draft, mediaPath: null, mediaType: null })}
                  >
                    {t("templates.removeImage")}
                  </button>
                </div>
              ) : (
                <label className="dropzone">
                  <PaperclipIcon className="text-muted" />
                  <span className="font-mono text-[11px] text-muted">
                    {uploading ? t("templates.uploading") : t("templates.addImageHint")}
                  </span>
                  <span className="btn-ghost">{t("composer.chooseFile")}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void attachImage(file);
                    }}
                  />
                </label>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {draft.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                  <button type="button" className="bg-transparent border-0 text-inherit p-0 leading-none" onClick={() => removeTag(tag)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              className="field-input"
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

            <div className="flex justify-end gap-3 mt-2">
              <button type="button" className="btn-link" onClick={() => setDraft(null)}>
                {t("dashboard.cancel")}
              </button>
              <button type="button" className="btn" onClick={() => void save()}>
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
    </>
  );
}
