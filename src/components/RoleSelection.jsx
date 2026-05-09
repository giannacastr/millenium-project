import { ROLE_OPTIONS } from '../data/constants'

function RoleSelection({ profile, setProfile, onEnter }) {
  return (
    <section className="card role-selection">
      <h1>Equity Order Ticket System</h1>
      <p>Select a role to load the matching front-end while sharing one data model.</p>
      <div className="form-grid">
        <label>
          Name
          <input
            value={profile.name}
            onChange={(event) =>
              setProfile((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="Enter your name"
          />
        </label>
        <label>
          Role
          <select
            value={profile.role}
            onChange={(event) =>
              setProfile((prev) => ({ ...prev, role: event.target.value }))
            }
          >
            <option value="">Select a role</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" onClick={onEnter} disabled={!profile.name || !profile.role}>
        Enter Platform
      </button>
    </section>
  )
}

export default RoleSelection
