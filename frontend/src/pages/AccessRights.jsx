import { useCallback, useEffect, useState } from 'react'
import { Badge, ErrorState, Spinner } from '../components/ui'
import { fetchAccessRights } from '../services'

const TONES = { full: 'success', read: 'warning', none: 'neutral' }

export default function AccessRights() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchAccessRights())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Droits d&apos;accès</h1>
          <p>
            Répartition des droits par rôle. Cette page est en lecture seule : les droits
            sont déterminés par le rôle attribué à chaque compte.
          </p>
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState error={error} onRetry={load} />}

      {!loading && !error && data && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, marginBottom: 10 }}>Niveaux d&apos;accès</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
              {data.levels.map((level) => (
                <div key={level.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Badge tone={TONES[level.key] ?? 'neutral'}>{level.label}</Badge>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 260 }}>
                    {level.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {data.sections.map((section) => (
            <div key={section.name} className="card" style={{ marginBottom: 20, padding: 0 }}>
              <h2 style={{ fontSize: 15, margin: 0, padding: '14px 16px' }}>{section.name}</h2>
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Module</th>
                      {data.roles.map((role) => (
                        <th key={role.key} style={{ width: 170 }}>{role.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.modules.map((module) => (
                      <tr key={module.key}>
                        <td>
                          <strong>{module.label}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                            {module.description}
                          </div>
                        </td>
                        {data.roles.map((role) => {
                          const levelKey = module.access[role.key]
                          const level = data.levels.find((l) => l.key === levelKey)
                          return (
                            <td key={role.key}>
                              <Badge tone={TONES[levelKey] ?? 'neutral'}>
                                {level?.label ?? '—'}
                              </Badge>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Les niveaux reflètent les permissions appliquées par l&apos;API. Certaines sections
            peuvent être masquées dans l&apos;interface selon le rôle.
          </p>
        </>
      )}
    </>
  )
}
