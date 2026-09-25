import { useEffect, useRef, useState } from 'react'
import { createClient } from './api'
import Chat from './Chat'
import Login from './Login'
import { formatPhone, normalizePhone } from './phone'
import { clearAuth, loadAuth, loadChats, saveAuth, saveChats } from './storage'

function textFrom(data) {
  if (!data) return ''
  if (data.typeMessage === 'textMessage') {
    return data.textMessageData?.textMessage || ''
  }
  if (data.typeMessage === 'extendedTextMessage' || data.typeMessage === 'quotedMessage') {
    return data.extendedTextMessageData?.text || data.textMessageData?.textMessage || ''
  }
  return ''
}

function toMs(timestamp) {
  const n = Number(timestamp)
  if (!Number.isFinite(n) || n <= 0) return Date.now()
  return n < 1e12 ? n * 1000 : n
}

function titleIsPhone(chat) {
  if (!chat.title) return true
  if (chat.title === chat.chatId) return true
  if (chat.phone && chat.title === formatPhone(chat.phone)) return true
  return false
}

function addMessage(prev, chatId, phone, name, message) {
  const idx = prev.findIndex(
    (c) => c.chatId === chatId || (phone && c.phone && c.phone === phone),
  )

  if (idx === -1) {
    return [
      {
        id: chatId,
        chatId,
        phone: phone || '',
        title: name || (phone ? formatPhone(phone) : chatId),
        messages: [message],
      },
      ...prev,
    ]
  }

  const chat = prev[idx]
  if (message.id && chat.messages.some((m) => m.id === message.id)) return prev

  const next = {
    ...chat,
    phone: chat.phone || phone || '',
    title: name && titleIsPhone(chat) ? name : chat.title,
    messages: [...chat.messages, message].sort((a, b) => a.time - b.time),
  }
  const copy = prev.slice()
  copy.splice(idx, 1)
  copy.unshift(next)
  return copy
}

function stateProblem(state) {
  if (state === 'authorized' || state === 'suspended') return ''
  if (state === 'notAuthorized') {
    return 'Инстанс не авторизован. В кабинете GREEN-API нужно войти по QR из приложения MAX.'
  }
  if (state === 'starting') return 'Инстанс запускается. Подождите и войдите ещё раз.'
  if (state === 'blocked') return 'Аккаунт MAX заблокирован.'
  if (state === 'pendingPassword') {
    return 'На MAX стоит пароль входа. Его нужно отключить, иначе QR не авторизует инстанс.'
  }
  return `Сейчас инстанс в состоянии «${state || 'неизвестно'}».`
}

function accountProblem(info) {
  const reason = String(info?.reason || '')
  if (/limit/i.test(reason)) return 'Слишком часто проверяется номер. Подождите и повторите.'
  if (/not authorized|starting/i.test(reason)) return 'Инстанс не авторизован или ещё запускается.'
  if (reason) return reason
  return 'Не удалось проверить номер'
}

function incomingReady(settings) {
  if (!settings) return false
  const hook = settings.webhookUrl
  const empty = hook == null || String(hook).trim() === ''
  return empty && settings.incomingWebhook === 'yes'
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    if (!signal) return
    const stop = () => {
      clearTimeout(timer)
      const err = new Error('aborted')
      err.name = 'AbortError'
      reject(err)
    }
    if (signal.aborted) stop()
    else signal.addEventListener('abort', stop, { once: true })
  })
}

function pollProblem(err) {
  const msg = String(err?.message || '')
  if (/webhook/i.test(msg)) {
    return 'У инстанса всё ещё указан webhook. Подождите минуту и обновите страницу.'
  }
  return msg || 'Не удаётся забрать входящие.'
}

const savedAuth = loadAuth()
const savedChats = savedAuth ? loadChats(savedAuth.idInstance) : { chats: [], activeId: null }

export default function App() {
  const [auth, setAuth] = useState(savedAuth)
  const [chats, setChats] = useState(savedChats.chats)
  const [activeId, setActiveId] = useState(savedChats.activeId)
  const [notice, setNotice] = useState('')
  const [pollError, setPollError] = useState('')

  const chatsRef = useRef(chats)
  const activeIdRef = useRef(activeId)
  chatsRef.current = chats
  activeIdRef.current = activeId

  useEffect(() => {
    if (!auth) return
    saveChats(auth.idInstance, { chats, activeId })
  }, [auth, chats, activeId])

  useEffect(() => {
    if (!auth) return undefined
    const client = createClient(auth)
    const ctrl = new AbortController()
    let stopped = false

    const take = (body, receiptId) => {
      if (!body) return
      const kind = body.typeWebhook
      if (kind !== 'incomingMessageReceived' && kind !== 'outgoingMessageReceived') return
      const text = textFrom(body.messageData).trim()
      if (!text) return
      const sender = body.senderData || {}
      const chatId = sender.chatId ? String(sender.chatId) : ''
      if (!chatId) return
      const phone = sender.senderPhoneNumber ? String(sender.senderPhoneNumber) : ''
      const name = sender.senderContactName || sender.senderName || sender.chatName || ''
      const message = {
        id: body.idMessage || `n-${receiptId}`,
        text,
        out: kind === 'outgoingMessageReceived',
        time: toMs(body.timestamp),
      }
      setChats((prev) => addMessage(prev, chatId, phone, name, message))
    }

    const loop = async () => {
      while (!stopped) {
        try {
          const note = await client.receiveNotification(20, ctrl.signal)
          if (stopped) return
          if (note && note.receiptId != null) {
            take(note.body, note.receiptId)
            try {
              await client.deleteNotification(note.receiptId)
            } catch {
            }
          }
          setPollError('')
        } catch (err) {
          if (stopped || err.name === 'AbortError') return
          setPollError(pollProblem(err))
          try {
            await sleep(3000, ctrl.signal)
          } catch {
            return
          }
        }
      }
    }

    loop()
    return () => {
      stopped = true
      ctrl.abort()
    }
  }, [auth])

  async function login({ apiUrl, idInstance, apiTokenInstance }) {
    const next = {
      apiUrl: apiUrl.trim().replace(/\/+$/, ''),
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    }
    if (!/^https?:\/\//i.test(next.apiUrl)) {
      throw new Error('apiUrl должен начинаться с http:// или https://')
    }
    if (!/^\d+$/.test(next.idInstance)) {
      throw new Error('idInstance должен состоять из цифр')
    }
    if (!next.apiTokenInstance) {
      throw new Error('Введите apiTokenInstance')
    }

    const client = createClient(next)
    const state = await client.getState()
    const problem = stateProblem(state?.stateInstance)
    if (problem) throw new Error(problem)

    const settings = await client.getSettings()
    let restarted = false
    if (!incomingReady(settings)) {
      const saved = await client.setIncoming()
      if (saved && saved.saveSettings === false) {
        throw new Error('Не удалось включить входящие сообщения')
      }
      restarted = true
    }

    const stored = loadChats(next.idInstance)
    saveAuth(next)
    setAuth(next)
    setChats(stored.chats)
    setActiveId(stored.activeId)
    setPollError('')

    const lines = []
    if (state?.stateInstance === 'suspended') {
      lines.push('На аккаунте ограничение: сообщения уйдут только тем, кто сохранил ваш номер.')
    }
    if (restarted) {
      lines.push('Входящие включены по HTTP API. Инстанс может перезапуститься, ответы тогда пойдут через пару минут.')
    }
    setNotice(lines.join(' '))
  }

  function logout() {
    clearAuth()
    setAuth(null)
    setChats([])
    setActiveId(null)
    setNotice('')
    setPollError('')
  }

  async function createChat(rawPhone) {
    const phone = normalizePhone(rawPhone)
    if (phone.length !== 11 && phone.length !== 12) {
      throw new Error('Нужен номер из 11 или 12 цифр, например 79991234567')
    }
    if (!phone.startsWith('7') && !phone.startsWith('375')) {
      throw new Error('Для проверки номера подходят РФ (7…) и Беларусь (375…)')
    }

    const already = chatsRef.current.find((c) => c.phone === phone)
    if (already) {
      setActiveId(already.id)
      return
    }

    const info = await createClient(auth).checkAccount(phone)
    if (info?.exist === false) throw new Error('На этом номере нет аккаунта MAX')
    if (!info?.chatId || info.status === false) throw new Error(accountProblem(info))

    const chatId = String(info.chatId)
    const same = chatsRef.current.find((c) => c.chatId === chatId)
    if (same) {
      setActiveId(same.id)
      return
    }

    setChats((prev) => [
      {
        id: chatId,
        chatId,
        phone,
        title: formatPhone(phone),
        messages: [],
      },
      ...prev,
    ])
    setActiveId(chatId)
  }

  async function sendText(text) {
    const clean = text.trim()
    if (!clean) return
    if (clean.length > 4000) throw new Error('Максимум 4000 символов')

    const chat = chatsRef.current.find((c) => c.id === activeIdRef.current)
    if (!chat) throw new Error('Сначала откройте чат')

    const res = await createClient(auth).sendMessage(chat.chatId, clean)
    setChats((prev) =>
      addMessage(prev, chat.chatId, chat.phone, '', {
        id: res?.idMessage || `local-${Date.now()}`,
        text: clean,
        out: true,
        time: Date.now(),
      }),
    )
  }

  if (!auth) return <Login onSubmit={login} />

  return (
    <Chat
      chats={chats}
      activeId={activeId}
      notice={notice}
      pollError={pollError}
      onSelect={setActiveId}
      onLogout={logout}
      onCreate={createChat}
      onSend={sendText}
      onDismissNotice={() => setNotice('')}
    />
  )
}
