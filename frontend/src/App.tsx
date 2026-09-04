import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Swal from 'sweetalert2'
import heroImage from './assets/hero.png'
import './App.css'

const apiURL = import.meta.env.VITE_API_URL ?? 'http://localhost:6400/api/v1'

const formatAmount = (value: string | number) => {
  const raw = String(value).replace(/[^0-9.]/g, '')
  const [integerPart, decimalPart] = raw.split('.')
  const formattedInteger = (integerPart || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimalPart === undefined ? formattedInteger : `${formattedInteger}.${decimalPart.slice(0, 2)}`
}

const amountNumber = (value: string) => Number(value.replace(/,/g, '')) || 0

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
  building_id: string
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
  building_id: number
  unit_id: string
  tenant_id: string
  contract_type: string
  start_date: string
  end_date: string
  monthly_rent: number
  payment_method?: string
  payment_frequency?: string
  utility_responsibility?: string
  status: string
}

type InvoiceRecord = {
  id: string
  building_id: number
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
  building_id: number
}

type Session = {
  token: string
  user: {
    username: string
    full_name: string
    roles: string[]
  }
}

type AdminUser = { id: number; username: string; email: string; full_name: string; status: string; roles: string[] }
type View = 'home' | 'buildings' | 'units' | 'tenants' | 'contracts' | 'invoices' | 'payments' | 'registration' | 'reports' | 'settings'

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
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [form, setForm] = useState(defaultForm)
  const [tenantForm, setTenantForm] = useState(defaultTenantForm)
  const [unitForm, setUnitForm] = useState(defaultUnitForm)
  const [contractForm, setContractForm] = useState(defaultContractForm)
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm)
  const [documentContractID, setDocumentContractID] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [view, setView] = useState<View>('home')
  const [selectedBuildingID, setSelectedBuildingID] = useState(() => localStorage.getItem('masco-building-id') ?? 'hq')
  const [formError, setFormError] = useState('')
  const [profileForm, setProfileForm] = useState({ full_name: session?.user.full_name ?? '', email: '' })
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [newUserForm, setNewUserForm] = useState({ username: '', email: '', full_name: '', password: '' })

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

  const readData = async (path: string) => {
    const response = await apiFetch(path)
    if (!response.ok) {
      throw new Error(`${path}: ${response.status}`)
    }
    return response.json() as Promise<{ data?: unknown }>
  }

  const loadData = async () => {
    if (!session) return
    try {
      const contextQuery = selectedBuildingID === 'hq' ? '' : `?building_id=${selectedBuildingID}`
      const [buildingData, tenantData, contractData, invoiceData, paymentData] = await Promise.all([
        readData('/buildings'),
        readData(`/tenants${contextQuery}`),
        readData(`/contracts${contextQuery}`),
        readData(`/invoices${contextQuery}`),
        readData(`/payments${contextQuery}`),
      ])

      const nextBuildings = (buildingData.data ?? []) as BuildingRecord[]
      setBuildings(nextBuildings)
      if (selectedBuildingID !== 'hq' && !nextBuildings.some((building) => String(building.id) === selectedBuildingID)) {
        switchBuilding('hq')
        return
      }
      setTenants((tenantData.data ?? []) as TenantRecord[])
      setContracts((contractData.data ?? []) as ContractRecord[])
      setInvoices((invoiceData.data ?? []) as InvoiceRecord[])
      setPayments((paymentData.data ?? []) as PaymentRecord[])
    } catch {
      await Swal.fire({ icon: 'error', title: 'Could not load portfolio data', text: 'Check the API response and database schema. The failed request is available in the browser network panel.', confirmButtonColor: '#133d32' })
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
    void apiFetch(`/buildings/${selectedBuildingID}/units`).then(async (response) => {
      if (!response.ok) throw new Error('Could not load units')
      return response.json()
    }).then((payload) => setUnits(payload.data ?? [])).catch(() => setUnits([]))
  }, [selectedBuildingID, session])

  useEffect(() => {
    if (view !== 'registration' || !session) return
    void Promise.all([apiFetch('/auth/users'), apiFetch('/auth/roles')]).then(async ([usersResponse, rolesResponse]) => {
      const usersPayload = await usersResponse.json()
      const rolesPayload = await rolesResponse.json()
      setAdminUsers(usersPayload.data ?? [])
      setRoles(rolesPayload.data ?? [])
    }).catch(() => {})
  }, [view, session])

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
      setView('home')
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
      body: JSON.stringify({ ...tenantForm, building_id: Number(selectedBuildingID) }),
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
        tenant_id: Number(contractForm.tenant_id),
        unit_id: Number(contractForm.unit_id),
        monthly_rent: amountNumber(contractForm.monthly_rent),
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
    const response = await apiFetch('/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...paymentForm, invoice_id: Number(paymentForm.invoice_id), amount: amountNumber(paymentForm.amount) }) })
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

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault()
    const response = await apiFetch('/auth/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUserForm) })
    if (!response.ok) { await showRequestError(response, 'Could not register user.'); return }
    setNewUserForm({ username: '', email: '', full_name: '', password: '' })
    setView('registration')
    void showSuccess('User registered')
  }

  const updateUserStatus = async (userID: number, status: string) => {
    const response = await apiFetch(`/auth/users/${userID}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!response.ok) { await showRequestError(response, 'Could not update user.'); return }
    setAdminUsers((current) => current.map((user) => user.id === userID ? { ...user, status } : user))
    void showSuccess('User updated')
  }

  const assignUserRole = async (userID: number, role: string) => {
    const response = await apiFetch(`/auth/users/${userID}/roles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
    if (!response.ok) { await showRequestError(response, 'Could not assign role.'); return }
    setAdminUsers((current) => current.map((user) => user.id === userID && !user.roles.includes(role) ? { ...user, roles: [...user.roles, role] } : user))
    void showSuccess('Role assigned')
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

  const selectedBuilding = buildings.find((building) => String(building.id) === selectedBuildingID)
  const pageTitle: Record<View, string> = {
    home: selectedBuildingID === 'hq' ? 'Home' : 'Branch home',
    buildings: 'Buildings',
    units: 'Units',
    tenants: 'Tenants',
    contracts: 'Contracts',
    invoices: 'Invoices',
    payments: 'Payments',
    registration: 'Registration',
    reports: 'Reports',
    settings: 'Settings',
  }

  const showView = (nextView: View) => {
    setFormError('')
    setView(nextView)
  }

  const today = new Date()
  const daysUntil = (date: string) => Math.ceil((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000)
  const scopedContracts = contracts.filter((contract) => selectedBuildingID === 'hq' || contract.building_id === Number(selectedBuildingID))
  const activeContracts = scopedContracts.filter((contract) => contract.status === 'Active')
  const expiring7 = activeContracts.filter((contract) => daysUntil(contract.end_date) >= 0 && daysUntil(contract.end_date) <= 7)
  const expiring30 = activeContracts.filter((contract) => daysUntil(contract.end_date) >= 0 && daysUntil(contract.end_date) <= 30)
  const expiredContracts = scopedContracts.filter((contract) => contract.end_date && daysUntil(contract.end_date) < 0 && contract.status !== 'Cancelled')
  const scopedInvoices = invoices.filter((invoice) => selectedBuildingID === 'hq' || invoice.building_id === Number(selectedBuildingID))
  const unpaidInvoices = scopedInvoices.filter((invoice) => invoice.status === 'Pending' || invoice.status === 'Partially Paid' || invoice.status === 'Overdue')
  const scopedPayments = payments.filter((payment) => selectedBuildingID === 'hq' || payment.building_id === Number(selectedBuildingID))
  const paymentsToday = scopedPayments.filter((payment) => payment.payment_date === today.toISOString().slice(0, 10))
  const branchCards = buildings.map((building) => {
    const branchContracts = contracts.filter((contract) => String(contract.building_id) === String(building.id))
    const branchInvoices = invoices.filter((invoice) => String(invoice.building_id) === String(building.id))
    return { building, active: branchContracts.filter((contract) => contract.status === 'Active').length, expiring7: branchContracts.filter((contract) => contract.status === 'Active' && daysUntil(contract.end_date) >= 0 && daysUntil(contract.end_date) <= 7).length, expiring30: branchContracts.filter((contract) => contract.status === 'Active' && daysUntil(contract.end_date) >= 0 && daysUntil(contract.end_date) <= 30).length, expired: branchContracts.filter((contract) => contract.end_date && daysUntil(contract.end_date) < 0 && contract.status !== 'Cancelled').length, unpaid: branchInvoices.filter((invoice) => invoice.status !== 'Paid' && invoice.status !== 'Cancelled').length }
  })

  const switchBuilding = (buildingID: string) => {
    setSelectedBuildingID(buildingID)
    setView('home')
  }

  return (
    <main className="page-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">M</span><span>Masco<span className="brand-muted">Rent</span></span></div>
        <p className="user-name">{session.user.full_name}</p>
        <nav className="nav">
          <button className={`nav-link ${view === 'home' ? 'active' : ''}`} onClick={() => showView('home')}>Home</button>
          {selectedBuildingID === 'hq' ? <>
            <button className={`nav-link ${view === 'registration' ? 'active' : ''}`} onClick={() => showView('registration')}>Registration</button>
            <button className={`nav-link ${view === 'reports' ? 'active' : ''}`} onClick={() => showView('reports')}>Reports</button>
          </> : <>
            <button className={`nav-link ${view === 'units' ? 'active' : ''}`} onClick={() => showView('units')}>Units</button>
            <button className={`nav-link ${view === 'tenants' ? 'active' : ''}`} onClick={() => showView('tenants')}>Tenants</button>
            <button className={`nav-link ${view === 'contracts' ? 'active' : ''}`} onClick={() => showView('contracts')}>Contracts</button>
            <button className={`nav-link ${view === 'invoices' ? 'active' : ''}`} onClick={() => showView('invoices')}>Invoices</button>
            <button className={`nav-link ${view === 'payments' ? 'active' : ''}`} onClick={() => showView('payments')}>Payments</button>
          </>}
          {selectedBuildingID === 'hq' && <button className={`nav-link ${view === 'buildings' ? 'active' : ''}`} onClick={() => showView('buildings')}>Buildings</button>}
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

        {view === 'home' && !selectedBuilding && <div className="hq-dashboard">
        <div className="dashboard-heading"><div><p className="eyebrow">HQ / Administration</p><h2>ADMINISTRATION OWNER UPDATES - ALL BUILDINGS</h2></div><span className="updated-date">Updated: {today.toLocaleDateString('en-GB')}</span></div>
        <div className="stats-grid dashboard-stats">
          <div className="stat-card"><span>Active contracts</span><strong>{activeContracts.length}</strong></div>
          <div className="stat-card"><span>Expiring 7 days</span><strong>{expiring7.length}</strong></div>
          <div className="stat-card"><span>Expiring 30 days</span><strong>{expiring30.length}</strong></div>
          <div className="stat-card"><span>Expired in progress</span><strong>{expiredContracts.length}</strong></div>
          <div className="stat-card"><span>Unpaid active</span><strong>{unpaidInvoices.length}</strong></div>
          <div className="stat-card"><span>Payments today</span><strong>{paymentsToday.length}</strong></div>
        </div>
        <div className="hq-section-heading"><div><p className="eyebrow">Portfolio directory</p><h2>Branches at a glance</h2></div><span>Choose a branch to enter its workspace</span></div>
        <div className="branch-grid">{branchCards.map((branch) => <button className="branch-card" key={branch.building.id} onClick={() => switchBuilding(String(branch.building.id))}><span>BRANCH: {branch.building.code}</span><strong>{branch.active} active</strong><small>{branch.expiring30} expiring in 30d · {branch.expired} expired · {branch.unpaid} unpaid</small></button>)}</div>
        </div>}
        {view === 'home' && selectedBuilding && <div className="branch-dashboard">
        <div className="dashboard-heading"><div><p className="eyebrow">Branch dashboard · {selectedBuilding.code}</p><h2>OWNER UPDATES - {selectedBuilding.name}</h2></div><span className="updated-date">Updated: {today.toLocaleDateString('en-GB')}</span></div>
        <div className="stats-grid dashboard-stats">
          <div className="stat-card"><span>Active contracts</span><strong>{activeContracts.length}</strong></div>
          <div className="stat-card"><span>Expiring 7 days</span><strong>{expiring7.length}</strong></div>
          <div className="stat-card"><span>Expiring 30 days</span><strong>{expiring30.length}</strong></div>
          <div className="stat-card"><span>Expired in progress</span><strong>{expiredContracts.length}</strong></div>
          <div className="stat-card"><span>Unpaid active</span><strong>{unpaidInvoices.length}</strong></div>
          <div className="stat-card"><span>Payments today</span><strong>{paymentsToday.length}</strong></div>
        </div>
        <div className="dashboard-columns">
          <div className="panel table-panel"><div className="section-heading"><h2>Contracts to expire</h2><span>Next 30 days</span></div>{expiring30.length === 0 ? <p className="empty-state">No contracts expiring in next 30 days.</p> : expiring30.map((contract) => <div className="dashboard-row" key={contract.id}><strong>{contract.tenant_id}</strong><span>{contract.unit_id}</span><span>{contract.end_date}</span><button className="row-action" onClick={() => showView('contracts')}>View / Pay</button></div>)}</div>
          <div className="panel table-panel"><div className="section-heading"><h2>Expired contracts</h2><span>{expiredContracts.length} records</span></div>{expiredContracts.length === 0 ? <p className="empty-state">No expired contracts.</p> : expiredContracts.map((contract) => <div className="dashboard-row" key={contract.id}><strong>{contract.tenant_id}</strong><span>{contract.unit_id}</span><span>{contract.end_date}</span><button className="row-action" onClick={() => showView('contracts')}>View</button></div>)}</div>
          <div className="panel table-panel"><div className="section-heading"><h2>Unpaid active contracts</h2><span>Balance due</span></div>{unpaidInvoices.length === 0 ? <p className="empty-state">No unpaid active contracts.</p> : unpaidInvoices.map((invoice) => <div className="dashboard-row" key={invoice.id}><strong>{invoice.number}</strong><span>{invoice.status}</span><span>{formatAmount(invoice.amount)}</span><button className="row-action" onClick={() => showView('payments')}>Pay</button></div>)}</div>
          <div className="panel table-panel"><div className="section-heading"><h2>Payments today</h2><span>Total: {paymentsToday.length}</span></div>{paymentsToday.length === 0 ? <p className="empty-state">No payments today.</p> : paymentsToday.map((payment) => <div className="dashboard-row" key={payment.id}><strong>{payment.payment_reference}</strong><span>{payment.payment_method}</span><span>{formatAmount(payment.amount)}</span></div>)}</div>
        </div>
        </div>}

        {view === 'registration' && <div className="registration-layout">
          <div className="registration-intro"><p className="eyebrow">Administration</p><h2>System registration</h2><p>Manage users, roles, and the shared catalogs used across every building.</p></div>
          <div className="panel-grid">
            <form className="panel form-panel" onSubmit={handleCreateUser}><h2>Register user</h2><label>Full name<input value={newUserForm.full_name} onChange={(event) => setNewUserForm((current) => ({ ...current, full_name: event.target.value }))} required /></label><label>Username<input value={newUserForm.username} onChange={(event) => setNewUserForm((current) => ({ ...current, username: event.target.value }))} required /></label><label>Email<input type="email" value={newUserForm.email} onChange={(event) => setNewUserForm((current) => ({ ...current, email: event.target.value }))} required /></label><label>Temporary password<input type="password" minLength={8} value={newUserForm.password} onChange={(event) => setNewUserForm((current) => ({ ...current, password: event.target.value }))} required /></label><button className="primary-button" type="submit">Register user</button></form>
            <div className="panel list-panel"><h2>Users and access</h2><div className="building-list">{adminUsers.length === 0 ? <p className="empty-state">No users loaded. Confirm roles and user_roles exist in the database.</p> : adminUsers.map((user) => <article className="building-card" key={user.id}><div className="building-header"><div><h3>{user.full_name}</h3><span className="code-tag">{user.username}</span></div><select value={user.status} onChange={(event) => void updateUserStatus(user.id, event.target.value)}><option>Active</option><option>Inactive</option><option>Suspended</option></select></div><p>{user.email}</p><div className="meta-row"><span>{user.roles.length ? user.roles.join(', ') : 'No role assigned'}</span><select defaultValue="" onChange={(event) => { if (event.target.value) void assignUserRole(user.id, event.target.value) }}><option value="">Assign role</option>{roles.map((role) => <option key={role}>{role}</option>)}</select></div></article>)}</div></div>
          </div>
          <div className="catalog-grid"><div className="catalog-card"><span>Buildings</span><strong>{buildings.length}</strong><small>Register and manage properties</small></div><div className="catalog-card"><span>Payment methods</span><strong>6</strong><small>Cash, bank, mobile, card, cheque, other</small></div><div className="catalog-card"><span>Roles</span><strong>{roles.length}</strong><small>Administrator, Manager, Accountant, Staff</small></div></div>
        </div>}

        {view === 'reports' && <div className="reports-layout"><div className="registration-intro"><p className="eyebrow">Office reports</p><h2>All buildings combined</h2><p>Portfolio-wide statements for administration and owner review.</p></div><div className="reports-grid"><div className="report-card"><span>Transaction statement</span><strong>{payments.length}</strong><small>Recorded payments across all buildings</small></div><div className="report-card"><span>Expenses statement</span><strong>0</strong><small>Expenses will appear here when registered</small></div><div className="report-card"><span>Monthly rent statement</span><strong>{invoices.length}</strong><small>Generated invoices across the portfolio</small></div><div className="report-card"><span>Tenant statement</span><strong>{tenants.length}</strong><small>Tenants with active portfolio records</small></div></div><div className="panel table-panel"><div className="section-heading"><h2>Recent transactions</h2><span>All buildings</span></div>{payments.length === 0 ? <p className="empty-state">No transactions recorded.</p> : payments.slice(0, 12).map((payment) => <div className="dashboard-row" key={payment.id}><strong>{payment.payment_reference}</strong><span>{payment.payment_method}</span><span>{formatAmount(payment.amount)}</span><span>{payment.payment_date}</span></div>)}</div></div>}

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
              <input inputMode="decimal" name="monthly_rent" value={contractForm.monthly_rent} onChange={(event) => setContractForm((current) => ({ ...current, monthly_rent: formatAmount(event.target.value) }))} />
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
                      <span>{formatAmount(contract.monthly_rent)} / {contract.payment_frequency || 'Monthly'}</span>
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
              {contracts.filter((contract) => contract.status === 'Active').length === 0 ? <p className="empty-state">Create an active contract before generating an invoice.</p> : contracts.filter((contract) => contract.status === 'Active').map((contract) => <article className="building-card" key={contract.id}><h3>{contract.contract_type} contract</h3><p>{formatAmount(contract.monthly_rent)} / {contract.payment_frequency || 'Monthly'}</p><button className="primary-button" type="button" onClick={() => void handleGenerateInvoice(contract.id)}>Generate invoice</button></article>)}
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
                      <span>Amount: {formatAmount(invoice.amount)}</span>
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
            <label>Invoice<select name="invoice_id" value={paymentForm.invoice_id} onChange={handlePaymentChange} required><option value="">Select invoice</option>{invoices.filter((invoice) => invoice.status !== 'Paid' && invoice.status !== 'Cancelled').map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number} - {formatAmount(invoice.amount)} ({invoice.status})</option>)}</select></label>
            <label>Amount received<input name="amount" inputMode="decimal" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: formatAmount(event.target.value) }))} required /></label>
            <div className="inline-fields"><label>Payment date<input name="payment_date" type="date" value={paymentForm.payment_date} onChange={handlePaymentChange} required /></label><label>Method<select name="payment_method" value={paymentForm.payment_method} onChange={handlePaymentChange}><option>Bank Transfer</option><option>Cash</option><option>Mobile Money</option><option>Card</option><option>Cheque</option></select></label></div>
            <label>Payment reference<input name="payment_reference" value={paymentForm.payment_reference} onChange={handlePaymentChange} placeholder="Bank or receipt reference" required /></label>
            <label>Receipt number<input name="receipt_number" value={paymentForm.receipt_number} onChange={handlePaymentChange} placeholder="Optional receipt number" /></label>
            <label>Notes<textarea name="notes" value={paymentForm.notes} onChange={handlePaymentChange} placeholder="Optional payment notes" /></label>
            <button className="primary-button" type="submit">Record payment</button>
          </form>
          <div className="panel list-panel"><h2>Payment history</h2><div className="building-list">{payments.length === 0 ? <p className="empty-state">No payments recorded.</p> : payments.map((payment) => <article className="building-card" key={payment.id}><div className="building-header"><div><h3>{formatAmount(payment.amount)}</h3><span className="code-tag">{payment.payment_method}</span></div><span className="status-badge">{payment.payment_date}</span></div><p>{payment.payment_reference}</p><div className="meta-row"><span>Invoice #{payment.invoice_id}</span><span>{payment.receipt_number || 'No receipt number'}</span></div></article>)}</div></div>
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
