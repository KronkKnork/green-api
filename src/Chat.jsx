import { useEffect, useRef, useState } from 'react'
import { formatPhone } from './phone'

function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(ts) {
  return new Date(ts).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function clock(ts) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function avatarColor(id) {
  const palette = ['#5b8def', '#7c6cf0', '#c86b8a', '#3fad90', '#d09a45', '#6a8caf']
  let n = 0
  const s = String(id || '')
  for (let i = 0; i < s.length; i += 1) n += s.charCodeAt(i)
  return palette[n % palette.length]
}

function avatarText(chat) {
  if (chat.phone) return chat.phone.slice(-2)
  const letter = String(chat.title || '?').trim().charAt(0)
  return letter.toUpperCase() || '?'
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7.2a1.5 1.5 0 0 1-1.5 1.5H9l-3.6 2.6v-2.6H5A1.5 1.5 0 0 1 3.5 15.2V8A1.5 1.5 0 0 1 5 6.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13.2 6.2l4.6 4.6M4.8 19.2l1-4.2 9.2-9.2a1.6 1.6 0 0 1 2.3 0l1.1 1.1a1.6 1.6 0 0 1 0 2.3l-9.2 9.2-4.4.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconOut() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10 7V5.8A1.8 1.8 0 0 1 11.8 4h6.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8h-6.4A1.8 1.8 0 0 1 10 18.2V17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M4 12h10M11 8.5L14.5 12 11 15.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Chat({
  chats,
  activeId,
  notice,
  pollError,
  onSelect,
  onLogout,
  onCreate,
  onSend,
  onDismissNotice,
}) {
  const [phone, setPhone] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [drafts, setDrafts] = useState({})
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const phoneRef = useRef(null)
  const streamRef = useRef(null)
  const areaRef = useRef(null)

  const active = chats.find((c) => c.id === activeId) || null
  const draft = active ? drafts[active.id] || '' : ''

  useEffect(() => {
    const el = streamRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [activeId, active?.messages.length])

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [draft, activeId])

  async function create(e) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      await onCreate(phone)
      setPhone('')
    } catch (err) {
      setCreateError(err.message || 'Не удалось создать чат')
    } finally {
      setCreating(false)
    }
  }

  async function send(e) {
    e?.preventDefault()
    const text = draft
    if (!text.trim() || sending || !active) return
    setSending(true)
    setSendError('')
    try {
      await onSend(text)
      setDrafts((prev) => ({ ...prev, [active.id]: '' }))
    } catch (err) {
      setSendError(err.message || 'Не отправилось')
    } finally {
      setSending(false)
    }
  }

  function onDraftKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  let lastDay = ''

  return (
    <div className={active ? 'app has-chat' : 'app'}>
      <aside className="rail">
        <div className="rail-mark" aria-hidden="true">M</div>
        <button className="rail-btn" type="button" title="Новый чат" onClick={() => phoneRef.current?.focus()}>
          <IconPencil />
        </button>
        <div className="rail-btn active" title="Чаты">
          <IconChat />
        </div>
        <div className="rail-gap" />
        <button className="rail-btn" type="button" title="Выйти" onClick={onLogout}>
          <IconOut />
        </button>
      </aside>

      <aside className="list">
        <div className="list-head">Чаты</div>
        <form className="new-chat" onSubmit={create}>
          <input
            ref={phoneRef}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Номер, 79991234567"
            inputMode="tel"
            autoComplete="off"
          />
          <button className="btn" type="submit" disabled={creating || !phone.trim()}>
            {creating ? '…' : 'Создать'}
          </button>
        </form>
        {createError && <p className="error list-error">{createError}</p>}

        <div className="items">
          {chats.length === 0 && <p className="empty">Чатов пока нет. Введите номер получателя.</p>}
          {chats.map((chat) => {
            const last = chat.messages[chat.messages.length - 1]
            return (
              <button
                key={chat.id}
                type="button"
                className={chat.id === activeId ? 'item active' : 'item'}
                onClick={() => onSelect(chat.id)}
              >
                <span className="avatar" style={{ background: avatarColor(chat.id) }}>
                  {avatarText(chat)}
                </span>
                <span className="item-body">
                  <span className="item-top">
                    <span className="item-name">{chat.title}</span>
                    {last && <span className="item-time">{clock(last.time)}</span>}
                  </span>
                  <span className="item-text">{last ? last.text : 'Нет сообщений'}</span>
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="pane">
        {!active && (
          <div className="placeholder">
            <p>Выберите чат или создайте новый по номеру телефона.</p>
          </div>
        )}

        {active && (
          <>
            <header className="top">
              <button className="back" type="button" onClick={() => onSelect(null)} aria-label="К списку чатов">
                ←
              </button>
              <span className="avatar" style={{ background: avatarColor(active.id) }}>
                {avatarText(active)}
              </span>
              <div className="who">
                <div className="name">{active.title}</div>
                {active.phone && active.title !== formatPhone(active.phone) && (
                  <div className="sub">{formatPhone(active.phone)}</div>
                )}
              </div>
            </header>

            {notice && (
              <div className="banner">
                <span>{notice}</span>
                <button type="button" onClick={onDismissNotice} aria-label="Скрыть">
                  ×
                </button>
              </div>
            )}
            {pollError && <div className="banner warn">{pollError}</div>}

            <div className="stream" ref={streamRef}>
              {active.messages.map((message) => {
                const day = dayKey(message.time)
                const showDay = day !== lastDay
                lastDay = day
                return (
                  <div key={message.id}>
                    {showDay && <div className="day">{dayLabel(message.time)}</div>}
                    <div className={message.out ? 'row out' : 'row'}>
                      <div className={message.out ? 'bubble out' : 'bubble in'}>
                        <span>{message.text}</span>
                        <time>{clock(message.time)}</time>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <form className="composer" onSubmit={send}>
              <textarea
                ref={areaRef}
                rows={1}
                value={draft}
                placeholder="Сообщение"
                onChange={(e) => {
                  const value = e.target.value
                  setDrafts((prev) => ({ ...prev, [active.id]: value }))
                  setSendError('')
                }}
                onKeyDown={onDraftKey}
              />
              <button className="send" type="submit" disabled={sending || !draft.trim()} aria-label="Отправить">
                <IconSend />
              </button>
              {sendError && <p className="error send-error">{sendError}</p>}
            </form>
          </>
        )}
      </section>
    </div>
  )
}
