import { useMemo, useState } from 'react'
import { Bot, Sparkles, Send, UserRound } from 'lucide-react'
import clsx from 'clsx'
import {
  advisorQuickActions,
  advisorSuggestedQuestions,
  answerAdvisorQuestion,
  type AdvisorAutoInsight,
  type AdvisorContext,
  type AdvisorResponse,
  type FinancialAdvisorData,
} from '../utils/financialAdvisor'

type ChatMessage = {
  id: string
  role: 'user' | 'advisor'
  text?: string
  response?: AdvisorResponse
}

const MAX_RECENT_QUESTIONS = 4

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function responseContext(response: AdvisorResponse, previous: AdvisorContext): AdvisorContext {
  return {
    ...previous,
    lastIntent: response.intent,
    lastTopic: response.title,
  }
}

export function AdvisorChat({
  data,
  autoInsights,
}: {
  data: FinancialAdvisorData
  autoInsights: AdvisorAutoInsight[]
}) {
  const suggestedQuestions = useMemo(() => advisorSuggestedQuestions(), [])
  const quickActions = useMemo(() => advisorQuickActions(), [])
  const [input, setInput] = useState('')
  const [memory, setMemory] = useState<AdvisorContext>({})
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
    const context: AdvisorContext = {
      ...memory,
      recentQuestions: [...(memory.recentQuestions ?? []), cleanQuestion].slice(-MAX_RECENT_QUESTIONS),
    }
    const response = answerAdvisorQuestion(cleanQuestion, data, context)
    setMessages((current) => [
      ...current,
      { id: createId(), role: 'user', text: cleanQuestion },
      { id: createId(), role: 'advisor', response },
    ])
    setMemory({
      ...responseContext(response, context),
      recentQuestions: context.recentQuestions,
    })
    setInput('')
  }

  return (
    <section className="premium-card flex min-h-[560px] flex-col overflow-hidden rounded-lg border border-line bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90 lg:min-h-[640px]">
      <div className="border-b border-line bg-gradient-to-br from-brand-50 via-white to-slate-50 p-3 dark:border-slate-800 dark:from-brand-500/10 dark:via-slate-900 dark:to-slate-900 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink dark:text-white sm:text-lg">Chat financiero</h3>
            <p className="mt-1 text-xs leading-5 text-muted dark:text-slate-400 sm:text-sm">
              Pregunta por gastos, deudas, metas o compras. Recuerda el contexto de esta sesion.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-brand-500/20 bg-white/80 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:border-brand-400/20 dark:bg-slate-950/70 dark:text-brand-100">
            Reglas locales
          </span>
        </div>

        {autoInsights.length ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {autoInsights.map((insight) => (
              <div
                key={insight.id}
                className={clsx(
                  'w-64 shrink-0 rounded-lg border px-3 py-2 text-xs leading-5 shadow-sm',
                  insight.tone === 'danger' && 'border-coral-500/25 bg-coral-50 text-coral-700 dark:border-coral-400/20 dark:bg-coral-500/10 dark:text-coral-300',
                  insight.tone === 'warning' && 'border-gold-500/25 bg-gold-50 text-gold-700 dark:border-gold-400/20 dark:bg-gold-500/10 dark:text-gold-300',
                  insight.tone === 'positive' && 'border-brand-500/25 bg-brand-50 text-brand-700 dark:border-brand-400/20 dark:bg-brand-500/10 dark:text-brand-100',
                  insight.tone === 'neutral' && 'border-line bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
                )}
              >
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{insight.title}</p>
                    <p className="mt-0.5 line-clamp-2 opacity-80">{insight.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => ask(action.question)}
              className="shrink-0 rounded-full border border-brand-500/20 bg-white px-3 py-2 text-xs font-semibold text-brand-700 shadow-sm hover:-translate-y-0.5 hover:border-brand-500/40 hover:bg-brand-50 dark:border-brand-400/20 dark:bg-slate-950 dark:text-brand-100 dark:hover:bg-brand-500/10"
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {suggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => ask(question)}
              className="shrink-0 rounded-full border border-line bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 hover:-translate-y-0.5 hover:border-brand-500/40 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-100"
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-5">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      <form
        className="sticky bottom-0 border-t border-line bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault()
          ask(input)
        }}
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20"
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
    <article className={clsx('flex gap-2 sm:gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser ? (
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100 sm:h-9 sm:w-9">
          <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      ) : null}
      <div
        className={clsx(
          'max-w-[94%] rounded-lg px-3 py-2.5 sm:max-w-[78%] sm:px-4 sm:py-3',
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
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:h-9 sm:w-9">
          <UserRound className="h-4 w-4 sm:h-5 sm:w-5" />
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {response.keyNumbers.map((item) => (
          <div key={item.label} className="rounded-lg bg-white p-2 dark:bg-slate-900">
            <p className="text-xs text-muted dark:text-slate-400">{item.label}</p>
            <p className="mt-0.5 font-semibold text-ink dark:text-white">{item.value}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-100">Analisis</p>
        <p className="mt-1 text-slate-700 dark:text-slate-200">{response.recommendation}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-600 dark:text-gold-300">Siguiente accion</p>
        <p className="mt-1 text-slate-700 dark:text-slate-200">{response.nextAction}</p>
      </div>
    </div>
  )
}
