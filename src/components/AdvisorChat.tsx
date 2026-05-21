import { useMemo, useState } from 'react'
import { Bot, Send, UserRound } from 'lucide-react'
import clsx from 'clsx'
import { answerAdvisorQuestion, advisorSuggestedQuestions, type AdvisorResponse, type FinancialAdvisorData } from '../utils/financialAdvisor'

type ChatMessage = {
  id: string
  role: 'user' | 'advisor'
  text?: string
  response?: AdvisorResponse
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function AdvisorChat({ data }: { data: FinancialAdvisorData }) {
  const suggestedQuestions = useMemo(() => advisorSuggestedQuestions(), [])
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'advisor',
      response: answerAdvisorQuestion('resumen financiero', data),
    },
  ])

  function ask(question: string) {
    const cleanQuestion = question.trim()
    if (!cleanQuestion) return
    const response = answerAdvisorQuestion(cleanQuestion, data)
    setMessages((current) => [
      ...current,
      { id: createId(), role: 'user', text: cleanQuestion },
      { id: createId(), role: 'advisor', response },
    ])
    setInput('')
  }

  return (
    <section className="flex min-h-[640px] flex-col rounded-lg border border-line bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-line p-4 dark:border-slate-800 sm:p-5">
        <h3 className="text-lg font-semibold text-ink dark:text-white">Chat financiero</h3>
        <p className="mt-1 text-sm text-muted dark:text-slate-400">
          Pregunta sobre gastos, deudas, metas, presupuesto o compras posibles.
        </p>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {suggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => ask(question)}
              className="shrink-0 rounded-full border border-line px-3 py-2 text-xs font-semibold text-slate-600 hover:border-brand-500/40 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-100"
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      <form
        className="border-t border-line p-3 dark:border-slate-800 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault()
          ask(input)
        }}
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-3 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20"
            placeholder="Ej. Puedo gastar RD$1500 este mes?"
          />
          <button
            type="submit"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700"
            aria-label="Enviar pregunta"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </section>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <article className={clsx('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser ? (
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
          <Bot className="h-5 w-5" />
        </div>
      ) : null}
      <div
        className={clsx(
          'max-w-[92%] rounded-lg px-4 py-3 sm:max-w-[78%]',
          isUser
            ? 'bg-brand-600 text-white'
            : 'border border-line bg-slate-50 text-ink dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100',
        )}
      >
        {isUser ? (
          <p className="text-sm leading-6">{message.text}</p>
        ) : message.response ? (
          <AdvisorResponseView response={message.response} />
        ) : null}
      </div>
      {isUser ? (
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <UserRound className="h-5 w-5" />
        </div>
      ) : null}
    </article>
  )
}

function AdvisorResponseView({ response }: { response: AdvisorResponse }) {
  return (
    <div className="space-y-3 text-sm leading-6">
      <div>
        <p className="font-semibold text-ink dark:text-white">{response.title}</p>
        <p className="mt-1 text-slate-600 dark:text-slate-300">{response.diagnosis}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {response.keyNumbers.map((item) => (
          <div key={item.label} className="rounded-lg bg-white p-2 dark:bg-slate-900">
            <p className="text-xs text-muted dark:text-slate-400">{item.label}</p>
            <p className="mt-0.5 font-semibold text-ink dark:text-white">{item.value}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-100">Recomendacion</p>
        <p className="mt-1 text-slate-700 dark:text-slate-200">{response.recommendation}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-600 dark:text-gold-300">Siguiente accion</p>
        <p className="mt-1 text-slate-700 dark:text-slate-200">{response.nextAction}</p>
      </div>
    </div>
  )
}
