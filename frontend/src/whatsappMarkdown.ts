/**
 * Renders WhatsApp's specific markdown subset to HTML for the template preview pane.
 * This is intentionally NOT a general markdown renderer: WhatsApp uses single
 * markers (*bold*, _italic_, ~strike~) rather than CommonMark's double-marker
 * bold (**bold**), so a generic MD library would over-render (turn a single
 * `*word*` into <em> instead of <strong>).
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline formatting only — assumes HTML-escaped input, applied within a single line. */
function renderInline(escaped: string): string {
  return escaped
    .replace(/```([^`\n]+?)```/g, "<code>$1</code>")
    .replace(/\*([^\s*][^*]*?)\*/g, "<strong>$1</strong>")
    .replace(/_([^\s_][^_]*?)_/g, "<em>$1</em>")
    .replace(/~([^\s~][^~]*?)~/g, "<del>$1</del>");
}

const BULLET_RE = /^[-*]\s+(.*)$/;
const NUMBERED_RE = /^\d+\.\s+(.*)$/;

export function renderWhatsAppMarkdown(source: string): string {
  const lines = source.split("\n");
  const htmlParts: string[] = [];
  let listType: "ul" | "ol" | null = null;

  function closeList() {
    if (listType) {
      htmlParts.push(listType === "ul" ? "</ul>" : "</ol>");
      listType = null;
    }
  }

  for (const rawLine of lines) {
    const bulletMatch = rawLine.match(BULLET_RE);
    const numberedMatch = !bulletMatch && rawLine.match(NUMBERED_RE);

    if (bulletMatch) {
      if (listType !== "ul") {
        closeList();
        htmlParts.push("<ul>");
        listType = "ul";
      }
      htmlParts.push(`<li>${renderInline(escapeHtml(bulletMatch[1]))}</li>`);
      continue;
    }

    if (numberedMatch) {
      if (listType !== "ol") {
        closeList();
        htmlParts.push("<ol>");
        listType = "ol";
      }
      htmlParts.push(`<li>${renderInline(escapeHtml(numberedMatch[1]))}</li>`);
      continue;
    }

    closeList();
    if (rawLine.trim() === "") {
      htmlParts.push("<br>");
    } else {
      htmlParts.push(`<div>${renderInline(escapeHtml(rawLine))}</div>`);
    }
  }
  closeList();

  return htmlParts.join("");
}
