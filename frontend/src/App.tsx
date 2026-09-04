import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Swal from 'sweetalert2'
import heroImage from './assets/hero.png'
import './App.css'

const apiURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

const defaultForm = {
  name: '',
  code: '',
  address: '',
  description: '',
  floors: '2',
  status: 'Active',
}

const defaultTenantForm = {
  type: 'Person',
  full_name: '',
  company_name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  id_number: '',
  notes: '',
}

const defaultUnitForm = {
  number: '',
  type: 'Residential',
  description: '',
  bedrooms: '0',
  bathrooms: '0',
  size: '',
  status: 'Vacant',
}

const defaultContractForm = {
  tenant_id: '',
  unit_id: '',
  contract_type: 'Residential',
  start_date: '',
  end_date: '',
  monthly_rent: '0',
  payment_method: 'Bank Transfer',
  payment_frequency: 'Monthly',
  utility_responsibility: 'Tenant pays electricity and water',
  terms: '',
  status: 'Active',
  notes: '',
}

const defaultPaymentForm = {
  invoice_id: '',
  amount: '',
  payment_date: new Date().toISOString().slice(0, 10),
  payment_method: 'Bank Transfer',
  payment_reference: '',
  receipt_number: '',
  notes: '',
}

type BuildingRecord = {
  id: string
  name: string
  code: string
  address: string
  description?: string
  floors: number
  status: string
}

type TenantRecord = {
  id: string
  type: string
  full_name?: string
  company_name?: string
  phone?: string
  email?: string
}

type UnitRecord = {
  id: string
  building_id: string
  number: string
  type: string
  bedrooms: number
  bathrooms: number
  size?: string
  status: string
}

type ContractRecord = {
  id: string
  unit_id: string
  tenant_id: string
  contract_type: string
  monthly_rent: number
  payment_method?: string
  payment_frequency?: string
  utility_responsibility?: string
  status: string
}

type InvoiceRecord = {
  id: string
  number: string
  amount: number
  status: string
}

type PaymentRecord = {
  id: string
  invoice_id: string
  payment_reference: string
  amount: number
  payment_date: string
  payment_method: string
  receipt_number?: string
}

type DashboardStats = {
  buildings: number
  floors: number
  units: number
  tenants: number
  contracts: number
  invoices: number
}

type Session = {
  token: string
  user: {
    username: string
    full_name: string
    roles: string[]
  }
}

type View = 'hq' | 'buildings' | 'units' | 'tenants' | 'contracts' | 'invoices' | 'payments' | 'settings'

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const stored = localStorage.getItem('masco-session')
    return stored ? JSON.parse(stored) as Session : null
  })
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [buildings, setBuildings] = useState<BuildingRecord[]>([])
  const [tenants, setTenants] = useState<TenantRecord[]>([])
  const [units, setUnits] = useState<UnitRecord[]>([])
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [stats, setStats] = useState<DashboardStats>({ buildings: 0, floors: 0, units: 0, tenants: 0, contracts: 0, invoices: 0 })
  const [form, setForm] = useState(defaultForm)
  const [tenantForm, setTenantForm] = useState(defaultTenantForm)
  const [unitForm, setUnitForm] = useState(defaultUnitForm)
  const [contractForm, setContractForm] = useState(defaultContractForm)
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm)
  const [documentContractID, setDocumentContractID] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [view, setView] = useState<View>('hq')
  const [selectedBuildingID, setSelectedBuildingID] = useState(() => localStorage.getItem('masco-building-id') ?? 'hq')
  const [formError, setFormError] = useState('')
  const [profileForm, setProfileForm] = useState({ full_name: session?.user.full_name ?? '', email: '' })
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })

  const logout = () => {
    localStorage.removeItem('masco-session')
    setSession(null)
  }

  const sessionExpiredRef = useRef(false)

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${apiURL}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${session?.token ?? ''}` },
    })
    if (response.status === 401 && !sessionExpiredRef.current) {
      sessionExpiredRef.current = true
      logout()
      void Swal.fire({ icon: 'info', title: 'Session expired', text: 'Please sign in again.', confirmButtonColor: '#133d32' })
    }
    return response
  }

  const showRequestError = async (response: Response, fallback: string) => {
    const payload = await response.json().catch(() => ({ error: fallback })) as { error?: string }
    await Swal.fire({ icon: 'error', title: 'Could not complete request', text: payload.error ?? fallback, confirmButtonColor: '#133d32' })
  }

  const showSuccess = (title: string) => Swal.fire({ icon: 'success', title, timer: 1600, showConfirmButton: false })

  const loadData = async () => {
    if (!session) return
    try {
        const [buildingsResponse, tenantsResponse, contractsResponse, invoicesResponse, paymentsResponse, dashboardResponse] = await Promise.all([
        apiFetch('/buildings'),
        apiFetch(`/tenants${selectedBuildingID === 'hq' ? '' : `?building_id=${selectedBuildingID}`}`),
        apiFetch(`/contracts${selectedBuildingID === 'hq' ? '' : `?building_id=${selectedBuildingID}`}`),
        apiFetch(`/invoices${selectedBuildingID === 'hq' ? '' : `?building_id=${selectedBuildingID}`}`),
        apiFetch(`/payments${selectedBuildingID === 'hq' ? '' : `?building_id=${selectedBuildingID}`}`),
        apiFetch(`/dashboard${selectedBuildingID === 'hq' ? '' : `?building_id=${selectedBuildingID}`}`),
      ])

      const buildingData = await buildingsResponse.json()
      const tenantData = await tenantsResponse.json()
      const contractData = await contractsResponse.json()
      const invoiceData = await invoicesResponse.json()
      const paymentData = await paymentsResponse.json()
      const dashboardData = await dashboardResponse.json()

      setBuildings(buildingData.data ?? [])
      setTenants(tenantData.data ?? [])
      setContracts(contractData.data ?? [])
      setInvoices(invoiceData.data ?? [])
      setPayments(paymentData.data ?? [])
      setStats(dashboardData.data ?? { buildings: 0, floors: 0, units: 0, tenants: 0, contracts: 0, invoices: 0 })
    } catch {
      setBuildings([])
      setTenants([])
      setContracts([])
      setInvoices([])
        setPayments([])
      setStats({ buildings: 0, floors: 0, units: 0, tenants: 0, contracts: 0, invoices: 0 })
    }
  }

  useEffect(() => {
    if (session) void loadData()
  }, [session, selectedBuildingID])

  useEffect(() => {
    if (!session) return
    void apiFetch('/auth/me').then((response) => response.ok ? response.json() : null).then((user) => {
      if (user) setProfileForm({ full_name: user.full_name, email: user.email })
    }).catch(() => {})
  }, [session])

  useEffect(() => {
    localStorage.setItem('masco-building-id', selectedBuildingID)
    if (!session || selectedBuildingID === 'hq') {
      setUnits([])
      return
    }
    void apiFetch(`/buildings/${selectedBuildingID}/units`).then((response) => response.json()).then((payload) => setUnits(payload.data ?? [])).catch(() => setUnits([]))
  }, [selectedBuildingID, session])

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setLoginError('')
    const response = await fetch(`${apiURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm),
    })
    if (!response.ok) {
      setLoginError('Invalid username or password.')
      await showRequestError(response, 'Invalid username or password.')
      return
    }
    const nextSession = await response.json() as Session
    localStorage.setItem('masco-session', JSON.stringify(nextSession))
    sessionExpiredRef.current = false
    setSession(nextSession)
    void showSuccess('Welcome back')
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleTenantChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setTenantForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleUnitChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setUnitForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleUnitSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (selectedBuildingID === 'hq') {
      await Swal.fire({ icon: 'info', title: 'Choose a building first', text: 'Select the building this unit belongs to from the portfolio context selector.', confirmButtonColor: '#133d32' })
      return
    }
    const response = await apiFetch(`/buildings/${selectedBuildingID}/units`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...unitForm, bedrooms: Number(unitForm.bedrooms), bathrooms: Number(unitForm.bathrooms) }) })
    if (!response.ok) {
      await showRequestError(response, 'Could not save unit.')
      return
    }
    const payload = await apiFetch(`/buildings/${selectedBuildingID}/units`)
    const data = await payload.json()
    setUnits(data.data ?? [])
    setUnitForm(defaultUnitForm)
    void showSuccess('Unit saved')
  }

  const handleContractChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setContractForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handlePaymentChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setPaymentForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    setFormError('')

    const response = await apiFetch('/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        floors: Number(form.floors),
      }),
    })

    if (response.ok) {
      await loadData()
      setForm(defaultForm)
      setView('hq')
      void showSuccess('Building saved')
    } else {
      const error = await response.json().catch(() => ({ error: 'Could not save building.' })) as { error?: string }
      setFormError(error.error ?? 'Could not save building.')
      await Swal.fire({ icon: 'error', title: 'Building not saved', text: error.error ?? 'Could not save building.', confirmButtonColor: '#133d32' })
    }
  }

  const handleTenantSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const response = await apiFetch('/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenantForm),
    })

    if (response.ok) {
      await loadData()
      setTenantForm(defaultTenantForm)
      void showSuccess('Tenant saved')
    } else {
      await showRequestError(response, 'Could not save tenant.')
    }
  }

  const handleContractSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const response = await apiFetch('/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...contractForm,
        monthly_rent: Number(contractForm.monthly_rent),
      }),
    })

    if (response.ok) {
      await loadData()
      setContractForm(defaultContractForm)
      void showSuccess('Contract saved')
    } else {
      await showRequestError(response, 'Could not save contract.')
    }
  }

  const handleGenerateInvoice = async (contractID: string) => {
    const response = await apiFetch(`/contracts/${contractID}/invoices`, { method: 'POST' })
    if (!response.ok) {
      await showRequestError(response, 'Could not generate invoice.')
      return
    }
    await loadData()
    void showSuccess('Invoice generated')
  }

  const handlePaymentSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const response = await apiFetch('/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...paymentForm, amount: Number(paymentForm.amount) }) })
    if (!response.ok) {
      await showRequestError(response, 'Could not record payment.')
      return
    }
    await loadData()
    setPaymentForm(defaultPaymentForm)
    void showSuccess('Payment recorded')
  }

  const handleLogout = async () => {
    const confirmation = await Swal.fire({ icon: 'question', title: 'Sign out?', showCancelButton: true, confirmButtonText: 'Sign out', confirmButtonColor: '#133d32' })
    if (!confirmation.isConfirmed) return
    logout()
  }

  const handleProfileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setProfileForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const response = await apiFetch('/auth/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileForm) })
    if (!response.ok) {
      await showRequestError(response, 'Could not update profile.')
      return
    }
    const updated = await response.json() as Session['user']
    if (session) {
      const nextSession = { ...session, user: { ...session.user, full_name: updated.full_name } }
      localStorage.setItem('masco-session', JSON.stringify(nextSession))
      setSession(nextSession)
    }
    void showSuccess('Profile updated')
  }

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      await Swal.fire({ icon: 'error', title: 'Passwords do not match', confirmButtonColor: '#133d32' })
      return
    }
    const response = await apiFetch('/auth/me/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: passwordForm.current_password, new_password: passwordForm.new_password }) })
    if (!response.ok) {
      await showRequestError(response, 'Could not change password.')
      return
    }
    setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
    void showSuccess('Password changed')
  }

  const handleDocumentSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!documentContractID || !documentFile) return

    const payload = new FormData()
    payload.append('file', documentFile)
    payload.append('name', documentName || documentFile.name)
    const response = await apiFetch(`/contracts/${documentContractID}/documents`, {
      method: 'POST',
      body: payload,
    })

    if (response.ok) {
      setDocumentContractID('')
      setDocumentName('')
      setDocumentFile(null)
      void showSuccess('Signed contract uploaded')
    } else {
      await showRequestError(response, 'Could not upload the document.')
    }
  }

  const handleContractPreview = async (contractID: string) => {
    const response = await apiFetch(`/contracts/${contractID}/preview`)
    if (!response.ok) {
      await showRequestError(response, 'Could not generate contract.')
      return
    }
    const documentURL = URL.createObjectURL(await response.blob())
    window.open(documentURL, '_blank', 'noopener,noreferrer')
  }

  if (!session) {
    return (
      <main className="login-shell">
        <section className="login-story">
          <div className="login-brand"><span className="brand-mark">M</span><span>Masco<span>Rent</span></span></div>
          <div className="story-copy">
            <p className="eyebrow">Property operations</p>
            <h1>Every building,<br />under control.</h1>
            <p>One quiet workspace for occupancy, tenants, contracts, and the details that keep each property moving.</p>
          </div>
          <img className="login-illustration" src={heroImage} alt="Layered building platform" />
          <p className="story-footer">MASCO APARTMENTS</p>
        </section>
        <form className="login-panel" onSubmit={handleLogin}>
          <div className="login-heading"><p className="eyebrow">Welcome back</p><h1>Sign in to your workspace</h1><p>Use your MascoRent account to continue.</p></div>
          <label>Username or email<input value={loginForm.username} onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))} autoComplete="username" placeholder="name@company.com" required /></label>
          <label>Password<input type="password" value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} autoComplete="current-password" placeholder="Enter your password" required /></label>
          {loginError && <p className="form-error">{loginError}</p>}
          <button className="primary-button" type="submit">Sign in</button>
        </form>
      </main>
    )
  }

  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingID)
  const pageTitle: Record<View, string> = {
    hq: 'HQ overview',
    buildings: 'Buildings',
    units: 'Units',
    tenants: 'Tenants',
    contracts: 'Contracts',
    invoices: 'Invoices',
    payments: 'Payments',
    settings: 'Settings',
  }

  const showView = (nextView: View) => {
    setFormError('')
    setView(nextView)
  }

  const switchBuilding = (buildingID: string) => {
    setSelectedBuildingID(buildingID)
    setView('hq')
  }

  return (
    <main className="page-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">M</span><span>Masco<span className="brand-muted">Rent</span></span></div>
        <p className="user-name">{session.user.full_name}</p>
        <nav className="nav">
          <button className={`nav-link ${view === 'hq' ? 'active' : ''}`} onClick={() => showView('hq')}>HQ overview</button>
          <button className={`nav-link ${view === 'buildings' ? 'active' : ''}`} onClick={() => showView('buildings')}>Buildings</button>
          <button className={`nav-link ${view === 'units' ? 'active' : ''}`} onClick={() => showView('units')}>Units</button>
          <button className={`nav-link ${view === 'tenants' ? 'active' : ''}`} onClick={() => showView('tenants')}>Tenants</button>
          <button className={`nav-link ${view === 'contracts' ? 'active' : ''}`} onClick={() => showView('contracts')}>Contracts</button>
          <button className={`nav-link ${view === 'invoices' ? 'active' : ''}`} onClick={() => showView('invoices')}>Invoices</button>
          <button className={`nav-link ${view === 'payments' ? 'active' : ''}`} onClick={() => showView('payments')}>Payments</button>
          <button className={`nav-link ${view === 'settings' ? 'active' : ''}`} onClick={() => showView('settings')}>Settings</button>
        </nav>
        <button className="logout-button" type="button" onClick={() => void handleLogout()}>Sign out</button>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{selectedBuilding ? selectedBuilding.code : 'All buildings'}</p>
            <h1>{pageTitle[view]}</h1>
          </div>
          <label className="building-switcher">Portfolio context
            <select value={selectedBuildingID} onChange={(event) => switchBuilding(event.target.value)}>
              <option value="hq">HQ - all buildings</option>
              {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
            </select>
          </label>
        </header>

        {view === 'hq' && <>
        <div className="stats-grid">
          <div className="stat-card"><span>Buildings</span><strong>{stats.buildings}</strong></div>
          <div className="stat-card"><span>Floors</span><strong>{stats.floors}</strong></div>
          <div className="stat-card"><span>Units</span><strong>{stats.units}</strong></div>
          <div className="stat-card"><span>Tenants</span><strong>{stats.tenants}</strong></div>
          <div className="stat-card"><span>Contracts</span><strong>{stats.contracts}</strong></div>
          <div className="stat-card"><span>Invoices</span><strong>{stats.invoices}</strong></div>
        </div>
        <div className="panel overview-panel"><h2>{selectedBuilding ? selectedBuilding.name : 'Portfolio status'}</h2><p>Use the building selector to review a property context, or choose a workspace from the sidebar to manage records.</p></div>
        </>}

        {view === 'buildings' && <div className="panel-grid">
          <form className="panel form-panel" onSubmit={handleSubmit}>
            <h2>Add building</h2>
            <label>
              Building name
              <input name="name" value={form.name} onChange={handleChange} placeholder="Mlimani Apartments" />
            </label>
            <label>
              Building code
              <input name="code" value={form.code} onChange={handleChange} placeholder="MLM-01" />
            </label>
            <label>
              Address
              <input name="address" value={form.address} onChange={handleChange} placeholder="Dar es Salaam" />
            </label>
            <label>
              Description
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Residential building" />
            </label>
            <div className="inline-fields">
              <label>
                Floors
                <input type="number" min="1" name="floors" value={form.floors} onChange={handleChange} />
              </label>
              <label>
                Status
                <select name="status" value={form.status} onChange={handleChange}>
                  <option>Active</option>
                  <option>Maintenance</option>
                  <option>Closed</option>
                </select>
              </label>
            </div>
            <button className="primary-button" type="submit">Save building</button>
            {formError && <p className="form-error">{formError}</p>}
          </form>

          <div className="panel list-panel">
            <h2>Registered buildings</h2>
            <div className="building-list">
              {buildings.length === 0 ? (
                <p className="empty-state">No buildings yet.</p>
              ) : (
                buildings.map((building) => (
                  <article className="building-card" key={building.id}>
                    <div className="building-header">
                      <div>
                        <h3>{building.name}</h3>
                        <span className="code-tag">{building.code}</span>
                      </div>
                      <span className="status-badge">{building.status}</span>
                    </div>
                    <p>{building.address}</p>
                    <div className="meta-row">
                      <span>{building.floors} floors</span>
                      <span>{building.description || 'No description'}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
        }

        {view === 'units' && <div className="panel-grid">
          <form className="panel form-panel" onSubmit={handleUnitSubmit}>
            <h2>Add unit</h2>
            <p className="empty-state">{selectedBuilding ? `Adding to ${selectedBuilding.name}` : 'Select a building above before adding a unit.'}</p>
            <label>Unit number<input name="number" value={unitForm.number} onChange={handleUnitChange} placeholder="A1 or Shop 4" required /></label>
            <div className="inline-fields"><label>Unit type<select name="type" value={unitForm.type} onChange={handleUnitChange}><option>Residential</option><option>Commercial</option><option>Service</option></select></label><label>Status<select name="status" value={unitForm.status} onChange={handleUnitChange}><option>Vacant</option><option>Occupied</option><option>Maintenance</option><option>Reserved</option></select></label></div>
            <label>Description<textarea name="description" value={unitForm.description} onChange={handleUnitChange} placeholder="Apartment, shop, office, or service area" /></label>
            <div className="inline-fields"><label>Bedrooms<input type="number" min="0" name="bedrooms" value={unitForm.bedrooms} onChange={handleUnitChange} /></label><label>Bathrooms<input type="number" min="0" name="bathrooms" value={unitForm.bathrooms} onChange={handleUnitChange} /></label></div>
            <label>Approximate size<input name="size" value={unitForm.size} onChange={handleUnitChange} placeholder="75 sqm" /></label>
            <button className="primary-button" type="submit">Save unit</button>
          </form>
          <div className="panel list-panel"><h2>{selectedBuilding ? `${selectedBuilding.name} units` : 'Units'}</h2><div className="building-list">{selectedBuildingID === 'hq' ? <p className="empty-state">Choose a building to see its units.</p> : units.length === 0 ? <p className="empty-state">No units registered for this building.</p> : units.map((unit) => <article className="building-card" key={unit.id}><div className="building-header"><div><h3>{unit.number}</h3><span className="code-tag">{unit.type}</span></div><span className="status-badge">{unit.status}</span></div><div className="meta-row"><span>{unit.bedrooms} bedrooms, {unit.bathrooms} bathrooms</span><span>{unit.size || 'Size not set'}</span></div></article>)}</div></div>
        </div>}

        {view === 'tenants' && <div className="panel-grid">
          <form className="panel form-panel" onSubmit={handleTenantSubmit}>
            <h2>Add tenant</h2>
            <label>
              Tenant type
              <select name="type" value={tenantForm.type} onChange={handleTenantChange}>
                <option value="Person">Person</option>
                <option value="Institution">Institution</option>
              </select>
            </label>
            {tenantForm.type === 'Person' ? (
              <>
                <label>
                  Full name
                  <input name="full_name" value={tenantForm.full_name} onChange={handleTenantChange} placeholder="Jane Doe" />
                </label>
              </>
            ) : (
              <>
                <label>
                  Company name
                  <input name="company_name" value={tenantForm.company_name} onChange={handleTenantChange} placeholder="Alpha Logistics" />
                </label>
                <label>
                  Contact person
                  <input name="contact_person" value={tenantForm.contact_person} onChange={handleTenantChange} placeholder="John Smith" />
                </label>
              </>
            )}
            <label>
              Phone
              <input name="phone" value={tenantForm.phone} onChange={handleTenantChange} placeholder="+255 700 000 001" />
            </label>
            <label>
              Email
              <input name="email" value={tenantForm.email} onChange={handleTenantChange} placeholder="tenant@example.com" />
            </label>
            <label>
              Address
              <textarea name="address" value={tenantForm.address} onChange={handleTenantChange} placeholder="Resident address" />
            </label>
            <label>
              ID / registration ref
              <input name="id_number" value={tenantForm.id_number} onChange={handleTenantChange} placeholder="NIN / Licence / Reg No" />
            </label>
            <button className="primary-button" type="submit">Save tenant</button>
          </form>

          <div className="panel list-panel">
            <h2>Tenants</h2>
            <div className="building-list">
              {tenants.length === 0 ? (
                <p className="empty-state">No tenants yet.</p>
              ) : (
                tenants.map((tenant) => (
                  <article className="building-card" key={tenant.id}>
                    <div className="building-header">
                      <div>
                        <h3>{tenant.full_name || tenant.company_name || 'Unnamed tenant'}</h3>
                        <span className="code-tag">{tenant.type}</span>
                      </div>
                    </div>
                    <p>{tenant.phone || 'No phone'} · {tenant.email || 'No email'}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
        }

        {view === 'contracts' && <>
        <div className="panel-grid">
          <form className="panel form-panel" onSubmit={handleContractSubmit}>
            <h2>Add contract</h2>
            <label>
              Tenant
              <select name="tenant_id" value={contractForm.tenant_id} onChange={handleContractChange}>
                <option value="">Select tenant</option>
                {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name || tenant.company_name}</option>)}
              </select>
            </label>
            <label>Unit<select name="unit_id" value={contractForm.unit_id} onChange={handleContractChange} disabled={selectedBuildingID === 'hq'}><option value="">{selectedBuildingID === 'hq' ? 'Choose a building context first' : 'Select unit'}</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.number} - {unit.type}</option>)}</select></label>
            <div className="inline-fields">
              <label>
                Contract type
                <select name="contract_type" value={contractForm.contract_type} onChange={handleContractChange}>
                  <option>Residential</option>
                  <option>Commercial</option>
                  <option>Service</option>
                </select>
              </label>
              <label>
                Status
                <select name="status" value={contractForm.status} onChange={handleContractChange}>
                  <option>Active</option>
                  <option>Draft</option>
                  <option>Expired</option>
                  <option>Cancelled</option>
                </select>
              </label>
            </div>
            <div className="inline-fields">
              <label>
                Start date
                <input type="date" name="start_date" value={contractForm.start_date} onChange={handleContractChange} />
              </label>
              <label>
                End date
                <input type="date" name="end_date" value={contractForm.end_date} onChange={handleContractChange} />
              </label>
            </div>
            <label>
              Monthly rent
              <input type="number" min="0" step="0.01" name="monthly_rent" value={contractForm.monthly_rent} onChange={handleContractChange} />
            </label>
            <div className="inline-fields">
              <label>
                Payment method
                <select name="payment_method" value={contractForm.payment_method} onChange={handleContractChange}>
                  <option>Bank Transfer</option>
                  <option>Cash</option>
                  <option>Mobile Money</option>
                  <option>Cheque</option>
                </select>
              </label>
              <label>
                Payment frequency
                <select name="payment_frequency" value={contractForm.payment_frequency} onChange={handleContractChange}>
                  <option>Monthly</option>
                  <option>Every 3 months</option>
                  <option>Every 6 months</option>
                  <option>Yearly</option>
                </select>
              </label>
            </div>
            <label>
              Utilities responsibility
              <input name="utility_responsibility" value={contractForm.utility_responsibility} onChange={handleContractChange} />
            </label>
            <label>
              Lease terms
              <textarea name="terms" value={contractForm.terms} onChange={handleContractChange} placeholder="Use, care, renewal, and termination terms" />
            </label>
            <label>
              Notes
              <textarea name="notes" value={contractForm.notes} onChange={handleContractChange} placeholder="Contract notes" />
            </label>
            <button className="primary-button" type="submit">Save contract</button>
          </form>

          <div className="panel list-panel">
            <h2>Contracts</h2>
            <div className="building-list">
              {contracts.length === 0 ? (
                <p className="empty-state">No contracts yet.</p>
              ) : (
                contracts.map((contract) => (
                  <article className="building-card" key={contract.id}>
                    <div className="building-header">
                      <div>
                        <h3>{contract.contract_type}</h3>
                        <span className="code-tag">{contract.status}</span>
                      </div>
                    </div>
                    <p>Tenant ID: {contract.tenant_id}</p>
                    <div className="meta-row">
                      <span>Unit ID: {contract.unit_id}</span>
                      <span>${contract.monthly_rent} / {contract.payment_frequency || 'Monthly'}</span>
                    </div>
                    <button className="document-link" type="button" onClick={() => void handleContractPreview(contract.id)}>Generate contract</button>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="panel-grid">
          <form className="panel form-panel" onSubmit={handleDocumentSubmit}>
            <h2>Attach signed contract</h2>
            <label>
              Contract
              <select value={documentContractID} onChange={(event) => setDocumentContractID(event.target.value)}>
                <option value="">Select contract</option>
                {contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_type} - {contract.id}</option>)}
              </select>
            </label>
            <label>
              Document name
              <input value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder="Signed lease agreement" />
            </label>
            <label>
              PDF or Word file
              <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} />
            </label>
            <button className="primary-button" type="submit">Upload contract</button>
          </form>
          <div className="panel list-panel">
            <h2>Contract files</h2>
            <p className="empty-state">Select a contract and attach the signed residential or commercial lease. Files are stored securely in the backend uploads directory.</p>
          </div>
        </div>
        </>}

        {view === 'invoices' && <div className="panel-grid">
          <div className="panel list-panel">
            <h2>Generate from contract</h2>
            <div className="building-list">
              {contracts.filter((contract) => contract.status === 'Active').length === 0 ? <p className="empty-state">Create an active contract before generating an invoice.</p> : contracts.filter((contract) => contract.status === 'Active').map((contract) => <article className="building-card" key={contract.id}><h3>{contract.contract_type} contract</h3><p>${contract.monthly_rent} / {contract.payment_frequency || 'Monthly'}</p><button className="primary-button" type="button" onClick={() => void handleGenerateInvoice(contract.id)}>Generate invoice</button></article>)}
            </div>
          </div>
          <div className="panel list-panel">
            <h2>Invoices</h2>
            <div className="building-list">
              {invoices.length === 0 ? (
                <p className="empty-state">No invoices yet.</p>
              ) : (
                invoices.map((invoice) => (
                  <article className="building-card" key={invoice.id}>
                    <div className="building-header">
                      <div>
                        <h3>{invoice.number}</h3>
                        <span className="code-tag">{invoice.status}</span>
                      </div>
                    </div>
                    <p>Invoice record: {invoice.id}</p>
                    <div className="meta-row">
                      <span>Amount: ${invoice.amount}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
        }

        {view === 'payments' && <div className="panel-grid">
          <form className="panel form-panel" onSubmit={handlePaymentSubmit}>
            <h2>Record payment</h2>
            <label>Invoice<select name="invoice_id" value={paymentForm.invoice_id} onChange={handlePaymentChange} required><option value="">Select invoice</option>{invoices.filter((invoice) => invoice.status !== 'Paid' && invoice.status !== 'Cancelled').map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number} - ${invoice.amount} ({invoice.status})</option>)}</select></label>
            <label>Amount received<input name="amount" type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={handlePaymentChange} required /></label>
            <div className="inline-fields"><label>Payment date<input name="payment_date" type="date" value={paymentForm.payment_date} onChange={handlePaymentChange} required /></label><label>Method<select name="payment_method" value={paymentForm.payment_method} onChange={handlePaymentChange}><option>Bank Transfer</option><option>Cash</option><option>Mobile Money</option><option>Card</option><option>Cheque</option></select></label></div>
            <label>Payment reference<input name="payment_reference" value={paymentForm.payment_reference} onChange={handlePaymentChange} placeholder="Bank or receipt reference" required /></label>
            <label>Receipt number<input name="receipt_number" value={paymentForm.receipt_number} onChange={handlePaymentChange} placeholder="Optional receipt number" /></label>
            <label>Notes<textarea name="notes" value={paymentForm.notes} onChange={handlePaymentChange} placeholder="Optional payment notes" /></label>
            <button className="primary-button" type="submit">Record payment</button>
          </form>
          <div className="panel list-panel"><h2>Payment history</h2><div className="building-list">{payments.length === 0 ? <p className="empty-state">No payments recorded.</p> : payments.map((payment) => <article className="building-card" key={payment.id}><div className="building-header"><div><h3>${payment.amount}</h3><span className="code-tag">{payment.payment_method}</span></div><span className="status-badge">{payment.payment_date}</span></div><p>{payment.payment_reference}</p><div className="meta-row"><span>Invoice #{payment.invoice_id}</span><span>{payment.receipt_number || 'No receipt number'}</span></div></article>)}</div></div>
        </div>}

        {view === 'settings' && <div className="panel-grid">
          <form className="panel form-panel" onSubmit={handleProfileSubmit}>
            <h2>Profile</h2>
            <label>Full name<input name="full_name" value={profileForm.full_name} onChange={handleProfileChange} required /></label>
            <label>Email<input name="email" type="email" value={profileForm.email} onChange={handleProfileChange} required /></label>
            <button className="primary-button" type="submit">Save profile</button>
          </form>
          <form className="panel form-panel" onSubmit={handlePasswordSubmit}>
            <h2>Change password</h2>
            <label>Current password<input name="current_password" type="password" value={passwordForm.current_password} onChange={handlePasswordChange} autoComplete="current-password" required /></label>
            <label>New password<input name="new_password" type="password" value={passwordForm.new_password} onChange={handlePasswordChange} autoComplete="new-password" minLength={8} required /></label>
            <label>Confirm new password<input name="confirm_password" type="password" value={passwordForm.confirm_password} onChange={handlePasswordChange} autoComplete="new-password" minLength={8} required /></label>
            <button className="primary-button" type="submit">Change password</button>
          </form>
        </div>}
      </section>
    </main>
  )
}

export default App
