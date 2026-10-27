import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { Placeholder } from '@tiptap/extensions';
import type { CollabSession } from './useCollab';
import { Toolbar } from './Toolbar';

type Props = { session: CollabSession; user: { id: string; name: string; color: string } };

export function CollabEditor({ session, user }: Props) {
  const editor = useEditor(
    {
      extensions: [
        // Yjs owns history; StarterKit's local undo stack would fight it.
        StarterKit.configure({ undoRedo: false, link: { openOnClick: false, autolink: true } }),
        Placeholder.configure({ placeholder: 'Start writing…' }),
        Collaboration.configure({ document: session.doc }),
        CollaborationCaret.configure({ provider: session.provider, user }),
      ],
      editorProps: { attributes: { class: 'doc-body', 'aria-label': 'Document body', spellcheck: 'true' } },
    },
    [session],
  );

  if (!editor) return null;
  return (
    <>
      <div className="sticky top-14 z-10 -mx-2 mb-8 border-b border-line bg-paper/95 px-2 py-2 backdrop-blur">
        <Toolbar editor={editor} />
      </div>
      <EditorContent editor={editor} />
    </>
  );
}
