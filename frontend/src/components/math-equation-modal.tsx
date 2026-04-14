"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import katex from "katex"
import "katex/dist/katex.min.css"

// ── Symbol groups for virtual keyboard ───────────────────────

const SYMBOL_GROUPS = [
  {
    label: "Operations",
    symbols: [
      { display: "+", latex: "+" },
      { display: "−", latex: "-" },
      { display: "×", latex: "\\times" },
      { display: "÷", latex: "\\div" },
      { display: "=", latex: "=" },
      { display: "≠", latex: "\\neq" },
      { display: "<", latex: "<" },
      { display: ">", latex: ">" },
      { display: "≤", latex: "\\leq" },
      { display: "≥", latex: "\\geq" },
      { display: "±", latex: "\\pm" },
      { display: "≈", latex: "\\approx" },
    ],
  },
  {
    label: "Fractions & Roots",
    symbols: [
      { display: "a/b", latex: "\\frac{}{}" },
      { display: "√", latex: "\\sqrt{}" },
      { display: "∛", latex: "\\sqrt[3]{}" },
      { display: "xⁿ", latex: "^{}" },
      { display: "x²", latex: "^2" },
      { display: "x³", latex: "^3" },
      { display: "xₙ", latex: "_{}" },
      { display: "|x|", latex: "\\left|\\right|" },
    ],
  },
  {
    label: "Greek Letters",
    symbols: [
      { display: "α", latex: "\\alpha" },
      { display: "β", latex: "\\beta" },
      { display: "γ", latex: "\\gamma" },
      { display: "δ", latex: "\\delta" },
      { display: "θ", latex: "\\theta" },
      { display: "λ", latex: "\\lambda" },
      { display: "μ", latex: "\\mu" },
      { display: "π", latex: "\\pi" },
      { display: "σ", latex: "\\sigma" },
      { display: "φ", latex: "\\phi" },
      { display: "ω", latex: "\\omega" },
      { display: "Σ", latex: "\\Sigma" },
      { display: "Δ", latex: "\\Delta" },
      { display: "Ω", latex: "\\Omega" },
    ],
  },
  {
    label: "Calculus & Logic",
    symbols: [
      { display: "∫", latex: "\\int" },
      { display: "∑", latex: "\\sum" },
      { display: "∏", latex: "\\prod" },
      { display: "∂", latex: "\\partial" },
      { display: "∞", latex: "\\infty" },
      { display: "lim", latex: "\\lim_{}" },
      { display: "∀", latex: "\\forall" },
      { display: "∃", latex: "\\exists" },
      { display: "∈", latex: "\\in" },
      { display: "∉", latex: "\\notin" },
      { display: "⊂", latex: "\\subset" },
      { display: "∪", latex: "\\cup" },
      { display: "∩", latex: "\\cap" },
    ],
  },
  {
    label: "Functions",
    symbols: [
      { display: "sin", latex: "\\sin" },
      { display: "cos", latex: "\\cos" },
      { display: "tan", latex: "\\tan" },
      { display: "log", latex: "\\log" },
      { display: "ln", latex: "\\ln" },
      { display: "sin⁻¹", latex: "\\sin^{-1}" },
      { display: "cos⁻¹", latex: "\\cos^{-1}" },
      { display: "tan⁻¹", latex: "\\tan^{-1}" },
    ],
  },
]

// ── Helper: render LaTeX safely ───────────────────────────────

function renderLatex(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
    })
  } catch {
    return latex
  }
}

// ── Exported helper: render text with inline $...$ equations ─

export function renderWithMath(text: string): React.ReactNode[] {
  const parts = text.split(/(\$[^$]+\$)/g)
  return parts.map((part, i) => {
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      const latex = part.slice(1, -1)
      return (
        <span
          key={i}
          dangerouslySetInnerHTML={{ __html: renderLatex(latex) }}
        />
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ── MathEquationModal ─────────────────────────────────────────

interface MathEquationModalProps {
  onInsert: (latex: string) => void
  onClose: () => void
}

export function MathEquationModal({ onInsert, onClose }: MathEquationModalProps) {
  const [latex, setLatex] = useState("")
  const [activeGroup, setActiveGroup] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [previewHtml, setPreviewHtml] = useState("")

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!latex.trim()) {
      setPreviewHtml("")
      return
    }
    setPreviewHtml(renderLatex(latex))
  }, [latex])

  // Insert a symbol at cursor position
  const insertAtCursor = (symbol: string) => {
    const el = inputRef.current
    if (!el) {
      setLatex((prev) => prev + symbol)
      return
    }
    const start = el.selectionStart ?? latex.length
    const end = el.selectionEnd ?? latex.length
    const newVal = latex.slice(0, start) + symbol + latex.slice(end)
    setLatex(newVal)

    // Move cursor into first {} if present
    const cursorOffset = symbol.includes("{}") ? start + symbol.indexOf("{}") + 1 : start + symbol.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursorOffset, cursorOffset)
    })
  }

  const handleInsert = () => {
    if (!latex.trim()) return
    onInsert(`$${latex.trim()}$`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-[580px] flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-display text-ink-primary">∑</span>
            <span className="font-display font-semibold text-base text-ink-primary">Math Equation Editor</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-tertiary hover:text-ink-primary hover:bg-surface-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* LaTeX input */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium font-body text-ink-tertiary">LaTeX Input</label>
            <textarea
              ref={inputRef}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleInsert()
                }
              }}
              placeholder="Type LaTeX here, e.g. \frac{1}{2} or x^2 + y^2"
              rows={3}
              className="w-full px-3 py-2.5 text-sm font-mono text-ink-primary bg-surface-secondary border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors resize-none"
            />
          </div>

          {/* Live preview */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium font-body text-ink-tertiary">Preview</label>
            <div className="min-h-[48px] px-4 py-3 bg-primary-50 border border-primary-100 rounded-[10px] flex items-center">
              {previewHtml ? (
                <span
                  className="text-ink-primary text-base"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <span className="text-[12px] font-body text-ink-tertiary italic">
                  Preview will appear here…
                </span>
              )}
            </div>
          </div>

          {/* Group tabs */}
          <div className="space-y-2">
            <div className="flex gap-1 flex-wrap">
              {SYMBOL_GROUPS.map((g, i) => (
                <button
                  key={g.label}
                  onClick={() => setActiveGroup(i)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold font-body transition-colors ${
                    activeGroup === i
                      ? "bg-primary-500 text-white"
                      : "bg-surface-secondary text-ink-secondary hover:bg-primary-50 hover:text-primary-500"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Symbol grid */}
            <div className="flex flex-wrap gap-1.5">
              {SYMBOL_GROUPS[activeGroup].symbols.map((sym) => (
                <button
                  key={sym.latex}
                  onClick={() => insertAtCursor(sym.latex)}
                  title={sym.latex}
                  className="px-2.5 py-1.5 rounded-[8px] border border-border-default text-sm font-body text-ink-primary hover:border-primary-500 hover:bg-primary-50 hover:text-primary-500 transition-colors min-w-[36px] text-center"
                >
                  {sym.display}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-light shrink-0 flex items-center justify-between gap-3">
          <p className="text-[11px] font-body text-ink-tertiary">
            Equation will be inserted as <code className="bg-surface-secondary px-1 rounded text-[10px]">$…$</code>
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-[10px] border border-border-default text-[13px] font-medium font-body text-ink-secondary hover:border-ink-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={!latex.trim()}
              className="px-4 py-2 rounded-[10px] bg-primary-500 text-white text-[13px] font-semibold font-body hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Insert Equation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
