function trimUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

function readError(data, text, status) {
  if (data && typeof data === 'object') {
    if (data.message) return String(data.message)
    if (data.error) return String(data.error)
    if (data.reason) return String(data.reason)
  }
  if (text) return text.slice(0, 300)
  return `Ошибка ${status}`
}

export function createClient({ apiUrl, idInstance, apiTokenInstance }) {
  const root = `${trimUrl(apiUrl)}/waInstance${idInstance}`

  async function call(path, { method = 'GET', body, signal } = {}) {
    const opts = { method, signal }
    if (body !== undefined) {
      opts.headers = { 'Content-Type': 'application/json' }
      opts.body = JSON.stringify(body)
    }

    let res
    try {
      res = await fetch(root + path, opts)
    } catch (err) {
      if (err.name === 'AbortError') throw err
      const wrapped = new Error('Нет ответа от API. Проверьте apiUrl и интернет.')
      wrapped.cause = err
      throw wrapped
    }

    const text = await res.text()
    let data = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = null
      }
    }

    if (!res.ok) {
      const error = new Error(readError(data, text, res.status))
      error.status = res.status
      throw error
    }

    return data
  }

  const token = encodeURIComponent(apiTokenInstance)

  return {
    getState() {
      return call(`/getStateInstance/${token}`)
    },
    getSettings() {
      return call(`/getSettings/${token}`)
    },
    setIncoming() {
      return call(`/setSettings/${token}`, {
        method: 'POST',
        body: {
          webhookUrl: '',
          incomingWebhook: 'yes',
        },
      })
    },
    checkAccount(phoneNumber) {
      return call(`/checkAccount/${token}`, {
        method: 'POST',
        body: { phoneNumber: Number(phoneNumber) },
      })
    },
    sendMessage(chatId, message) {
      return call(`/sendMessage/${token}`, {
        method: 'POST',
        body: { chatId, message },
      })
    },
    receiveNotification(seconds, signal) {
      return call(`/receiveNotification/${token}?receiveTimeout=${seconds}`, { signal })
    },
    deleteNotification(receiptId) {
      return call(`/deleteNotification/${token}/${receiptId}`, { method: 'DELETE' })
    },
  }
}
