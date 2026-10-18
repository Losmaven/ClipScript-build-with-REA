/**
 * ScriptEditor — TipTap-powered transcript/script panel.
 * Left-side panel. Renders word-level marks, toolbar, and word count.
 */

import {
  AlignLeft,
  Bold,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { EditorContent } from '@tiptap/react'
import React from 'react'
import { useScriptEditor } from '../../hooks/useScriptEditor'
import { useAppStore } from '../../store/useAppStore'
import './ScriptEditor.css'

export function ScriptEditor() {
  const setCurrentTime = useAppStore((s) => s.setCurrentTime)
  const isTranscriptSynced = useAppStore((s) => s.isTranscriptSynced)
  const setIsTranscriptSynced = useAppStore((s) => s.setIsTranscriptSynced)

  const { editor } = useScriptEditor({
    onWordClick: (_wordId, startTime) => {
      setCurrentTime(startTime)
    },
  })

  if (!editor) return null

  const ToolbarBtn = ({
    onClick,
    active,
    disabled,
    title,
    children,
  }: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    title: string
    children: React.ReactNode
  }) => (
    <button
      className={`script-toolbar__btn ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
    >
      {children}
    </button>
  )

  return (
    <div className="script-editor">
      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="script-toolbar" role="toolbar" aria-label="Text formatting">
        <ToolbarBtn
          title="Bold (⌘B)"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={14} />
        </ToolbarBtn>

        <ToolbarBtn
          title="Italic (⌘I)"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={14} />
        </ToolbarBtn>

        <ToolbarBtn
          title="Underline (⌘U)"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={14} />
        </ToolbarBtn>

        <ToolbarBtn
          title="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={14} />
        </ToolbarBtn>

        <ToolbarBtn
          title="Highlight"
          active={editor.isActive('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter size={14} />
        </ToolbarBtn>

        <div className="script-toolbar__sep" />

        <ToolbarBtn
          title="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 size={14} />
        </ToolbarBtn>

        <ToolbarBtn
          title="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={14} />
        </ToolbarBtn>

        <ToolbarBtn
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={14} />
        </ToolbarBtn>

        <ToolbarBtn
          title="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={14} />
        </ToolbarBtn>

        <ToolbarBtn
          title="Blockquote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={14} />
        </ToolbarBtn>

        <ToolbarBtn
          title="Align left"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft size={14} />
        </ToolbarBtn>

        <div className="script-toolbar__sep" />

        <ToolbarBtn
          title="Undo (⌘Z)"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={14} />
        </ToolbarBtn>

        <ToolbarBtn
          title="Redo (⌘⇧Z)"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={14} />
        </ToolbarBtn>

        <div className="script-toolbar__sep" />

        {/* Transcript sync toggle */}
        <button
          className={`script-toolbar__sync-btn ${isTranscriptSynced ? 'active' : ''}`}
          onClick={() => setIsTranscriptSynced(!isTranscriptSynced)}
          title={isTranscriptSynced ? 'Transcript sync on — click to disable' : 'Enable transcript sync'}
        >
          <span className="sync-dot" />
          {isTranscriptSynced ? 'Synced' : 'Sync'}
        </button>
      </div>

      {/* ── Editor Area ───────────────────────────────────── */}
      <div className="script-editor__scroll">
        <EditorContent editor={editor} className="script-editor__content" />
      </div>

      {/* ── Footer: Word/Char Count ───────────────────────── */}
      <div className="script-editor__footer">
        <span>{editor.storage.characterCount?.words?.() ?? 0} words</span>
        <span>{editor.storage.characterCount?.characters?.() ?? 0} characters</span>
      </div>
    </div>
  )
}
