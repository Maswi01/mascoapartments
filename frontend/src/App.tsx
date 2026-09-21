import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Swal from "sweetalert2";
import heroImage from "./assets/hero.png";
import "./App.css";

const apiURL = import.meta.env.VITE_API_URL ?? "http://localhost:6400/api/v1";

const formatAmount = (value: string | number) => {
  const raw = String(value).replace(/[^0-9.]/g, "");
  const [integerPart, decimalPart] = raw.split(".");
  const formattedInteger = (integerPart || "0")
    .replace(/^0+(?=\d)/, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart === undefined
    ? formattedInteger
    : `${formattedInteger}.${decimalPart.slice(0, 2)}`;
};

const amountNumber = (value: string) => Number(value.replace(/,/g, "")) || 0;

const dateOnly = (value: string) => value ? value.slice(0, 10) : "";

const contractMonths = (start: string, end: string) => {
  const startDate = new Date(`${dateOnly(start)}T00:00:00`);
  const endDate = new Date(`${dateOnly(end)}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 1;
  const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + (endDate.getDate() > startDate.getDate() ? 1 : 0);
  return Math.max(1, months);
};

const escapeHTML = (value: string | number) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const defaultForm = {
  name: "",
  code: "",
  address: "",
  description: "",
  floors: "2",
  status: "Active",
};

const defaultExpenseCategoryForm = {
  name: "",
};

const defaultTenantForm = {
  type: "Person",
  full_name: "",
  company_name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  id_number: "",
  notes: "",
};

const defaultUnitForm = {
  number: "",
  floor_id: "",
  type: "Residential",
  description: "",
  status: "Vacant",
  base_rent: "",
};

const defaultContractForm = {
  tenant_id: "",
  unit_id: "",
  contract_type: "Residential",
  start_date: "",
  end_date: "",
  monthly_rent: "0",
  period: "1",
  prepaid_amount: "0",
  payment_method: "Bank Transfer",
  payment_frequency: "Monthly",
  utility_responsibility: "Tenant pays electricity and water",
  terms: "",
  status: "Active",
  notes: "",
};

const defaultPaymentForm = {
  invoice_id: "",
  amount: "",
  payment_date: new Date().toISOString().slice(0, 10),
  payment_method: "Bank Transfer",
  payment_reference: "",
  receipt_number: "",
  notes: "",
};

const defaultProformaForm = {
  unit_id: "",
  start_date: new Date().toISOString().slice(0, 10),
  period: "1",
  prepaid_amount: "0",
  issue_date: new Date().toISOString().slice(0, 10),
};

const defaultContractUpgradeForm = {
  period: "",
  prepaid_amount: "0",
  payment_date: new Date().toISOString().slice(0, 10),
};

type BuildingRecord = {
  id: string;
  name: string;
  code: string;
  address: string;
  description?: string;
  floors: number;
  status: string;
};

type TenantRecord = {
  id: string;
  building_id: string;
  type: string;
  full_name?: string;
  company_name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  id_number?: string;
  registration_ref?: string;
  notes?: string;
};

type UnitRecord = {
  id: string;
  building_id: string;
  number: string;
  type: string;
  status: string;
  floor_id?: string;
  base_rent: number;
};

type FloorRecord = { id: string; name: string };

type ContractRecord = {
  id: string;
  building_id: number;
  unit_id: string;
  tenant_id: string;
  contract_type: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  payment_method?: string;
  payment_frequency?: string;
  utility_responsibility?: string;
  terms?: string;
  notes?: string;
  status: string;
};

type InvoiceRecord = {
  id: string;
  contract_id: string;
  tenant_id: string;
  building_id: number;
  unit_id: string;
  number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  description?: string;
  status: string;
};

type PaymentRecord = {
  id: string;
  tenant_id: string;
  invoice_id: string;
  unit_id: string;
  payment_reference: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_number?: string;
  building_id: number;
};

type Session = {
  token: string;
  user: {
    username: string;
    full_name: string;
    roles: string[];
  };
};

type AdminUser = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  status: string;
  roles: string[];
};
type ExpenseCategoryRecord = {
  id: string;
  name: string;
  created_at?: string;
};
type ReportMode = "tenants" | "transactions" | "expenses" | "cashflow" | "rent";
type View =
  | "home"
  | "buildings"
  | "units"
  | "tenants"
  | "contracts"
  | "invoices"
  | "payments"
  | "registration"
  | "reports"
  | "settings";

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const stored = localStorage.getItem("masco-session");
    return stored ? (JSON.parse(stored) as Session) : null;
  });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [units, setUnits] = useState<UnitRecord[]>([]);
  const [floors, setFloors] = useState<FloorRecord[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [registrationTab, setRegistrationTab] = useState<"users" | "roles" | "expenses">("users");
  const [registrationNavOpen, setRegistrationNavOpen] = useState(false);
  const [expenseCategoryForm, setExpenseCategoryForm] = useState(defaultExpenseCategoryForm);
  const [userPageMode, setUserPageMode] = useState<"list" | "create">("list");
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [rolePageMode, setRolePageMode] = useState<"list" | "create" | "permissions">("list");
  const [roleSearch, setRoleSearch] = useState("");
  const [rolePage, setRolePage] = useState(1);
  const [rolePageSize, setRolePageSize] = useState(10);
  const [expensePageMode, setExpensePageMode] = useState<"list" | "create">("list");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(10);
  const [form, setForm] = useState(defaultForm);
  const [tenantForm, setTenantForm] = useState(defaultTenantForm);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantTypeFilter, setTenantTypeFilter] = useState("All");
  const [tenantPage, setTenantPage] = useState(1);
  const [tenantPageSize, setTenantPageSize] = useState(10);
  const [editingTenantID, setEditingTenantID] = useState<string | null>(null);
  const [buildingPageMode, setBuildingPageMode] = useState<"list" | "create">("list");
  const [buildingSearch, setBuildingSearch] = useState("");
  const [buildingStatusFilter, setBuildingStatusFilter] = useState("All");
  const [buildingPage, setBuildingPage] = useState(1);
  const [buildingPageSize, setBuildingPageSize] = useState(10);
  const [targetBuildingID, setTargetBuildingID] = useState("");
  const [unitRows, setUnitRows] = useState([defaultUnitForm]);
  const [unitSearch, setUnitSearch] = useState("");
  const [unitTypeFilter, setUnitTypeFilter] = useState("All");
  const [unitStatusFilter, setUnitStatusFilter] = useState("All");
  const [unitFloorFilter, setUnitFloorFilter] = useState("All");
  const [unitPage, setUnitPage] = useState(1);
  const [unitPageSize, setUnitPageSize] = useState(10);
  const [unitPageMode, setUnitPageMode] = useState<"list" | "create" | "rent">(() =>
    window.location.pathname === "/units/new" ? "create" : window.location.pathname.includes("/rent") ? "rent" : "list",
  );
  const [tenantPageMode, setTenantPageMode] = useState<"list" | "create" | "edit" | "invoice">(() =>
    window.location.pathname === "/tenants/new" ? "create" : window.location.pathname === "/tenants/edit" ? "edit" : window.location.pathname.includes("/invoice") ? "invoice" : "list",
  );
  const [proformaTenantID, setProformaTenantID] = useState<string | null>(null);
  const [proformaForm, setProformaForm] = useState(defaultProformaForm);
  const [editingUnitID, setEditingUnitID] = useState<string | null>(null);
  const [rentUnitID, setRentUnitID] = useState<string | null>(null);
  const [contractForm, setContractForm] = useState(defaultContractForm);
  const [contractPageMode, setContractPageMode] = useState<"list" | "create" | "edit" | "upgrade" | "document">("list");
  const [contractSearch, setContractSearch] = useState("");
  const [contractStatusFilter, setContractStatusFilter] = useState("All");
  const [contractPage, setContractPage] = useState(1);
  const [contractPageSize, setContractPageSize] = useState(10);
  const [upgradingContractID, setUpgradingContractID] = useState<string | null>(null);
  const [editingContractID, setEditingContractID] = useState<string | null>(null);
  const [contractUpgradeForm, setContractUpgradeForm] = useState(defaultContractUpgradeForm);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("All");
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize, setInvoicePageSize] = useState(10);
  const [invoicePageMode, setInvoicePageMode] = useState<"list" | "payment">("list");
  const [payingInvoiceID, setPayingInvoiceID] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm);
  const [paymentPageMode, setPaymentPageMode] = useState<"list" | "create">("list");
  const [paymentTenantID, setPaymentTenantID] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentTenantFilter, setPaymentTenantFilter] = useState("All");
  const [paymentUnitFilter, setPaymentUnitFilter] = useState("All");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All");
  const [paymentInvoiceFilter, setPaymentInvoiceFilter] = useState("All");
  const [paymentDateFrom, setPaymentDateFrom] = useState("");
  const [paymentDateTo, setPaymentDateTo] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentPageSize, setPaymentPageSize] = useState(10);
  const [documentContractID, setDocumentContractID] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [reportsNavOpen, setReportsNavOpen] = useState(false);
  const [reportMode, setReportMode] = useState<ReportMode>("tenants");
  const [view, setView] = useState<View>("home");
  const [selectedBuildingID, setSelectedBuildingID] = useState(
    () => localStorage.getItem("masco-building-id") ?? "hq",
  );
  const [formError, setFormError] = useState("");
  const [profileForm, setProfileForm] = useState({
    full_name: session?.user.full_name ?? "",
    email: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
  });

  const goTo = (path: string) => {
    window.history.pushState({}, "", path);
    if (path === "/units/new") setUnitPageMode("create");
    if (path === "/units") setUnitPageMode("list");
    if (path.includes("/rent")) setUnitPageMode("rent");
    if (path === "/tenants/new") setTenantPageMode("create");
    if (path === "/tenants") setTenantPageMode("list");
    if (path === "/tenants/edit") setTenantPageMode("edit");
    if (path.startsWith("/tenants/") && path.includes("/invoice")) setTenantPageMode("invoice");
    if (path === "/contracts") setContractPageMode("list");
    if (path === "/contracts/new") setContractPageMode("create");
    if (path.includes("/edit")) setContractPageMode("edit");
    if (path.includes("/upgrade")) setContractPageMode("upgrade");
    if (path.includes("/document")) setContractPageMode("document");
    if (path === "/invoices") setInvoicePageMode("list");
    if (/^\/invoices\/[^/]+\/payment$/.test(path)) setInvoicePageMode("payment");
    if (path === "/payments") setPaymentPageMode("list");
    if (path === "/payments/new") setPaymentPageMode("create");
    if (path === "/buildings") setBuildingPageMode("list");
    if (path === "/buildings/new") setBuildingPageMode("create");
    if (path === "/reports/tenants") setReportMode("tenants");
    if (path === "/reports/transactions") setReportMode("transactions");
    if (path === "/reports/expenses") setReportMode("expenses");
    if (path === "/reports/cash-flow") setReportMode("cashflow");
    if (path === "/reports/monthly-rent") setReportMode("rent");
  };

  const logout = () => {
    localStorage.removeItem("masco-session");
    setSession(null);
  };

  const sessionExpiredRef = useRef(false);

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${apiURL}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${session?.token ?? ""}`,
      },
    });
    if (response.status === 401 && !sessionExpiredRef.current) {
      sessionExpiredRef.current = true;
      logout();
      void Swal.fire({
        icon: "info",
        title: "Session expired",
        text: "Please sign in again.",
        confirmButtonColor: "#133d32",
      });
    }
    return response;
  };

  const showRequestError = async (response: Response, fallback: string) => {
    const payload = (await response
      .json()
      .catch(() => ({ error: fallback }))) as { error?: string };
    await Swal.fire({
      icon: "error",
      title: "Could not complete request",
      text: payload.error ?? fallback,
      confirmButtonColor: "#133d32",
    });
  };

  const showSuccess = (title: string) =>
    Swal.fire({
      icon: "success",
      title,
      timer: 1600,
      showConfirmButton: false,
    });

  const readData = async (path: string) => {
    const response = await apiFetch(path);
    if (!response.ok) {
      throw new Error(`${path}: ${response.status}`);
    }
    return response.json() as Promise<{ data?: unknown }>;
  };

  const loadData = async () => {
    if (!session) return;
    try {
      const contextQuery =
        selectedBuildingID === "hq" ? "" : `?building_id=${selectedBuildingID}`;
      const [buildingData, tenantData, contractData, invoiceData, paymentData] =
        await Promise.all([
          readData("/buildings"),
          readData(`/tenants${contextQuery}`),
          readData(`/contracts${contextQuery}`),
          readData(`/invoices${contextQuery}`),
          readData(`/payments${contextQuery}`),
        ]);

      const nextBuildings = (buildingData.data ?? []) as BuildingRecord[];
      setBuildings(nextBuildings);
      if (
        selectedBuildingID !== "hq" &&
        !nextBuildings.some(
          (building) => String(building.id) === selectedBuildingID,
        )
      ) {
        switchBuilding("hq");
        return;
      }
      setTenants((tenantData.data ?? []) as TenantRecord[]);
      setContracts((contractData.data ?? []) as ContractRecord[]);
      setInvoices((invoiceData.data ?? []) as InvoiceRecord[]);
      setPayments((paymentData.data ?? []) as PaymentRecord[]);
    } catch {
      await Swal.fire({
        icon: "error",
        title: "Could not load portfolio data",
        text: "Check the API response and database schema. The failed request is available in the browser network panel.",
        confirmButtonColor: "#133d32",
      });
    }
  };

  useEffect(() => {
    if (session) void loadData();
  }, [session, selectedBuildingID]);

  useEffect(() => {
    if (!session) return;
    void apiFetch("/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((user) => {
        if (user)
          setProfileForm({ full_name: user.full_name, email: user.email });
      })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    localStorage.setItem("masco-building-id", selectedBuildingID);
    if (!session) {
      setUnits([]);
      setFloors([]);
      return;
    }
    const unitsEndpoint = selectedBuildingID === "hq" ? "/units" : `/buildings/${selectedBuildingID}/units`;
    const floorsEndpoint = selectedBuildingID === "hq" ? "/floors" : `/buildings/${selectedBuildingID}/floors`;
    void Promise.all([
      apiFetch(unitsEndpoint),
      apiFetch(floorsEndpoint),
    ])
      .then(async ([unitsResponse, floorsResponse]) => {
        if (!unitsResponse.ok || !floorsResponse.ok)
          throw new Error("Could not load building data");
        const [unitsPayload, floorsPayload] = await Promise.all([
          unitsResponse.json(),
          floorsResponse.json(),
        ]);
        setUnits(unitsPayload.data ?? []);
        setFloors(floorsPayload.data ?? []);
      })
      .catch(() => {
        setUnits([]);
        setFloors([]);
      });
  }, [selectedBuildingID, session]);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/units\/(\d+)\/rent$/);
    if (!match || units.length === 0) return;
    const unit = units.find((item) => String(item.id) === match[1]);
    if (unit) {
      setRentUnitID(unit.id);
      setContractForm((current) => ({ ...current, unit_id: unit.id, contract_type: unit.type, monthly_rent: formatAmount(unit.base_rent) }));
    }
  }, [units]);

  useEffect(() => {
    if (view === "registration") setRegistrationNavOpen(true);
  }, [view]);

  useEffect(() => {
    if (view === "reports") setReportsNavOpen(true);
  }, [view]);

  useEffect(() => {
    if (view !== "registration" || !session) return;
    void Promise.all([apiFetch("/auth/users"), apiFetch("/auth/roles"), apiFetch("/auth/permissions"), apiFetch("/expense-categories")])
      .then(async ([usersResponse, rolesResponse, permissionsResponse, expenseCategoriesResponse]) => {
        const usersPayload = await usersResponse.json();
        const rolesPayload = await rolesResponse.json();
        const permissionsPayload = await permissionsResponse.json();
        const expenseCategoriesPayload = await expenseCategoriesResponse.json();
        setAdminUsers(usersPayload.data ?? []);
        setRoles(rolesPayload.data ?? []);
        setPermissions(permissionsPayload.data ?? []);
        setExpenseCategories(expenseCategoriesPayload.data ?? []);
        setSelectedRole((current) => current || (rolesPayload.data ?? [])[0] || "");
      })
      .catch(() => {});
  }, [view, session]);

  useEffect(() => {
    if (view !== "registration" || rolePageMode !== "permissions" || !selectedRole) return;
    void apiFetch(`/auth/roles/${encodeURIComponent(selectedRole)}/permissions`)
      .then((response) => (response.ok ? response.json() : { data: [] }))
      .then((payload) => setRolePermissions(payload.data ?? []))
      .catch(() => setRolePermissions([]));
  }, [view, rolePageMode, selectedRole]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError("");
    const response = await fetch(`${apiURL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });
    if (!response.ok) {
      setLoginError("Invalid username or password.");
      await showRequestError(response, "Invalid username or password.");
      return;
    }
    const nextSession = (await response.json()) as Session;
    localStorage.setItem("masco-session", JSON.stringify(nextSession));
    sessionExpiredRef.current = false;
    setSession(nextSession);
    void showSuccess("Welcome back");
  };

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleTenantChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setTenantForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const editTenant = (tenant: TenantRecord) => {
    setEditingTenantID(tenant.id);
    setTenantForm({
      ...defaultTenantForm,
      type: tenant.type,
      full_name: tenant.full_name ?? "",
      company_name: tenant.company_name ?? "",
      contact_person: tenant.contact_person ?? "",
      phone: tenant.phone ?? "",
      email: tenant.email ?? "",
      address: tenant.address ?? "",
      id_number: tenant.id_number ?? "",
      notes: tenant.notes ?? "",
    });
    goTo("/tenants/edit");
  };

  const deleteTenant = async (tenant: TenantRecord) => {
    const rentedUnits = contracts
      .filter((contract) => String(contract.tenant_id) === String(tenant.id))
      .map((contract) => units.find((unit) => String(unit.id) === String(contract.unit_id))?.number)
      .filter(Boolean);
    if (rentedUnits.length > 0) {
      await Swal.fire({
        icon: "info",
        title: "Tenant cannot be deleted",
        text: `This tenant has rented unit${rentedUnits.length === 1 ? "" : "s"}: ${rentedUnits.join(", ")}.`,
        confirmButtonColor: "#133d32",
      });
      return;
    }
    const result = await Swal.fire({
      icon: "warning",
      title: `Delete ${tenant.full_name || tenant.company_name || "tenant"}?`,
      text: "This action cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#d9574f",
    });
    if (!result.isConfirmed) return;
    const response = await apiFetch(`/tenants/${tenant.id}`, { method: "DELETE" });
    if (!response.ok) {
      await showRequestError(response, "Could not delete tenant.");
      return;
    }
    setTenants((current) => current.filter((item) => item.id !== tenant.id));
    void showSuccess("Tenant deleted");
  };

  const updateUnitRow = (rowIndex: number, field: string, value: string) => {
    setUnitRows((current) =>
      current.map((row, index) =>
        index === rowIndex ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addUnitRow = () =>
    setUnitRows((current) => [...current, { ...defaultUnitForm }]);

  const removeUnitRow = (rowIndex: number) =>
    setUnitRows((current) =>
      current.length === 1
        ? current
        : current.filter((_, index) => index !== rowIndex),
    );

  const editUnit = (unit: UnitRecord) => {
    setEditingUnitID(unit.id);
    setUnitRows([{ number: unit.number, floor_id: unit.floor_id ?? "", type: unit.type, description: "", status: unit.status, base_rent: formatAmount(unit.base_rent) }]);
    goTo(`/units/edit/${unit.id}`);
  };

  const rentUnit = (unit: UnitRecord) => {
    setRentUnitID(unit.id);
    setContractForm((current) => ({ ...current, unit_id: unit.id, contract_type: unit.type, monthly_rent: formatAmount(unit.base_rent), start_date: new Date().toISOString().slice(0, 10), period: "1", prepaid_amount: "0" }));
    goTo(`/units/${unit.id}/rent`);
  };

  const deleteUnit = async (unit: UnitRecord) => {
    const result = await Swal.fire({
      icon: "warning",
      title: `Delete ${unit.number}?`,
      text: "This action cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#d9574f",
    });
    if (!result.isConfirmed) return;
    const response = await apiFetch(`/units/${unit.id}`, { method: "DELETE" });
    if (!response.ok) {
      await showRequestError(response, "Could not delete unit.");
      return;
    }
    setUnits((current) => current.filter((item) => item.id !== unit.id));
    void showSuccess("Unit deleted");
  };

  const handleUnitSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const effectiveBuildingID = targetBuildingID || (selectedBuildingID === "hq" ? "" : selectedBuildingID);
    if (!effectiveBuildingID) {
      await Swal.fire({
        icon: "info",
        title: "Choose a building first",
        text: "Select the building this unit belongs to.",
        confirmButtonColor: "#133d32",
      });
      return;
    }
    if (editingUnitID) {
      const row = unitRows[0];
      const response = await apiFetch(`/units/${editingUnitID}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...row, id: Number(editingUnitID), building_id: Number(effectiveBuildingID), floor_id: Number(row.floor_id) || 0, base_rent: amountNumber(row.base_rent) }) });
      if (!response.ok) { await showRequestError(response, "Could not update unit."); return; }
      const payload = await apiFetch(selectedBuildingID === "hq" ? "/units" : `/buildings/${selectedBuildingID}/units`);
      const data = await payload.json();
      setUnits(data.data ?? []);
      setEditingUnitID(null);
      setUnitRows([{ ...defaultUnitForm }]);
      goTo("/units");
      void showSuccess("Unit updated");
      return;
    }
    for (const row of unitRows) {
      const response = await apiFetch(
        `/buildings/${effectiveBuildingID}/units`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...row,
            floor_id: Number(row.floor_id) || 0,
            base_rent: amountNumber(row.base_rent),
          }),
        },
      );
      if (!response.ok) {
        await showRequestError(response, "Could not save unit.");
        return;
      }
    }
    const payload = await apiFetch(selectedBuildingID === "hq" ? "/units" : `/buildings/${selectedBuildingID}/units`);
    const data = await payload.json();
    setUnits(data.data ?? []);
    setUnitRows([{ ...defaultUnitForm }]);
    goTo("/units");
    void showSuccess("Unit saved");
  };

  const handleContractChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setContractForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const rentStartDate = contractForm.start_date ? new Date(`${contractForm.start_date}T00:00:00`) : null;
  const rentPeriod = Math.max(1, Number(contractForm.period) || 1);
  const calculatedEndDate = rentStartDate ? new Date(rentStartDate.getFullYear(), rentStartDate.getMonth() + rentPeriod, rentStartDate.getDate()).toISOString().slice(0, 10) : "";
  const totalRent = amountNumber(contractForm.monthly_rent) * rentPeriod;
  const prepaidAmount = amountNumber(contractForm.prepaid_amount);
  const balanceAmount = Math.max(0, totalRent - prepaidAmount);

  const handlePaymentChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    if (event.target.name === "invoice_id") {
      const invoice = invoices.find((item) => String(item.id) === event.target.value);
      setPaymentForm((current) => ({
        ...current,
        invoice_id: event.target.value,
        amount: invoice ? formatAmount(Math.max(0, invoice.amount - invoicePaidAmount(invoice.id))) : "",
      }));
      return;
    }
    setPaymentForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setFormError("");

    const response = await apiFetch("/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        floors: Number(form.floors),
      }),
    });

    if (response.ok) {
      await loadData();
      setForm(defaultForm);
      goTo("/buildings");
      void showSuccess("Building saved");
    } else {
      const error = (await response
        .json()
        .catch(() => ({ error: "Could not save building." }))) as {
        error?: string;
      };
      setFormError(error.error ?? "Could not save building.");
      await Swal.fire({
        icon: "error",
        title: "Building not saved",
        text: error.error ?? "Could not save building.",
        confirmButtonColor: "#133d32",
      });
    }
  };

  const handleTenantSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const response = await apiFetch(
      editingTenantID ? `/tenants/${editingTenantID}` : "/tenants",
      {
      method: editingTenantID ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...tenantForm,
        building_id: Number(selectedBuildingID),
      }),
      },
    );

    if (response.ok) {
      const createdTenant = (await response.json()) as TenantRecord;
      await loadData();
      setTenantForm(defaultTenantForm);
      setEditingTenantID(null);
      if (editingTenantID) {
        goTo("/tenants");
        void showSuccess("Tenant updated");
      } else {
        setProformaTenantID(createdTenant.id);
        setProformaForm(defaultProformaForm);
        goTo(`/tenants/${createdTenant.id}/invoice`);
        void showSuccess("Tenant saved. Prepare the invoice.");
      }
    } else {
      await showRequestError(response, "Could not save tenant.");
    }
  };

  const handleProformaChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setProformaForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const createContractInvoice = async (
    contract: ContractRecord,
    prepaidAmount: number,
    paymentMethod: string,
    paymentDate: string,
  ) => {
    const invoiceResponse = await apiFetch(`/contracts/${contract.id}/invoices`, {
      method: "POST",
    });
    if (!invoiceResponse.ok) {
      await showRequestError(invoiceResponse, "Contract saved, but its invoice could not be generated.");
      return false;
    }
    const invoice = (await invoiceResponse.json()) as InvoiceRecord;
    if (prepaidAmount <= 0) return true;
    const paymentResponse = await apiFetch("/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_id: Number(invoice.id),
        amount: prepaidAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        payment_reference: `PREPAY-${contract.id}-${Date.now()}`,
        notes: "Prepaid during contract creation",
      }),
    });
    if (!paymentResponse.ok) {
      await showRequestError(paymentResponse, "Invoice generated, but the prepaid amount could not be recorded.");
      return false;
    }
    return true;
  };

  const handleProformaSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const selectedUnit = units.find((unit) => String(unit.id) === proformaForm.unit_id);
    if (!selectedUnit || !proformaTenantID) return;
    const period = Math.max(1, Number(proformaForm.period) || 1);
    const startDate = new Date(`${proformaForm.start_date}T00:00:00`);
    const endDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + period,
      startDate.getDate(),
    ).toISOString().slice(0, 10);
    const contractResponse = await apiFetch("/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: Number(proformaTenantID),
        unit_id: Number(selectedUnit.id),
        contract_type: selectedUnit.type,
        start_date: proformaForm.start_date,
        end_date: endDate,
        monthly_rent: selectedUnit.base_rent,
        payment_frequency: "Monthly",
        status: "Active",
        notes: `Prepaid amount: ${formatAmount(proformaForm.prepaid_amount)}`,
      }),
    });
    if (!contractResponse.ok) {
      await showRequestError(contractResponse, "Could not create the tenant contract.");
      return;
    }
    const contract = (await contractResponse.json()) as ContractRecord;
    const completed = await createContractInvoice(
      contract,
      amountNumber(proformaForm.prepaid_amount),
      "Bank Transfer",
      proformaForm.issue_date,
    );
    if (!completed) return;
    await loadData();
    void showSuccess("Proforma invoice generated");
    setView("tenants");
    goTo("/tenants");
  };

  const handleContractSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const rentNotes = rentUnitID && amountNumber(contractForm.prepaid_amount) > 0
      ? `${contractForm.notes}${contractForm.notes ? "\n" : ""}Prepaid amount: ${formatAmount(contractForm.prepaid_amount)}`
      : contractForm.notes
    const response = await apiFetch(editingContractID ? `/contracts/${editingContractID}` : "/contracts", {
      method: editingContractID ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...contractForm,
        tenant_id: Number(contractForm.tenant_id),
        unit_id: Number(contractForm.unit_id),
        monthly_rent: amountNumber(contractForm.monthly_rent),
        end_date: rentUnitID ? calculatedEndDate : contractForm.end_date,
        notes: rentNotes,
      }),
    });

    if (response.ok) {
      if (editingContractID) {
        await loadData();
        setContractForm(defaultContractForm);
        setEditingContractID(null);
        goTo("/contracts");
        void showSuccess("Contract updated");
        return;
      }
      const contract = (await response.json()) as ContractRecord;
      const completed = await createContractInvoice(
        contract,
        amountNumber(contractForm.prepaid_amount),
        contractForm.payment_method,
        contractForm.start_date || new Date().toISOString().slice(0, 10),
      );
      if (!completed) return;
      await loadData();
      setContractForm(defaultContractForm);
      if (rentUnitID) {
        setRentUnitID(null)
        goTo('/units')
      } else {
        goTo("/contracts");
      }
      void showSuccess("Contract saved");
    } else {
      await showRequestError(response, "Could not save contract.");
    }
  };

  const editContract = (contract: ContractRecord) => {
    setEditingContractID(contract.id);
    setContractForm({
      ...defaultContractForm,
      tenant_id: String(contract.tenant_id),
      unit_id: String(contract.unit_id),
      contract_type: contract.contract_type,
      start_date: dateOnly(contract.start_date),
      end_date: dateOnly(contract.end_date),
      monthly_rent: formatAmount(contract.monthly_rent),
      payment_method: contract.payment_method || "Bank Transfer",
      payment_frequency: contract.payment_frequency || "Monthly",
      utility_responsibility: contract.utility_responsibility || defaultContractForm.utility_responsibility,
      terms: contract.terms || "",
      status: contract.status,
      notes: contract.notes || "",
    });
    goTo(`/contracts/${contract.id}/edit`);
  };

  const deleteContract = async (contract: ContractRecord) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete contract permanently?",
      text: "Use Terminate if you need to preserve contract history. Contracts with invoices or signed documents cannot be deleted.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#d9574f",
    });
    if (!result.isConfirmed) return;
    const response = await apiFetch(`/contracts/${contract.id}`, { method: "DELETE" });
    if (!response.ok) {
      await showRequestError(response, "Could not delete contract.");
      return;
    }
    await loadData();
    void showSuccess("Contract deleted");
  };

  const terminateContract = async (contract: ContractRecord) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Terminate contract?",
      text: "The unit will become available for rent.",
      showCancelButton: true,
      confirmButtonText: "Terminate",
      confirmButtonColor: "#d9574f",
    });
    if (!result.isConfirmed) return;
    const response = await apiFetch(`/contracts/${contract.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contract, status: "Cancelled" }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not terminate contract.");
      return;
    }
    await loadData();
    void showSuccess("Contract terminated");
  };

  const upgradeContract = (contract: ContractRecord) => {
    setUpgradingContractID(contract.id);
    setContractUpgradeForm(defaultContractUpgradeForm);
    goTo(`/contracts/${contract.id}/upgrade`);
  };

  const handleContractUpgradeSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const contract = contracts.find((item) => item.id === upgradingContractID);
    if (!contract) return;
    const period = Math.max(1, Number(contractUpgradeForm.period) || 1);
    const currentEndDate = new Date(`${dateOnly(contract.end_date)}T00:00:00`);
    const endDate = new Date(currentEndDate.getFullYear(), currentEndDate.getMonth() + period, currentEndDate.getDate()).toISOString().slice(0, 10);
    const response = await apiFetch(`/contracts/${contract.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contract, end_date: endDate, status: "Active" }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not upgrade contract.");
      return;
    }
    const addedAmount = contract.monthly_rent * period;
    const invoiceResponse = await apiFetch("/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_id: Number(contract.id),
        tenant_id: Number(contract.tenant_id),
        building_id: contract.building_id,
        unit_id: Number(contract.unit_id),
        number: `UPG-${contract.id}-${contractUpgradeForm.payment_date.replaceAll("-", "")}-${Date.now()}`,
        issue_date: contractUpgradeForm.payment_date,
        due_date: contractUpgradeForm.payment_date,
        amount: addedAmount,
        description: `Contract upgrade for ${period} month${period === 1 ? "" : "s"}`,
        status: "Pending",
      }),
    });
    if (!invoiceResponse.ok) {
      await showRequestError(invoiceResponse, "Contract upgraded, but the upgrade invoice could not be created.");
      return;
    }
    const invoice = (await invoiceResponse.json()) as InvoiceRecord;
    const prepaidAmount = amountNumber(contractUpgradeForm.prepaid_amount);
    if (prepaidAmount > 0) {
      const paymentResponse = await apiFetch("/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: Number(invoice.id),
          amount: prepaidAmount,
          payment_date: contractUpgradeForm.payment_date,
          payment_method: contract.payment_method || "Bank Transfer",
          payment_reference: `UPG-PREPAY-${contract.id}-${Date.now()}`,
          notes: "Prepaid during contract upgrade",
        }),
      });
      if (!paymentResponse.ok) {
        await showRequestError(paymentResponse, "Upgrade invoice created, but the prepaid amount could not be recorded.");
        return;
      }
    }
    await loadData();
    setContractPageMode("list");
    goTo("/contracts");
    void showSuccess("Contract upgraded");
  };

  const payContractInvoice = (contractID: string) => {
    const invoice = invoices.find((item) => String(item.contract_id) === String(contractID));
    if (!invoice) {
      void Swal.fire({ icon: "info", title: "No invoice yet", text: "Generate an invoice for this contract before recording payment.", confirmButtonColor: "#133d32" });
      return;
    }
    setPaymentTenantID(String(invoice.tenant_id));
    setPaymentForm((current) => ({ ...current, invoice_id: invoice.id, amount: formatAmount(Math.max(0, invoice.amount - invoicePaidAmount(invoice.id))) }));
    setView("payments");
    goTo("/payments/new");
  };

  const payInvoice = (invoice: InvoiceRecord) => {
    const balance = Math.max(0, invoice.amount - invoicePaidAmount(invoice.id));
    if (balance === 0) return;
    setPaymentTenantID(String(invoice.tenant_id));
    setPaymentForm((current) => ({ ...current, invoice_id: invoice.id, amount: formatAmount(balance) }));
    setPayingInvoiceID(invoice.id);
    setView("invoices");
    goTo(`/invoices/${invoice.id}/payment`);
  };

  const showInvoicePayments = async (invoice: InvoiceRecord) => {
    const invoicePayments = payments.filter((payment) => String(payment.invoice_id) === String(invoice.id));
    await Swal.fire({
      icon: "info",
      title: `Payments for ${invoice.number}`,
      text: invoicePayments.length
        ? invoicePayments.map((payment) => `${dateOnly(payment.payment_date)} · ${payment.payment_method} · ${formatAmount(payment.amount)} · ${payment.payment_reference}`).join("\n")
        : "No payments recorded for this invoice.",
      confirmButtonColor: "#133d32",
    });
  };

  const viewInvoice = (invoice: InvoiceRecord) => {
    const contract = contracts.find((item) => String(item.id) === String(invoice.contract_id));
    const tenant = tenants.find((item) => String(item.id) === String(invoice.tenant_id));
    const unit = units.find((item) => String(item.id) === String(invoice.unit_id));
    const paid = invoicePaidAmount(invoice.id);
    const balance = Math.max(0, invoice.amount - paid);
    const tenantName = tenant?.full_name || tenant?.company_name || "Unknown tenant";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(invoice.number)}</title><style>body{max-width:850px;margin:48px auto;font:15px Arial,sans-serif;color:#17231f}h1{margin-bottom:4px}p{color:#69756e}table{width:100%;margin-top:28px;border-collapse:collapse}th,td{padding:12px;border:1px solid #dfe5dd;text-align:left}.totals{margin:26px 0 0 auto;width:320px}.totals div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #dfe5dd}@media print{body{margin:20px}}</style></head><body><h1>Invoice ${escapeHTML(invoice.number)}</h1><p>${escapeHTML(tenantName)} · Room ${escapeHTML(unit?.number || "-")}</p><table><tr><th>Period</th><th>Monthly price</th><th>Issue date</th><th>Status</th></tr><tr><td>${escapeHTML(dateOnly(contract?.start_date || invoice.issue_date))} to ${escapeHTML(dateOnly(contract?.end_date || invoice.due_date))}</td><td>${escapeHTML(formatAmount(contract?.monthly_rent || invoice.amount))}</td><td>${escapeHTML(dateOnly(invoice.issue_date))}</td><td>${escapeHTML(balance === 0 ? "Paid" : paid > 0 ? "Partially Paid" : invoice.status)}</td></tr></table><div class="totals"><div><span>Total</span><strong>${escapeHTML(formatAmount(invoice.amount))}</strong></div><div><span>Paid</span><strong>${escapeHTML(formatAmount(paid))}</strong></div><div><span>Balance</span><strong>${escapeHTML(formatAmount(balance))}</strong></div></div><script>window.print()</script></body></html>`;
    const invoiceURL = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(invoiceURL, "_blank", "noopener,noreferrer");
  };

  const handlePaymentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const returnToInvoices = view === "invoices" && invoicePageMode === "payment";
    const response = await apiFetch("/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...paymentForm,
        invoice_id: Number(paymentForm.invoice_id),
        amount: amountNumber(paymentForm.amount),
      }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not record payment.");
      return;
    }
    await loadData();
    setPaymentForm(defaultPaymentForm);
    setPaymentTenantID("");
    setPayingInvoiceID(null);
    goTo(returnToInvoices ? "/invoices" : "/payments");
    void showSuccess("Payment recorded");
  };

  const handleLogout = async () => {
    const confirmation = await Swal.fire({
      icon: "question",
      title: "Sign out?",
      showCancelButton: true,
      confirmButtonText: "Sign out",
      confirmButtonColor: "#133d32",
    });
    if (!confirmation.isConfirmed) return;
    logout();
  };

  const handleProfileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setProfileForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const response = await apiFetch("/auth/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileForm),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not update profile.");
      return;
    }
    const updated = (await response.json()) as Session["user"];
    if (session) {
      const nextSession = {
        ...session,
        user: { ...session.user, full_name: updated.full_name },
      };
      localStorage.setItem("masco-session", JSON.stringify(nextSession));
      setSession(nextSession);
    }
    void showSuccess("Profile updated");
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      await Swal.fire({
        icon: "error",
        title: "Passwords do not match",
        confirmButtonColor: "#133d32",
      });
      return;
    }
    const response = await apiFetch("/auth/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not change password.");
      return;
    }
    setPasswordForm({
      current_password: "",
      new_password: "",
      confirm_password: "",
    });
    void showSuccess("Password changed");
  };

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    const response = await apiFetch("/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUserForm),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not register user.");
      return;
    }
    const usersResponse = await apiFetch("/auth/users");
    if (usersResponse.ok) {
      const usersPayload = await usersResponse.json();
      setAdminUsers(usersPayload.data ?? []);
    }
    setNewUserForm({ username: "", email: "", full_name: "", password: "" });
    setUserPageMode("list");
    void showSuccess("User registered");
  };

  const handleExpenseCategorySubmit = async (event: FormEvent) => {
    event.preventDefault();
    const response = await apiFetch("/expense-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expenseCategoryForm),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not save expense category.");
      return;
    }
    const created = (await response.json()) as ExpenseCategoryRecord;
    setExpenseCategories((current) => [...current, created]);
    setExpenseCategoryForm(defaultExpenseCategoryForm);
    setExpensePageMode("list");
    void showSuccess("Expense category saved");
  };

  const handleCreateRole = async (event: FormEvent) => {
    event.preventDefault();
    const response = await apiFetch("/auth/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoleName }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not create role.");
      return;
    }
    setRoles((current) => [...current, newRoleName]);
    setNewRoleName("");
    setRolePageMode("list");
    void showSuccess("Role created");
  };

  const manageRolePermissions = (role: string) => {
    setSelectedRole(role);
    setRolePageMode("permissions");
  };

  const toggleRolePermission = async (permission: string, granted: boolean) => {
    if (!selectedRole) return;
    const response = granted
      ? await apiFetch(`/auth/roles/${encodeURIComponent(selectedRole)}/permissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permission }),
        })
      : await apiFetch(`/auth/roles/${encodeURIComponent(selectedRole)}/permissions/${encodeURIComponent(permission)}`, {
          method: "DELETE",
        });
    if (!response.ok) {
      await showRequestError(response, "Could not update role permission.");
      return;
    }
    setRolePermissions((current) =>
      granted ? [...current, permission] : current.filter((item) => item !== permission),
    );
  };

  const updateUserStatus = async (userID: number, status: string) => {
    const response = await apiFetch(`/auth/users/${userID}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not update user.");
      return;
    }
    setAdminUsers((current) =>
      current.map((user) => (user.id === userID ? { ...user, status } : user)),
    );
    void showSuccess("User updated");
  };

  const assignUserRole = async (userID: number, role: string) => {
    const response = await apiFetch(`/auth/users/${userID}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not assign role.");
      return;
    }
    setAdminUsers((current) =>
      current.map((user) =>
        user.id === userID && !user.roles.includes(role)
          ? { ...user, roles: [...user.roles, role] }
          : user,
      ),
    );
    void showSuccess("Role assigned");
  };

  const handleDocumentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!documentContractID || !documentFile) return;

    const payload = new FormData();
    payload.append("file", documentFile);
    payload.append("name", documentName || documentFile.name);
    const response = await apiFetch(
      `/contracts/${documentContractID}/documents`,
      {
        method: "POST",
        body: payload,
      },
    );

    if (response.ok) {
      setDocumentContractID("");
      setDocumentName("");
      setDocumentFile(null);
      goTo("/contracts");
      void showSuccess("Signed contract uploaded");
    } else {
      await showRequestError(response, "Could not upload the document.");
    }
  };

  const handleContractPreview = async (contractID: string) => {
    const response = await apiFetch(`/contracts/${contractID}/preview`);
    if (!response.ok) {
      await showRequestError(response, "Could not generate contract.");
      return;
    }
    const documentURL = URL.createObjectURL(await response.blob());
    window.open(documentURL, "_blank", "noopener,noreferrer");
  };

  const handleContractView = async (contractID: string) => {
    const documentsResponse = await apiFetch(`/contracts/${contractID}/documents`);
    if (!documentsResponse.ok) {
      await showRequestError(documentsResponse, "Could not load contract documents.");
      return;
    }
    const payload = (await documentsResponse.json()) as { data?: unknown[] };
    if (!payload.data?.length) {
      await handleContractPreview(contractID);
      return;
    }
    const response = await apiFetch(`/contracts/${contractID}/documents/latest`);
    if (!response.ok) {
      await showRequestError(response, "Could not open the signed contract.");
      return;
    }
    const documentURL = URL.createObjectURL(await response.blob());
    window.open(documentURL, "_blank", "noopener,noreferrer");
  };

  const attachSignedContract = (contractID: string) => {
    setDocumentContractID(contractID);
    setDocumentName("");
    setDocumentFile(null);
    goTo(`/contracts/${contractID}/document`);
  };

  if (!session) {
    return (
      <main className="login-shell">
        <section className="login-story">
          <div className="login-brand">
            <span className="brand-mark">M</span>
            <span>
              Masco<span>Rent</span>
            </span>
          </div>
          <div className="story-copy">
            <p className="eyebrow">Property operations</p>
            <h1>
              Every building,
              <br />
              under control.
            </h1>
            <p>
              One quiet workspace for occupancy, tenants, contracts, and the
              details that keep each property moving.
            </p>
          </div>
          <img
            className="login-illustration"
            src={heroImage}
            alt="Layered building platform"
          />
          <p className="story-footer">MASCO APARTMENTS</p>
        </section>
        <form className="login-panel" onSubmit={handleLogin}>
          <div className="login-heading">
            <p className="eyebrow">Welcome back</p>
            <h1>Sign in to your workspace</h1>
            <p>Use your MascoRent account to continue.</p>
          </div>
          <label>
            Username or email
            <input
              value={loginForm.username}
              onChange={(event) =>
                setLoginForm((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
              autoComplete="username"
              placeholder="name@company.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
          </label>
          {loginError && <p className="form-error">{loginError}</p>}
          <button className="primary-button" type="submit">
            Sign in
          </button>
        </form>
      </main>
    );
  }

  const selectedBuilding = buildings.find(
    (building) => String(building.id) === selectedBuildingID,
  );
  const pageTitle: Record<View, string> = {
    home: selectedBuildingID === "hq" ? "Home" : "Branch home",
    buildings: "Buildings",
    units: "Units",
    tenants: "Tenants",
    contracts: "Contracts",
    invoices: "Invoices",
    payments: "Payments",
    registration: "Registration",
    reports: "Reports",
    settings: "Settings",
  };

  const filteredBuildings = buildings.filter((building) => {
    const search = buildingSearch.toLowerCase();
    const searchable = `${building.name} ${building.code} ${building.address}`.toLowerCase();
    return (!search || searchable.includes(search)) && (buildingStatusFilter === "All" || building.status === buildingStatusFilter);
  });
  const buildingPageCount = Math.max(1, Math.ceil(filteredBuildings.length / buildingPageSize));
  const visibleBuildings = filteredBuildings.slice((buildingPage - 1) * buildingPageSize, buildingPage * buildingPageSize);

  const filteredAdminUsers = adminUsers.filter((user) => {
    const search = userSearch.toLowerCase();
    const searchable = `${user.full_name} ${user.username} ${user.email}`.toLowerCase();
    return !search || searchable.includes(search);
  });
  const userPageCount = Math.max(1, Math.ceil(filteredAdminUsers.length / userPageSize));
  const visibleAdminUsers = filteredAdminUsers.slice((userPage - 1) * userPageSize, userPage * userPageSize);

  const filteredRoles = roles.filter((role) => {
    const search = roleSearch.toLowerCase();
    return !search || role.toLowerCase().includes(search);
  });
  const rolePageCount = Math.max(1, Math.ceil(filteredRoles.length / rolePageSize));
  const visibleRoles = filteredRoles.slice((rolePage - 1) * rolePageSize, rolePage * rolePageSize);

  const filteredExpenseCategories = expenseCategories.filter((category) => {
    const search = expenseSearch.toLowerCase();
    return !search || category.name.toLowerCase().includes(search);
  });
  const expensePageCount = Math.max(1, Math.ceil(filteredExpenseCategories.length / expensePageSize));
  const visibleExpenseCategories = filteredExpenseCategories.slice((expensePage - 1) * expensePageSize, expensePage * expensePageSize);

  const filteredUnits = units.filter((unit) => {
    const search = unitSearch.toLowerCase();
    return (
      (!search || unit.number.toLowerCase().includes(search)) &&
      (unitTypeFilter === "All" || unit.type === unitTypeFilter) &&
      (unitStatusFilter === "All" || unit.status === unitStatusFilter) &&
      (unitFloorFilter === "All" ||
        String(unit.floor_id ?? "") === unitFloorFilter)
    );
  });
  const unitPageCount = Math.max(
    1,
    Math.ceil(filteredUnits.length / unitPageSize),
  );
  const visibleUnits = filteredUnits.slice(
    (unitPage - 1) * unitPageSize,
    unitPage * unitPageSize,
  );
  const filteredTenants = tenants.filter((tenant) => {
    const search = tenantSearch.toLowerCase();
    const name = (tenant.full_name || tenant.company_name || "").toLowerCase();
    return (
      (!search || `${name} ${tenant.phone || ""} ${tenant.email || ""}`.toLowerCase().includes(search)) &&
      (tenantTypeFilter === "All" || tenant.type === tenantTypeFilter)
    );
  });
  const tenantPageCount = Math.max(
    1,
    Math.ceil(filteredTenants.length / tenantPageSize),
  );
  const visibleTenants = filteredTenants.slice(
    (tenantPage - 1) * tenantPageSize,
    tenantPage * tenantPageSize,
  );
  const filteredUnitsRentTotal = filteredUnits.reduce(
    (total, unit) => total + unit.base_rent,
    0,
  );
  const filteredContracts = contracts.filter((contract) => {
    const tenant = tenants.find((item) => String(item.id) === String(contract.tenant_id));
    const unit = units.find((item) => String(item.id) === String(contract.unit_id));
    const search = contractSearch.toLowerCase();
    const searchable = `${tenant?.full_name || tenant?.company_name || ""} ${unit?.number || ""}`.toLowerCase();
    return (!search || searchable.includes(search)) && (contractStatusFilter === "All" || contract.status === contractStatusFilter);
  });
  const contractPageCount = Math.max(1, Math.ceil(filteredContracts.length / contractPageSize));
  const visibleContracts = filteredContracts.slice((contractPage - 1) * contractPageSize, contractPage * contractPageSize);
  const invoicePaidAmount = (invoiceID: string) => payments
    .filter((payment) => String(payment.invoice_id) === String(invoiceID))
    .reduce((total, payment) => total + payment.amount, 0);
  const filteredInvoices = invoices.filter((invoice) => {
    const tenant = tenants.find((item) => String(item.id) === String(invoice.tenant_id));
    const unit = units.find((item) => String(item.id) === String(invoice.unit_id));
    const paid = invoicePaidAmount(invoice.id);
    const effectiveStatus = paid >= invoice.amount ? "Paid" : paid > 0 ? "Partially Paid" : invoice.status;
    const searchable = `${invoice.number} ${tenant?.full_name || tenant?.company_name || ""} ${unit?.number || ""}`.toLowerCase();
    return (!invoiceSearch || searchable.includes(invoiceSearch.toLowerCase())) && (invoiceStatusFilter === "All" || effectiveStatus === invoiceStatusFilter);
  });
  const invoicePageCount = Math.max(1, Math.ceil(filteredInvoices.length / invoicePageSize));
  const visibleInvoices = filteredInvoices.slice((invoicePage - 1) * invoicePageSize, invoicePage * invoicePageSize);
  const filteredPayments = payments.filter((payment) => {
    const tenant = tenants.find((item) => String(item.id) === String(payment.tenant_id));
    const unit = units.find((item) => String(item.id) === String(payment.unit_id));
    const invoice = invoices.find((item) => String(item.id) === String(payment.invoice_id));
    const searchable = `${payment.payment_reference} ${payment.receipt_number || ""} ${tenant?.full_name || tenant?.company_name || ""} ${unit?.number || ""} ${invoice?.number || ""}`.toLowerCase();
    return (
      (!paymentSearch || searchable.includes(paymentSearch.toLowerCase())) &&
      (paymentTenantFilter === "All" || String(payment.tenant_id) === paymentTenantFilter) &&
      (paymentUnitFilter === "All" || String(payment.unit_id) === paymentUnitFilter) &&
      (paymentMethodFilter === "All" || payment.payment_method === paymentMethodFilter) &&
      (paymentInvoiceFilter === "All" || String(payment.invoice_id) === paymentInvoiceFilter) &&
      (!paymentDateFrom || dateOnly(payment.payment_date) >= paymentDateFrom) &&
      (!paymentDateTo || dateOnly(payment.payment_date) <= paymentDateTo)
    );
  });
  const paymentPageCount = Math.max(1, Math.ceil(filteredPayments.length / paymentPageSize));
  const visiblePayments = filteredPayments.slice((paymentPage - 1) * paymentPageSize, paymentPage * paymentPageSize);
  const filteredPaymentTotal = filteredPayments.reduce((total, payment) => total + payment.amount, 0);

  const resetUnitList = () => {
    setUnitSearch("");
    setUnitTypeFilter("All");
    setUnitStatusFilter("All");
    setUnitFloorFilter("All");
    setUnitPage(1);
    setUnitPageSize(10);
  };

  const resetTenantList = () => {
    setTenantSearch("");
    setTenantTypeFilter("All");
    setTenantPage(1);
    setTenantPageSize(10);
  };

  const resetContractList = () => {
    setContractSearch("");
    setContractStatusFilter("All");
    setContractPage(1);
    setContractPageSize(10);
    setUpgradingContractID(null);
    setEditingContractID(null);
    setContractForm(defaultContractForm);
    setContractUpgradeForm(defaultContractUpgradeForm);
  };

  const resetInvoiceList = () => {
    setInvoiceSearch("");
    setInvoiceStatusFilter("All");
    setInvoicePage(1);
    setInvoicePageSize(10);
    setPayingInvoiceID(null);
    setPaymentForm(defaultPaymentForm);
  };

  const resetBuildingList = () => {
    setBuildingSearch("");
    setBuildingStatusFilter("All");
    setBuildingPage(1);
    setBuildingPageSize(10);
  };

  const resetUserList = () => {
    setUserPageMode("list");
    setUserSearch("");
    setUserPage(1);
    setUserPageSize(10);
  };

  const resetRoleList = () => {
    setRolePageMode("list");
    setRoleSearch("");
    setRolePage(1);
    setRolePageSize(10);
    setSelectedRole("");
  };

  const resetExpenseList = () => {
    setExpensePageMode("list");
    setExpenseSearch("");
    setExpensePage(1);
    setExpensePageSize(10);
  };

  const resetPaymentList = () => {
    setPaymentSearch("");
    setPaymentTenantFilter("All");
    setPaymentUnitFilter("All");
    setPaymentMethodFilter("All");
    setPaymentInvoiceFilter("All");
    setPaymentDateFrom("");
    setPaymentDateTo("");
    setPaymentPage(1);
    setPaymentPageSize(10);
    setPaymentTenantID("");
    setPaymentForm(defaultPaymentForm);
  };

  const showView = (nextView: View) => {
    setFormError("");
    if (nextView === "buildings") {
      resetBuildingList();
      goTo("/buildings");
    }
    if (nextView === "units") {
      resetUnitList();
      setRentUnitID(null);
      goTo("/units");
    }
    if (nextView === "tenants") {
      resetTenantList();
      setEditingTenantID(null);
      setTenantForm(defaultTenantForm);
      goTo("/tenants");
    }
    if (nextView === "contracts") {
      resetContractList();
      goTo("/contracts");
    }
    if (nextView === "invoices") {
      resetInvoiceList();
      goTo("/invoices");
    }
    if (nextView === "payments") {
      resetPaymentList();
      goTo("/payments");
    }
    setView(nextView);
  };

  const today = new Date();
  const daysUntil = (date: string) =>
    Math.ceil(
      (new Date(`${dateOnly(date)}T00:00:00`).getTime() - today.getTime()) / 86400000,
    );
  const scopedContracts = contracts.filter(
    (contract) =>
      selectedBuildingID === "hq" ||
      contract.building_id === Number(selectedBuildingID),
  );
  const activeContracts = scopedContracts.filter(
    (contract) => contract.status === "Active",
  );
  const expiring7 = activeContracts.filter(
    (contract) =>
      daysUntil(contract.end_date) >= 0 && daysUntil(contract.end_date) <= 7,
  );
  const expiring30 = activeContracts.filter(
    (contract) =>
      daysUntil(contract.end_date) >= 0 && daysUntil(contract.end_date) <= 30,
  );
  const expiredContracts = scopedContracts.filter(
    (contract) =>
      contract.end_date &&
      daysUntil(contract.end_date) < 0 &&
      contract.status !== "Cancelled",
  );
  const scopedInvoices = invoices.filter(
    (invoice) =>
      selectedBuildingID === "hq" ||
      invoice.building_id === Number(selectedBuildingID),
  );
  const unpaidInvoices = scopedInvoices.filter(
    (invoice) =>
      invoice.status === "Pending" ||
      invoice.status === "Partially Paid" ||
      invoice.status === "Overdue",
  );
  const scopedPayments = payments.filter(
    (payment) =>
      selectedBuildingID === "hq" ||
      payment.building_id === Number(selectedBuildingID),
  );
  const paymentsToday = scopedPayments.filter(
    (payment) => payment.payment_date === today.toISOString().slice(0, 10),
  );
  const totalContractRent = activeContracts.reduce(
    (total, contract) => total + contract.monthly_rent,
    0,
  );
  const totalInvoiced = scopedInvoices.reduce(
    (total, invoice) => total + invoice.amount,
    0,
  );
  const totalPaid = scopedPayments.reduce(
    (total, payment) => total + payment.amount,
    0,
  );
  const totalOutstanding = Math.max(0, totalInvoiced - totalPaid);
  const branchCards = buildings.map((building) => {
    const branchContracts = contracts.filter(
      (contract) => String(contract.building_id) === String(building.id),
    );
    const branchInvoices = invoices.filter(
      (invoice) => String(invoice.building_id) === String(building.id),
    );
    return {
      building,
      active: branchContracts.filter((contract) => contract.status === "Active")
        .length,
      expiring7: branchContracts.filter(
        (contract) =>
          contract.status === "Active" &&
          daysUntil(contract.end_date) >= 0 &&
          daysUntil(contract.end_date) <= 7,
      ).length,
      expiring30: branchContracts.filter(
        (contract) =>
          contract.status === "Active" &&
          daysUntil(contract.end_date) >= 0 &&
          daysUntil(contract.end_date) <= 30,
      ).length,
      expired: branchContracts.filter(
        (contract) =>
          contract.end_date &&
          daysUntil(contract.end_date) < 0 &&
          contract.status !== "Cancelled",
      ).length,
      unpaid: branchInvoices.filter(
        (invoice) =>
          invoice.status !== "Paid" && invoice.status !== "Cancelled",
      ).length,
    };
  });

  const switchBuilding = (buildingID: string) => {
    setSelectedBuildingID(buildingID);
    setView("home");
  };

  const openReport = (mode: ReportMode) => {
    setReportMode(mode);
    setView("reports");
    const pathByMode: Record<ReportMode, string> = {
      tenants: "/reports/tenants",
      transactions: "/reports/transactions",
      expenses: "/reports/expenses",
      cashflow: "/reports/cash-flow",
      rent: "/reports/monthly-rent",
    };
    goTo(pathByMode[mode]);
  };

  const reportLinks = (
    <div className="nav-subgroup">
      <button className={`nav-sublink ${view === "reports" && reportMode === "tenants" ? "active" : ""}`} type="button" onClick={() => openReport("tenants")}>{selectedBuildingID === "hq" ? "All tenants" : "Tenant statement"}</button>
      <button className={`nav-sublink ${view === "reports" && reportMode === "transactions" ? "active" : ""}`} type="button" onClick={() => openReport("transactions")}>Transaction statement</button>
      <button className={`nav-sublink ${view === "reports" && reportMode === "expenses" ? "active" : ""}`} type="button" onClick={() => openReport("expenses")}>Expenses statement</button>
      <button className={`nav-sublink ${view === "reports" && reportMode === "cashflow" ? "active" : ""}`} type="button" onClick={() => openReport("cashflow")}>Cash flow statement</button>
      <button className={`nav-sublink ${view === "reports" && reportMode === "rent" ? "active" : ""}`} type="button" onClick={() => openReport("rent")}>Monthly rent report</button>
    </div>
  );

  return (
    <main className="page-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <span>
            Masco<span className="brand-muted">Rent</span>
          </span>
        </div>
        <p className="user-name">{session.user.full_name}</p>
        <nav className="nav">
          <button
            className={`nav-link ${view === "home" ? "active" : ""}`}
            onClick={() => showView("home")}
          >
            Home
          </button>
          {selectedBuildingID === "hq" ? (
            <>
              <button
                className={`nav-link ${view === "buildings" ? "active" : ""}`}
                onClick={() => showView("buildings")}
              >
                Buildings
              </button>
              <div className="nav-group">
                <button
                  className={`nav-link nav-group-toggle ${view === "registration" ? "active" : ""}`}
                  type="button"
                  onClick={() => setRegistrationNavOpen((open) => !open)}
                >
                  Registration
                  <span className={`nav-chevron ${registrationNavOpen ? "open" : ""}`}>▾</span>
                </button>
                {registrationNavOpen && (
                  <div className="nav-subgroup">
                    <button
                      className={`nav-sublink ${view === "registration" && registrationTab === "users" ? "active" : ""}`}
                      type="button"
                      onClick={() => {
                        resetUserList();
                        setRegistrationTab("users");
                        showView("registration");
                      }}
                    >
                      Users
                    </button>
                    <button
                      className={`nav-sublink ${view === "registration" && registrationTab === "roles" ? "active" : ""}`}
                      type="button"
                      onClick={() => {
                        resetRoleList();
                        setRegistrationTab("roles");
                        showView("registration");
                      }}
                    >
                      Roles &amp; permissions
                    </button>
                    <button
                      className={`nav-sublink ${view === "registration" && registrationTab === "expenses" ? "active" : ""}`}
                      type="button"
                      onClick={() => {
                        resetExpenseList();
                        setRegistrationTab("expenses");
                        showView("registration");
                      }}
                    >
                      Expense categories
                    </button>
                  </div>
                )}
              </div>
              <div className="nav-group">
                <button
                  className={`nav-link nav-group-toggle ${view === "reports" ? "active" : ""}`}
                  type="button"
                  onClick={() => setReportsNavOpen((open) => !open)}
                >
                  Reports
                  <span className={`nav-chevron ${reportsNavOpen ? "open" : ""}`}>▾</span>
                </button>
                {reportsNavOpen && reportLinks}
              </div>
            </>
          ) : (
            <>
              <button
                className={`nav-link ${view === "units" ? "active" : ""}`}
                onClick={() => showView("units")}
              >
                Units
              </button>
              <button
                className={`nav-link ${view === "tenants" ? "active" : ""}`}
                onClick={() => showView("tenants")}
              >
                Tenants
              </button>
              <button
                className={`nav-link ${view === "contracts" ? "active" : ""}`}
                onClick={() => showView("contracts")}
              >
                Contracts
              </button>
              <button
                className={`nav-link ${view === "invoices" ? "active" : ""}`}
                onClick={() => showView("invoices")}
              >
                Invoices
              </button>
              <button
                className={`nav-link ${view === "payments" ? "active" : ""}`}
                onClick={() => showView("payments")}
              >
                Payments
              </button>
              <div className="nav-group">
                <button
                  className={`nav-link nav-group-toggle ${view === "reports" ? "active" : ""}`}
                  type="button"
                  onClick={() => setReportsNavOpen((open) => !open)}
                >
                  Reports
                  <span className={`nav-chevron ${reportsNavOpen ? "open" : ""}`}>▾</span>
                </button>
                {reportsNavOpen && reportLinks}
              </div>
            </>
          )}
          <button
            className={`nav-link ${view === "settings" ? "active" : ""}`}
            onClick={() => showView("settings")}
          >
            Settings
          </button>
        </nav>
        <button
          className="logout-button"
          type="button"
          onClick={() => void handleLogout()}
        >
          Sign out
        </button>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {selectedBuilding ? selectedBuilding.code : "All buildings"}
            </p>
            <h1>{pageTitle[view]}</h1>
          </div>
          <label className="building-switcher">
            Portfolio context
            <select
              value={selectedBuildingID}
              onChange={(event) => switchBuilding(event.target.value)}
            >
              <option value="hq">HQ - all buildings</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </label>
        </header>

        {view === "home" && !selectedBuilding && (
          <div className="hq-dashboard">
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">HQ / Administration</p>
                <h2>ADMINISTRATION OWNER UPDATES - ALL BUILDINGS</h2>
              </div>
              <span className="updated-date">
                Updated: {today.toLocaleDateString("en-GB")}
              </span>
            </div>
            <div className="stats-grid dashboard-stats">
              <div className="stat-card">
                <span>Active contracts</span>
                <strong>{activeContracts.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expiring 7 days</span>
                <strong>{expiring7.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expiring 30 days</span>
                <strong>{expiring30.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expired in progress</span>
                <strong>{expiredContracts.length}</strong>
              </div>
              <div className="stat-card">
                <span>Unpaid active</span>
                <strong>{unpaidInvoices.length}</strong>
              </div>
              <div className="stat-card">
                <span>Payments today</span>
                <strong>{paymentsToday.length}</strong>
              </div>
            </div>
            <div className="amount-summary">
              <div>
                <span>Expected rent</span>
                <strong>{formatAmount(totalContractRent)}</strong>
              </div>
              <div>
                <span>Invoiced</span>
                <strong>{formatAmount(totalInvoiced)}</strong>
              </div>
              <div>
                <span>Collected</span>
                <strong>{formatAmount(totalPaid)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>{formatAmount(totalOutstanding)}</strong>
              </div>
            </div>
            <div className="hq-section-heading">
              <div>
                <p className="eyebrow">Portfolio directory</p>
                <h2>Branches at a glance</h2>
              </div>
              <span>Choose a branch to enter its workspace</span>
            </div>
            <div className="branch-grid">
              {branchCards.map((branch) => (
                <button
                  className="branch-card"
                  key={branch.building.id}
                  onClick={() => switchBuilding(String(branch.building.id))}
                >
                  <span>BRANCH: {branch.building.code}</span>
                  <strong>{branch.active} active</strong>
                  <small>
                    {branch.expiring30} expiring in 30d · {branch.expired}{" "}
                    expired · {branch.unpaid} unpaid
                  </small>
                </button>
              ))}
            </div>
          </div>
        )}
        {view === "home" && selectedBuilding && (
          <div className="branch-dashboard">
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">
                  Branch dashboard · {selectedBuilding.code}
                </p>
                <h2>OWNER UPDATES - {selectedBuilding.name}</h2>
              </div>
              <span className="updated-date">
                Updated: {today.toLocaleDateString("en-GB")}
              </span>
            </div>
            <div className="stats-grid dashboard-stats">
              <div className="stat-card">
                <span>Active contracts</span>
                <strong>{activeContracts.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expiring 7 days</span>
                <strong>{expiring7.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expiring 30 days</span>
                <strong>{expiring30.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expired in progress</span>
                <strong>{expiredContracts.length}</strong>
              </div>
              <div className="stat-card">
                <span>Unpaid active</span>
                <strong>{unpaidInvoices.length}</strong>
              </div>
              <div className="stat-card">
                <span>Payments today</span>
                <strong>{paymentsToday.length}</strong>
              </div>
            </div>
            <div className="amount-summary">
              <div>
                <span>Expected rent</span>
                <strong>{formatAmount(totalContractRent)}</strong>
              </div>
              <div>
                <span>Invoiced</span>
                <strong>{formatAmount(totalInvoiced)}</strong>
              </div>
              <div>
                <span>Collected</span>
                <strong>{formatAmount(totalPaid)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>{formatAmount(totalOutstanding)}</strong>
              </div>
            </div>
            <div className="dashboard-columns">
              <div className="panel table-panel">
                <div className="section-heading">
                  <h2>Contracts to expire</h2>
                  <span>Next 30 days</span>
                </div>
                {expiring30.length === 0 ? (
                  <p className="empty-state">
                    No contracts expiring in next 30 days.
                  </p>
                ) : (
                  expiring30.map((contract) => (
                    <div className="dashboard-row" key={contract.id}>
                      <strong>{contract.tenant_id}</strong>
                      <span>{contract.unit_id}</span>
                      <span>{dateOnly(contract.end_date)}</span>
                      <button
                        className="row-action"
                        onClick={() => showView("contracts")}
                      >
                        View / Pay
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="panel table-panel">
                <div className="section-heading">
                  <h2>Expired contracts</h2>
                  <span>{expiredContracts.length} records</span>
                </div>
                {expiredContracts.length === 0 ? (
                  <p className="empty-state">No expired contracts.</p>
                ) : (
                  expiredContracts.map((contract) => (
                    <div className="dashboard-row" key={contract.id}>
                      <strong>{contract.tenant_id}</strong>
                      <span>{contract.unit_id}</span>
                      <span>{dateOnly(contract.end_date)}</span>
                      <button
                        className="row-action"
                        onClick={() => showView("contracts")}
                      >
                        View
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="panel table-panel">
                <div className="section-heading">
                  <h2>Unpaid active contracts</h2>
                  <span>Balance due</span>
                </div>
                {unpaidInvoices.length === 0 ? (
                  <p className="empty-state">No unpaid active contracts.</p>
                ) : (
                  unpaidInvoices.map((invoice) => (
                    <div className="dashboard-row" key={invoice.id}>
                      <strong>{invoice.number}</strong>
                      <span>{invoice.status}</span>
                      <span>{formatAmount(invoice.amount)}</span>
                      <button
                        className="row-action"
                        onClick={() => showView("payments")}
                      >
                        Pay
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="panel table-panel">
                <div className="section-heading">
                  <h2>Payments today</h2>
                  <span>Total: {paymentsToday.length}</span>
                </div>
                {paymentsToday.length === 0 ? (
                  <p className="empty-state">No payments today.</p>
                ) : (
                  paymentsToday.map((payment) => (
                    <div className="dashboard-row" key={payment.id}>
                      <strong>{payment.payment_reference}</strong>
                      <span>{payment.payment_method}</span>
                      <span>{formatAmount(payment.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {view === "registration" && (
          <div className="registration-layout">
            <div className="registration-intro">
              <p className="eyebrow">Administration</p>
              <h2>System registration</h2>
              <p>
                Manage users, roles, and the shared catalogs used across every
                building.
              </p>
            </div>
            {registrationTab === "users" && (
              <div className={`panel-grid users-workspace ${userPageMode}`}>
                {userPageMode === "list" && (
                  <button
                    className="secondary-button users-add-button"
                    type="button"
                    onClick={() => setUserPageMode("create")}
                  >
                    + Register user
                  </button>
                )}
                {userPageMode === "create" && (
                  <form className="panel form-panel" onSubmit={handleCreateUser}>
                    <div className="section-heading">
                      <h2>Register user</h2>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setUserPageMode("list")}
                      >
                        Back to list
                      </button>
                    </div>
                    <label>
                      Full name
                      <input
                        value={newUserForm.full_name}
                        onChange={(event) =>
                          setNewUserForm((current) => ({
                            ...current,
                            full_name: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Username
                      <input
                        value={newUserForm.username}
                        onChange={(event) =>
                          setNewUserForm((current) => ({
                            ...current,
                            username: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={newUserForm.email}
                        onChange={(event) =>
                          setNewUserForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Temporary password
                      <input
                        type="password"
                        minLength={8}
                        value={newUserForm.password}
                        onChange={(event) =>
                          setNewUserForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Register user
                    </button>
                  </form>
                )}
                <div className="panel list-panel">
                  <div className="section-heading">
                    <h2>Users and access</h2>
                    <span>{filteredAdminUsers.length} entries</span>
                  </div>
                  <div className="unit-toolbar users-toolbar">
                    <input
                      value={userSearch}
                      onChange={(event) => {
                        setUserSearch(event.target.value);
                        setUserPage(1);
                      }}
                      placeholder="Search name, username, email"
                    />
                    <select
                      value={userPageSize}
                      onChange={(event) => {
                        setUserPageSize(Number(event.target.value));
                        setUserPage(1);
                      }}
                    >
                      <option value="10">10 entries</option>
                      <option value="25">25 entries</option>
                      <option value="50">50 entries</option>
                    </select>
                  </div>
                  <div className="unit-table-wrap">
                    <table className="unit-table">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Name</th>
                          <th>Username</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Roles</th>
                          <th>Assign role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAdminUsers.length === 0 ? (
                          <tr>
                            <td colSpan={7}>No users match these filters.</td>
                          </tr>
                        ) : (
                          visibleAdminUsers.map((user, index) => (
                            <tr key={user.id}>
                              <td>{(userPage - 1) * userPageSize + index + 1}</td>
                              <td>{user.full_name}</td>
                              <td>
                                <span className="code-tag">{user.username}</span>
                              </td>
                              <td>{user.email}</td>
                              <td>
                                <select
                                  value={user.status}
                                  onChange={(event) =>
                                    void updateUserStatus(user.id, event.target.value)
                                  }
                                >
                                  <option>Active</option>
                                  <option>Inactive</option>
                                  <option>Suspended</option>
                                </select>
                              </td>
                              <td>
                                {user.roles.length
                                  ? user.roles.join(", ")
                                  : "No role assigned"}
                              </td>
                              <td>
                                <select
                                  defaultValue=""
                                  onChange={(event) => {
                                    if (event.target.value)
                                      void assignUserRole(
                                        user.id,
                                        event.target.value,
                                      );
                                  }}
                                >
                                  <option value="">Assign role</option>
                                  {roles.map((role) => (
                                    <option key={role}>{role}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination">
                    <span>
                      Showing{" "}
                      {visibleAdminUsers.length
                        ? (userPage - 1) * userPageSize + 1
                        : 0}{" "}
                      to{" "}
                      {Math.min(userPage * userPageSize, filteredAdminUsers.length)}{" "}
                      of {filteredAdminUsers.length}
                    </span>
                    <div>
                      <button
                        type="button"
                        disabled={userPage === 1}
                        onClick={() => setUserPage((page) => page - 1)}
                      >
                        Previous
                      </button>
                      <strong>{userPage}</strong>
                      <button
                        type="button"
                        disabled={userPage >= userPageCount}
                        onClick={() => setUserPage((page) => page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {registrationTab === "roles" && (
              <div className={`panel-grid roles-workspace ${rolePageMode}`}>
                {rolePageMode === "list" && (
                  <button
                    className="secondary-button roles-add-button"
                    type="button"
                    onClick={() => setRolePageMode("create")}
                  >
                    + Add role
                  </button>
                )}
                {rolePageMode === "create" && (
                  <form className="panel form-panel" onSubmit={handleCreateRole}>
                    <div className="section-heading">
                      <h2>Add role</h2>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setRolePageMode("list")}
                      >
                        Back to list
                      </button>
                    </div>
                    <label>
                      Role name
                      <input
                        value={newRoleName}
                        onChange={(event) => setNewRoleName(event.target.value)}
                        placeholder="Supervisor"
                        required
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Save role
                    </button>
                  </form>
                )}
                {rolePageMode === "permissions" && (
                  <div className="panel form-panel permissions-panel">
                    <div className="section-heading">
                      <h2>Permissions · {selectedRole}</h2>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setRolePageMode("list")}
                      >
                        Back to list
                      </button>
                    </div>
                    <div className="permission-list">
                      {permissions.map((permission) => (
                        <label className="permission-toggle" key={permission}>
                          <input
                            type="checkbox"
                            checked={rolePermissions.includes(permission)}
                            onChange={(event) =>
                              void toggleRolePermission(permission, event.target.checked)
                            }
                          />
                          {permission.replaceAll("_", " ")}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="panel list-panel">
                  <div className="section-heading">
                    <h2>Roles</h2>
                    <span>{filteredRoles.length} entries</span>
                  </div>
                  <div className="unit-toolbar roles-toolbar">
                    <input
                      value={roleSearch}
                      onChange={(event) => {
                        setRoleSearch(event.target.value);
                        setRolePage(1);
                      }}
                      placeholder="Search role"
                    />
                    <select
                      value={rolePageSize}
                      onChange={(event) => {
                        setRolePageSize(Number(event.target.value));
                        setRolePage(1);
                      }}
                    >
                      <option value="10">10 entries</option>
                      <option value="25">25 entries</option>
                      <option value="50">50 entries</option>
                    </select>
                  </div>
                  <div className="unit-table-wrap">
                    <table className="unit-table">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Role</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRoles.length === 0 ? (
                          <tr>
                            <td colSpan={3}>No roles match these filters.</td>
                          </tr>
                        ) : (
                          visibleRoles.map((role, index) => (
                            <tr key={role}>
                              <td>{(rolePage - 1) * rolePageSize + index + 1}</td>
                              <td>
                                <span className="code-tag">{role}</span>
                              </td>
                              <td>
                                <button
                                  className="table-action edit"
                                  type="button"
                                  onClick={() => manageRolePermissions(role)}
                                >
                                  Manage permissions
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination">
                    <span>
                      Showing{" "}
                      {visibleRoles.length ? (rolePage - 1) * rolePageSize + 1 : 0}{" "}
                      to {Math.min(rolePage * rolePageSize, filteredRoles.length)}{" "}
                      of {filteredRoles.length}
                    </span>
                    <div>
                      <button
                        type="button"
                        disabled={rolePage === 1}
                        onClick={() => setRolePage((page) => page - 1)}
                      >
                        Previous
                      </button>
                      <strong>{rolePage}</strong>
                      <button
                        type="button"
                        disabled={rolePage >= rolePageCount}
                        onClick={() => setRolePage((page) => page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {registrationTab === "expenses" && (
              <div className={`panel-grid expenses-workspace ${expensePageMode}`}>
                {expensePageMode === "list" && (
                  <button
                    className="secondary-button expenses-add-button"
                    type="button"
                    onClick={() => setExpensePageMode("create")}
                  >
                    + Add category
                  </button>
                )}
                {expensePageMode === "create" && (
                  <form className="panel form-panel" onSubmit={handleExpenseCategorySubmit}>
                    <div className="section-heading">
                      <h2>Add expense category</h2>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setExpensePageMode("list")}
                      >
                        Back to list
                      </button>
                    </div>
                    <label>
                      Name
                      <input
                        value={expenseCategoryForm.name}
                        onChange={(event) =>
                          setExpenseCategoryForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Repairs and maintenance"
                        required
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Save category
                    </button>
                  </form>
                )}
                <div className="panel list-panel">
                  <div className="section-heading">
                    <h2>Expense categories</h2>
                    <span>{filteredExpenseCategories.length} entries</span>
                  </div>
                  <div className="unit-toolbar expenses-toolbar">
                    <input
                      value={expenseSearch}
                      onChange={(event) => {
                        setExpenseSearch(event.target.value);
                        setExpensePage(1);
                      }}
                      placeholder="Search category"
                    />
                    <select
                      value={expensePageSize}
                      onChange={(event) => {
                        setExpensePageSize(Number(event.target.value));
                        setExpensePage(1);
                      }}
                    >
                      <option value="10">10 entries</option>
                      <option value="25">25 entries</option>
                      <option value="50">50 entries</option>
                    </select>
                  </div>
                  <div className="unit-table-wrap">
                    <table className="unit-table">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleExpenseCategories.length === 0 ? (
                          <tr>
                            <td colSpan={2}>No expense categories match these filters.</td>
                          </tr>
                        ) : (
                          visibleExpenseCategories.map((category, index) => (
                            <tr key={category.id}>
                              <td>{(expensePage - 1) * expensePageSize + index + 1}</td>
                              <td>{category.name}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination">
                    <span>
                      Showing{" "}
                      {visibleExpenseCategories.length
                        ? (expensePage - 1) * expensePageSize + 1
                        : 0}{" "}
                      to{" "}
                      {Math.min(
                        expensePage * expensePageSize,
                        filteredExpenseCategories.length,
                      )}{" "}
                      of {filteredExpenseCategories.length}
                    </span>
                    <div>
                      <button
                        type="button"
                        disabled={expensePage === 1}
                        onClick={() => setExpensePage((page) => page - 1)}
                      >
                        Previous
                      </button>
                      <strong>{expensePage}</strong>
                      <button
                        type="button"
                        disabled={expensePage >= expensePageCount}
                        onClick={() => setExpensePage((page) => page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === "reports" && (
          <div className="reports-layout">
            <div className="registration-intro">
              <p className="eyebrow">Reports</p>
              <h2>{selectedBuildingID === "hq" ? "All buildings combined" : selectedBuilding?.name || "Building reports"}</h2>
              <p>
                {selectedBuildingID === "hq" ? "Portfolio-wide statements for administration and owner review." : "Building-level statements for daily property operations."}
              </p>
            </div>
            {reportMode === "tenants" && (
              <div className="panel list-panel report-panel">
                <div className="section-heading"><h2>{selectedBuildingID === "hq" ? "All tenants by building" : "Tenant statement"}</h2><span>{tenants.length} entries</span></div>
                <div className="unit-table-wrap"><table className="unit-table report-table"><thead><tr><th>No.</th><th>Tenant</th><th>Phone</th>{selectedBuildingID === "hq" && <th>Building</th>}<th>Units</th><th>Active contracts</th><th>Total rent</th></tr></thead><tbody>
                  {tenants.length === 0 ? <tr><td colSpan={selectedBuildingID === "hq" ? 7 : 6}>No tenants found.</td></tr> : tenants.map((tenant, index) => {
                    const tenantContracts = contracts.filter((contract) => String(contract.tenant_id) === String(tenant.id) && contract.status === "Active");
                    const tenantUnits = tenantContracts.map((contract) => units.find((unit) => String(unit.id) === String(contract.unit_id))?.number).filter(Boolean);
                    const building = buildings.find((item) => String(item.id) === String(tenant.building_id));
                    return <tr key={tenant.id}><td>{index + 1}</td><td>{tenant.full_name || tenant.company_name || "Unnamed tenant"}</td><td>{tenant.phone || "-"}</td>{selectedBuildingID === "hq" && <td>{building?.name || "-"}</td>}<td>{tenantUnits.length ? tenantUnits.join(", ") : "-"}</td><td>{tenantContracts.length}</td><td>{formatAmount(tenantContracts.reduce((total, contract) => total + contract.monthly_rent, 0))}</td></tr>;
                  })}
                </tbody></table></div>
              </div>
            )}
            {reportMode === "transactions" && (
              <div className="panel list-panel report-panel">
                <div className="section-heading"><h2>Transaction statement</h2><span>Total {formatAmount(scopedPayments.reduce((total, payment) => total + payment.amount, 0))}</span></div>
                <div className="unit-table-wrap"><table className="unit-table report-table"><thead><tr><th>No.</th><th>Date</th><th>Tenant</th><th>Unit</th><th>Invoice</th><th>Reference</th><th>Method</th><th>Amount</th></tr></thead><tbody>
                  {scopedPayments.length === 0 ? <tr><td colSpan={8}>No transactions recorded.</td></tr> : scopedPayments.map((payment, index) => { const tenant = tenants.find((item) => String(item.id) === String(payment.tenant_id)); const unit = units.find((item) => String(item.id) === String(payment.unit_id)); const invoice = invoices.find((item) => String(item.id) === String(payment.invoice_id)); return <tr key={payment.id}><td>{index + 1}</td><td>{dateOnly(payment.payment_date)}</td><td>{tenant?.full_name || tenant?.company_name || "-"}</td><td>{unit?.number || "-"}</td><td>{invoice?.number || payment.invoice_id}</td><td>{payment.payment_reference}</td><td>{payment.payment_method}</td><td>{formatAmount(payment.amount)}</td></tr>; })}
                </tbody></table></div>
              </div>
            )}
            {reportMode === "expenses" && (
              <div className="panel list-panel report-panel">
                <div className="section-heading"><h2>Expenses statement</h2><span>{expenseCategories.length} categories</span></div>
                <div className="unit-table-wrap"><table className="unit-table report-table"><thead><tr><th>No.</th><th>Category</th><th>Recorded amount</th></tr></thead><tbody>
                  {expenseCategories.length === 0 ? <tr><td colSpan={3}>No expense categories registered.</td></tr> : expenseCategories.map((category, index) => <tr key={category.id}><td>{index + 1}</td><td>{category.name}</td><td>{formatAmount(0)}</td></tr>)}
                </tbody><tfoot><tr><td colSpan={2}>Total expenses</td><td>{formatAmount(0)}</td></tr></tfoot></table></div>
              </div>
            )}
            {reportMode === "cashflow" && (
              <div className="panel list-panel report-panel">
                <div className="section-heading"><h2>Cash flow statement</h2><span>Net {formatAmount(totalPaid)}</span></div>
                <div className="unit-table-wrap"><table className="unit-table report-table"><thead><tr><th>Type</th><th>Description</th><th>Inflow</th><th>Outflow</th><th>Net</th></tr></thead><tbody><tr><td>Income</td><td>Rent and invoice payments</td><td>{formatAmount(totalPaid)}</td><td>{formatAmount(0)}</td><td>{formatAmount(totalPaid)}</td></tr><tr><td>Expense</td><td>Recorded expenses</td><td>{formatAmount(0)}</td><td>{formatAmount(0)}</td><td>{formatAmount(0)}</td></tr></tbody><tfoot><tr><td colSpan={2}>Net cash flow</td><td>{formatAmount(totalPaid)}</td><td>{formatAmount(0)}</td><td>{formatAmount(totalPaid)}</td></tr></tfoot></table></div>
              </div>
            )}
            {reportMode === "rent" && (
              <div className="panel list-panel report-panel">
                <div className="section-heading"><h2>Monthly rent report</h2><span>Total {formatAmount(totalContractRent)}</span></div>
                <div className="unit-table-wrap"><table className="unit-table report-table"><thead><tr><th>No.</th><th>Tenant</th><th>Unit</th><th>Start</th><th>End</th><th>Monthly rent</th><th>Status</th></tr></thead><tbody>
                  {scopedContracts.length === 0 ? <tr><td colSpan={7}>No contracts found.</td></tr> : scopedContracts.map((contract, index) => { const tenant = tenants.find((item) => String(item.id) === String(contract.tenant_id)); const unit = units.find((item) => String(item.id) === String(contract.unit_id)); return <tr key={contract.id}><td>{index + 1}</td><td>{tenant?.full_name || tenant?.company_name || "-"}</td><td>{unit?.number || "-"}</td><td>{dateOnly(contract.start_date)}</td><td>{dateOnly(contract.end_date)}</td><td>{formatAmount(contract.monthly_rent)}</td><td><span className={`table-status ${contract.status.toLowerCase()}`}>{contract.status}</span></td></tr>; })}
                </tbody><tfoot><tr><td colSpan={5}>Total monthly rent</td><td>{formatAmount(totalContractRent)}</td><td></td></tr></tfoot></table></div>
              </div>
            )}
          </div>
        )}

        {view === "buildings" && (
          <div className={`panel-grid buildings-workspace ${buildingPageMode}`}>
            {buildingPageMode === "list" && (
              <button
                className="secondary-button buildings-add-button"
                type="button"
                onClick={() => goTo("/buildings/new")}
              >
                + Add building
              </button>
            )}
            {buildingPageMode === "create" && (
              <form className="panel form-panel" onSubmit={handleSubmit}>
                <div className="section-heading">
                  <h2>Add building</h2>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setForm(defaultForm);
                      setFormError("");
                      goTo("/buildings");
                    }}
                  >
                    Back to list
                  </button>
                </div>
                <label>
                  Building name
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Mlimani Apartments"
                  />
                </label>
                <label>
                  Building code
                  <input
                    name="code"
                    value={form.code}
                    onChange={handleChange}
                    placeholder="MLM-01"
                  />
                </label>
                <label>
                  Address
                  <input
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Dar es Salaam"
                  />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Residential building"
                  />
                </label>
                <div className="inline-fields">
                  <label>
                    Floors
                    <input
                      type="number"
                      min="1"
                      name="floors"
                      value={form.floors}
                      onChange={handleChange}
                    />
                  </label>
                  <label>
                    Status
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                    >
                      <option>Active</option>
                      <option>Maintenance</option>
                      <option>Closed</option>
                    </select>
                  </label>
                </div>
                <button className="primary-button" type="submit">
                  Save building
                </button>
                {formError && <p className="form-error">{formError}</p>}
              </form>
            )}

            {buildingPageMode === "list" && (
              <div className="panel list-panel">
                <div className="section-heading">
                  <h2>Registered buildings</h2>
                  <span>{filteredBuildings.length} entries</span>
                </div>
                <div className="unit-toolbar building-toolbar">
                  <input
                    value={buildingSearch}
                    onChange={(event) => {
                      setBuildingSearch(event.target.value);
                      setBuildingPage(1);
                    }}
                    placeholder="Search name, code, address"
                  />
                  <select
                    value={buildingStatusFilter}
                    onChange={(event) => {
                      setBuildingStatusFilter(event.target.value);
                      setBuildingPage(1);
                    }}
                  >
                    <option value="All">All statuses</option>
                    <option>Active</option>
                    <option>Maintenance</option>
                    <option>Closed</option>
                  </select>
                  <select
                    value={buildingPageSize}
                    onChange={(event) => {
                      setBuildingPageSize(Number(event.target.value));
                      setBuildingPage(1);
                    }}
                  >
                    <option value="10">10 entries</option>
                    <option value="25">25 entries</option>
                    <option value="50">50 entries</option>
                  </select>
                </div>
                <div className="unit-table-wrap">
                  <table className="unit-table building-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Address</th>
                        <th>Floors</th>
                        <th>Description</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleBuildings.length === 0 ? (
                        <tr>
                          <td colSpan={7}>No buildings match these filters.</td>
                        </tr>
                      ) : (
                        visibleBuildings.map((building, index) => (
                          <tr key={building.id}>
                            <td>
                              {(buildingPage - 1) * buildingPageSize + index + 1}
                            </td>
                            <td>
                              <span className="code-tag">{building.code}</span>
                            </td>
                            <td>
                              <strong>{building.name}</strong>
                            </td>
                            <td>{building.address}</td>
                            <td>{building.floors} floors</td>
                            <td>{building.description || "-"}</td>
                            <td>
                              <span
                                className={`table-status ${building.status.toLowerCase()}`}
                              >
                                {building.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <span>
                    Showing{" "}
                    {visibleBuildings.length
                      ? (buildingPage - 1) * buildingPageSize + 1
                      : 0}{" "}
                    to{" "}
                    {Math.min(
                      buildingPage * buildingPageSize,
                      filteredBuildings.length,
                    )}{" "}
                    of {filteredBuildings.length}
                  </span>
                  <div>
                    <button
                      type="button"
                      disabled={buildingPage === 1}
                      onClick={() => setBuildingPage((page) => page - 1)}
                    >
                      Previous
                    </button>
                    <strong>{buildingPage}</strong>
                    <button
                      type="button"
                      disabled={buildingPage >= buildingPageCount}
                      onClick={() => setBuildingPage((page) => page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === "units" && (
          <div className={`panel-grid units-workspace ${unitPageMode}`}>
            {unitPageMode === "list" && (
              <button
                className="secondary-button units-add-button"
                type="button"
                onClick={() => goTo("/units/new")}
              >
                + Add unit(s)
              </button>
            )}
            {unitPageMode === "create" && (
              <form className="panel form-panel" onSubmit={handleUnitSubmit}>
                <div className="section-heading">
                  <h2>{editingUnitID ? "Edit unit" : "Add units"}</h2>
                  <div>
                    {!editingUnitID && <button className="secondary-button" type="button" onClick={addUnitRow}>+ Add row</button>}
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => { setEditingUnitID(null); goTo("/units"); }}
                    >
                      Back to list
                    </button>
                  </div>
                </div>
                <p className="empty-state">
                  {selectedBuilding
                    ? `Adding to ${selectedBuilding.name}`
                    : "Select a building context or choose a building below."}
                </p>
                {selectedBuildingID === "hq" && (
                  <label>
                    Building
                    <select
                      value={targetBuildingID}
                      onChange={(event) => setTargetBuildingID(event.target.value)}
                      required
                    >
                      <option value="">Select building</option>
                      {buildings.map((building) => (
                        <option key={building.id} value={building.id}>
                          {building.name} ({building.code})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="unit-entry-list">
                  {unitRows.map((row, rowIndex) => (
                    <div className="unit-entry-row" key={rowIndex}>
                      <input
                        value={row.number}
                        onChange={(event) =>
                          updateUnitRow(rowIndex, "number", event.target.value)
                        }
                        placeholder="Unit no."
                        required
                      />
                      <select
                        value={row.floor_id}
                        onChange={(event) =>
                          updateUnitRow(
                            rowIndex,
                            "floor_id",
                            event.target.value,
                          )
                        }
                      >
                        <option value="">Floor</option>
                        {floors.map((floor) => (
                          <option key={floor.id} value={floor.id}>
                            {floor.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.type}
                        onChange={(event) =>
                          updateUnitRow(rowIndex, "type", event.target.value)
                        }
                      >
                        <option>Residential</option>
                        <option>Commercial</option>
                        <option>Service</option>
                      </select>
                      <input
                        inputMode="decimal"
                        value={row.base_rent}
                        onChange={(event) =>
                          updateUnitRow(
                            rowIndex,
                            "base_rent",
                            formatAmount(event.target.value),
                          )
                        }
                        placeholder="Required rent"
                        required
                      />
                      <button
                        className="remove-row"
                        type="button"
                        onClick={() => removeUnitRow(rowIndex)}
                        aria-label="Remove row"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button className="primary-button" type="submit">{editingUnitID ? "Save changes" : "Save unit"}</button>
              </form>
            )}
            {unitPageMode === "rent" && (
              <form className="panel form-panel rent-panel" onSubmit={handleContractSubmit}>
                <div className="section-heading">
                  <h2>Rent unit</h2>
                  <button className="secondary-button" type="button" onClick={() => { setRentUnitID(null); goTo("/units"); }}>Back to list</button>
                </div>
                <p className="empty-state">{selectedBuilding?.name} · Unit {units.find((unit) => unit.id === rentUnitID)?.number}</p>
                <label>Tenant<select name="tenant_id" value={contractForm.tenant_id} onChange={handleContractChange} required><option value="">Select tenant</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name || tenant.company_name}</option>)}</select></label>
                <div className="inline-fields"><label>Start date<input type="date" name="start_date" value={contractForm.start_date} onChange={handleContractChange} required /></label><label>Period (months)<input type="number" min="1" name="period" value={contractForm.period} onChange={handleContractChange} required /></label></div>
                <div className="inline-fields"><label>End date<input type="date" value={calculatedEndDate} readOnly /></label><label>Required monthly rent<input inputMode="decimal" value={contractForm.monthly_rent} readOnly /></label></div>
                <div className="inline-fields"><label>Prepaid amount<input inputMode="decimal" name="prepaid_amount" value={contractForm.prepaid_amount} onChange={(event) => setContractForm((current) => ({ ...current, prepaid_amount: formatAmount(event.target.value) }))} /><small className="field-help">Amount paid now. Enter 0 when no payment is received.</small></label><label>Total amount<input value={formatAmount(totalRent)} readOnly /></label></div>
                <label>Balance<input value={formatAmount(balanceAmount)} readOnly /></label>
                <div className="inline-fields"><label>Payment method<select name="payment_method" value={contractForm.payment_method} onChange={handleContractChange}><option>Bank Transfer</option><option>Cash</option><option>Mobile Money</option><option>Cheque</option></select></label><label>Payment frequency<select name="payment_frequency" value={contractForm.payment_frequency} onChange={handleContractChange}><option>Monthly</option><option>Every 3 months</option><option>Every 6 months</option><option>Yearly</option></select></label></div>
                <label>Notes<textarea name="notes" value={contractForm.notes} onChange={handleContractChange} placeholder="Lease notes" /></label>
                <button className="primary-button" type="submit">Create contract</button>
              </form>
            )}
            <div className="panel list-panel">
              <div className="section-heading">
                <h2>
                  {selectedBuilding
                    ? `${selectedBuilding.name} units`
                    : "Units"}
                </h2>
                <span>{filteredUnits.length} entries</span>
              </div>
              <>
                <div className="unit-toolbar">
                  <input
                    value={unitSearch}
                    onChange={(event) => {
                      setUnitSearch(event.target.value);
                      setUnitPage(1);
                    }}
                    placeholder="Search room number"
                  />
                  <select
                    value={unitFloorFilter}
                    onChange={(event) => {
                      setUnitFloorFilter(event.target.value);
                      setUnitPage(1);
                    }}
                  >
                    <option value="All">All floors</option>
                    {floors.map((floor) => (
                      <option key={floor.id} value={floor.id}>
                        {floor.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={unitTypeFilter}
                    onChange={(event) => {
                      setUnitTypeFilter(event.target.value);
                      setUnitPage(1);
                    }}
                  >
                    <option value="All">All types</option>
                    <option>Residential</option>
                    <option>Commercial</option>
                    <option>Service</option>
                  </select>
                  <select
                    value={unitStatusFilter}
                    onChange={(event) => {
                      setUnitStatusFilter(event.target.value);
                      setUnitPage(1);
                    }}
                  >
                    <option value="All">All statuses</option>
                    <option>Vacant</option>
                    <option>Occupied</option>
                    <option>Reserved</option>
                    <option>Maintenance</option>
                  </select>
                  <select
                    value={unitPageSize}
                    onChange={(event) => {
                      setUnitPageSize(Number(event.target.value));
                      setUnitPage(1);
                    }}
                  >
                    <option value="10">10 entries</option>
                    <option value="25">25 entries</option>
                    <option value="50">50 entries</option>
                  </select>
                </div>
                <div className="unit-table-wrap">
                  <table className="unit-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Room No.</th>
                        {selectedBuildingID === "hq" && <th>Building</th>}
                        <th>Floor</th>
                        <th>Type</th>
                        <th>Required rent</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleUnits.length === 0 ? (
                        <tr>
                          <td colSpan={selectedBuildingID === "hq" ? 8 : 7}>No units match these filters.</td>
                        </tr>
                      ) : (
                        visibleUnits.map((unit, index) => (
                          <tr key={unit.id}>
                            <td>
                              {(unitPage - 1) * unitPageSize + index + 1}
                            </td>
                            <td>{unit.number}</td>
                            {selectedBuildingID === "hq" && (
                              <td>
                                {buildings.find(
                                  (b) => String(b.id) === String(unit.building_id),
                                )?.name || "-"}
                              </td>
                            )}
                            <td>
                              {floors.find(
                                (floor) =>
                                  String(floor.id) === String(unit.floor_id),
                              )?.name || "-"}
                            </td>
                            <td>
                              <span className="code-tag">{unit.type}</span>
                            </td>
                            <td>{formatAmount(unit.base_rent)}</td>
                            <td>
                              <span
                                className={`table-status ${unit.status.toLowerCase()}`}
                              >
                                {unit.status}
                              </span>
                            </td>
                            <td>
                              {unit.status === "Vacant" && <button className="table-action rent" type="button" onClick={() => rentUnit(unit)}>Rent</button>}
                              <button className="table-action edit" type="button" onClick={() => void editUnit(unit)}>Edit</button>
                              <button className="table-action delete" type="button" onClick={() => void deleteUnit(unit)}>Delete</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={selectedBuildingID === "hq" ? 5 : 4}>Total required rent</td>
                        <td>{formatAmount(filteredUnitsRentTotal)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="pagination">
                  <span>
                    Showing{" "}
                    {visibleUnits.length
                      ? (unitPage - 1) * unitPageSize + 1
                      : 0}{" "}
                    to{" "}
                    {Math.min(unitPage * unitPageSize, filteredUnits.length)}{" "}
                    of {filteredUnits.length}
                  </span>
                  <div>
                    <button
                      type="button"
                      disabled={unitPage === 1}
                      onClick={() => setUnitPage((page) => page - 1)}
                    >
                      Previous
                    </button>
                    <strong>{unitPage}</strong>
                    <button
                      type="button"
                      disabled={unitPage >= unitPageCount}
                      onClick={() => setUnitPage((page) => page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            </div>
          </div>
        )}

        {view === "tenants" && (
          <div className={`panel-grid tenants-workspace ${tenantPageMode}`}>
            {tenantPageMode === "invoice" && (
              <form className="panel form-panel proforma-panel" onSubmit={handleProformaSubmit}>
                <div className="section-heading">
                  <h2>Prepare proforma invoice</h2>
                  <button className="secondary-button" type="button" onClick={() => goTo("/tenants")}>
                    Back to tenants
                  </button>
                </div>
                <p className="empty-state">
                  Tenant: {tenants.find((tenant) => String(tenant.id) === proformaTenantID)?.full_name || tenants.find((tenant) => String(tenant.id) === proformaTenantID)?.company_name || "New tenant"}
                </p>
                <label>
                  Room
                  <select name="unit_id" value={proformaForm.unit_id} onChange={handleProformaChange} required>
                    <option value="">Choose room</option>
                    {units.filter((unit) => unit.status === "Vacant").map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.number}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Monthly price
                  <input value={proformaForm.unit_id ? formatAmount(units.find((unit) => String(unit.id) === proformaForm.unit_id)?.base_rent ?? 0) : ""} readOnly />
                </label>
                <label>
                  Entry date
                  <input type="date" name="start_date" value={proformaForm.start_date} onChange={handleProformaChange} required />
                </label>
                <label>
                  Period (months)
                  <input type="number" min="1" name="period" value={proformaForm.period} onChange={handleProformaChange} required />
                </label>
                <label>
                  Ending date
                  <input value={(() => { const start = new Date(`${proformaForm.start_date}T00:00:00`); const period = Math.max(1, Number(proformaForm.period) || 1); return proformaForm.start_date ? new Date(start.getFullYear(), start.getMonth() + period, start.getDate()).toISOString().slice(0, 10) : ""; })()} readOnly />
                </label>
                <label>
                  Total amount
                  <input value={formatAmount((units.find((unit) => String(unit.id) === proformaForm.unit_id)?.base_rent ?? 0) * (Number(proformaForm.period) || 1))} readOnly />
                </label>
                <label>
                  Prepaid amount
                  <input inputMode="decimal" name="prepaid_amount" value={proformaForm.prepaid_amount} onChange={handleProformaChange} />
                  <small className="field-help">If customer pays now, put amount here. (0 = no payment)</small>
                </label>
                <label>
                  Balance
                  <input value={formatAmount(Math.max(0, (units.find((unit) => String(unit.id) === proformaForm.unit_id)?.base_rent ?? 0) * (Number(proformaForm.period) || 1) - amountNumber(proformaForm.prepaid_amount)))} readOnly />
                </label>
                <label>
                  Date
                  <input type="date" name="issue_date" value={proformaForm.issue_date} onChange={handleProformaChange} required />
                </label>
                <button className="primary-button" type="submit">Generate invoice</button>
              </form>
            )}
            {tenantPageMode === "list" && (
              <button
                className="secondary-button tenants-add-button"
                type="button"
                onClick={() => goTo("/tenants/new")}
              >
                + Add tenant
              </button>
            )}
            {(tenantPageMode === "create" || tenantPageMode === "edit") && (
              <form className="panel form-panel" onSubmit={handleTenantSubmit}>
                <div className="section-heading">
                  <h2>{tenantPageMode === "edit" ? "Edit tenant" : "Add tenant"}</h2>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setEditingTenantID(null);
                      setTenantForm(defaultTenantForm);
                      goTo("/tenants");
                    }}
                  >
                    Back to list
                  </button>
                </div>
              <label>
                Tenant type
                <select
                  name="type"
                  value={tenantForm.type}
                  onChange={handleTenantChange}
                >
                  <option value="Person">Person</option>
                  <option value="Institution">Institution</option>
                </select>
              </label>
              {tenantForm.type === "Person" ? (
                <>
                  <label>
                    Full name
                    <input
                      name="full_name"
                      value={tenantForm.full_name}
                      onChange={handleTenantChange}
                      placeholder="Jane Doe"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Company name
                    <input
                      name="company_name"
                      value={tenantForm.company_name}
                      onChange={handleTenantChange}
                      placeholder="Alpha Logistics"
                    />
                  </label>
                  <label>
                    Contact person
                    <input
                      name="contact_person"
                      value={tenantForm.contact_person}
                      onChange={handleTenantChange}
                      placeholder="John Smith"
                    />
                  </label>
                </>
              )}
              <label>
                Phone
                <input
                  name="phone"
                  value={tenantForm.phone}
                  onChange={handleTenantChange}
                  placeholder="+255 700 000 001"
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  value={tenantForm.email}
                  onChange={handleTenantChange}
                  placeholder="tenant@example.com"
                />
              </label>
              <label>
                Address
                <textarea
                  name="address"
                  value={tenantForm.address}
                  onChange={handleTenantChange}
                  placeholder="Resident address"
                />
              </label>
              <label>
                ID / registration ref
                <input
                  name="id_number"
                  value={tenantForm.id_number}
                  onChange={handleTenantChange}
                  placeholder="NIN / Licence / Reg No"
                />
              </label>
              <button className="primary-button" type="submit">
                Save tenant
              </button>
              </form>
            )}

            <div className="panel list-panel">
              <div className="section-heading">
                <h2>Tenants</h2>
                <span>{filteredTenants.length} entries</span>
              </div>
              <div className="unit-toolbar tenant-toolbar">
                <input
                  value={tenantSearch}
                  onChange={(event) => {
                    setTenantSearch(event.target.value);
                    setTenantPage(1);
                  }}
                  placeholder="Search tenant"
                />
                <select
                  value={tenantTypeFilter}
                  onChange={(event) => {
                    setTenantTypeFilter(event.target.value);
                    setTenantPage(1);
                  }}
                >
                  <option value="All">All types</option>
                  <option>Person</option>
                  <option>Institution</option>
                </select>
                <select
                  value={tenantPageSize}
                  onChange={(event) => {
                    setTenantPageSize(Number(event.target.value));
                    setTenantPage(1);
                  }}
                >
                  <option value="10">10 entries</option>
                  <option value="25">25 entries</option>
                  <option value="50">50 entries</option>
                </select>
              </div>
              <div className="unit-table-wrap">
                <table className="unit-table tenant-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Rented units</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTenants.length === 0 ? (
                      <tr>
                        <td colSpan={7}>No tenants match these filters.</td>
                      </tr>
                    ) : (
                      visibleTenants.map((tenant, index) => (
                        <tr key={tenant.id}>
                          {(() => {
                            const rentedContracts = contracts
                              .filter((contract) => String(contract.tenant_id) === String(tenant.id))
                              .map((contract) => ({
                                contract,
                                unit: units.find((unit) => String(unit.id) === String(contract.unit_id)),
                              }))
                              .filter((item) => item.unit);
                            return (
                              <>
                          <td>{(tenantPage - 1) * tenantPageSize + index + 1}</td>
                          <td>{tenant.full_name || tenant.company_name || "Unnamed tenant"}</td>
                          <td><span className="code-tag">{tenant.type}</span></td>
                          <td>{tenant.phone || "-"}</td>
                          <td>{tenant.email || "-"}</td>
                          <td>
                            {rentedContracts.length ? rentedContracts.map(({ contract, unit }) => (
                              <button
                                className="contract-unit-link"
                                key={contract.id}
                                type="button"
                                title="Open contract"
                                onClick={() => void handleContractPreview(contract.id)}
                              >
                                {unit?.number}
                              </button>
                            )) : "None"}
                          </td>
                          <td>
                            <button className="table-action edit" type="button" onClick={() => editTenant(tenant)}>Edit</button>
                            <button className="table-action delete" type="button" onClick={() => void deleteTenant(tenant)} disabled={rentedContracts.length > 0}>Delete</button>
                          </td>
                              </>
                            );
                          })()}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  Showing {visibleTenants.length ? (tenantPage - 1) * tenantPageSize + 1 : 0} to {Math.min(tenantPage * tenantPageSize, filteredTenants.length)} of {filteredTenants.length}
                </span>
                <div>
                  <button
                    type="button"
                    disabled={tenantPage === 1}
                    onClick={() => setTenantPage((page) => page - 1)}
                  >
                    Previous
                  </button>
                  <strong>{tenantPage}</strong>
                  <button
                    type="button"
                    disabled={tenantPage >= tenantPageCount}
                    onClick={() => setTenantPage((page) => page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "contracts" && (
          <>
            <div className={`panel-grid contracts-workspace ${contractPageMode}`}>
              {contractPageMode === "list" && (
                <button className="secondary-button contracts-add-button" type="button" onClick={() => goTo("/contracts/new")}>
                  + Add contract
                </button>
              )}
              {contractPageMode === "upgrade" && (() => {
                const contract = contracts.find((item) => item.id === upgradingContractID);
                const unit = units.find((item) => String(item.id) === String(contract?.unit_id));
                const tenant = tenants.find((item) => String(item.id) === String(contract?.tenant_id));
                const period = Number(contractUpgradeForm.period) || 0;
                const currentEndDate = contract?.end_date ? new Date(`${dateOnly(contract.end_date)}T00:00:00`) : null;
                const endDate = currentEndDate && period ? new Date(currentEndDate.getFullYear(), currentEndDate.getMonth() + period, currentEndDate.getDate()).toISOString().slice(0, 10) : "";
                const addedAmount = (contract?.monthly_rent ?? 0) * period;
                return (
                  <form className="panel form-panel contract-upgrade-panel" onSubmit={handleContractUpgradeSubmit}>
                    <div className="upgrade-heading">
                      <h2>Upgrade tenant contract</h2>
                      <p>{tenant?.full_name || tenant?.company_name || "Tenant"} · Room {unit?.number || "-"}</p>
                    </div>
                    <div className="upgrade-form-grid">
                      <label><span>Room</span><input value={unit?.number || ""} readOnly /></label>
                      <label><span>Monthly price</span><input value={formatAmount(contract?.monthly_rent ?? 0)} readOnly /></label>
                      <label><span>Entry date</span><input value={dateOnly(contract?.start_date || "")} readOnly /></label>
                      <label><span>Current ending date</span><input value={dateOnly(contract?.end_date || "")} readOnly /></label>
                      <label><span>Add period (months)</span><select name="period" value={contractUpgradeForm.period} onChange={(event) => setContractUpgradeForm((current) => ({ ...current, period: event.target.value }))} required><option value="">Select months</option>{Array.from({ length: 24 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? "month" : "months"}</option>)}</select></label>
                      <label><span>New ending date</span><input value={endDate} placeholder="yyyy-mm-dd" readOnly /></label>
                      <label><span>Total amount (added)</span><input value={period ? formatAmount(addedAmount) : ""} readOnly /></label>
                      <label><span>Prepaid amount</span><span className="upgrade-control"><input inputMode="decimal" name="prepaid_amount" value={contractUpgradeForm.prepaid_amount} onChange={(event) => setContractUpgradeForm((current) => ({ ...current, prepaid_amount: formatAmount(event.target.value) }))} /><small className="field-help">0 = no payment</small></span></label>
                      <label><span>Balance</span><input value={formatAmount(Math.max(0, addedAmount - amountNumber(contractUpgradeForm.prepaid_amount)))} readOnly /></label>
                      <label><span>Date</span><input type="date" name="payment_date" value={contractUpgradeForm.payment_date} onChange={(event) => setContractUpgradeForm((current) => ({ ...current, payment_date: event.target.value }))} required /></label>
                    </div>
                    <div className="upgrade-actions"><button className="primary-button" type="submit">Save upgrade</button><button className="secondary-button" type="button" onClick={() => goTo("/contracts")}>Back</button></div>
                  </form>
                );
              })()}
              {contractPageMode === "document" && (
                <form className="panel form-panel signed-contract-panel" onSubmit={handleDocumentSubmit}>
                  <div className="section-heading">
                    <h2>Attach signed contract</h2>
                    <button className="secondary-button" type="button" onClick={() => goTo("/contracts")}>Back to list</button>
                  </div>
                  <p className="empty-state">
                    Contract for {tenants.find((tenant) => String(tenant.id) === String(contracts.find((contract) => String(contract.id) === documentContractID)?.tenant_id))?.full_name || tenants.find((tenant) => String(tenant.id) === String(contracts.find((contract) => String(contract.id) === documentContractID)?.tenant_id))?.company_name || "tenant"}
                  </p>
                  <label>
                    Document name
                    <input value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder="Signed lease agreement" />
                  </label>
                  <label>
                    PDF or Word file
                    <input type="file" required accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} />
                  </label>
                  <button className="primary-button" type="submit">Upload signed contract</button>
                </form>
              )}
              <form
                className="panel form-panel"
                onSubmit={handleContractSubmit}
              >
                <div className="section-heading"><h2>{contractPageMode === "edit" ? "Edit contract" : "Add contract"}</h2><button className="secondary-button" type="button" onClick={() => { setEditingContractID(null); setContractForm(defaultContractForm); goTo("/contracts"); }}>Back to list</button></div>
                <label>
                  Tenant
                  <select
                    name="tenant_id"
                    value={contractForm.tenant_id}
                    onChange={handleContractChange}
                    disabled={contractPageMode === "edit"}
                  >
                    <option value="">Select tenant</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.full_name || tenant.company_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Unit
                  <select
                    name="unit_id"
                    value={contractForm.unit_id}
                    onChange={handleContractChange}
                    disabled={contractPageMode === "edit"}
                  >
                    <option value="">Select unit</option>
                    {units.map((unit) => {
                      const building = buildings.find((b) => String(b.id) === String(unit.building_id));
                      return (
                        <option key={unit.id} value={unit.id}>
                          {unit.number} - {unit.type} {building ? `(${building.name})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <div className="inline-fields">
                  <label>
                    Contract type
                    <select
                      name="contract_type"
                      value={contractForm.contract_type}
                      onChange={handleContractChange}
                    >
                      <option>Residential</option>
                      <option>Commercial</option>
                      <option>Service</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      name="status"
                      value={contractForm.status}
                      onChange={handleContractChange}
                    >
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
                    <input
                      type="date"
                      name="start_date"
                      value={contractForm.start_date}
                      onChange={handleContractChange}
                    />
                  </label>
                  <label>
                    End date
                    <input
                      type="date"
                      name="end_date"
                      value={contractForm.end_date}
                      onChange={handleContractChange}
                    />
                  </label>
                </div>
                <label>
                  Monthly rent
                  <input
                    inputMode="decimal"
                    name="monthly_rent"
                    value={contractForm.monthly_rent}
                    onChange={(event) =>
                      setContractForm((current) => ({
                        ...current,
                        monthly_rent: formatAmount(event.target.value),
                      }))
                    }
                  />
                </label>
                {contractPageMode === "create" && (
                  <label>
                    Prepaid amount
                    <input
                      inputMode="decimal"
                      name="prepaid_amount"
                      value={contractForm.prepaid_amount}
                      onChange={(event) => setContractForm((current) => ({ ...current, prepaid_amount: formatAmount(event.target.value) }))}
                    />
                    <small className="field-help">Amount received now. Enter 0 when there is no prepayment.</small>
                  </label>
                )}
                <div className="inline-fields">
                  <label>
                    Payment method
                    <select
                      name="payment_method"
                      value={contractForm.payment_method}
                      onChange={handleContractChange}
                    >
                      <option>Bank Transfer</option>
                      <option>Cash</option>
                      <option>Mobile Money</option>
                      <option>Cheque</option>
                    </select>
                  </label>
                  <label>
                    Payment frequency
                    <select
                      name="payment_frequency"
                      value={contractForm.payment_frequency}
                      onChange={handleContractChange}
                    >
                      <option>Monthly</option>
                      <option>Every 3 months</option>
                      <option>Every 6 months</option>
                      <option>Yearly</option>
                    </select>
                  </label>
                </div>
                <label>
                  Utilities responsibility
                  <input
                    name="utility_responsibility"
                    value={contractForm.utility_responsibility}
                    onChange={handleContractChange}
                  />
                </label>
                <label>
                  Lease terms
                  <textarea
                    name="terms"
                    value={contractForm.terms}
                    onChange={handleContractChange}
                    placeholder="Use, care, renewal, and termination terms"
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    name="notes"
                    value={contractForm.notes}
                    onChange={handleContractChange}
                    placeholder="Contract notes"
                  />
                </label>
                <button className="primary-button" type="submit">
                  Save contract
                </button>
              </form>

              <div className="panel list-panel">
                <div className="section-heading"><h2>Contracts</h2><span>{filteredContracts.length} entries</span></div>
                <div className="unit-toolbar contract-toolbar">
                  <input value={contractSearch} onChange={(event) => { setContractSearch(event.target.value); setContractPage(1); }} placeholder="Search tenant or room" />
                  <select value={contractStatusFilter} onChange={(event) => { setContractStatusFilter(event.target.value); setContractPage(1); }}><option>All</option><option>Active</option><option>Expired</option><option>Cancelled</option><option>Draft</option></select>
                  <select value={contractPageSize} onChange={(event) => { setContractPageSize(Number(event.target.value)); setContractPage(1); }}><option value="10">10 entries</option><option value="25">25 entries</option><option value="50">50 entries</option></select>
                </div>
                <div className="unit-table-wrap"><table className="unit-table contract-table"><thead><tr><th>No.</th><th>Customer</th><th>Room</th><th>Type</th><th>Start</th><th>End</th><th>Time left</th><th>Price</th><th>Invoice</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                  {visibleContracts.length === 0 ? <tr><td colSpan={13}>No contracts match these filters.</td></tr> : visibleContracts.map((contract, index) => {
                    const tenant = tenants.find((item) => String(item.id) === String(contract.tenant_id));
                    const unit = units.find((item) => String(item.id) === String(contract.unit_id));
                    const invoice = invoices.find((item) => String(item.contract_id) === String(contract.id));
                    const paid = invoice ? payments.filter((item) => String(item.invoice_id) === String(invoice.id)).reduce((total, item) => total + item.amount, 0) : 0;
                    const balance = Math.max(0, (invoice?.amount ?? 0) - paid);
                    const remainingDays = contract.end_date ? daysUntil(contract.end_date) : null;
                    const timeLeft = contract.status === "Cancelled" ? "Terminated" : remainingDays === null ? "Open" : remainingDays < 0 ? "Expired" : remainingDays === 0 ? "Ends today" : `${remainingDays} days`;
                    return <tr key={contract.id}><td>{(contractPage - 1) * contractPageSize + index + 1}</td><td>{tenant?.full_name || tenant?.company_name || "Unknown tenant"}</td><td>{unit?.number || "-"}</td><td><span className="code-tag">{contract.contract_type}</span></td><td>{dateOnly(contract.start_date)}</td><td>{dateOnly(contract.end_date) || "-"}</td><td><span className={`time-left ${remainingDays !== null && remainingDays < 0 ? "expired" : ""}`}>{timeLeft}</span></td><td>{formatAmount(contract.monthly_rent)}</td><td>{formatAmount(invoice?.amount ?? 0)}</td><td>{formatAmount(paid)}</td><td>{formatAmount(balance)}</td><td><span className={`table-status ${contract.status.toLowerCase()}`}>{contract.status}</span></td><td><div className="contract-actions-grid"><button type="button" onClick={() => void handleContractView(contract.id)}>View</button><button type="button" onClick={() => editContract(contract)}>Edit</button><button type="button" onClick={() => void handleContractPreview(contract.id)}>Generated</button><button type="button" onClick={() => attachSignedContract(contract.id)}>Attach signed</button>{contract.status === "Active" && <><button type="button" onClick={() => payContractInvoice(contract.id)}>Pay</button><button type="button" onClick={() => upgradeContract(contract)}>Upgrade</button><button className="danger" type="button" onClick={() => void terminateContract(contract)}>Terminate</button></>}<button className="danger" type="button" onClick={() => void deleteContract(contract)}>Delete</button></div></td></tr>;
                  })}
                </tbody></table></div>
                <div className="pagination"><span>Showing {visibleContracts.length ? (contractPage - 1) * contractPageSize + 1 : 0} to {Math.min(contractPage * contractPageSize, filteredContracts.length)} of {filteredContracts.length}</span><div><button type="button" disabled={contractPage === 1} onClick={() => setContractPage((page) => page - 1)}>Previous</button><strong>{contractPage}</strong><button type="button" disabled={contractPage >= contractPageCount} onClick={() => setContractPage((page) => page + 1)}>Next</button></div></div>
              </div>
            </div>

          </>
        )}

        {view === "invoices" && (
          <div className={`invoices-workspace ${invoicePageMode}`}>
            {invoicePageMode === "payment" && (() => {
              const invoice = invoices.find((item) => String(item.id) === String(payingInvoiceID || paymentForm.invoice_id));
              const tenant = tenants.find((item) => String(item.id) === String(invoice?.tenant_id));
              const unit = units.find((item) => String(item.id) === String(invoice?.unit_id));
              const balance = invoice ? Math.max(0, invoice.amount - invoicePaidAmount(invoice.id)) : 0;
              return <form className="panel form-panel invoice-payment-panel" onSubmit={handlePaymentSubmit}>
                <div className="section-heading"><h2>Record invoice payment</h2><button className="secondary-button" type="button" onClick={() => { setPayingInvoiceID(null); setPaymentForm(defaultPaymentForm); goTo("/invoices"); }}>Back to invoices</button></div>
                <div className="payment-context">
                  <div><span>Customer</span><strong>{tenant?.full_name || tenant?.company_name || "-"}</strong></div>
                  <div><span>Unit</span><strong>{unit?.number || "-"}</strong></div>
                  <div><span>Invoice</span><strong>{invoice?.number || "-"}</strong></div>
                  <div><span>Balance</span><strong>{formatAmount(balance)}</strong></div>
                </div>
                <label>Amount received<input name="amount" inputMode="decimal" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: formatAmount(event.target.value) }))} required /></label>
                <div className="inline-fields"><label>Payment date<input name="payment_date" type="date" value={paymentForm.payment_date} onChange={handlePaymentChange} required /></label><label>Method<select name="payment_method" value={paymentForm.payment_method} onChange={handlePaymentChange}><option>Bank Transfer</option><option>Cash</option><option>Mobile Money</option><option>Card</option><option>Cheque</option></select></label></div>
                <label>Payment reference<input name="payment_reference" value={paymentForm.payment_reference} onChange={handlePaymentChange} placeholder="Bank or receipt reference" required /></label>
                <label>Receipt number<input name="receipt_number" value={paymentForm.receipt_number} onChange={handlePaymentChange} placeholder="Optional receipt number" /></label>
                <label>Notes<textarea name="notes" value={paymentForm.notes} onChange={handlePaymentChange} placeholder="Optional payment notes" /></label>
                <button className="primary-button" type="submit">Record payment</button>
              </form>;
            })()}
            {invoicePageMode === "list" && <div className="panel list-panel">
              <div className="section-heading"><h2>Invoices</h2><span>{filteredInvoices.length} entries</span></div>
              <div className="unit-toolbar invoice-toolbar">
                <input value={invoiceSearch} onChange={(event) => { setInvoiceSearch(event.target.value); setInvoicePage(1); }} placeholder="Search invoice, tenant, or room" />
                <select value={invoiceStatusFilter} onChange={(event) => { setInvoiceStatusFilter(event.target.value); setInvoicePage(1); }}><option>All</option><option>Pending</option><option>Partially Paid</option><option>Paid</option><option>Overdue</option><option>Cancelled</option></select>
                <select value={invoicePageSize} onChange={(event) => { setInvoicePageSize(Number(event.target.value)); setInvoicePage(1); }}><option value="10">10 entries</option><option value="25">25 entries</option><option value="50">50 entries</option></select>
              </div>
              <div className="unit-table-wrap">
                <table className="unit-table invoice-table">
                  <thead><tr><th>No.</th><th>Invoice ID</th><th>Tenant</th><th>Mobile</th><th>Room</th><th>Period</th><th>Monthly price</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {visibleInvoices.length === 0 ? <tr><td colSpan={12}>No invoices match these filters.</td></tr> : visibleInvoices.map((invoice, index) => {
                      const contract = contracts.find((item) => String(item.id) === String(invoice.contract_id));
                      const tenant = tenants.find((item) => String(item.id) === String(invoice.tenant_id));
                      const unit = units.find((item) => String(item.id) === String(invoice.unit_id));
                      const paid = invoicePaidAmount(invoice.id);
                      const balance = Math.max(0, invoice.amount - paid);
                      const status = balance === 0 ? "Paid" : paid > 0 ? "Partially Paid" : invoice.status;
                      return <tr key={invoice.id}><td>{(invoicePage - 1) * invoicePageSize + index + 1}</td><td>{invoice.number}</td><td>{tenant?.full_name || tenant?.company_name || "Unknown tenant"}</td><td>{tenant?.phone || "-"}</td><td>{unit?.number || "-"}</td><td><strong>{contract ? `${contractMonths(contract.start_date, contract.end_date)} month(s)` : "-"}</strong><small>{contract ? `${dateOnly(contract.start_date)} → ${dateOnly(contract.end_date)}` : dateOnly(invoice.issue_date)}</small></td><td>{formatAmount(contract?.monthly_rent || invoice.amount)}</td><td>{formatAmount(invoice.amount)}</td><td>{formatAmount(paid)}</td><td><strong>{formatAmount(balance)}</strong></td><td><span className={`invoice-status ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span></td><td><div className="invoice-actions">{balance > 0 ? <button type="button" onClick={() => payInvoice(invoice)}>Payment</button> : <button className="paid-action" type="button" onClick={() => void showInvoicePayments(invoice)}>Payments</button>}<button className="outline" type="button" onClick={() => viewInvoice(invoice)}>Invoice</button></div></td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
              <div className="pagination"><span>Showing {visibleInvoices.length ? (invoicePage - 1) * invoicePageSize + 1 : 0} to {Math.min(invoicePage * invoicePageSize, filteredInvoices.length)} of {filteredInvoices.length}</span><div><button type="button" disabled={invoicePage === 1} onClick={() => setInvoicePage((page) => page - 1)}>Previous</button><strong>{invoicePage}</strong><button type="button" disabled={invoicePage >= invoicePageCount} onClick={() => setInvoicePage((page) => page + 1)}>Next</button></div></div>
            </div>}
          </div>
        )}

        {view === "payments" && (
          <div className={`payments-workspace ${paymentPageMode}`}>
            {paymentPageMode === "list" && <button className="secondary-button payments-add-button" type="button" onClick={() => goTo("/payments/new")}>+ Record payment</button>}
            {paymentPageMode === "create" && <form className="panel form-panel payment-entry-panel" onSubmit={handlePaymentSubmit}>
              <div className="section-heading"><h2>Record payment</h2><button className="secondary-button" type="button" onClick={() => { setPaymentTenantID(""); setPaymentForm(defaultPaymentForm); goTo("/payments"); }}>Back to list</button></div>
              <label>
                Customer
                <select value={paymentTenantID} onChange={(event) => { setPaymentTenantID(event.target.value); setPaymentForm((current) => ({ ...current, invoice_id: "", amount: "" })); }} required>
                  <option value="">Select customer</option>
                  {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name || tenant.company_name}</option>)}
                </select>
              </label>
              <label>
                Invoice
                <select
                  name="invoice_id"
                  value={paymentForm.invoice_id}
                  onChange={handlePaymentChange}
                  required
                >
                  <option value="">Select invoice</option>
                  {invoices
                    .filter(
                      (invoice) =>
                        String(invoice.tenant_id) === paymentTenantID &&
                        invoice.status !== "Paid" &&
                        invoice.status !== "Cancelled" &&
                        invoicePaidAmount(invoice.id) < invoice.amount,
                    )
                    .map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.number} · {units.find((unit) => String(unit.id) === String(invoice.unit_id))?.number || "Unit"} · Balance {formatAmount(Math.max(0, invoice.amount - invoicePaidAmount(invoice.id)))}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Amount received
                <input
                  name="amount"
                  inputMode="decimal"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amount: formatAmount(event.target.value),
                    }))
                  }
                  required
                />
              </label>
              <div className="inline-fields">
                <label>
                  Payment date
                  <input
                    name="payment_date"
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={handlePaymentChange}
                    required
                  />
                </label>
                <label>
                  Method
                  <select
                    name="payment_method"
                    value={paymentForm.payment_method}
                    onChange={handlePaymentChange}
                  >
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Mobile Money</option>
                    <option>Card</option>
                    <option>Cheque</option>
                  </select>
                </label>
              </div>
              <label>
                Payment reference
                <input
                  name="payment_reference"
                  value={paymentForm.payment_reference}
                  onChange={handlePaymentChange}
                  placeholder="Bank or receipt reference"
                  required
                />
              </label>
              <label>
                Receipt number
                <input
                  name="receipt_number"
                  value={paymentForm.receipt_number}
                  onChange={handlePaymentChange}
                  placeholder="Optional receipt number"
                />
              </label>
              <label>
                Notes
                <textarea
                  name="notes"
                  value={paymentForm.notes}
                  onChange={handlePaymentChange}
                  placeholder="Optional payment notes"
                />
              </label>
              <button className="primary-button" type="submit">
                Record payment
              </button>
            </form>}
            {paymentPageMode === "list" && <div className="panel list-panel payment-ledger-panel">
              <div className="section-heading"><h2>Payment history</h2><span>{filteredPayments.length} entries · Total {formatAmount(filteredPaymentTotal)}</span></div>
              <div className="payment-filters">
                <input value={paymentSearch} onChange={(event) => { setPaymentSearch(event.target.value); setPaymentPage(1); }} placeholder="Search reference, customer, room" />
                <input type="date" value={paymentDateFrom} onChange={(event) => { setPaymentDateFrom(event.target.value); setPaymentPage(1); }} aria-label="From date" />
                <input type="date" value={paymentDateTo} onChange={(event) => { setPaymentDateTo(event.target.value); setPaymentPage(1); }} aria-label="To date" />
                <select value={paymentTenantFilter} onChange={(event) => { setPaymentTenantFilter(event.target.value); setPaymentPage(1); }}><option value="All">All customers</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name || tenant.company_name}</option>)}</select>
                <select value={paymentUnitFilter} onChange={(event) => { setPaymentUnitFilter(event.target.value); setPaymentPage(1); }}><option value="All">All units</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.number}</option>)}</select>
                <select value={paymentMethodFilter} onChange={(event) => { setPaymentMethodFilter(event.target.value); setPaymentPage(1); }}><option>All</option><option>Bank Transfer</option><option>Cash</option><option>Mobile Money</option><option>Card</option><option>Cheque</option></select>
                <select value={paymentInvoiceFilter} onChange={(event) => { setPaymentInvoiceFilter(event.target.value); setPaymentPage(1); }}><option value="All">All invoices</option>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number}</option>)}</select>
                <select value={paymentPageSize} onChange={(event) => { setPaymentPageSize(Number(event.target.value)); setPaymentPage(1); }}><option value="10">10 entries</option><option value="25">25 entries</option><option value="50">50 entries</option></select>
              </div>
              <div className="unit-table-wrap"><table className="unit-table payment-table"><thead><tr><th>No.</th><th>Date</th><th>Customer</th><th>Unit</th><th>Invoice</th><th>Reference</th><th>Method</th><th>Receipt</th><th>Amount</th></tr></thead><tbody>
                {visiblePayments.length === 0 ? <tr><td colSpan={9}>No payments match these filters.</td></tr> : visiblePayments.map((payment, index) => { const tenant = tenants.find((item) => String(item.id) === String(payment.tenant_id)); const unit = units.find((item) => String(item.id) === String(payment.unit_id)); const invoice = invoices.find((item) => String(item.id) === String(payment.invoice_id)); return <tr key={payment.id}><td>{(paymentPage - 1) * paymentPageSize + index + 1}</td><td>{dateOnly(payment.payment_date)}</td><td>{tenant?.full_name || tenant?.company_name || "Unknown customer"}</td><td>{unit?.number || "-"}</td><td>{invoice?.number || payment.invoice_id}</td><td>{payment.payment_reference}</td><td>{payment.payment_method}</td><td>{payment.receipt_number || "-"}</td><td><strong>{formatAmount(payment.amount)}</strong></td></tr>; })}
              </tbody><tfoot><tr><td colSpan={8}>Filtered total</td><td>{formatAmount(filteredPaymentTotal)}</td></tr></tfoot></table></div>
              <div className="pagination"><span>Showing {visiblePayments.length ? (paymentPage - 1) * paymentPageSize + 1 : 0} to {Math.min(paymentPage * paymentPageSize, filteredPayments.length)} of {filteredPayments.length}</span><div><button type="button" disabled={paymentPage === 1} onClick={() => setPaymentPage((page) => page - 1)}>Previous</button><strong>{paymentPage}</strong><button type="button" disabled={paymentPage >= paymentPageCount} onClick={() => setPaymentPage((page) => page + 1)}>Next</button></div></div>
            </div>}
          </div>
        )}

        {view === "settings" && (
          <div className="panel-grid">
            <form className="panel form-panel" onSubmit={handleProfileSubmit}>
              <h2>Profile</h2>
              <label>
                Full name
                <input
                  name="full_name"
                  value={profileForm.full_name}
                  onChange={handleProfileChange}
                  required
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  value={profileForm.email}
                  onChange={handleProfileChange}
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Save profile
              </button>
            </form>
            <form className="panel form-panel" onSubmit={handlePasswordSubmit}>
              <h2>Change password</h2>
              <label>
                Current password
                <input
                  name="current_password"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                New password
                <input
                  name="new_password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={handlePasswordChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <label>
                Confirm new password
                <input
                  name="confirm_password"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={handlePasswordChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Change password
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
