const AUTH = 'max.auth'

function chatsKey(idInstance) {
  return `max.chats.${idInstance}`
}

export function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data.idInstance || !data.apiTokenInstance || !data.apiUrl) return null
    return data
  } catch {
    return null
  }
}

export function saveAuth(auth) {
  localStorage.setItem(AUTH, JSON.stringify(auth))
}

export function clearAuth() {
  localStorage.removeItem(AUTH)
}

export function loadChats(idInstance) {
  try {
    const raw = localStorage.getItem(chatsKey(idInstance))
    if (!raw) return { chats: [], activeId: null }
    const data = JSON.parse(raw)
    return {
      chats: Array.isArray(data.chats) ? data.chats : [],
      activeId: data.activeId || null,
    }
  } catch {
    return { chats: [], activeId: null }
  }
}

export function saveChats(idInstance, payload) {
  localStorage.setItem(chatsKey(idInstance), JSON.stringify(payload))
}
