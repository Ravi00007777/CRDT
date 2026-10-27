import { useState, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';

function Btn({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={onClick}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-sm transition disabled:opacity-30 ${active ? 'bg-ink text-white' : 'text-ink hover:bg-black/5'}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-line" aria-hidden />;

export function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      href: e.getAttributes('link').href as string | undefined,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const c = () => editor.chain().focus();

  function applyLink(raw: string) {
    setLinkOpen(false);
    const url = raw.trim();
    if (!url) return c().extendMarkRange('link').unsetLink().run();
    const href = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
    c().extendMarkRange('link').setLink({ href }).run();
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="relative flex flex-wrap items-center gap-0.5">
      <Btn label="Undo (⌘Z)" disabled={!s.canUndo} onClick={() => c().undo().run()}>↶</Btn>
      <Btn label="Redo (⇧⌘Z)" disabled={!s.canRedo} onClick={() => c().redo().run()}>↷</Btn>
      <Sep />
      <Btn label="Heading 1" active={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()}><b>H1</b></Btn>
      <Btn label="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><b>H2</b></Btn>
      <Btn label="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><b>H3</b></Btn>
      <Sep />
      <Btn label="Bold (⌘B)" active={s.bold} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
      <Btn label="Italic (⌘I)" active={s.italic} onClick={() => c().toggleItalic().run()}><i className="font-serif">I</i></Btn>
      <Btn label="Underline (⌘U)" active={s.underline} onClick={() => c().toggleUnderline().run()}><u>U</u></Btn>
      <Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}><s>S</s></Btn>
      <Btn label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}><code className="text-xs">{'</>'}</code></Btn>
      <Btn label="Link" active={s.link} onClick={() => setLinkOpen((o) => !o)}>🔗</Btn>
      <Sep />
      <Btn label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>•≡</Btn>
      <Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>1≡</Btn>
      <Btn label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>❝</Btn>
      <Btn label="Divider" onClick={() => c().setHorizontalRule().run()}>―</Btn>

      {linkOpen && (
        <form
          onSubmit={(e) => { e.preventDefault(); applyLink(String(new FormData(e.currentTarget).get('url'))); }}
          className="absolute left-0 top-10 z-30 flex gap-2 rounded-lg border border-line bg-white p-2 shadow-lg"
        >
          <input name="url" autoFocus defaultValue={s.href ?? ''} placeholder="https://example.com" aria-label="Link URL"
            onKeyDown={(e) => e.key === 'Escape' && setLinkOpen(false)}
            className="w-64 rounded-md border border-line px-2 py-1 text-sm outline-none focus:border-ink/40" />
          <button className="rounded-md bg-ink px-3 text-sm text-white">Apply</button>
        </form>
      )}
    </div>
  );
}
