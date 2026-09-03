import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
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

const defaultInvoiceForm = {
  tenant_id: '',
  unit_id: '',
  contract_id: '',
  number: '',
  issue_date: '',
  due_date: '',
  amount: '0',
  status: 'Pending',
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

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const stored = localStorage.getItem('masco-session')
    return stored ? JSON.parse(stored) as Session : null
  })
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [buildings, setBuildings] = useState<BuildingRecord[]>([])
  const [tenants, setTenants] = useState<TenantRecord[]>([])
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [stats, setStats] = useState<DashboardStats>({ buildings: 0, floors: 0, units: 0, tenants: 0, contracts: 0, invoices: 0 })
  const [form, setForm] = useState(defaultForm)
  const [tenantForm, setTenantForm] = useState(defaultTenantForm)
  const [contractForm, setContractForm] = useState(defaultContractForm)
  const [invoiceForm, setInvoiceForm] = useState(defaultInvoiceForm)
  const [documentContractID, setDocumentContractID] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)

  const apiFetch = (path: string, options: RequestInit = {}) => fetch(`${apiURL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${session?.token ?? ''}` },
  })

  const loadData = async () => {
    if (!session) return
    try {
      const [buildingsResponse, tenantsResponse, contractsResponse, invoicesResponse, dashboardResponse] = await Promise.all([
        apiFetch('/buildings'),
        apiFetch('/tenants'),
        apiFetch('/contracts'),
        apiFetch('/invoices'),
        apiFetch('/dashboard'),
      ])

      const buildingData = await buildingsResponse.json()
      const tenantData = await tenantsResponse.json()
      const contractData = await contractsResponse.json()
      const invoiceData = await invoicesResponse.json()
      const dashboardData = await dashboardResponse.json()

      setBuildings(buildingData.data ?? [])
      setTenants(tenantData.data ?? [])
      setContracts(contractData.data ?? [])
      setInvoices(invoiceData.data ?? [])
      setStats(dashboardData.data ?? { buildings: 0, floors: 0, units: 0, tenants: 0, contracts: 0, invoices: 0 })
    } catch {
      setBuildings([])
      setTenants([])
      setContracts([])
      setInvoices([])
      setStats({ buildings: 0, floors: 0, units: 0, tenants: 0, contracts: 0, invoices: 0 })
    }
  }

  useEffect(() => {
    if (session) void loadData()
  }, [session])

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
      return
    }
    const nextSession = await response.json() as Session
    localStorage.setItem('masco-session', JSON.stringify(nextSession))
    setSession(nextSession)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleTenantChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setTenantForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleContractChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setContractForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleInvoiceChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setInvoiceForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

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
    }
  }

  const handleInvoiceSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const response = await apiFetch('/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...invoiceForm,
        amount: Number(invoiceForm.amount),
      }),
    })

    if (response.ok) {
      await loadData()
      setInvoiceForm(defaultInvoiceForm)
    }
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
    }
  }

  const handleContractPreview = async (contractID: string) => {
    const response = await apiFetch(`/contracts/${contractID}/preview`)
    if (!response.ok) return
    const documentURL = URL.createObjectURL(await response.blob())
    window.open(documentURL, '_blank', 'noopener,noreferrer')
  }

  if (!session) {
    return (
      <main className="login-shell">
        <form className="login-panel" onSubmit={handleLogin}>
          <div className="brand"><span className="brand-mark">M</span><span>Masco<span className="brand-muted">Rent</span></span></div>
          <h1>Sign in</h1>
          <p>Property and rental management</p>
          <label>Username or email<input value={loginForm.username} onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))} autoComplete="username" required /></label>
          <label>Password<input type="password" value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} autoComplete="current-password" required /></label>
          {loginError && <p className="form-error">{loginError}</p>}
          <button className="primary-button" type="submit">Sign in</button>
        </form>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">M</span><span>Masco<span className="brand-muted">Rent</span></span></div>
        <p className="user-name">{session.user.full_name}</p>
        <nav className="nav">
          <a className="nav-link" href="#dashboard">Dashboard</a>
          <a className="nav-link active" href="#buildings">Buildings</a>
          <a className="nav-link" href="#tenants">Tenants</a>
          <a className="nav-link" href="#contracts">Contracts</a>
          <a className="nav-link" href="#invoices">Invoices</a>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar" id="dashboard">
          <div>
            <p className="eyebrow">Operations overview</p>
            <h1>Portfolio dashboard</h1>
          </div>
        </header>

        <div className="stats-grid">
          <div className="stat-card"><span>Buildings</span><strong>{stats.buildings}</strong></div>
          <div className="stat-card"><span>Floors</span><strong>{stats.floors}</strong></div>
          <div className="stat-card"><span>Units</span><strong>{stats.units}</strong></div>
          <div className="stat-card"><span>Tenants</span><strong>{stats.tenants}</strong></div>
          <div className="stat-card"><span>Contracts</span><strong>{stats.contracts}</strong></div>
          <div className="stat-card"><span>Invoices</span><strong>{stats.invoices}</strong></div>
        </div>

        <div className="panel-grid" id="buildings">
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

        <div className="panel-grid" id="tenants">
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

        <div className="panel-grid" id="contracts">
          <form className="panel form-panel" onSubmit={handleContractSubmit}>
            <h2>Add contract</h2>
            <label>
              Tenant
              <select name="tenant_id" value={contractForm.tenant_id} onChange={handleContractChange}>
                <option value="">Select tenant</option>
                {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name || tenant.company_name}</option>)}
              </select>
            </label>
            <label>
              Unit ID
              <input name="unit_id" value={contractForm.unit_id} onChange={handleContractChange} placeholder="unit-abc123" />
            </label>
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

        <div className="panel-grid" id="documents">
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

        <div className="panel-grid" id="invoices">
          <form className="panel form-panel" onSubmit={handleInvoiceSubmit}>
            <h2>Add invoice</h2>
            <label>
              Invoice number
              <input name="number" value={invoiceForm.number} onChange={handleInvoiceChange} placeholder="INV-001" />
            </label>
            <label>
              Contract ID
              <input name="contract_id" value={invoiceForm.contract_id} onChange={handleInvoiceChange} placeholder="contract-abc123" />
            </label>
            <label>
              Tenant ID
              <input name="tenant_id" value={invoiceForm.tenant_id} onChange={handleInvoiceChange} placeholder="tenant-abc123" />
            </label>
            <label>
              Unit ID
              <input name="unit_id" value={invoiceForm.unit_id} onChange={handleInvoiceChange} placeholder="unit-abc123" />
            </label>
            <div className="inline-fields">
              <label>
                Issue date
                <input type="date" name="issue_date" value={invoiceForm.issue_date} onChange={handleInvoiceChange} />
              </label>
              <label>
                Due date
                <input type="date" name="due_date" value={invoiceForm.due_date} onChange={handleInvoiceChange} />
              </label>
            </div>
            <label>
              Amount
              <input type="number" min="0" step="0.01" name="amount" value={invoiceForm.amount} onChange={handleInvoiceChange} />
            </label>
            <label>
              Status
              <select name="status" value={invoiceForm.status} onChange={handleInvoiceChange}>
                <option>Pending</option>
                <option>Partially Paid</option>
                <option>Paid</option>
                <option>Overdue</option>
              </select>
            </label>
            <button className="primary-button" type="submit">Save invoice</button>
          </form>

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
      </section>
    </main>
  )
}

export default App
