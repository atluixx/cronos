import { describe, expect, it } from "vitest";
import { renderWhatsAppMarkdown } from "./whatsappMarkdown";

describe("renderWhatsAppMarkdown", () => {
  it("renders single-asterisk bold, not CommonMark double-asterisk", () => {
    expect(renderWhatsAppMarkdown("*bold*")).toBe("<div><strong>bold</strong></div>");
  });

  it("renders italic and strikethrough", () => {
    expect(renderWhatsAppMarkdown("_italic_")).toBe("<div><em>italic</em></div>");
    expect(renderWhatsAppMarkdown("~gone~")).toBe("<div><del>gone</del></div>");
  });

  it("renders inline monospace", () => {
    expect(renderWhatsAppMarkdown("```code```")).toBe("<div><code>code</code></div>");
  });

  it("does not render a marker with a space touching it (WhatsApp's own rule)", () => {
    expect(renderWhatsAppMarkdown("* not bold*")).not.toContain("<strong>");
  });

  it("combines multiple inline styles in one line", () => {
    expect(renderWhatsAppMarkdown("*bold* and _italic_")).toBe(
      "<div><strong>bold</strong> and <em>italic</em></div>",
    );
  });

  it("escapes HTML to avoid injection in the preview", () => {
    expect(renderWhatsAppMarkdown("<script>alert(1)</script>")).toBe(
      "<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>",
    );
  });

  it("renders a bullet list from consecutive '- ' lines", () => {
    expect(renderWhatsAppMarkdown("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders a bullet list from '* ' lines without confusing it with bold", () => {
    expect(renderWhatsAppMarkdown("* one\n* two")).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders a numbered list from '1. ' style lines", () => {
    expect(renderWhatsAppMarkdown("1. first\n2. second")).toBe("<ol><li>first</li><li>second</li></ol>");
  });

  it("closes a list when a non-list line follows", () => {
    expect(renderWhatsAppMarkdown("- item\nplain text")).toBe("<ul><li>item</li></ul><div>plain text</div>");
  });

  it("renders plain text with no markers untouched", () => {
    expect(renderWhatsAppMarkdown("hello world")).toBe("<div>hello world</div>");
  });
});
