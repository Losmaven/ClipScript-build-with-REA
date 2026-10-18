/**
 * useScriptEditor — TipTap editor configuration for the ClipScript script panel.
 *
 * Features:
 * - Full rich-text editing (bold, italic, underline, highlight, headings)
 * - Custom "WordMark" extension to attach transcript word metadata per-run
 * - Soft-delete words (strikethrough + dim) which drive timeline cuts
 * - Bi-directional sync: playhead position → active word highlight
 *   and word click → seek playhead
 */

import CharacterCount from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Mark, mergeAttributes } from '@tiptap/core'
import { useCallback, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

// ─── Custom WordMark Extension ────────────────────────────────────────────────
// Attaches word-level metadata (id, startTime, endTime) as inline marks.
// Used for transcript-to-playhead sync and visual highlighting.

const WordMark = Mark.create({
  name: 'wordMark',
  keepOnSplit: false,
  exitable: true,

  addAttributes() {
    return {
      wordId:    { default: null, parseHTML: (el) => el.getAttribute('data-word-id') },
      startTime: { default: null, parseHTML: (el) => Number(el.getAttribute('data-start')) },
      endTime:   { default: null, parseHTML: (el) => Number(el.getAttribute('data-end')) },
      deleted:   { default: false, parseHTML: (el) => el.getAttribute('data-deleted') === 'true' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-word-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { wordId, startTime, endTime, deleted } = HTMLAttributes
    return [
      'span',
      mergeAttributes(
        {
          'data-word-id': wordId,
          'data-start': startTime,
          'data-end': endTime,
          'data-deleted': deleted,
          class: deleted ? 'word-deleted' : 'word-highlight',
          style: deleted
            ? 'text-decoration: line-through; opacity: 0.4; cursor: pointer;'
            : 'cursor: pointer;',
        },
        HTMLAttributes,
      ),
      0,
    ]
  },
})

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseScriptEditorOptions {
  onWordClick?: (wordId: string, startTime: number) => void
}

export function useScriptEditor({ onWordClick }: UseScriptEditorOptions = {}) {
  const currentTime = useAppStore((s) => s.currentTime)
  const transcript = useAppStore((s) => s.transcript)
  const isTranscriptSynced = useAppStore((s) => s.isTranscriptSynced)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Typography,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: 'Start writing your script, or drop a media file to auto-transcribe…',
      }),
      CharacterCount,
      WordMark,
    ],
    content: '',
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        spellcheck: 'true',
        'data-gramm': 'false', // Disable Grammarly extension interference
      },
      handleClick(view, _pos, event) {
        // Word click → seek playhead
        const target = event.target as HTMLElement
        const wordEl = target.closest('[data-word-id]') as HTMLElement | null
        if (wordEl && onWordClick) {
          const wordId = wordEl.getAttribute('data-word-id') ?? ''
          const startTime = Number(wordEl.getAttribute('data-start') ?? 0)
          onWordClick(wordId, startTime)
          return true
        }
        return false
      },
    },
  })

  // ── Sync transcript data into editor as WordMark nodes ────────────────────
  const loadTranscript = useCallback(() => {
    if (!editor || transcript.length === 0) return

    const paragraphs = transcript.map((seg) => {
      const wordNodes = seg.words.flatMap((w) => [
        {
          type: 'text',
          text: w.text,
          marks: [
            {
              type: 'wordMark',
              attrs: {
                wordId: w.id,
                startTime: w.startTime,
                endTime: w.endTime,
                deleted: w.deleted ?? false,
              },
            },
          ],
        },
        { type: 'text', text: ' ' },
      ])

      const content: typeof wordNodes = []
      if (seg.speaker) {
        content.push({
          type: 'text',
          text: `${seg.speaker}: `,
          marks: [],
        })
      }
      content.push(...wordNodes)

      return { type: 'paragraph', content }
    })

    editor.commands.setContent({ type: 'doc', content: paragraphs })
  }, [editor, transcript])

  useEffect(() => {
    loadTranscript()
  }, [transcript]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync playhead → active word highlight ────────────────────────────────
  useEffect(() => {
    if (!editor || !isTranscriptSynced) return

    // Remove previous active highlight via DOM (avoids ProseMirror transaction overhead)
    document
      .querySelectorAll('.word-active')
      .forEach((el) => el.classList.remove('word-active'))

    // Find the word that spans currentTime
    for (const seg of transcript) {
      for (const word of seg.words) {
        if (!word.deleted && currentTime >= word.startTime && currentTime < word.endTime) {
          const el = document.querySelector(`[data-word-id="${word.id}"]`)
          if (el) {
            el.classList.add('word-active')
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
          break
        }
      }
    }
  }, [currentTime, isTranscriptSynced, transcript, editor])

  return { editor }
}
