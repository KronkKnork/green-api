import { useState } from 'react'

export default function Login({ onSubmit }) {
  const [apiUrl, setApiUrl] = useState('https://api.green-api.com')
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit({ apiUrl, idInstance, apiTokenInstance })
    } catch (err) {
      setError(err.message || 'Не удалось войти')
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h1>MAX</h1>
        <p className="lead">Данные инстанса из личного кабинета GREEN-API</p>

        <label>
          apiUrl
          <input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.green-api.com"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          idInstance
          <input
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          apiTokenInstance
          <input
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
