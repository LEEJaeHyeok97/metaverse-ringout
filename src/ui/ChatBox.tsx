import { useEffect, useRef, useState, type FormEvent } from 'react'
import { connection, type ChatLine } from '../net/connection'
import { MAX_CHAT_LENGTH } from '../net/protocol'

/** 같은 공간 사람끼리 짧게 말한다. 엔터로 입력창에 들어가고 나온다. */
export function ChatBox({ chats, enabled }: { chats: ChatLine[]; enabled: boolean }) {
  const [text, setText] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && document.activeElement !== field.current && !(document.activeElement instanceof HTMLInputElement)) {
        event.preventDefault()
        field.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [chats])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const message = text.trim()
    if (message) connection.send({ t: 'chat', text: message })
    setText('')
    field.current?.blur()
  }

  return (
    <div className="sketch pointer-events-auto flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-1 p-2 max-sm:w-56">
      <ul ref={list} className="max-h-28 overflow-y-auto text-lg leading-tight max-sm:max-h-16" aria-live="polite">
        {chats.length === 0 && <li className="text-pencil">엔터를 눌러 인사해 보세요</li>}
        {chats.map((line) => (
          <li key={line.key}>
            <b>{line.nickname}</b> {line.text}
          </li>
        ))}
      </ul>
      <form onSubmit={submit}>
        <input
          ref={field}
          value={text}
          disabled={!enabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') field.current?.blur()
          }}
          maxLength={MAX_CHAT_LENGTH}
          placeholder={enabled ? '할 말 (엔터)' : '서버에 연결 중…'}
          className="w-full rounded-lg border-2 border-ink bg-white px-2 py-1 text-lg outline-none focus:border-accent"
        />
      </form>
    </div>
  )
}
